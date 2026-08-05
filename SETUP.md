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

**Run `supabase/migrations/repair_schema.sql` in the Supabase SQL editor.**
It's idempotent, it covers everything the automations and the Reactivate tab
read, and it prints a pass/fail table so you can see what applied instead of
assuming.

Run it **before** deploying, or the automations and the Reactivate tab have
nothing to read.

### Why one script instead of a list

The Supabase SQL editor runs a script as **one transaction**. If any statement
fails, every statement before it is rolled back — you get a single error and
reasonably assume the rest applied.

That's exactly what happened here. `add_growth.sql` and `add_reactivation.sql`
each declared `booking_id uuid references bookings(id)`. The `bookings` table
predates every migration in this repo (it was made in the Supabase table
editor, and there's no `create table bookings` anywhere in the code), so if its
`id` is `bigint` rather than `uuid`, Postgres rejects the constraint and drops
the whole file with it. Both scripts left nothing behind, and the automations
died on a missing `bookings.no_show` — a column that is plainly in
`add_growth.sql`.

`repair_schema.sql` reads the real type of `bookings.id` and builds each
foreign key to match, puts every section in its own error-isolated block, and
reports what it did. The individual files below still work and have been given
the same type-adaptive treatment, but there's no reason to run them separately:

- `add_stripe_noshow_columns.sql`
- `add_reactivation.sql`
- `add_growth.sql`
- `add_checkout_recovery.sql`
- `add_quoted_price.sql`
- `add_missing_booking_columns.sql`

If any row of the report says `FAILED`, the `detail` column says what to do.

## The hourly automations

`/api/cron/engine` does everything that happens on its own:

| | When | |
| --- | --- | --- |
| 24h reminder | 23–25h before the appointment | always on |
| Day-of reminder | 2–4h before | always on |
| Review request | 2–4h after it ends | Settings toggle |
| Rebooking nudge | at the fill interval, default 3 weeks | Settings toggle |
| Abandoned checkout | 30 min after an unpaid checkout | always on |

Every message is idempotent — the appointment ones through `sms_log`, checkout
recovery through its own `recovered_at` stamp — so running the job twice, or
re-running it after a failure, can't double-text anyone.

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
