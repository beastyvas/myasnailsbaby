-- add_client_credits.sql — run once in the Supabase SQL editor. Safe to re-run.
--
-- WHY
--
-- Mya's deposit is non-refundable. The site said so on the booking page and
-- in the terms, and then the cancellation flow refunded it anyway — a client
-- cancelled and got their $20 back. Real money, lost to the site
-- contradicting its own stated policy.
--
-- Non-refundable does not mean forfeited. She keeps the money and honours it
-- against the client's next visit, which is the promise the cancellation page
-- now makes. This table is where that promise lives.
--
-- A ledger rather than a balance column on `clients`, because it's money:
-- every credit records where it came from and what consumed it, so a figure
-- can always be explained rather than just asserted.

do $$
declare idtype text;
begin
  select format_type(a.atttypid, a.atttypmod) into idtype
    from pg_attribute a
   where a.attrelid = to_regclass('public.bookings') and a.attname = 'id';

  execute format($f$
    create table if not exists client_credits (
      id             uuid primary key default gen_random_uuid(),
      -- NORMALIZED (+1XXXXXXXXXX). bookings.phone is stored as typed, so both
      -- sides of a lookup must go through normalizePhone() in utils/sms.js.
      phone          text not null,
      amount_cents   int  not null,
      -- Partial redemption, not a boolean: a $35 basic manicure less the $20
      -- deposit leaves only $15 of room, so a $20 credit gives up 15 and the
      -- remaining 5 must stay on the account.
      redeemed_cents int  not null default 0,
      reason         text,
      -- The booking whose cancellation created this credit. Note that
      -- cancelling DELETES the booking row, so this nulls out almost
      -- immediately — which is why the provenance below is copied onto the
      -- credit itself rather than joined back. Mya has to be able to answer
      -- "where did this $20 come from" without a row that no longer exists.
      booking_id     %s references bookings(id) on delete set null,
      client_name    text,
      source_date    date,
      created_at     timestamptz not null default now()
    )$f$, idtype);

  create index if not exists client_credits_phone_idx on client_credits (phone);

  -- Written by the cancel route and read by the webhook and an admin-gated
  -- route, all service-role. A client's credit balance is not something the
  -- browser's anon key should be able to read for an arbitrary phone number.
  alter table client_credits enable row level security;
end $$;

-- Hand credit back when a booking that consumed some is itself cancelled.
-- Without this, cancelling twice silently eats the client's money.
--
-- A function rather than a read-modify-write in the API route: it's money,
-- and spreading a decrement across a select and an update invites two callers
-- releasing the same cents. Walks newest credits first, releasing only what
-- each row actually holds.
create or replace function release_client_credit(p_phone text, p_cents int)
returns void
language plpgsql
as $fn$
declare
  remaining int := greatest(0, p_cents);
  r         record;
  give      int;
begin
  for r in
    select id, redeemed_cents
      from client_credits
     where phone = p_phone and redeemed_cents > 0
     order by created_at desc
  loop
    exit when remaining <= 0;
    give := least(r.redeemed_cents, remaining);
    update client_credits
       set redeemed_cents = redeemed_cents - give
     where id = r.id;
    remaining := remaining - give;
  end loop;
end
$fn$;

-- How much credit was applied to a booking, so the dashboard and the owner
-- text can state a finished total instead of asking Mya to subtract at the
-- chair with a client waiting.
do $$
begin
  alter table bookings add column if not exists credit_applied_cents int not null default 0;
end $$;

select
  case
    when to_regclass('public.client_credits') is null then 'FAILED — client_credits not created'
    when not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'bookings'
         and column_name = 'credit_applied_cents'
    ) then 'FAILED — bookings.credit_applied_cents missing'
    else 'ok — client credits ready'
  end as status;
