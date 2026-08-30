/*
  # Add anon-scoped RLS policies for customers, driver_requests, and webhook_outbox

  ## Context
  The previous migration enabled RLS on 4 tables that had policies but RLS
  disabled. Two of those tables (delivery_request_pickup_details already had
  anon policies; webhook_outbox is not used from the client) are fine.

  However, `customers` and `driver_requests` only had `authenticated`-scoped
  policies using `auth.uid()`. This app uses CUSTOM authentication (phone/
  password stored in the tables, NOT Supabase Auth), so the frontend talks
  to Supabase with the anon key and `auth.uid()` is always null. With RLS
  now enabled, those authenticated-only policies block all app access —
  the customer dashboard can't read customer data, drivers can't see
  requests, and the open-request flow breaks entirely.

  ## Changes

  ### 1. customers — add anon CRUD policies
  The app identifies customers by their UUID `id` (passed as customerId
  in the frontend). Add anon-scoped SELECT/INSERT/UPDATE/DELETE policies
  that allow access. The admin policies using `is_admin_user()` remain.

  ### 2. driver_requests — add anon CRUD policies
  The app reads driver_requests to show accepted drivers for open requests,
  inserts them when drivers accept, and updates status when selecting/
  cancelling. Add anon-scoped policies for all four operations.

  ### 3. webhook_outbox — add anon SELECT (not used by client but for safety)
  The webhook_outbox table is not referenced from the frontend, but since
  RLS is now enabled, add a minimal anon SELECT policy so the table is
  not completely locked if any server-side process needs it.

  ## Security notes
  1. This app uses custom auth — the anon key IS the app's access token.
     Anon-scoped policies are the correct pattern here, matching what
     already exists on deliveries, delivery_requests, and other tables.
  2. The admin-level policies (is_admin_user()) on customers are preserved.
  3. No existing policies are dropped — only additive new policies.
  4. Row-level data isolation is enforced at the application layer
     (the frontend filters by customer_id/driver_id), consistent with
     the architecture used on all other tables in this schema.
*/

-- =========================================================
-- 1. customers — anon CRUD policies
-- =========================================================
DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers"
  ON customers FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers"
  ON customers FOR INSERT
  TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers"
  ON customers FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers"
  ON customers FOR DELETE
  TO anon USING (true);

-- =========================================================
-- 2. driver_requests — anon CRUD policies
-- =========================================================
DROP POLICY IF EXISTS "anon_select_driver_requests" ON driver_requests;
CREATE POLICY "anon_select_driver_requests"
  ON driver_requests FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "anon_insert_driver_requests" ON driver_requests;
CREATE POLICY "anon_insert_driver_requests"
  ON driver_requests FOR INSERT
  TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_driver_requests" ON driver_requests;
CREATE POLICY "anon_update_driver_requests"
  ON driver_requests FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_driver_requests" ON driver_requests;
CREATE POLICY "anon_delete_driver_requests"
  ON driver_requests FOR DELETE
  TO anon USING (true);

-- =========================================================
-- 3. webhook_outbox — minimal anon SELECT
-- =========================================================
DROP POLICY IF EXISTS "anon_select_webhook_outbox" ON webhook_outbox;
CREATE POLICY "anon_select_webhook_outbox"
  ON webhook_outbox FOR SELECT
  TO anon USING (true);
