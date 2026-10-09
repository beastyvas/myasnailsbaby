-- The "add french tips" box on the pedicure part of the booking form.
-- 'yes' / 'no', same shape as spa_pedi. Safe to run more than once.
--
-- Until this is run, bookings still go through: the webhook drops the column
-- and writes "French tips on pedicure (+$5)" into the notes instead.
alter table public.bookings add column if not exists pedi_french text;
