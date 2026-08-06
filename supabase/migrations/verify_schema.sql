-- verify_schema.sql — the one to run. Safe to re-run, safe on a healthy database.
--
-- WHY THIS EXISTS
--
-- repair_schema.sql fixed the tables the automations read, but it only ever
-- looked at five of the ten tables this app actually uses. It never checked
-- `clients`, `pending_checkouts`, `availability`, `gallery` or
-- `schedule_settings` — so "all 9 ok" was a true answer to a narrow question.
--
-- This checks EVERYTHING the code reads or writes, in one pass:
--   · every table named in a .from("...") call
--   · every bookings column the Stripe webhook writes or the engine selects
--   · every settings column the dashboard reads
--
-- It creates what it can (the two tables with definitions in this repo) and
-- REPORTS the rest rather than guessing at a type. A missing core column like
-- bookings.name means something is wrong that a script shouldn't paper over.
--
-- Read the report at the bottom. Anything saying MISSING is a real problem.

create temp table if not exists schema_report (
  step int, item text, status text, detail text
);
delete from schema_report;

-- ── 1. create the two tables this repo has definitions for ──────────────────
-- Both predate repair_schema.sql and were never verified by it.

do $$
begin
  -- Client profiles, keyed by phone. Read by the dashboard's Clients tab.
  create table if not exists clients (
    phone      text primary key,
    label      text,       -- 'regular' | 'vip' | 'flagged' | null
    notes      text,
    created_at timestamptz default now()
  );
  insert into schema_report values (1, 'clients table', 'ok', null);
exception when others then
  insert into schema_report values (1, 'clients table', 'FAILED', sqlerrm);
end $$;

do $$
begin
  -- Someone who reached Stripe and didn't pay. Written by the checkout route,
  -- chased once by the hourly job, then left alone.
  create table if not exists pending_checkouts (
    id                uuid primary key default gen_random_uuid(),
    stripe_session_id text not null unique,
    name              text not null default '',
    phone             text not null,
    service           text,
    date              date,
    start_time        time,
    created_at        timestamptz not null default now(),
    completed         boolean not null default false,
    recovered_at      timestamptz
  );
  create index if not exists pending_checkouts_open_idx
    on pending_checkouts (completed, recovered_at, created_at);
  -- Holds phone numbers, so the browser's anon key must never read it.
  alter table pending_checkouts enable row level security;
  insert into schema_report values (2, 'pending_checkouts table', 'ok', null);
exception when others then
  insert into schema_report values (2, 'pending_checkouts table', 'FAILED', sqlerrm);
end $$;

-- Stripe / no-show columns, from add_stripe_noshow_columns.sql. Believed
-- applied, never actually verified.
do $$
begin
  alter table bookings add column if not exists stripe_customer_id       text;
  alter table bookings add column if not exists stripe_payment_method_id text;
  alter table bookings add column if not exists no_show_charged          boolean default false;
  alter table bookings add column if not exists no_show_fee_amount       integer;
  insert into schema_report values (3, 'stripe / no-show columns', 'ok', null);
exception when others then
  insert into schema_report values (3, 'stripe / no-show columns', 'FAILED', sqlerrm);
end $$;

-- ── 2. audit: every table the code calls .from() on ─────────────────────────

insert into schema_report
select 4, 'table: ' || t,
       case when to_regclass('public.' || t) is null then 'MISSING' else 'ok' end,
       case when to_regclass('public.' || t) is null
            then 'code calls .from("' || t || '")' end
from unnest(array[
  'bookings', 'settings', 'availability', 'gallery', 'schedule_settings',
  'clients', 'sms_log', 'reactivation_sends', 'marketing_optouts',
  'pending_checkouts'
]) t;

-- ── 3. audit: every bookings column the code writes or reads ────────────────
-- The write list is the Stripe webhook's insert; the read list is the hourly
-- engine's select plus the reschedule and reactivation paths.

insert into schema_report
select 5, 'bookings.' || c,
       case when exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'bookings' and column_name = c
       ) then 'ok' else 'MISSING' end,
       null
from unnest(array[
  -- written by the Stripe webhook on every booking
  'name', 'instagram', 'phone', 'email', 'service', 'art_level', 'length',
  'date', 'start_time', 'end_time', 'notes', 'soakoff', 'returning',
  'duration', 'referral', 'pedicure', 'pedicure_type', 'booking_nails',
  'spa_pedi', 'quoted_cents', 'paid', 'confirmed', 'session_id',
  'stripe_customer_id', 'stripe_payment_method_id',
  -- read by the hourly automations
  'no_show', 'refunded',
  -- no-show fee path
  'no_show_charged', 'no_show_fee_amount',
  -- reschedule path
  'reschedule_count', 'last_rescheduled_at',
  -- reactivation attribution
  'reactivation_code', 'discount_percent'
]) c;

-- ── 4. audit: settings columns the dashboard reads ──────────────────────────

insert into schema_report
select 6, 'settings.' || c,
       case when exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'settings' and column_name = c
       ) then 'ok' else 'MISSING' end,
       null
from unnest(array[
  'bio', 'profile_picture_url', 'promo_text', 'promo_enabled',
  'reactivation_percent', 'rebook_after_weeks', 'reviews_enabled', 'rebook_enabled'
]) c;

-- ── 5. the fill interval the rebooking nudge uses ───────────────────────────
-- Not a schema check — just surfacing the value, since it decides when the
-- nudge fires and there's no other easy place to see it.
do $$
declare wks int;
begin
  select rebook_after_weeks into wks
    from settings where id = 'c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9';
  insert into schema_report values
    (7, 'rebook interval', 'info',
     coalesce(wks::text || ' weeks (nudge fires that long after a visit)',
              'no settings row for that id'));
exception when others then
  insert into schema_report values (7, 'rebook interval', 'info', sqlerrm);
end $$;

-- ── the report ──────────────────────────────────────────────────────────────
-- Scan the status column. Every row should say ok or info.
select step, item, status, detail
  from schema_report
 order by step, (status <> 'ok') desc, item;
