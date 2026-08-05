-- Columns the code depends on that no migration ever created.
-- Run once in the Supabase SQL editor. Safe to re-run, and a no-op for any
-- column that already exists.
--
-- Found the hard way: the hourly automations returned
--   {"error":"column bookings.refunded does not exist"}
-- the first time they actually reached the endpoint.
--
-- `refunded` is read by the automations engine and the reactivation
-- campaign, and *written* by the Stripe webhook when two people pay for the
-- same slot — so the auto-refund path was failing to record itself too,
-- which is the worse half of this.

alter table bookings add column if not exists refunded boolean not null default false;

-- Written by the reschedule flow. Almost certainly already present, since
-- rescheduling has worked, but adding them costs nothing and removes the
-- same class of surprise.
alter table bookings add column if not exists reschedule_count    int not null default 0;
alter table bookings add column if not exists last_rescheduled_at timestamptz;

create index if not exists bookings_refunded_idx on bookings (refunded);
