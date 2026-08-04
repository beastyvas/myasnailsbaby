import { absoluteUrl } from "@/utils/seo";

/** Only pages worth landing on. The booking utilities (/reschedule,
 *  /cancel-appointment, /success) are transactional — they're marked
 *  noindex and deliberately left out, so crawl budget goes to real pages. */
const PAGES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

function buildSitemap() {
  const lastmod = new Date().toISOString().split("T")[0];
  const urls = PAGES.map(
    ({ path, changefreq, priority }) => `  <url>
    <loc>${absoluteUrl(path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate");
  res.write(buildSitemap());
  res.end();
  return { props: {} };
}

/** Never rendered — getServerSideProps writes the response directly. */
export default function Sitemap() {
  return null;
}
