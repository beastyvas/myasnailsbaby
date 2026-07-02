-- Run this in your Supabase SQL editor
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_customer_id       text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS no_show_charged          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_show_fee_amount       integer;
