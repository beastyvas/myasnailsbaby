// SEO + content gate. Build first, then run:
//
//   npm run build:seo
//   npm run seo:check
//
// Any FAIL means something Google would see is broken. (It also still holds
// the content rules for content/guides/*.md, in case guides ever come back;
// with no guides folder that part is skipped.)
//
// It runs the real built site (`next start`, with placeholder keys — no
// secrets needed, nothing real is touched), crawls everything in sitemap.xml
// plus every internal link those pages contain, and checks what Google would
// actually see. Then it reads the guide markdown and applies the content rules
// from docs/SEO_ROUTINE.md.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.myasnailsbaby.com").trim().replace(/\/+$/, "");
const PORT = Number(process.env.SEO_CHECK_PORT || 4320);
const LOCAL = `http://127.0.0.1:${PORT}`;

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

if (!existsSync(".next/BUILD_ID")) {
  console.error("No build found — run `npm run build:seo` first.");
  process.exit(1);
}

// ── Start the built site ─────────────────────────────────────────────────────
// Placeholder keys on purpose: the check must give the same answer on any
// machine, and must never touch the real database, Stripe, or send a text.
const env = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: ORIGIN,
  PORT: String(PORT),
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "seo-check-placeholder",
};
for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "TEXTBELT_KEY", "TEXTBELT_API_KEY", "RESEND_API_KEY", "CRON_SECRET"])
  delete env[k];
// Something already answering on the port would be checked instead of this
// build — and pass or fail on stale pages. Refuse rather than guess.
try {
  await fetch(`${LOCAL}/robots.txt`);
  console.error(`Port ${PORT} is already in use — stop whatever is on it, or set SEO_CHECK_PORT.`);
  process.exit(1);
} catch {}
const server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
  detached: true, // own process group, so stopping it takes next-server down too
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
const stop = () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
};
process.on("exit", stop);

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${LOCAL}/robots.txt`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error("Site didn't start:\n" + serverLog);
  process.exit(1);
}
await waitUp();

const cache = new Map();
async function get(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(`${LOCAL}${path}`, { redirect: "manual" }).then(async (r) => ({
        status: r.status,
        headers: r.headers,
        body: r.status === 200 ? await r.text() : "",
      })),
    );
  }
  return cache.get(path);
}

const decode = (s) =>
  s
    ?.replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const pick = (html, re) => decode((html.match(re) || [])[1]);
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ");

// The suite number is private — it only goes out in the booking
// confirmation and reminder texts (utils/location.js). Read the real values
// so this keeps working if she moves again.
const locationSrc = readFileSync("utils/location.js", "utf8");
const UNITS = [...locationSrc.matchAll(/unit:\s*"([^"]+)"/g)].map((m) => m[1]);
const NEW_STREET = (locationSrc.match(/NEW_STUDIO = \{[\s\S]*?street:\s*"([^"]+)"/) || [])[1];

// ── Sitemap + robots ─────────────────────────────────────────────────────────
const robots = (await get("/robots.txt")).body;
if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) err(`robots.txt doesn't point at ${ORIGIN}/sitemap.xml`);
if (!robots.includes("Disallow: /api/")) err("robots.txt no longer disallows /api/");
if (!robots.includes("Allow: /api/og")) err("robots.txt must allow /api/og (the link-preview card)");
// Private pages must stay fetchable so Google can read their noindex.
for (const p of ["/login", "/dashboard", "/success", "/reschedule"])
  if (new RegExp(`^Disallow: ${p}\\b`, "m").test(robots)) err(`robots.txt blocks ${p} — it must be noindexed instead, not blocked`);

