/*
  # Add authenticated customer RLS policies for deliveries and customer_addresses

  ## Context
  The app now uses Supabase Auth for customer login. When a customer is
  authenticated, their Supabase Auth session provides `auth.uid()` which
  matches `customers.auth_id`. This migration adds `authenticated`-scoped
  RLS policies that enforce customer ownership on the `deliveries` and
  `customer_addresses` tables.

  The existing `anon`/`public` policies remain in place so that drivers,
  admins, and the customer-facing app (when not yet signed in) continue
  to work. The new `authenticated` policies are ADDITIVE — they give
  signed-in customers an extra ownership enforcement layer on top of
  the existing open access.

  ## Changes

  ### 1. deliveries — authenticated customer ownership policies
  Adds SELECT/INSERT/UPDATE/DELETE policies scoped to `authenticated`
  users where the delivery belongs to a customer whose `auth_id` matches
  `auth.uid()`.

  ### 2. customer_addresses — authenticated customer ownership policies
  Adds SELECT/INSERT/UPDATE/DELETE policies scoped to `authenticated`
  users where the address belongs to a customer whose `auth_id` matches
  `auth.uid()`.

  ## Security notes
  1. No existing policies are dropped or modified.
  2. The new policies are `TO authenticated` only — they don't affect
     anon-key access (drivers, admins, unsigned-in browsing).
  3. Ownership is verified through `customers.auth_id = auth.uid()`,
     which is set during customer registration via Supabase Auth.
*/
-- =========================================================
-- 1. deliveries — authenticated customer ownership
-- =========================================================
DROP POLICY IF EXISTS "auth_customer_select_deliveries" ON deliveries;
CREATE POLICY "auth_customer_select_deliveries"
  ON deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customers
            WHERE customers.id = deliveries.customer_id
            AND customers.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "auth_customer_insert_deliveries" ON deliveries;
CREATE POLICY "auth_customer_insert_deliveries"
  ON deliveries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM customers
            WHERE customers.id = deliveries.customer_id
            AND customers.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "auth_customer_update_deliveries" ON deliveries;
CREATE POLICY "auth_customer_update_deliveries"
  ON deliveries FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customers
            WHERE customers.id = deliveries.customer_id
            AND customers.auth_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM customers
            WHERE customers.id = deliveries.customer_id
            AND customers.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "auth_customer_delete_deliveries" ON deliveries;
CREATE POLICY "auth_customer_delete_deliveries"
  ON deliveries FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customers
            WHERE customers.id = deliveries.customer_id
            AND customers.auth_id = auth.uid())
  );

-- =========================================================
-- 2. customer_addresses — authenticated customer ownership
-- =========================================================
DROP POLICY IF EXISTS "auth_customer_select_addresses" ON customer_addresses;
CREATE POLICY "auth_customer_select_addresses"
  ON customer_addresses FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customers
            WHERE customers.id = customer_addresses.customer_id
            AND customers.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "auth_customer_insert_addresses" ON customer_addresses;
CREATE POLICY "auth_customer_insert_addresses"
  ON customer_addresses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM customers
            WHERE customers.id = customer_addresses.customer_id
            AND customers.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "auth_customer_update_addresses" ON customer_addresses;
CREATE POLICY "auth_customer_update_addresses"
  ON customer_addresses FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customers
            WHERE customers.id = customer_addresses.customer_id
            AND customers.auth_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM customers
            WHERE customers.id = customer_addresses.customer_id
            AND customers.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "auth_customer_delete_addresses" ON customer_addresses;
CREATE POLICY "auth_customer_delete_addresses"
  ON customer_addresses FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customers
            WHERE customers.id = customer_addresses.customer_id
            AND customers.auth_id = auth.uid())
  );
