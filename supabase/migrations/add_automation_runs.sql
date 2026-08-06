-- add_automation_runs.sql — run once in the Supabase SQL editor. Safe to re-run.
--
-- WHY
--
-- The automations sent their first real texts today, and the only record of
-- that fact was a GitHub Actions log. Three blind spots followed from it:
--
--   1. Mya can't see that the site texts her clients at all, so she'd never
--      notice it stopping — just quietly fewer rebookings.
--   2. The engine can return HTTP 200 with a non-empty `failures` array. The
--      workflow only checks the status code, so a run where every text was
--      rejected is a green tick and no email.
--   3. Worst: if the engine stops running entirely, nothing notices. GitHub
--      cancelled two runs today for lack of a runner. Had that persisted, the
--      ABSENCE of failure emails would have looked exactly like everything
--      being fine.
--
-- One row per run fixes (3) by making silence mean something: if the newest
-- row is hours old, the engine isn't running, and both the dashboard and the
-- workflow can say so.

do $$
begin
  create table if not exists automation_runs (
    id           uuid primary key default gen_random_uuid(),
    ran_at       timestamptz not null default now(),
    sent         int not null default 0,
    -- the per-kind breakdown, kept whole so a new automation doesn't need a
    -- migration just to be counted
    counts       jsonb,
    failures     int not null default 0,
    -- Textbelt credits at the time of the run. Null when the key isn't
    -- configured or the quota check itself failed — which is different from
    -- zero, and must stay different.
    credits_left int,
    -- a run that held everything for morning is still a healthy run
    quiet_hours  boolean not null default false,
    held         int not null default 0
  );

  -- Every read is "the most recent run(s)".
  create index if not exists automation_runs_ran_at_idx on automation_runs (ran_at desc);

  -- Written by the cron engine and read by an admin-gated API route, both
  -- service-role. The browser's anon key has no business reading operational
  -- history, so RLS on with no policy is the right posture.
  alter table automation_runs enable row level security;

  raise notice 'automation_runs ready';
end $$;

select
  case when to_regclass('public.automation_runs') is null
       then 'FAILED — table not created'
       else 'ok — automation_runs ready' end as status;
