/*
  # Fix Paynow payment constraint + enable RLS on tables missing it

  ## Problem
  The `deliveries` and `declined_deliveries` tables still have CHECK constraints
  that only allow `payment_option IN ('pay_on_delivery', 'ecocash')`. The app
  was updated to use 'paynow' instead of 'ecocash', so every delivery insert
  with `payment_option = 'paynow'` fails with a constraint violation — the red
  error the customer sees on the dashboard.

  Separately, the Supabase linter flagged 4 tables that have RLS policies
  created but RLS itself disabled, meaning the policies are not enforced:
  - customers
  - delivery_request_pickup_details
  - driver_requests
  - webhook_outbox

  ## Changes

  ### 1. deliveries — add 'paynow' to payment_option CHECK
  Drops the old constraint and recreates it to allow 'pay_on_delivery' and
  'paynow'. The 'ecocash' value is kept for backward compatibility with
  any existing rows that may still carry it.

  ### 2. declined_deliveries — same fix
  Same constraint update so declined-delivery inserts don't fail.

  ### 3. Enable RLS on the 4 tables missing it
  - customers
  - delivery_request_pickup_details
  - driver_requests
  - webhook_outbox

  These tables already have policies defined; enabling RLS makes those
  policies actually enforce. The app uses the anon key (custom auth, not
  Supabase Auth), so the existing anon-scoped policies on these tables
  will continue to allow the app to function.

  ## Security
  - No policies are changed or weakened.
  - No data is modified or deleted.
  - Enabling RLS on the 4 tables strengthens access control — it does not
    loosen it.

  ## Important notes
  1. Existing rows with payment_option = 'ecocash' (if any) remain valid
     because 'ecocash' is still in the allowed set.
  2. The app no longer sends 'ecocash' as a payment_option value; it sends
     'paynow'. Both are now accepted by the constraint.
*/

-- =========================================================
-- 1. Fix deliveries.payment_option CHECK constraint
-- =========================================================
ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_payment_option_check;

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_payment_option_check
  CHECK (payment_option = ANY (ARRAY['pay_on_delivery'::text, 'ecocash'::text, 'paynow'::text]));

-- =========================================================
-- 2. Fix declined_deliveries.payment_option CHECK constraint
-- =========================================================
ALTER TABLE public.declined_deliveries
  DROP CONSTRAINT IF EXISTS declined_deliveries_payment_option_check;

ALTER TABLE public.declined_deliveries
  ADD CONSTRAINT declined_deliveries_payment_option_check
  CHECK (payment_option = ANY (ARRAY['pay_on_delivery'::text, 'ecocash'::text, 'paynow'::text]));

-- =========================================================
-- 3. Enable RLS on tables that have policies but RLS disabled
-- =========================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_request_pickup_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_outbox ENABLE ROW LEVEL SECURITY;
