# SEO routine — instructions for the scheduled sessions

Two scheduled Claude Code sessions run this file: a guide writer (twice a
week) and a monthly health check. Both fire into one long-lived "Mya's Nails
Baby SEO runner" session that was started with this repo attached, so the repo
is already your working directory. Start every run from the latest `main`.

Repo: `beastyvas/myasnailsbaby` (default branch `main`). Live site:
https://www.myasnailsbaby.com — **Mya's Nails Baby**, Mya's solo nail studio.
Since **October 21, 2026** she works from a private suite at **Glamour Gains
Studio Suites, 178 N Pecos Rd, Henderson, NV 89074** (before that, E. Flamingo
Rd in Las Vegas). By appointment only, booked online with a $20 deposit.

Her menu (the source of truth is `utils/pricing.js` and `SERVICES` in
`utils/seo.js`): Gel-X extensions, acrylic, hard gel (with tips, or as a
manicure), structure gel manicure (people search "builder gel" — same thing),
gel manicure, basic manicure, custom nail art (levels 1–4, French tips),
soak-off removal, gel pedicure, acrylic big toes, acrylic pedicure.

**The goal: make her the nail tech Henderson finds.** Her existing clients
know her from Las Vegas; new ones near Pecos Rd don't know she exists yet.
Every guide is written for **people in Henderson and the southeast valley
deciding on their next set** (Green Valley, Anthem, Seven Hills, Whitney Ranch,
Inspirada, Silverado Ranch) — not other nail techs. `/henderson` is the local
landing page; link to it from guides where the area genuinely comes up.

**Publishing:** Nick (the site owner) approved **auto-publish**. Commit
straight to `main` and push — the repo's CLAUDE.md says to work on `main` and
never open PRs unless asked. Only push after `npm run build:seo && npm run
seo:check` both pass and `npm test` is green. Vercel deploys `main`
automatically. If anything fails and you can't fix it in three attempts, push
to a branch `seo/blocked-<date>` instead, don't publish, and say why.

---

## WEEKLY — publish one guide

1. `git fetch origin main && git checkout -B main origin/main && git clean -fd`.
   Run `npm ci`.