const sitemap = (await get("/sitemap.xml")).body;
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!listed.length) err("sitemap.xml lists no pages");
const toPath = (url) => {
  if (!url.startsWith(ORIGIN)) {
    err(`sitemap entry ${url} isn't on ${ORIGIN}`);
    return null;
  }
  return url.slice(ORIGIN.length) || "/";
};
const sitemapPaths = new Set(listed.map(toPath).filter(Boolean));
for (const p of ["/", "/services", "/henderson"]) if (!sitemapPaths.has(p)) err(`sitemap.xml is missing ${p}`);
for (const p of ["/login", "/dashboard", "/success", "/reschedule", "/cancel-appointment", "/Payment"])
  if (sitemapPaths.has(p)) err(`sitemap.xml lists private page ${p}`);

// ── Private pages stay out of the index ─────────────────────────────────────
for (const p of ["/login", "/reschedule", "/success"]) {
  const r = await get(p);
  if (!/noindex/.test(r.headers.get("x-robots-tag") || "")) err(`${p}: lost its X-Robots-Tag noindex header (next.config.js)`);
}

// ── Every page in the sitemap ────────────────────────────────────────────────
const titles = new Map();
const descs = new Map();
const linkTargets = new Map(); // target → first page that links to it

for (const path of sitemapPaths) {
  const res = await get(path);
  if (res.status !== 200) {
    err(`${path}: sitemap lists it but it returns ${res.status}`);
    continue;
  }
  const html = res.body;
  if (/<meta name="robots" content="[^"]*noindex/.test(html) || /noindex/.test(res.headers.get("x-robots-tag") || "")) {
    err(`${path}: in the sitemap but noindexed`);
    continue;
  }
  if (/localhost|127\.0\.0\.1|vercel\.app/.test(html.replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/g, "")))
    err(`${path}: points at a non-production address (localhost / vercel.app) — build with npm run build:seo`);

  const title = pick(html, /<title[^>]*>([^<]*)<\/title>/);
  const desc = pick(html, /<meta name="description" content="([^"]*)"/);
  const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/);
  const h1s = (html.match(/<h1[\s>]/g) || []).length;

  if (!title) err(`${path}: no <title>`);
  else {
    if (title.length > 70) warn(`${path}: title is ${title.length} chars (Google shows ~60–65)`);
    if (titles.has(title)) err(`${path}: same title as ${titles.get(title)}`);
    titles.set(title, path);
  }
  if (!desc) err(`${path}: no meta description`);
  else {
    if (desc.length < 70 || desc.length > 170) warn(`${path}: description is ${desc.length} chars (aim for 120–160)`);
    if (descs.has(desc)) err(`${path}: same description as ${descs.get(desc)}`);
    descs.set(desc, path);
  }
  const expected = `${ORIGIN}${path}`;
  if (!canonical) err(`${path}: no canonical`);
  else if (canonical.replace(/\/$/, "") !== expected.replace(/\/$/, "")) err(`${path}: canonical is ${canonical}, expected ${expected}`);
  if (h1s !== 1) err(`${path}: has ${h1s} <h1> elements (need exactly 1)`);
  if (!/<meta property="og:image"/.test(html)) warn(`${path}: no og:image`);

  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch {
      err(`${path}: invalid JSON-LD`);
    }
  }
  if (/<img(?![^>]*\balt=)[^>]*>/.test(html)) err(`${path}: an <img> has no alt attribute`);
  if (/<iframe(?![^>]*\btitle=)[^>]*>/.test(html)) err(`${path}: an <iframe> has no title attribute`);

  const text = visibleText(html);
  for (const u of UNITS) if (u && text.includes(u)) err(`${path}: shows the private suite number "${u}"`);
  if (NEW_STREET && path === "/henderson" && !text.includes(NEW_STREET)) err(`/henderson doesn't show the studio address (${NEW_STREET})`);

  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const t = m[1].replace(/\/$/, "") || "/";
    if (/^\/(api|_next)\b/.test(t) || /\.\w+$/.test(t)) continue;
    if (!linkTargets.has(t)) linkTargets.set(t, path);
  }
}

