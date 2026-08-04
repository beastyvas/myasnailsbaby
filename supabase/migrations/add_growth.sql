-- Growth + bookkeeping — run once in the Supabase SQL editor. Safe to re-run.
--
-- Three things: a log so automated texts can't double-send, the fields
-- needed to know what an appointment actually earned, and an expense book so
-- the dashboard can show profit rather than just takings.

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

-- 2 ── what the appointment actually earned ─────────────────────────────
-- The deposit is the only figure the system sees; the rest is settled in
-- person. collected_cents is the total for the visit, deposit included, and
-- is filled in when Mya marks an appointment done.
alter table bookings add column if not exists collected_cents int;
alter table bookings add column if not exists completed_at    timestamptz;
alter table bookings add column if not exists no_show         boolean not null default false;

create index if not exists bookings_date_idx on bookings (date);

-- 3 ── the expense book ─────────────────────────────────────────────────
create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category     text not null,
  description  text not null default '',
  amount_cents int  not null check (amount_cents > 0),
  created_at   timestamptz not null default now()
);

create index if not exists expenses_date_idx on expenses (expense_date);

-- Reached only through authenticated dashboard routes running as the
-- service role, so RLS on with no policy is the correct posture: the anon
-- key used in the browser can't read the books or the send log.
alter table sms_log  enable row level security;
alter table expenses enable row level security;

-- 4 ── settings the dashboard drives ────────────────────────────────────
-- Money set aside for taxes, and the switches for each automated text, so
-- Mya can turn one off without a deploy.
alter table settings add column if not exists tax_set_aside_percent int not null default 25;
alter table settings add column if not exists rebook_after_weeks    int not null default 3;
alter table settings add column if not exists reviews_enabled       boolean not null default true;
alter table settings add column if not exists rebook_enabled        boolean not null default true;
