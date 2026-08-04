# Setup

## Environment variables

Set these in Vercel (Project → Settings → Environment Variables), and in
`.env.local` for local work.

### Texting — Textbelt

| Variable | What it's for |
| --- | --- |
| `TEXTBELT_KEY` | Your Textbelt API key. **Without it no texts are sent** — messages are printed to the server log instead, which is what you want locally. |
| `TEXTBELT_WEBHOOK_SECRET` | Any long random string you invent. Textbelt echoes it back on inbound replies so `/api/sms-reply` can tell a real reply from someone poking the URL. **Without it, STOP replies are ignored** and the route refuses everything. |
| `MYA_PHONE_NUMBER` | Where new-booking alerts, reactivation wins, and forwarded client replies go. |
| `NEXT_PUBLIC_SITE_URL` | e.g. `https://www.myasnailsbaby.com`. Used for the reply webhook URL and for canonical/sitemap links. |

Get a key at [textbelt.com](https://textbelt.com) — it's pay-per-text, no
monthly line, which suits a single-chair shop with quiet months. Credits are
bought in bundles and don't expire.

**About links:** Textbelt blocks messages containing URLs until your sending
domain is whitelisted by them. Every outbound message is currently written
without one, and `utils/sms.js` strips any that slip in. Once
myasnailsbaby.com is approved, flip `ALLOW_LINKS` to `true` at the top of
that file — nothing else needs to change.

### Everything else

| Variable | What it's for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Bypasses RLS for the webhook and campaign routes. Never expose this to the browser. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Deposits and no-show fees |
| `RESEND_API_KEY` | Confirmation and cancellation emails |

## Database migrations

Run these once each in the Supabase SQL editor. Both are safe to re-run.

1. `supabase/migrations/add_stripe_noshow_columns.sql`
2. `supabase/migrations/add_reactivation.sql`

Run the reactivation migration **before** deploying, or the Reactivate tab
has nothing to read.

## The reactivation campaign

Dashboard → **Reactivate**.

A client appears there when she hasn't been in for 45 days and has nothing on
the books. Ticking her and sending texts her a one-off code for a percentage
off her next set, good for 30 days. Set the percentage under
Settings → Reactivation Offer.

If she books from that number inside the window it's credited automatically —
she doesn't have to mention the code. The booking gets stamped with the
discount and Mya gets a text so she knows to honor it at the chair.

Anyone who replies STOP is added to the opt-out list immediately and never
gets another offer. Appointment confirmations and reminders are transactional
and keep sending, which is both correct and what the law expects.

## Search

- Page metadata lives in `components/Seo.jsx`; business facts (address,
  hours, phone, services) live in `utils/seo.js`. Change them in one place.
- `/sitemap.xml` and `/robots.txt` are generated — no files to maintain.
- The link-preview card is drawn on request at `/api/og`.

After deploying, submit `https://www.myasnailsbaby.com/sitemap.xml` in
[Google Search Console](https://search.google.com/search-console) and claim
the [Google Business Profile](https://business.google.com) — for a local nail
studio that listing drives more traffic than the site's own ranking does.
