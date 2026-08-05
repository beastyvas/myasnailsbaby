-- Quoted price on the booking — run once in the Supabase SQL editor.
-- Safe to re-run.
--
-- The estimate the client was shown at checkout, priced server-side from
-- their selections. Stored so Mya sees the same number at the chair that
-- they saw on the site, and so a later price-list change never rewrites
-- what someone was actually quoted.
--
-- Null means the selections couldn't be priced — a booking made before
-- this existed, or one using the retired "Hard Gel" / "XL/XXL" options.

alter table bookings add column if not exists quoted_cents int;
alter table bookings add column if not exists spa_pedi text;
