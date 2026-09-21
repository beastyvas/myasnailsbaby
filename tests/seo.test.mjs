/**
 * On-page SEO structure.
 *
 * These guard things that regress silently on the next design tweak — a
 * heading demoted to make it look right, an alt attribute dropped — and that
 * nobody notices for months because the page still looks fine.
 *
 * The last section is the important one: it asserts we are NOT publishing
 * ratings or reviews that don't exist.
 */
import { read, load } from "./helpers/repo.mjs";
import { suite } from "./helpers/harness.mjs";

const { ok, eq, done } = suite("seo");

/** Pages a searcher can land on. The transactional ones are noindex. */
const PUBLIC_PAGES = [
  "pages/index.js",
  "pages/services.jsx",
  "pages/privacy.jsx",
  "pages/terms.jsx",
];

/**
 * Comments have to come out before counting tags.
 *
 * The first run of this suite reported three <h1>s on the homepage. Two of
 * them were the characters "<h1>" inside comments explaining the heading
 * change — the test was reading its own subject matter as markup.
 */
const stripComments = (src) =>
  src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "") // {/* JSX */}
    .replace(/\/\*[\s\S]*?\*\//g, "") //          /* block */
    .replace(/^\s*\/\/.*$/gm, ""); //             // line

const countTag = (src, tag) =>
  (stripComments(src).match(new RegExp(`<${tag}[\\s>]`, "g")) || []).length;

// ── exactly one h1 per page ──────────────────────────────────────────────
for (const page of PUBLIC_PAGES) {
  const src = read(page);
  eq(`${page} has exactly one <h1>`, countTag(src, "h1"), 1);
}

// ── the homepage h1 has to say what she does and where ───────────────────
{
  const src = stripComments(read("pages/index.js"));
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(src)?.[1] || "";
  const text = h1.replace(/\{[^}]*\}/g, " ").replace(/<[^>]*>/g, " ").trim();

  ok("homepage h1 mentions Las Vegas", /las vegas/i.test(text), text);
  ok("homepage h1 mentions nails", /nail/i.test(text), text);

  // It used to be the logo text in the nav — the strongest on-page signal
  // there is, spent on a word nobody searches.
  ok("the wordmark is no longer an h1", !/<h1[^>]*>\s*MyasNailsBaby/.test(src));
  ok("the wordmark is still on the page", /MyasNailsBaby\s*<\/span>/.test(src));
}

// ── the public gallery, parked at Mya's request ──────────────────────────
//
// She doesn't want her work on the site. Parked behind a flag rather than
// deleted, the same way the cancel flow is — so the tests here check that off
// really means off, and that flipping it back would still produce a correct
// section rather than bitrot.
{
  const src = read("pages/index.js");
  const feat = await load("utils/features.js");

  ok("the gallery flag is off", feat.PUBLIC_GALLERY_ENABLED === false);
  ok("the render is gated on the flag", /\{PUBLIC_GALLERY_ENABLED && <NailGallery/.test(src));

  // Off means no query, not a query whose result is thrown away.
  const gsp = src.slice(src.indexOf("getServerSideProps"));
  const guard = gsp.indexOf("!PUBLIC_GALLERY_ENABLED");
  ok("the flag is checked inside getServerSideProps", guard > -1);
  ok(
    "it returns before hitting Supabase",
    guard > -1 && guard < gsp.indexOf("createClient"),
    "the gallery query should be skipped entirely when off"
  );

  // Still correct if she changes her mind — the flag is only a one-line flip
  // if what it turns on still works.
  const gal = read("components/NailGallery.jsx");
  ok("gallery takes items as a prop", /function NailGallery\(\{\s*items/.test(gal));
  ok("gallery does not fetch its own data", !/from\("gallery"\)/.test(gal));
  ok("every gallery image has an alt", !/<img(?![^>]*\balt=)/.test(gal));
  ok("gallery images lazy-load", /loading="lazy"/.test(gal));
  ok("gallery renders nothing when empty", /if \(!items\.length\) return null/.test(gal));
}

// ── alt text must not be a keyword list ──────────────────────────────────
{
  const gal = read("components/NailGallery.jsx");
  const fallback = /item\.caption\?\.trim\(\)\s*\?[\s\S]*?:\s*"([^"]+)"/.exec(gal)?.[1] || "";
  ok("there is an alt fallback when a caption is blank", fallback.length > 0, fallback);
  // Read aloud to screen-reader users. Keep it a sentence, not a phrase dump.
  ok("the fallback alt is a readable phrase", fallback.split(/\s+/).length <= 12, fallback);
  ok("the fallback alt has no comma-separated keyword list", (fallback.match(/,/g) || []).length <= 1, fallback);
}

// ── indexability ─────────────────────────────────────────────────────────
{
  const sitemap = read("pages/sitemap.xml.js");
  const robots = read("pages/robots.txt.js");

  for (const path of ["/", "/services"]) {
    ok(`${path} is in the sitemap`, sitemap.includes(`path: "${path}"`));
    ok(`${path} is not disallowed in robots`, !new RegExp(`"${path}"`).test(robots));
  }

  // Transactional pages stay out of the index — they're useless as a landing
  // page and a crawled URL can carry a booking's details.
  for (const p of ["/success", "/reschedule", "/cancel-appointment", "/dashboard"]) {
    ok(`${p} stays out of search`, robots.includes(`"${p}"`));
  }

  const idx = read("pages/index.js");
  ok("the homepage is not noindex", !/<Seo[^>]*noindex/.test(idx.slice(0, idx.indexOf("</Seo>") + 1)));
}

// ── structured data says only true things ────────────────────────────────
{
  const seo = read("utils/seo.js");

  // THE ONE THAT MATTERS. Mya has no reviews yet, on Google or anywhere.
  // Publishing an aggregateRating would be inventing a number — a
  // manual-action risk, and a lie told to every person who searches for her.
  // This block goes in when there are real reviews to count, and not before.
  ok("no fabricated aggregateRating", !/aggregateRating/i.test(seo));
  ok("no fabricated Review schema", !/"@type":\s*"Review"|"@type": "Review"/.test(seo));
  ok("no fabricated ratingValue", !/ratingValue/i.test(seo));

  for (const page of PUBLIC_PAGES) {
    const src = read(page);
    ok(`${page} publishes no aggregateRating`, !/aggregateRating/i.test(src));
    ok(`${page} publishes no testimonial schema`, !/"@type":\s*"Review"/.test(src));
  }
}

// ── the structured data still matches the site ───────────────────────────
{
  const seoMod = await load("utils/seo.js");
  const salon = seoMod.salonJsonLd();
  const idx = read("pages/index.js");

  eq("schema type is NailSalon", salon["@type"], "NailSalon");
  eq("phone matches", salon.telephone, "+17029818428");

  // Google cross-checks name/address/phone across the web, so the visible
  // hours and the structured hours have to agree. They drifted once already.
  for (const spec of salon.openingHoursSpecification) {
    const open12 = Number(spec.opens.slice(0, 2)) % 12 || 12;
    ok(
      `hours for ${spec.dayOfWeek.join("/")} appear on the page`,
      idx.includes(`${open12}:${spec.opens.slice(3, 5)}`),
      `${spec.opens}-${spec.closes}`
    );
  }

  // The booking anchor the Business Profile will point at has to exist.
  ok("ReserveAction targets a real anchor", salon.potentialAction.target.urlTemplate.endsWith("/#booking"));
  ok("that anchor is on the page", /id="booking"/.test(idx));
}

done();