// Internal links must land on a real page, and anything indexable that people
// can reach should be in the sitemap too.
for (const [t, from] of linkTargets) {
  const r = await get(t);
  if (r.status >= 400) err(`${from}: broken internal link → ${t} (${r.status})`);
  else if (
    r.status === 200 &&
    !sitemapPaths.has(t) &&
    !/noindex/.test(r.body.match(/<meta name="robots"[^>]*>/)?.[0] || "") &&
    !/noindex/.test(r.headers.get("x-robots-tag") || "")
  )
    warn(`${t} is linked from ${from} but isn't in the sitemap`);
}

// ── Guide content rules (these protect auto-publishing) ──────────────────────
// Same parser as utils/guides.js.
function parseGuide(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`guides/${file}: missing its --- front matter ---`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return {
    ...meta,
    slug: meta.slug || file.replace(/\.md$/, ""),
    related: (meta.related || "").split(",").map((s) => s.trim().replace(/^\//, "")).filter(Boolean),
    body: m[2].trim(),
  };
}

const BANNED_WORDS = [
  "elevate", "seamless", "unlock", "delve", "game-changer", "game changer", "revolutioniz",
  "holy grail", "transformative", "in today's", "look no further", "pamper yourself", "glow up",
  "nail journey", "nestled", "treat yourself", "indulge",
];
// Nevada licenses nail technologists to care for healthy nails, not to treat
// conditions — and the FTC treats an unproven result as a deceptive ad.
// These are the shapes that cross either line.
const BANNED_CLAIMS = [
  [/\b(cures?|heals?|treats?|treating|fix(es)?|eliminates?|gets? rid of|prevents?) (your |the |a )?(nail )?(fungus|fungal|infections?|onychomycosis|ingrown|psoriasis|eczema|paronychia|warts?)/i, "medical/treatment claim — say 'see a doctor or podiatrist' instead"],
  [/\b(I|we) (can |will )?(diagnose|prescribe)/i, "nail techs don't diagnose or prescribe"],
  [/guarantee/i, "no guarantees of results"],
  [/clinically proven|medical[- ]grade|FDA[- ]approved|dermatologist[- ]approved|doctor[- ]approved/i, "unprovable marketing claim"],
  [/non[- ]?toxic|toxin[- ]free|chemical[- ]free|\b\d+[- ]free\b/i, "unverifiable 'free-from' claim"],
  [/damage[- ]free|(won't|will not|never|doesn't|does not) (damage|lift|chip|break|crack|pop off)/i, "promises a set can't keep"],
  [/\b(dip powder|dipping powder|dip nails|SNS|poly ?gel|press[- ]ons?|nail wraps?|microblading|lash extensions?|waxing)\b/i, "a service she doesn't offer — leave it out"],
  [/\b(my|our) clients? (saw|see|got|get|say|said|love|swear|tell me)/i, "no client stories or results (none are published)"],
  [/\d+ ?% of (my|our) clients/i, "no client statistics"],
  [/(only )?(ask|send|invite) (only )?(happy|satisfied) (clients|customers)/i, "review gating"],
  [/(discount|free|% off|gift)[^.]{0,40}(for|in exchange for|when you leave) (a |an )?(\w+ )?review/i, "review incentives (FTC 16 CFR 465)"],
  [/best nail (tech|technician|artist|salon|studio)s? in (henderson|las vegas|vegas|nevada|green valley)|#1 nail/i, "unprovable superlative"],
  [/\$\s?\d/, "no prices in guides — they change; link the price list (related: services) instead"],
  [/flamingo|2080 E/i, "the old studio address — she moved to Henderson"],
];

const guideDir = "content/guides";
const guideFiles = existsSync(guideDir) ? readdirSync(guideDir).filter((f) => f.endsWith(".md")) : [];
const slugs = new Set();
for (const f of guideFiles) {
  let g;
  try {
    g = parseGuide(readFileSync(`${guideDir}/${f}`, "utf8"), f);
  } catch (e) {
    err(e.message);
    continue;
  }
  const where = `guides/${f}`;
  for (const k of ["title", "description", "date"]) if (!g[k]) err(`${where}: missing "${k}" in front matter`);
  for (const k of ["date", "updated"]) if (g[k] && !/^\d{4}-\d{2}-\d{2}$/.test(g[k])) err(`${where}: ${k} must be YYYY-MM-DD`);
  if (g.title && (g.title.length < 40 || g.title.length > 65)) warn(`${where}: title is ${g.title.length} chars (aim 50–65)`);
  if (g.description && (g.description.length < 110 || g.description.length > 160))
    warn(`${where}: description is ${g.description.length} chars (aim 120–160)`);
  if (!/^[a-z0-9-]+$/.test(g.slug)) err(`${where}: slug must be lowercase-with-dashes`);
  if (slugs.has(g.slug)) err(`${where}: duplicate slug ${g.slug}`);
  slugs.add(g.slug);
  if (!sitemapPaths.has(`/guides/${g.slug}`)) err(`${where}: /guides/${g.slug} isn't in the sitemap — did the build include it?`);

  if (/^# /m.test(g.body)) err(`${where}: no "# " headings in the body — the page already has the H1`);
  const words = g.body.split(/\s+/).length;
  if (words < 700) err(`${where}: only ${words} words (minimum 700)`);
  if (words > 2000) warn(`${where}: ${words} words — over 2,000 usually means it's two guides`);
  const lower = g.body.toLowerCase();
  for (const w of BANNED_WORDS) if (lower.includes(w)) err(`${where}: banned filler "${w}"`);
  const prose = g.body.split(/^## Sources\s*$/m)[0];
  for (const [re, why] of BANNED_CLAIMS) {
    const hit = prose.match(re);
    if (hit) err(`${where}: "${hit[0]}" — ${why}`);
  }
  for (const u of UNITS) if (u && g.body.includes(u)) err(`${where}: contains the private suite number "${u}"`);
  if (/lorem ipsum|\bTODO\b|\bTK\b|\[insert|\[source/i.test(g.body)) err(`${where}: placeholder text left in`);

  // Every guide shows its working. A named source is what separates a guide
  // from a blog post, for Google and for the reader.
  const sources = g.body.split(/^## Sources\s*$/m)[1];
  if (!sources) err(`${where}: needs a "## Sources" section at the end`);
  else if (!/\]\(https?:\/\//.test(sources)) err(`${where}: the Sources section has no links`);
  const figures = (prose.match(/\d+(\.\d+)?\s?%/g) || []).length;
  if (figures && !/(according to|found|reports?|survey|study|review|published|puts|per |says)/i.test(prose))
    err(`${where}: has ${figures} percentage figure(s) but never says where they come from`);

  const mentions = (g.body.match(/Mya's Nails Baby|Myas Nails Baby/gi) || []).length;
  if (mentions > 1) err(`${where}: names Mya's Nails Baby ${mentions} times (once, near the end, at most)`);

  for (const r of g.related) {
    const res = await get(`/${r}`);
    if (res.status !== 200) err(`${where}: related page "/${r}" returns ${res.status}`);
  }
  if (g.related.length < 2) warn(`${where}: link 2–3 related pages in the front matter`);
}

// ── Report ───────────────────────────────────────────────────────────────────
stop();
console.log(`SEO check: ${sitemapPaths.size} sitemap pages, ${linkTargets.size} internal link targets, ${guideFiles.length} guides`);
for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.log(`  FAIL  ${e}`);
if (errors.length) {
  console.log(`\n✗ ${errors.length} error(s). Do not publish until these are fixed.`);
  process.exit(1);
}
console.log(`✓ All checks passed${warnings.length ? ` (${warnings.length} warning(s))` : ""}.`);
process.exit(0);
