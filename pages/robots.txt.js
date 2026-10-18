import { absoluteUrl } from "@/utils/seo";

/** Blocked from crawling: only the API, which has nothing to show.
 *
 *  The private pages (dashboard, login, checkout, success, reschedule) are
 *  deliberately NOT listed here. They carry a noindex tag and an
 *  X-Robots-Tag header (next.config.js), and Google can only obey those if
 *  it's allowed to fetch the page. Blocking them here is what got /login
 *  shown as a "Dashboard Login" sitelink under her name: Google saw a link
 *  to it, wasn't allowed in to read "don't index me", and listed it anyway. */
const DISALLOW = ["/api/"];

function buildRobots() {
  return [
    "User-agent: *",
    // /api/og is the link-preview card — chat apps and crawlers must reach it
    "Allow: /api/og",
    ...DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");
}

export async function getServerSideProps({ res }) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate");
  res.write(buildRobots());
  res.end();
  return { props: {} };
}

/** Never rendered — getServerSideProps writes the response directly. */
export default function Robots() {
  return null;
}
