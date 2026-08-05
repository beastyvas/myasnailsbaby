-- repair_schema.sql — run once in the Supabase SQL editor. Safe to re-run.
--
-- WHY THIS EXISTS
--
-- The hourly automations returned {"error":"column bookings.no_show does not
-- exist"} — but no_show is right there in add_growth.sql, which had been run.
--
-- The Supabase SQL editor executes a script as ONE transaction. If any
-- statement fails, every statement before it is rolled back. You see a single
-- error message and reasonably assume the rest applied. It didn't.
--
-- The evidence split cleanly along one line: every migration WITHOUT a foreign
-- key to bookings applied, and both migrations WITH one did not.
--
--   add_stripe_noshow_columns.sql   no FK   applied
--   add_quoted_price.sql            no FK   applied
--   add_checkout_recovery.sql       no FK   applied
--   add_missing_booking_columns.sql no FK   applied
--   add_growth.sql                  FK      rolled back
--   add_reactivation.sql            FK      rolled back
--
-- Both declared `booking_id uuid ... references bookings(id)`. The bookings
-- table predates every migration in this repo — it was created in the Supabase
-- table editor, and there is no `create table bookings` anywhere in the code,
-- so its id type was never pinned down. If that column is bigint rather than
-- uuid, Postgres rejects the constraint outright and takes the script with it.
--
-- So this script does three things the originals didn't:
--
--   1. TYPE-ADAPTIVE. It reads the real type of bookings.id and builds each
--      foreign key to match, instead of assuming uuid.
--   2. FAILURE-ISOLATED. Every section is its own DO block with an exception
--      handler, so one bad section can no longer silently roll back the good
--      ones. That is the actual defect in how these migrations were written.
--   3. SELF-REPORTING. Each section records ok/FAILED, and the script ends by
--      selecting the report — so you can see what applied rather than trust it.

create temp table if not exists migration_report (
  step int, item text, status text, detail text
);
delete from migration_report;

-- 0 ── what type is bookings.id, really? -------------------------------------
-- Reported on its own so the answer survives even if every later step fails.
do $$
declare idtype text;
begin
  select format_type(a.atttypid, a.atttypmod) into idtype
    from pg_attribute a
   where a.attrelid = to_regclass('public.bookings') and a.attname = 'id';
  insert into migration_report
    values (0, 'bookings.id type', 'info', coalesce(idtype, 'bookings table NOT FOUND'));
end $$;

-- 1 ── sms_log: the guard the whole automation engine depends on -------------
-- Every automated text goes through sendOnce() in pages/api/cron/engine.js,
-- which claims a row here BEFORE sending and returns early if the insert
-- fails. With no table, every claim fails and nothing sends — silently. That
-- makes this more important than the column that was actually erroring.
do $$
declare idtype text;
begin
  select format_type(a.atttypid, a.atttypmod) into idtype
    from pg_attribute a
   where a.attrelid = to_regclass('public.bookings') and a.attname = 'id';

  execute format($f$
    create table if not exists sms_log (
      id         uuid primary key default gen_random_uuid(),
      booking_id %s not null references bookings(id) on delete cascade,
      kind       text not null,
      sent_at    timestamptz not null default now(),
      unique (booking_id, kind)
    )$f$, idtype);

  create index if not exists sms_log_booking_idx on sms_log (booking_id);

  -- Reached only by the service role (the hourly job), so RLS on with no
  -- policy is the right posture: the browser's anon key can't read or forge
  -- the send log.
  alter table sms_log enable row level security;

  insert into migration_report values (1, 'sms_log', 'ok', 'booking_id ' || idtype);
exception when others then
  insert into migration_report values (1, 'sms_log', 'FAILED', sqlerrm);
end $$;

-- 2 ── catch an sms_log left behind by a half-applied earlier attempt --------
-- `create table if not exists` above would skip straight past a table whose
-- booking_id is the wrong type, leaving the engine broken in a way that looks
-- fixed. Check explicitly rather than assume step 1 built it.
do $$
declare idtype text; fktype text;
begin
  select format_type(a.atttypid, a.atttypmod) into idtype
    from pg_attribute a
   where a.attrelid = to_regclass('public.bookings') and a.attname = 'id';
  select format_type(a.atttypid, a.atttypmod) into fktype
    from pg_attribute a
   where a.attrelid = to_regclass('public.sms_log') and a.attname = 'booking_id';

  if fktype is null then
    insert into migration_report
      values (2, 'sms_log.booking_id', 'FAILED', 'table missing — see step 1');
  elsif fktype is distinct from idtype then
    insert into migration_report values (2, 'sms_log.booking_id', 'FAILED',
      format('is %s but bookings.id is %s — run: drop table sms_log;  then re-run this script',
             fktype, idtype));
  else
    insert into migration_report values (2, 'sms_log.booking_id', 'ok', fktype);
  end if;
end $$;

-- 3 ── the column that was failing the hourly job ----------------------------
-- Distinct from no_show_charged: someone can miss an appointment without being
-- charged for it. The engine checks this so a missed appointment never
-- triggers a review request or a "you're due for a fill" nudge.
do $$
begin
  alter table bookings add column if not exists no_show boolean not null default false;
  create index if not exists bookings_date_idx on bookings (date);
  insert into migration_report values (3, 'bookings.no_show', 'ok', null);
exception when others then
  insert into migration_report values (3, 'bookings.no_show', 'FAILED', sqlerrm);
end $$;

-- 4 ── reactivation attribution on the booking -------------------------------
-- Written by the Stripe webhook so a campaign can be judged on bookings won
-- rather than texts sent.
do $$
begin
  alter table bookings add column if not exists reactivation_code text;
  alter table bookings add column if not exists discount_percent  int;
  create index if not exists bookings_phone_idx on bookings (phone);
  insert into migration_report values (4, 'bookings reactivation cols', 'ok', null);
exception when others then
  insert into migration_report values (4, 'bookings reactivation cols', 'FAILED', sqlerrm);
end $$;

-- 5 ── reactivation_sends: one row per "miss you" text -----------------------
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

  create index if not exists reactivation_sends_phone_idx
    on reactivation_sends (phone, expires_at);
  alter table reactivation_sends enable row level security;

  insert into migration_report values (5, 'reactivation_sends', 'ok', 'booking_id ' || idtype);
exception when others then
  insert into migration_report values (5, 'reactivation_sends', 'FAILED', sqlerrm);
end $$;

-- 6 ── marketing_optouts: where STOP replies land ----------------------------
-- pages/api/sms-reply.js writes here. A STOP that fails to record is the one
-- failure in this system with legal teeth, so it gets its own isolated block.
-- Reminders and confirmations are transactional and keep sending regardless;
-- only the campaign and the rebooking nudge consult this list.
do $$
begin
  create table if not exists marketing_optouts (
    phone      text primary key,
    created_at timestamptz not null default now()
  );
  alter table marketing_optouts enable row level security;
  insert into migration_report values (6, 'marketing_optouts', 'ok', null);
exception when others then
  insert into migration_report values (6, 'marketing_optouts', 'FAILED', sqlerrm);
end $$;

-- 7 ── the switches Mya flips from the dashboard -----------------------------
-- Not fatal if these are missing: the engine falls back to defaults and
-- fetchBio() already retries without them. The toggles just wouldn't persist.
do $$
begin
  alter table settings add column if not exists rebook_after_weeks   int     not null default 3;
  alter table settings add column if not exists reviews_enabled      boolean not null default true;
  alter table settings add column if not exists rebook_enabled       boolean not null default true;
  alter table settings add column if not exists reactivation_percent int     not null default 20;
  insert into migration_report values (7, 'settings switches', 'ok', null);
exception when others then
  insert into migration_report values (7, 'settings switches', 'FAILED', sqlerrm);
end $$;

-- 8 ── re-assert the columns whose migrations did apply ----------------------
-- Cheap, and it means one script is enough to bring a fresh database up.
do $$
begin
  alter table bookings add column if not exists refunded            boolean not null default false;
  alter table bookings add column if not exists reschedule_count    int not null default 0;
  alter table bookings add column if not exists last_rescheduled_at timestamptz;
  alter table bookings add column if not exists quoted_cents        int;
  alter table bookings add column if not exists spa_pedi            text;
  create index if not exists bookings_refunded_idx on bookings (refunded);
  insert into migration_report values (8, 'earlier booking cols', 'ok', null);
exception when others then
  insert into migration_report values (8, 'earlier booking cols', 'FAILED', sqlerrm);
end $$;

-- ── the report ──────────────────────────────────────────────────────────────
-- Step 0 tells you the real bookings.id type. Any FAILED row names what still
-- needs doing. All ok means the automations have everything they read.
select step, item, status, detail from migration_report order by step;
