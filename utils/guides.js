/** Nail guides (/guides/<slug>): one markdown file per guide in
 *  content/guides, with a small front-matter block. Adding a file is all it
 *  takes to publish one — the build renders it, and the guides index and the
 *  sitemap pick it up from here.
 *
 *  These exist for the searches the homepage and price list can't answer:
 *  "how long does gel-x last", "structure gel vs acrylic", "nail tech near
 *  me henderson". Someone asking that isn't ready to book yet, and a straight
 *  answer from the person who'd do their nails is how Mya meets them before
 *  they are — and how a studio that moved to Henderson in October 2026 earns
 *  its place in Henderson searches.
 *
 *  The scheduled SEO routine writes these; docs/SEO_ROUTINE.md is its
 *  rulebook and scripts/seo-check.mjs is the gate that stops a bad one going
 *  live. The front-matter parser is duplicated there on purpose — the check
 *  is plain node and must not depend on the app.
 *
 *  SERVER ONLY (reads the filesystem). Import it from getStaticProps /
 *  getStaticPaths / getServerSideProps, never from component code. */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

const DIR = join(process.cwd(), "content", "guides");

export function parseGuide(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`Guide ${file} is missing its --- front matter ---`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return {
    slug: meta.slug || file.replace(/\.md$/, ""),
    title: meta.title || "",
    description: meta.description || "",
    h1: meta.h1 || meta.title || "",
    date: meta.date || "",
    updated: meta.updated || meta.date || "",
    related: (meta.related || "")
      .split(",")
      .map((s) => s.trim().replace(/^\//, ""))
      .filter(Boolean),
    body: m[2].trim(),
  };
}

/** Newest first. */
export function allGuides() {
  let files = [];
  try {
    files = readdirSync(DIR).filter((f) => f.endsWith(".md"));
  } catch {
    // no guides folder is an empty list, not a broken build
  }
  return files
    .map((f) => parseGuide(readFileSync(join(DIR, f), "utf8"), f))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function guideFor(slug) {
  return allGuides().find((g) => g.slug === slug) ?? null;
}

/** The body as HTML. The markdown is ours — written in this repo and checked
 *  by seo:check before it publishes — so it is trusted input. */
export function guideHtml(g) {
  return marked.parse(g.body, { async: false });
}

/** Rough reading time at 230 words a minute. */
export function readingMinutes(g) {
  return Math.max(1, Math.round(g.body.split(/\s+/).length / 230));
}

/** "November 9, 2026". Dates are calendar days, read as such so a UTC
 *  midnight can't slide into the previous day in Vegas. Browser-safe: the
 *  pages call this at render time with the plain date string. */
export function formatGuideDate(iso) {
  if (!iso) return "";
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A label for a path in a guide's `related:` list, or null if it isn't a
 *  page that exists — a dead related link is dropped, not rendered. */
export function relatedLabel(path) {
  if (path === "services") return "Prices & services";
  if (path === "henderson") return "Nail tech in Henderson, NV";
  if (path === "" || path === "/") return "Book an appointment";
  const [kind, slug] = path.split("/");
  if (kind === "guides" && slug) return guideFor(slug)?.h1 ?? null;
  return null;
}
