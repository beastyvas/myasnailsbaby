-- Abandoned checkout recovery — run once in the Supabase SQL editor.
-- Safe to re-run.
--
-- A client who picks a slot, reaches Stripe and doesn't pay currently leaves
-- no trace anywhere: bookings are only written by the webhook, on payment. So
-- the most recoverable person in the whole funnel — someone who chose a time
-- and got cold feet at the card form — is invisible. This gives them a row.

create table if not exists pending_checkouts (
  id                uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  name              text not null default '',
  phone             text not null,
  service           text,
  date              date,
  start_time        time,
  created_at        timestamptz not null default now(),
  -- set when they pay, so a completed checkout is never chased
  completed         boolean not null default false,
  -- set when the one recovery text goes out; doubles as the idempotency
  -- guard, since there's no booking row for sms_log to reference
  recovered_at      timestamptz
);

create index if not exists pending_checkouts_open_idx
  on pending_checkouts (completed, recovered_at, created_at);

-- Written by the checkout route and read by the hourly job, both running as
-- the service role. Nothing in the browser should be able to read a list of
-- people's phone numbers and the times they nearly booked.
alter table pending_checkouts enable row level security;

-- NOTE: this deliberately does NOT hold the slot. Holding it during checkout
-- would also prevent the double-booking that the webhook currently resolves
-- with an auto-refund, but it changes booking behaviour and interacts with
-- the bookings_conflict RPC. Recovery is the low-risk half; the hold is a
-- separate decision.
