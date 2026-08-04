import Head from "next/head";
import { SITE_NAME, absoluteUrl, jsonLdSafe, ogImageUrl } from "@/utils/seo";

/**
 * Per-page metadata. Every public page renders one of these.
 *
 * @param {string}  title      page title; the site name is appended unless
 *                             `bareTitle` is set
 * @param {string}  description  the snippet Google shows under the link
 * @param {string}  path       site-relative path, used for the canonical URL.
 *                             Canonicals matter here because the site is
 *                             reachable at both the apex and www.
 * @param {boolean} noindex    keep the page out of search results — for
 *                             transactional pages that are useless as a
 *                             landing page and would otherwise dilute the site
 * @param {object|object[]} jsonLd  structured data to embed
 */
export default function Seo({
  title,
  description,
  path = "/",
  noindex = false,
  bareTitle = false,
  jsonLd = null,
}) {
  const fullTitle = bareTitle || !title ? title || SITE_NAME : `${title} | ${SITE_NAME}`;
  const canonical = absoluteUrl(path);
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImageUrl()} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${SITE_NAME} — custom nail sets in Las Vegas`} />

      {/* Twitter / iMessage cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImageUrl()} />

      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdSafe(block) }}
        />
      ))}
    </Head>
  );
}
