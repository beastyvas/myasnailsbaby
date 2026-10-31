/**
 * Mya's Google reviews, straight from her Business Profile.
 *
 * Uses the Places API (New) Place Details call, which returns her overall
 * rating, the total count, and up to five reviews Google picks as "most
 * relevant". That five is Google's limit, not ours — there is no API that
 * returns every review for a business you don't manage through OAuth.
 *
 * Needs two env vars, both server-only:
 *   GOOGLE_PLACES_API_KEY  — a key with "Places API (New)" enabled
 *   GOOGLE_PLACE_ID        — her profile's place id (starts "ChIJ…")
 * With either missing, this returns null and the section simply isn't drawn.
 *
 * What this must never do:
 *   - throw, or hold up the homepage. A review strip that fails costs a
 *     section; a getServerSideProps that throws costs the booking form.
 *   - publish structured data. Google doesn't allow review markup a business
 *     writes about itself, and tests/seo.test.mjs guards against it. These
 *     are shown to people, not to crawlers.
 *   - edit a review. Google's terms require the text and author as given.
 */

const TTL_MS = 12 * 60 * 60 * 1000; // twice a day is plenty, and keeps it in the free tier
const TIMEOUT_MS = 2500;

let cache = { at: 0, value: null };

/** Shape the API response into only what the page renders. Pure — tested. */
export function normalizeReviews(place) {
  if (!place || typeof place !== "object") return null;
  const rating = Number(place.rating);
  const count = Number(place.userRatingCount);
  if (!Number.isFinite(rating) || !Number.isFinite(count) || count < 1) return null;

  const reviews = (Array.isArray(place.reviews) ? place.reviews : [])
    .map((r) => ({
      author: r?.authorAttribution?.displayName || "",
      authorUrl: r?.authorAttribution?.uri || null,
      photo: r?.authorAttribution?.photoUri || null,
      rating: Number(r?.rating) || 0,
      when: r?.relativePublishTimeDescription || "",
      text: (r?.text?.text || r?.originalText?.text || "").trim(),
      url: r?.googleMapsUri || null,
    }))
    // Star-only reviews have nothing to read. Every review that has words
    // stays, whatever its rating — showing only the five-stars would be
    // curating Google's data, which its terms don't allow.
    .filter((r) => r.author && r.text);

  return {
    rating: Math.round(rating * 10) / 10,
    count,
    url: place.googleMapsUri || null,
    reviews,
  };
}

export async function getGoogleReviews({ fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!key || !placeId || typeof fetchImpl !== "function") return null;

  if (cache.value && now - cache.at < TTL_MS) return cache.value;

  try {
    const res = await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "rating,userRatingCount,reviews,googleMapsUri",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("Google reviews: Places API answered", res.status);
      return cache.value; // last good copy beats nothing
    }
    const value = normalizeReviews(await res.json());
    if (value) cache = { at: now, value };
    return value || cache.value;
  } catch (err) {
    console.error("Google reviews: fetch failed:", err?.message || err);
    return cache.value;
  }
}

/** For tests only. */
export function _resetReviewsCache() {
  cache = { at: 0, value: null };
}