2. Open `docs/seo-topics.md` and take the **first unchecked topic**.
3. Research it with web search. Use only facts you can attribute to a named,
   credible source in the sentence ("The American Academy of Dermatology
   says…", "the Nevada State Board of Cosmetology requires…"). Prefer primary
   sources: the AAD, the Nevada State Board of Cosmetology (NRS/NAC 644A),
   the FDA (cosmetics, nail products, UV lamps), OSHA (nail salon safety),
   the CDC, peer-reviewed journals, the City of Henderson, the Southern
   Nevada Water Authority, the National Weather Service. If you can't source
   a number, don't use it.
4. Write `content/guides/<slug>.md`:
   ```
   ---
   title: <50–65 chars, the question or promise, phrased how people search>
   description: <120–160 chars, says exactly what the reader gets>
   h1: <shorter on-page heading, optional — defaults to title>
   date: <today, YYYY-MM-DD>
   related: <2–3 site paths, comma-separated: services, henderson, guides/<slug>>
   ---
   <body in markdown>
   ```
   - 900–1,500 words. **The first paragraph answers the question directly.**
   - `##` sections (never `#` — the page already has the H1). Include at least
     one table, checklist or step-by-step routine.
   - Henderson / Las Vegas specifics where they're true: dry desert air, hard
     water, sun and heat, pool season, AC drying out cuticles. No made-up
     local facts, landmarks, drive times or "locals love…".
   - Voice: warm, plain, short sentences — Mya explaining it while she works.
     First person ("I") is fine near the end; the rest can be neutral. No
     filler (the check bans words like "elevate", "seamless", "holy grail",
     "nail journey", "delve", "indulge").
   - Mention Mya's Nails Baby **at most once**, near the end, as one option.
     The page adds its own booking box.
   - End with `## Sources` — a bullet list of every source, each with a link.
     The check fails without it.
   - Only link `related:` pages that exist: `services`, `henderson`, or
     `guides/<slug>` for a file in `content/guides/`.
5. **Rules that must never be broken:**
   - **Scope of license.** Nail technicians care for healthy nails. Never say
     a service treats, cures, fixes or prevents a condition (nail fungus,
     infections, ingrown nails, psoriasis). Anything that sounds medical —
     discoloration, pain, swelling, lifting with green/yellow under it — ends
     with "see a doctor or podiatrist", and the guide says a nail tech won't
     work over it.
   - **Only her menu.** Don't write about services she doesn't offer: dip
     powder, SNS, polygel, press-ons, wraps, lashes, waxing. The check blocks
     these words. Comparing her services with each other is fine (Gel-X vs
     acrylic vs structure gel vs hard gel).
   - No invented statistics, client stories, testimonials, quotes, photos,
     before/afters or results. Never "my clients say…".
   - No guarantees, no "damage-free", "won't lift", "never chips",
     "non-toxic", "10-free", "clinically proven", no "best nail tech in
     Henderson". Say how long a set *usually* lasts and what shortens it.
   - Reviews: never suggest asking only happy clients, filtering, or offering
     anything for a review (FTC 16 CFR 465, Google policy).
   - **Address:** the street address (178 N Pecos Rd, Henderson) is public and
     fine to use. **The suite number is private** — it never appears on the
     site. Never mention the old Flamingo address in a guide.
   - No other salon's name, and nothing negative about other salons.
   - Prices: don't put prices in guides — they change in code and the guide
     wouldn't. Point to the price list (`related: services`).
6. `npm run build:seo && npm run seo:check && npm test`. Fix every FAIL. Fix
   title and description length warnings on the new guide.
7. In `docs/seo-topics.md`, tick the topic and add `→ /guides/<slug> (<date>)`.
   If fewer than 8 unchecked topics remain, add 4 new ones at the bottom: real
   questions Henderson / Las Vegas clients search, not already covered by a
   guide, and only about services on her menu.
7b. Write the Google Business Profile post for this guide to
   `docs/gbp-posts/<slug>.md`, same format as `docs/gbp-posts/README.md`
   describes: a **Post** of 300–600 characters (the question in one line, what
   the guide covers, no stats that aren't in the guide, no prices, no links in
   the text — Google strips them), then **Button:** Learn more,
   **Link:** https://www.myasnailsbaby.com/guides/<slug>,
   **Photo:** https://www.myasnailsbaby.com/api/og.
8. Commit (`SEO guide: <title>`) and push to `origin main`.
9. Finish with a short summary: guide title, its URL
   (https://www.myasnailsbaby.com/guides/<slug>), the commit link, then the
   Google Business Profile post text ready to paste.

## MONTHLY — health check and fixes

1. Fresh `main` as above, `npm ci`, `npm run build:seo`, `npm run seo:check`,
   `npm test`. Fix every FAIL; fix warnings that are clear and low-risk.
2. Lighthouse on mobile for `/`, `/services`, `/henderson` and the newest
   guide. Serve with
   `NEXT_PUBLIC_SITE_URL=https://www.myasnailsbaby.com NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x npx next start -p 4300 &`, then
   `CHROME_PATH=/opt/pw-browsers/chromium npx -y lighthouse@12 http://localhost:4300/<path> --form-factor=mobile --only-categories=performance,seo,accessibility,best-practices --quiet --output=json --output-path=/tmp/lh-<name>.json --chrome-flags="--headless=new --no-sandbox"`
   (if that path isn't a binary, use `ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1`).
   Record the four scores. Fix clear, low-risk issues (alt text, a label,
   contrast on new elements). **Don't redesign anything** — the look (stone
   and rose-800, Georgia headings, the script hero, Mya's MNB monogram) is
   Mya's call and stays. Never touch booking, payments, texts or the
   dashboard in an SEO run. Stop the server after.
3. Henderson progress: with web search, look at who shows for "nail tech
   henderson nv", "nail salon near Pecos Rd henderson", "gel x henderson" and
   "myas nails baby". Note whether her site or Business Profile appears. Don't
   copy competitors; just record it.
4. Freshness: re-check facts in any guide older than 6 months with web
   search; correct anything that moved and add/bump its `updated:` date.
5. Write `docs/seo-reports/<YYYY-MM>.md`: scores per page, what you fixed,
   the Henderson search snapshot, and what needs a person (e.g. "Business
   Profile still shows the Flamingo address", "add the map pin coordinates to
   NEW_STUDIO in utils/location.js", "post the GBP updates in
   docs/gbp-posts/", "ask recent clients for a review — all of them, nothing
   offered").
6. Commit (`SEO health check <YYYY-MM>`) and push to `main` if build,
   seo:check and tests pass.
7. Finish with a short summary: scores, fixes, the Henderson snapshot, and
   anything Mya or Nick should do.
