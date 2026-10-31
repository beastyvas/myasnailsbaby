// Google reviews on the homepage: real data only, never a broken page.
import { load } from "./helpers/repo.mjs";
import { suite } from "./helpers/harness.mjs";

const { ok, eq, done } = suite("reviews");
const R = await load("utils/reviews.js");

const place = {
  rating: 4.94,
  userRatingCount: 37,
  googleMapsUri: "https://maps.google.com/?cid=1",
  reviews: [
    { rating: 5, relativePublishTimeDescription: "a week ago", text: { text: "  Obsessed with my set  " }, authorAttribution: { displayName: "Ana L", uri: "https://g/ana" } },
    { rating: 5, text: { text: "" }, authorAttribution: { displayName: "Stars Only" } },
    { rating: 3, text: { text: "Fine, ran a bit late" }, authorAttribution: { displayName: "Bea" } },
    { rating: 5, text: { text: "No name" } },
  ],
};

{
  const n = R.normalizeReviews(place);
  eq("rating is rounded to one place", n.rating, 4.9);
  eq("count is passed through", n.count, 37);
  eq("star-only and anonymous reviews are dropped", n.reviews.map((r) => r.author).join("|"), "Ana L|Bea");
  ok("a lower-rated review with words is kept, not curated out", n.reviews.some((r) => r.rating === 3));
  eq("text is trimmed but otherwise untouched", n.reviews[0].text, "Obsessed with my set");
  eq("author link kept for attribution", n.reviews[0].authorUrl, "https://g/ana");
}

ok("no reviews at all means no section", R.normalizeReviews({ rating: 0, userRatingCount: 0 }) === null);
ok("garbage in means null, not a throw", R.normalizeReviews("nope") === null);

// Unconfigured: no network call at all.
{
  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.GOOGLE_PLACE_ID;
  let called = false;
  const v = await R.getGoogleReviews({ fetchImpl: () => { called = true; } });
  ok("unconfigured returns null", v === null);
  ok("unconfigured never calls Google", !called);
}

// Configured: fetches once, then serves the cache; a later failure keeps the last good copy.
{
  process.env.GOOGLE_PLACES_API_KEY = "k";
  process.env.GOOGLE_PLACE_ID = "ChIJ123";
  R._resetReviewsCache();
  let calls = 0, sentKey = null, sentMask = null;
  const good = async (url, opts) => {
    calls++; sentKey = opts.headers["X-Goog-Api-Key"]; sentMask = opts.headers["X-Goog-FieldMask"];
    return { ok: true, json: async () => place };
  };
  const t0 = 1_000_000;
  const a = await R.getGoogleReviews({ fetchImpl: good, now: t0 });
  const b = await R.getGoogleReviews({ fetchImpl: good, now: t0 + 60_000 });
  eq("second call within the TTL is cached", calls, 1);
  ok("same data both times", a === b && a.count === 37);
  eq("key goes in the header, not the URL", sentKey, "k");
  ok("field mask limits the request to what is shown", /reviews/.test(sentMask) && !/\*/.test(sentMask));

  const later = t0 + 13 * 60 * 60 * 1000;
  const boom = async () => { throw new Error("network down"); };
  const c = await R.getGoogleReviews({ fetchImpl: boom, now: later });
  ok("a failed refresh serves the last good copy", c === a);
  const d = await R.getGoogleReviews({ fetchImpl: async () => ({ ok: false, status: 403 }), now: later });
  ok("an API error serves the last good copy", d === a);

  R._resetReviewsCache();
  const e = await R.getGoogleReviews({ fetchImpl: boom, now: later });
  ok("a failure with nothing cached is null, not a throw", e === null);
}

done();
