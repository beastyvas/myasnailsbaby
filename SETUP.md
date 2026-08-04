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
| `CRON_SECRET` | Any long random string. Guards `/api/cron/engine`. **Without it the automations refuse to run** — reminders, review requests and rebooking nudges all stop. |

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

Run these once each in the Supabase SQL editor, in order. All are safe to
re-run.

1. `supabase/migrations/add_stripe_noshow_columns.sql`
2. `supabase/migrations/add_reactivation.sql`
3. `supabase/migrations/add_growth.sql`

Run them **before** deploying, or the Reactivate and Business tabs have
nothing to read.

## The hourly automations

`/api/cron/engine` does everything that happens on its own:

| | When | |
| --- | --- | --- |
| 24h reminder | 23–25h before the appointment | always on |
| Day-of reminder | 2–4h before | always on |
| Review request | 2–4h after it ends | Settings toggle |
| Rebooking nudge | at the fill interval, default 3 weeks | Settings toggle |

Every message is logged in `sms_log`, so running the job twice — or re-running
after a failure — can't double-text anyone.

**Scheduling.** Vercel's Hobby plan only allows one cron run per day, which
would miss almost every window above. `.github/workflows/engine.yml` runs it
hourly on GitHub Actions for free. Add two repository secrets under
**Settings → Secrets and variables → Actions**:

- `SITE_URL` — `https://www.myasnailsbaby.com`
- `CRON_SECRET` — the same value as the environment variable

The daily Vercel cron in `vercel.json` stays on as a backstop; it's harmless
because the endpoint is idempotent.

To test it by hand: Actions → *Hourly automations* → **Run workflow**, or

```
curl -H "Authorization: Bearer $CRON_SECRET" https://www.myasnailsbaby.com/api/cron/engine
```

It returns a count of what it sent, so a `0` with no error means nothing was
due — not that it's broken.

## The Business tab

Real profit, not just takings — but only once the totals are entered.

The site only ever processes the $20 deposit; the rest is settled at the
chair. Every past appointment therefore shows up under **"What Did You
Collect?"** until the real total is typed in. Until then it's counted at the
deposit only, which keeps the books honest rather than optimistic.

Expenses go in the same tab, and the **set aside for tax** figure is a
percentage of profit (not revenue) — set it under Settings → Automatic Texts.

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
