-- Automated texts — run once in the Supabase SQL editor. Safe to re-run.
--
-- Everything the hourly job needs: a log so it can't double-send, a way to
-- mark someone as a no-show, and the switches for each automated message.

-- 1 ── automated SMS log ────────────────────────────────────────────────
-- The hourly job re-examines the same bookings every run. One row per
-- (booking, kind) is what stops a client getting the same reminder twelve
-- times. The unique constraint does the real work — two overlapping runs
-- race, and the loser's insert fails instead of sending a duplicate.
create table if not exists sms_log (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  kind       text not null,
  sent_at    timestamptz not null default now(),
  unique (booking_id, kind)
);

create index if not exists sms_log_booking_idx on sms_log (booking_id);

-- 2 ── no-shows ─────────────────────────────────────────────────────────
-- Distinct from no_show_charged: someone can miss an appointment without
-- being charged for it. The hourly job checks this so a missed appointment
-- never triggers a review request or a "you're due for a fill" nudge.
alter table bookings add column if not exists no_show boolean not null default false;

create index if not exists bookings_date_idx on bookings (date);

-- Reached only through authenticated routes and the hourly job, both running
-- as the service role, so RLS on with no policy is the correct posture: the
-- anon key used in the browser can't read or forge the send log.
alter table sms_log enable row level security;

-- 3 ── switches for the automated texts ─────────────────────────────────
-- So Mya can turn one off from the dashboard without a deploy.
alter table settings add column if not exists rebook_after_weeks int not null default 3;
alter table settings add column if not exists reviews_enabled    boolean not null default true;
alter table settings add column if not exists rebook_enabled     boolean not null default true;
