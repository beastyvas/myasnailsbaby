import { absoluteUrl } from "@/utils/seo";

/** Kept out of search: the dashboard and its login, the API surface, and the
 *  post-checkout / booking-management pages, which are useless to a searcher
 *  and can expose a booking's details in a crawled URL. */
const DISALLOW = [
  "/api/",
  "/dashboard",
  "/login",
  "/logout",
  "/Payment",
  "/success",
  "/reschedule",
  "/cancel-appointment",
];

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
