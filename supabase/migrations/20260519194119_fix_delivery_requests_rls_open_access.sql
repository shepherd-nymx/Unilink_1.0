/*
  # Fix delivery_requests RLS for driver visibility

  ## Context
  UniLink uses custom authentication (phone/password stored in drivers/customers tables),
  NOT Supabase Auth. Therefore auth.uid() is always null for app queries. RLS must be
  permissive for the anon role (which the app uses via the anon key) while still being
  meaningful at the row level via application-level filtering.

  ## Fix
  - Allow anon role to SELECT/INSERT/UPDATE all three tables (app enforces data isolation)
  - Keep the authenticated role policies in case Supabase Auth is added later
  - Remove broken policies that reference auth.uid() since it's always null
*/

-- =========================================================
-- delivery_requests — drop all old policies, add clean ones
-- =========================================================
DROP POLICY IF EXISTS "Customers can view own delivery requests" ON delivery_requests;
DROP POLICY IF EXISTS "Customers can insert own delivery requests" ON delivery_requests;
DROP POLICY IF EXISTS "Customers and drivers can update delivery requests" ON delivery_requests;
DROP POLICY IF EXISTS "Service role full access to delivery_requests" ON delivery_requests;
DROP POLICY IF EXISTS "delivery_requests_select" ON delivery_requests;
DROP POLICY IF EXISTS "delivery_requests_insert" ON delivery_requests;
DROP POLICY IF EXISTS "delivery_requests_update" ON delivery_requests;

CREATE POLICY "delivery_requests_anon_select"
  ON delivery_requests FOR SELECT TO anon USING (true);

CREATE POLICY "delivery_requests_anon_insert"
  ON delivery_requests FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "delivery_requests_anon_update"
  ON delivery_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "delivery_requests_auth_select"
  ON delivery_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "delivery_requests_auth_insert"
  ON delivery_requests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "delivery_requests_auth_update"
  ON delivery_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- delivery_request_buy_details
-- =========================================================
DROP POLICY IF EXISTS "Buy details readable by request parties" ON delivery_request_buy_details;
DROP POLICY IF EXISTS "Buy details insertable by authenticated" ON delivery_request_buy_details;
DROP POLICY IF EXISTS "Buy details updatable by authenticated" ON delivery_request_buy_details;
DROP POLICY IF EXISTS "buy_details_select" ON delivery_request_buy_details;
DROP POLICY IF EXISTS "buy_details_insert" ON delivery_request_buy_details;
DROP POLICY IF EXISTS "buy_details_update" ON delivery_request_buy_details;

CREATE POLICY "buy_details_anon_select" ON delivery_request_buy_details FOR SELECT TO anon USING (true);
CREATE POLICY "buy_details_anon_insert" ON delivery_request_buy_details FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "buy_details_anon_update" ON delivery_request_buy_details FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "buy_details_auth_select" ON delivery_request_buy_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "buy_details_auth_insert" ON delivery_request_buy_details FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "buy_details_auth_update" ON delivery_request_buy_details FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- delivery_request_pickup_details
-- =========================================================
DROP POLICY IF EXISTS "Pickup details readable by request parties" ON delivery_request_pickup_details;
DROP POLICY IF EXISTS "Pickup details insertable by authenticated" ON delivery_request_pickup_details;
DROP POLICY IF EXISTS "Pickup details updatable by authenticated" ON delivery_request_pickup_details;
DROP POLICY IF EXISTS "pickup_details_select" ON delivery_request_pickup_details;
DROP POLICY IF EXISTS "pickup_details_insert" ON delivery_request_pickup_details;
DROP POLICY IF EXISTS "pickup_details_update" ON delivery_request_pickup_details;

CREATE POLICY "pickup_details_anon_select" ON delivery_request_pickup_details FOR SELECT TO anon USING (true);
CREATE POLICY "pickup_details_anon_insert" ON delivery_request_pickup_details FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "pickup_details_anon_update" ON delivery_request_pickup_details FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "pickup_details_auth_select" ON delivery_request_pickup_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "pickup_details_auth_insert" ON delivery_request_pickup_details FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pickup_details_auth_update" ON delivery_request_pickup_details FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
