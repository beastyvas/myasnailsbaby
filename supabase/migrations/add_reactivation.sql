-- Reactivation campaign — run once in the Supabase SQL editor. Safe to re-run.
--
-- Lets Mya text lapsed clients a percent-off code from the dashboard, and
-- credits a later booking from that number back to the text that caused it.
--
-- SUPERSEDED by repair_schema.sql, which covers this file and add_growth.sql
-- in one pass and reports what it applied. Prefer that. Kept accurate here so
-- re-running this file is safe.

-- 1 ── attribution stamp on the booking ─────────────────────────────────
alter table bookings add column if not exists reactivation_code text;
alter table bookings add column if not exists discount_percent  int;

create index if not exists bookings_phone_idx on bookings (phone);

-- 2 ── one row per "miss you" text ──────────────────────────────────────
-- A booking from a texted number inside the window is credited here, so the
-- campaign can be judged on bookings rather than on texts sent.
--
-- booking_id's type is read from bookings.id rather than hardcoded, for the
-- reason spelled out in add_growth.sql: a mismatched foreign key here doesn't
-- just fail on its own, it rolls back every statement in the file with it.
do $$
declare idtype text;
begin
  select format_type(a.atttypid, a.atttypmod) into idtype
    from pg_attribute a
   where a.attrelid = to_regclass('public.bookings') and a.attname = 'id';

  execute format($f$
    create table if not exists reactivation_sends (
      id          uuid primary key default gen_random_uuid(),
      phone       text not null,
      name        text not null default '',
      code        text not null unique,
      percent_off int  not null,
      sent_at     timestamptz not null default now(),
      expires_at  timestamptz not null,
      booking_id  %s references bookings(id) on delete set null,
      booked_at   timestamptz
    )$f$, idtype);
end $$;

create index if not exists reactivation_sends_phone_idx
  on reactivation_sends (phone, expires_at);

-- 3 ── numbers that asked out of promotional texts ──────────────────────
-- Reminders and confirmations are transactional and keep sending; only the
-- campaign consults this list.
create table if not exists marketing_optouts (
  phone      text primary key,
  created_at timestamptz not null default now()
);

-- Only the service role touches these two tables (the campaign routes and
-- the Textbelt reply webhook), so RLS on with no policy is the correct
-- posture: the anon key used in the browser can neither read the offer
-- codes nor write the opt-out list.
alter table reactivation_sends enable row level security;
alter table marketing_optouts  enable row level security;

-- 4 ── the offer Mya sets in the dashboard ──────────────────────────────
alter table settings add column if not exists reactivation_percent int not null default 20;
