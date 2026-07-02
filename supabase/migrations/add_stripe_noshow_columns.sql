-- Run this in your Supabase SQL editor

-- Step 1: Add Stripe + no-show columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_customer_id       text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS no_show_charged          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_show_fee_amount       integer;

-- Step 2: Client profiles table (keyed by phone number)
CREATE TABLE IF NOT EXISTS clients (
  phone       text PRIMARY KEY,
  label       text,       -- 'regular' | 'vip' | 'flagged' | null
  notes       text,
  created_at  timestamptz DEFAULT now()
);
