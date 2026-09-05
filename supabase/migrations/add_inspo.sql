-- Inspo photos on a booking — run once in the Supabase SQL editor.
-- Safe to re-run.
--
-- Clients describe a design in the notes field, which is a bad medium for
-- nail art. This lets them attach up to three reference pictures, and puts
-- those pictures on the appointment instead of in Mya's DMs.
--
-- Storage paths, not URLs: the public URL is built at render time from
-- NEXT_PUBLIC_SUPABASE_URL (see utils/storage.js), so moving the project
-- doesn't strand every stored link. Null means no photos — the same
-- convention quoted_cents uses, and it keeps an empty string out of the
-- array where it would render as a broken image on the dashboard.
--
-- NOTE: the whole SQL editor runs as one transaction, so if any statement
-- below fails, everything before it is rolled back too. Run the file whole.

alter table bookings add column if not exists inspo_urls text[];

-- The bucket. Public-read with unguessable uuid paths, matching every other
-- image in the app.
--
-- The size and MIME limits here are the point of doing this in SQL rather
-- than clicking through the dashboard: Supabase enforces them itself, under
-- the checks in /api/upload-inspo. A bug in that route can't turn this into
-- a general-purpose file host.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspo', 'inspo', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage policies are created on purpose. Writes go through
-- /api/upload-inspo with the service role, which bypasses RLS; leaving the
-- bucket with no insert policy is what stops anything in a browser from
-- writing to it directly. Reads don't need a policy because the bucket is
-- public.

-- Verify.
select
  (select count(*) from information_schema.columns
     where table_name = 'bookings' and column_name = 'inspo_urls') as inspo_column,
  (select count(*) from storage.buckets where id = 'inspo')        as inspo_bucket;
