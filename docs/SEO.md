# SEO playbook — getting Mya into the Las Vegas map pack

For searches like "nail tech las vegas" or "gel x near me", Google shows a
map with three businesses on it before any website. Getting into those three
spots is the goal. That ranking comes from three things, roughly in this
order:

1. **Her Google Business Profile**: is it complete, in the right category,
   and active?
2. **Reviews**: how many, how recent, and does she reply to them?
3. **The website**: does it clearly say what she does, where, and for how
   much?

The site side (3) is done and lives in the code. Steps 1 and 2 happen
outside the code. They're listed below in order of payoff.

---

## 1. Google Business Profile (do this first, ~1 hour)

At [business.google.com](https://business.google.com):

- [ ] **Claim or create the profile** with the exact name `Mya's Nails Baby`.
- [ ] **Address**: `178 N Pecos Rd, Henderson, NV 89074`. Keep the suite
      private if she wants by turning on *"I deliver goods and services to
      customers"* and hiding the address, then set the service area to
      **Henderson** and **Las Vegas**. Either way, the address must match the
      website character for character.
- [ ] **Primary category: `Nail salon`**. Add secondary categories only if
      Google offers one that is genuinely true for her.
- [ ] **Phone** `(702) 981-8428`, **website** `https://www.myasnailsbaby.com`,
      **booking link** `https://www.myasnailsbaby.com/#booking`.
- [ ] **Hours**: Mon–Tue 10–8, Fri 8–6, Sat 8–4, closed Sun/Wed/Thu. These
      must match the website, which publishes the same hours in its
      structured data.
- [ ] **Services**: add each one with its starting price (Gel-X from $60,
      Acrylic from $65, Structure gel manicure $55, Gel pedicure $50, nail
      art from +$15). The same prices are on `/services`.
- [ ] **Description**: one honest paragraph naming the services and
      "Henderson / Las Vegas". No keyword stuffing.
- [ ] **Photos**. This is the one place her work should live even though
      the site has no gallery. Upload 10+ of her sets, the studio, and her.
      Profiles with fresh photos get noticeably more clicks.
- [ ] **Post weekly**: an "update" with a new set and a book-now button.
      Activity is a ranking signal and takes two minutes.
- [ ] Once the map pin is placed, copy its latitude and longitude into
      `NEW_STUDIO` in `utils/location.js` so the website's structured data
      points at the exact spot.
- [ ] Copy the **Place ID** into Vercel as `GOOGLE_PLACE_ID` (see
      SETUP.md) to turn on the reviews section on the homepage.

## 2. Reviews (the biggest ongoing lever)

- [ ] **Turn on the automatic review request.** It's already built: a text
      2–24h after each appointment asking for a Google review. It's off
      because `EXTRA_TEXTS_ENABLED` is `false` in `utils/features.js`.
      Flipping it on is the cheapest way to get a steady stream of reviews.
- [ ] Get the profile's **"Ask for reviews" short link** from the Business
      Profile dashboard. Once Textbelt allows links (see SETUP.md), put that
      link in the review text instead of "search for us".
- [ ] **Reply to every review**, good or bad, within a few days. Replies are
      a ranking signal and they're what the next client reads.
- [ ] Never buy, swap, or gate reviews (asking only happy clients). Google
      removes them and can suspend the profile.

## 3. Consistent listings (one afternoon)

Google checks that the name, address and phone match everywhere. List her,
identically, on:

- [ ] **Apple Business Connect** (Apple Maps and Siri). Free, often skipped,
      and many iPhone users search there.
- [ ] **Yelp**, **Bing Places** (imports from Google in one click),
      **Facebook page**, **Booksy / StyleSeat** if she's ever listed there
      (update the address, or close the listing).
- [ ] **Instagram bio**: add "Henderson / Las Vegas nail artist" and the
      website link.
- [ ] The **old Flamingo Rd address** must not survive anywhere: update or
      remove it on every listing.

## 4. Search Console (15 minutes, then check monthly)

- [ ] Add `https://www.myasnailsbaby.com` in
      [Google Search Console](https://search.google.com/search-console)
      (Domain property, verified by DNS through Vercel).
- [ ] **Submit the sitemap**: `https://www.myasnailsbaby.com/sitemap.xml`.
- [ ] Use **URL Inspection → Request indexing** on the homepage, `/services`,
      and each `/nails/...` page once they're live.
- [ ] Monthly: look at **Performance → Queries** to see what people actually
      search to find her. If a service keeps showing up that has no page,
      that's the next page to write.

## 5. Checks to run after each deploy

- [ ] [PageSpeed Insights](https://pagespeed.web.dev) on the homepage and one
      service page, **mobile**. Aim for green on LCP and CLS.
- [ ] [Rich Results Test](https://search.google.com/test/rich-results) on a
      service page. It should find *Service*, *Breadcrumb*, *FAQ* and
      *LocalBusiness (NailSalon)* with no errors.
- [ ] `npm test`, which guards the things above from regressing quietly.

---

## What the website already does (for reference)

- `NailSalon` structured data with address, hours, price range, service
  area (Henderson + Las Vegas), booking action and map link — `utils/seo.js`.
- A crawlable price list at `/services`, read from `utils/pricing.js`.
- One page per service under `/nails/...`, each with its own prices,
  questions and structured data — `utils/servicePages.js`. To add one, add
  an entry there; the page, sitemap and internal links follow automatically.
- Bio and photo rendered on the server, a compressed hero photo, canonical
  URLs, a sitemap, and noindex on private pages.
- **Never** publishes a rating or review markup it doesn't have:
  `tests/seo.test.mjs` fails the build if anyone adds one. Google reviews are
  shown on the page for people, not marked up for search.
