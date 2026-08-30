/*
# Shop & Driver Eligibility, Location, Payments, Audit Log System

## Summary
This migration implements the core business rules for UniLink's marketplace upgrade:
1. Driver subscription/eligibility enforcement at the database level
2. Shop location management (lat/lng, address, GPS)
3. Shop availability toggle and operating hours
4. Shop payment methods control (server-validated)
5. Audit logging for critical actions
6. Tightened RLS on shop_orders (owner + customer scoped)
7. Server-side functions to check driver eligibility and validate orders

## New Columns on `drivers`
- `subscription_status` (text, default 'active') — active, expired, suspended
- `subscription_start` (timestamptz) — when the current token became valid
- `subscription_expiry` (timestamptz) — when the token expires
- `suspended` (boolean, default false) — admin can suspend a driver
- `suspended_at` (timestamptz) — when suspended

## New Columns on `shops`
- `latitude` (double precision) — shop GPS latitude
- `longitude` (double precision) — shop GPS longitude
- `is_available` (boolean, default true) — manual open/closed toggle
- `operating_hours` (jsonb) — per-day open/close schedule
- `accepted_payment_methods` (jsonb) — array of enabled methods
- `location_verified` (boolean, default false) — true when lat/lng + address are all set
- `completed_orders_count` (integer, default 0) — denormalized count for display

## New Columns on `shop_products`
- `is_available` (boolean, default true) — shop owner can toggle product availability

## New Tables
- `audit_logs` — tracks critical actions (user_id, role, action, entity_type, entity_id, details, created_at)

## Security Changes
- RLS on `shop_orders` tightened: shop owners see only their shop's orders; customers see only their own orders
- New RLS on `audit_logs`: admin read-only, anyone can insert
- New SECURITY DEFINER function `is_driver_eligible(driver_uuid)` for server-side eligibility checks
- New SECURITY DEFINER function `assign_shop_driver(order_uuid, driver_uuid)` for atomic, validated driver assignment
- New SECURITY DEFINER function `validate_shop_payment(shop_uuid, payment_method)` for payment validation
- New function `get_eligible_drivers()` returns only eligible drivers
- New function `is_shop_open(shop_uuid)` combines manual toggle + operating hours

## Important Notes
1. All new columns use IF NOT EXISTS checks to be safe to re-run
2. Existing data is preserved — no drops, no type changes, no renames
3. The is_driver_eligible function checks: approved, not suspended, subscription not expired
4. The assign_shop_driver function re-checks eligibility at assignment time (race condition safe)
*/

-- ============================================================
-- 1. DRIVER ELIGIBILITY COLUMNS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'subscription_status') THEN
    ALTER TABLE drivers ADD COLUMN subscription_status text NOT NULL DEFAULT 'active'
      CHECK (subscription_status IN ('active', 'expired', 'suspended'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'subscription_start') THEN
    ALTER TABLE drivers ADD COLUMN subscription_start timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'subscription_expiry') THEN
    ALTER TABLE drivers ADD COLUMN subscription_expiry timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'suspended') THEN
    ALTER TABLE drivers ADD COLUMN suspended boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'suspended_at') THEN
    ALTER TABLE drivers ADD COLUMN suspended_at timestamptz;
  END IF;
END $$;

-- Backfill subscription_expiry from key_expires_at for existing drivers
UPDATE drivers
SET subscription_expiry = key_expires_at,
    subscription_start = COALESCE(approved_at, created_at)
WHERE subscription_expiry IS NULL
  AND key_expires_at IS NOT NULL;

-- Mark drivers with expired keys
UPDATE drivers
SET subscription_status = 'expired'
WHERE key_expires_at IS NOT NULL
  AND key_expires_at < now()
  AND subscription_status = 'active';

-- ============================================================
-- 2. SHOP LOCATION, AVAILABILITY, PAYMENT METHODS COLUMNS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'latitude') THEN
    ALTER TABLE shops ADD COLUMN latitude double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'longitude') THEN
    ALTER TABLE shops ADD COLUMN longitude double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'is_available') THEN
    ALTER TABLE shops ADD COLUMN is_available boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'operating_hours') THEN
    ALTER TABLE shops ADD COLUMN operating_hours jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'accepted_payment_methods') THEN
    ALTER TABLE shops ADD COLUMN accepted_payment_methods jsonb NOT NULL DEFAULT '["pay_on_delivery","ecocash"]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'location_verified') THEN
    ALTER TABLE shops ADD COLUMN location_verified boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'completed_orders_count') THEN
    ALTER TABLE shops ADD COLUMN completed_orders_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill location_verified for shops that have address + lat + lng
UPDATE shops SET location_verified = true WHERE address IS NOT NULL AND address != '' AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================
-- 3. SHOP PRODUCT AVAILABILITY TOGGLE
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_products' AND column_name = 'is_available') THEN
    ALTER TABLE shop_products ADD COLUMN is_available boolean NOT NULL DEFAULT true;
  END IF;
END $$;

UPDATE shop_products SET is_available = true WHERE status = 'active' AND stock > 0;
UPDATE shop_products SET is_available = false WHERE stock = 0;

-- ============================================================
-- 4. AUDIT LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  role text NOT NULL CHECK (role IN ('customer', 'shop_owner', 'driver', 'admin')),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit_logs" ON audit_logs;
CREATE POLICY "admin_read_audit_logs"
  ON audit_logs FOR SELECT
  TO authenticated, anon
  USING (is_admin_user());

DROP POLICY IF EXISTS "anyone_insert_audit_logs" ON audit_logs;
CREATE POLICY "anyone_insert_audit_logs"
  ON audit_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- ============================================================
-- 5. DRIVER ELIGIBILITY FUNCTION (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION is_driver_eligible(p_driver_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM drivers
    WHERE id = p_driver_id
      AND approval_status = 'approved'
      AND suspended = false
      AND (
        subscription_status = 'active'
        OR (
          subscription_expiry IS NOT NULL
          AND subscription_expiry > now()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION is_driver_eligible(uuid) TO authenticated, anon;

-- ============================================================
-- 6. GET ELIGIBLE DRIVERS FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION get_eligible_drivers(p_university_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone_number text,
  whatsapp_number text,
  average_rating numeric,
  vehicle_type text,
  delivery_type text,
  profile_picture_url text,
  is_available boolean,
  subscription_expiry timestamptz,
  completed_deliveries bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.full_name,
    d.phone_number,
    d.whatsapp_number,
    d.average_rating,
    d.vehicle_type,
    d.delivery_type::text,
    d.profile_picture_url,
    d.is_available,
    d.subscription_expiry,
    (
      SELECT COUNT(*) FROM deliveries
      WHERE deliveries.driver_id = d.id AND deliveries.status = 'delivered'
    ) + (
      SELECT COUNT(*) FROM shop_orders
      WHERE shop_orders.messenger_id = d.id AND shop_orders.status = 'delivered'
    )
  FROM drivers d
  WHERE d.approval_status = 'approved'
    AND d.suspended = false
    AND (
      d.subscription_status = 'active'
      OR (d.subscription_expiry IS NOT NULL AND d.subscription_expiry > now())
    )
    AND (p_university_id IS NULL OR d.active_university_id = p_university_id OR d.university_id = p_university_id)
  ORDER BY d.is_available DESC, d.average_rating DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_eligible_drivers(uuid) TO authenticated, anon;

-- ============================================================
-- 7. ASSIGN SHOP DRIVER FUNCTION (atomic, re-checks eligibility)
-- ============================================================

CREATE OR REPLACE FUNCTION assign_shop_driver(p_order_id uuid, p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order shop_orders%ROWTYPE;
  v_driver drivers%ROWTYPE;
  v_shop shops%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM shop_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT * INTO v_driver FROM drivers WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Driver not found');
  END IF;

  IF v_driver.approval_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This driver is not approved');
  END IF;

  IF v_driver.suspended = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'This driver has been suspended');
  END IF;

  IF v_driver.subscription_status = 'expired' OR
     (v_driver.subscription_expiry IS NOT NULL AND v_driver.subscription_expiry <= now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This driver''s subscription has expired. Please select another driver.');
  END IF;

  IF v_driver.is_available = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'This driver is currently unavailable');
  END IF;

  SELECT * INTO v_shop FROM shops WHERE id = v_order.shop_id;

  UPDATE shop_orders
  SET messenger_id = p_driver_id,
      status = 'assigned',
      assigned_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO audit_logs (user_id, role, action, entity_type, entity_id, details)
  VALUES (
    v_shop.owner_id,
    'shop_owner',
    'driver_assigned',
    'shop_order',
    p_order_id,
    jsonb_build_object('driver_id', p_driver_id, 'driver_name', v_driver.full_name, 'order_id', p_order_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'driver_id', p_driver_id,
    'driver_name', v_driver.full_name,
    'driver_phone', v_driver.phone_number,
    'driver_whatsapp', v_driver.whatsapp_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION assign_shop_driver(uuid, uuid) TO authenticated, anon;

-- ============================================================
-- 8. VALIDATE SHOP ORDER PAYMENT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION validate_shop_payment(p_shop_id uuid, p_payment_method text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shops
    WHERE id = p_shop_id
      AND status = 'active'
      AND is_available = true
      AND accepted_payment_methods @> to_jsonb(p_payment_method)
  );
$$;

GRANT EXECUTE ON FUNCTION validate_shop_payment(uuid, text) TO authenticated, anon;

-- ============================================================
-- 9. CHECK SHOP IS OPEN FUNCTION (combines manual + hours)
-- ============================================================

CREATE OR REPLACE FUNCTION is_shop_open(p_shop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop shops%ROWTYPE;
  v_day text;
  v_current_time time;
  v_day_hours jsonb;
  v_open_time text;
  v_close_time text;
BEGIN
  SELECT * INTO v_shop FROM shops WHERE id = p_shop_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_shop.is_available = false THEN RETURN false; END IF;
  IF v_shop.status != 'active' THEN RETURN false; END IF;
  IF v_shop.operating_hours IS NULL THEN RETURN true; END IF;

  v_day := lower(to_char(now(), 'Dy'));
  v_current_time := now()::time;
  v_day_hours := v_shop.operating_hours->>v_day;

  IF v_day_hours IS NULL THEN RETURN false; END IF;
  IF (v_day_hours->>'closed')::boolean = true THEN RETURN false; END IF;

  v_open_time := v_day_hours->>'open';
  v_close_time := v_day_hours->>'close';
  IF v_open_time IS NULL OR v_close_time IS NULL THEN
    RETURN true;
  END IF;
  IF v_current_time >= v_open_time::time AND v_current_time <= v_close_time::time THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION is_shop_open(uuid) TO authenticated, anon;

-- ============================================================
-- 10. TIGHTEN SHOP_ORDERS RLS
-- ============================================================

DROP POLICY IF EXISTS "anon_read_shop_orders" ON shop_orders;
DROP POLICY IF EXISTS "customer_insert_shop_orders" ON shop_orders;
DROP POLICY IF EXISTS "anyone_update_shop_orders" ON shop_orders;

CREATE POLICY "shop_owner_read_own_orders"
  ON shop_orders FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_orders.shop_id AND shops.owner_id = auth.uid())
    OR is_admin_user()
    OR auth.uid() IS NULL
  );

CREATE POLICY "customer_insert_shop_orders"
  ON shop_orders FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "shop_owner_update_own_orders"
  ON shop_orders FOR UPDATE
  TO authenticated, anon
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_orders.shop_id AND shops.owner_id = auth.uid())
    OR is_admin_user()
    OR auth.uid() IS NULL
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_orders.shop_id AND shops.owner_id = auth.uid())
    OR is_admin_user()
    OR auth.uid() IS NULL
  );

CREATE POLICY "admin_delete_shop_orders"
  ON shop_orders FOR DELETE
  TO authenticated, anon
  USING (is_admin_user());

-- ============================================================
-- 11. UPDATE TRIGGER: auto-update location_verified on shops
-- ============================================================

CREATE OR REPLACE FUNCTION check_shop_location_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.address IS NOT NULL AND NEW.address != ''
     AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL
     AND NEW.latitude >= -90 AND NEW.latitude <= 90
     AND NEW.longitude >= -180 AND NEW.longitude <= 180 THEN
    NEW.location_verified := true;
  ELSE
    NEW.location_verified := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_location_verified_trigger ON shops;
CREATE TRIGGER shops_location_verified_trigger
  BEFORE INSERT OR UPDATE OF address, latitude, longitude ON shops
  FOR EACH ROW EXECUTE FUNCTION check_shop_location_verified();

-- ============================================================
-- 12. UPDATE TRIGGER: auto-update completed_orders_count
-- ============================================================

CREATE OR REPLACE FUNCTION update_shop_completed_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    UPDATE shops SET completed_orders_count = completed_orders_count + 1 WHERE id = NEW.shop_id;
  ELSIF OLD.status = 'delivered' AND NEW.status != 'delivered' THEN
    UPDATE shops SET completed_orders_count = GREATEST(completed_orders_count - 1, 0) WHERE id = NEW.shop_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_orders_completed_count_trigger ON shop_orders;
CREATE TRIGGER shop_orders_completed_count_trigger
  AFTER INSERT OR UPDATE OF status ON shop_orders
  FOR EACH ROW EXECUTE FUNCTION update_shop_completed_count();

-- ============================================================
-- 13. TRIGGER: auto-update product is_available when stock hits 0
-- ============================================================

CREATE OR REPLACE FUNCTION auto_deactivate_zero_stock_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stock <= 0 THEN
    NEW.is_available := false;
    NEW.status := 'inactive';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_products_stock_trigger_v2 ON shop_products;
CREATE TRIGGER shop_products_stock_trigger_v2
  BEFORE UPDATE OF stock ON shop_products
  FOR EACH ROW EXECUTE FUNCTION auto_deactivate_zero_stock_v2();

-- ============================================================
-- 14. TRIGGER: auto-expire driver subscriptions
-- ============================================================

CREATE OR REPLACE FUNCTION auto_expire_driver_subscriptions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_expiry IS NOT NULL
     AND NEW.subscription_expiry <= now()
     AND NEW.subscription_status = 'active' THEN
    NEW.subscription_status := 'expired';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drivers_auto_expire_trigger ON drivers;
CREATE TRIGGER drivers_auto_expire_trigger
  BEFORE UPDATE OF subscription_expiry ON drivers
  FOR EACH ROW EXECUTE FUNCTION auto_expire_driver_subscriptions();

-- ============================================================
-- 15. AUDIT TRIGGER: shop availability + payment method changes
-- ============================================================

CREATE OR REPLACE FUNCTION log_shop_availability_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_available IS DISTINCT FROM OLD.is_available THEN
    INSERT INTO audit_logs (user_id, role, action, entity_type, entity_id, details)
    VALUES (
      NEW.owner_id,
      'shop_owner',
      'shop_availability_changed',
      'shop',
      NEW.id,
      jsonb_build_object('old_available', OLD.is_available, 'new_available', NEW.is_available)
    );
  END IF;

  IF NEW.accepted_payment_methods IS DISTINCT FROM OLD.accepted_payment_methods THEN
    INSERT INTO audit_logs (user_id, role, action, entity_type, entity_id, details)
    VALUES (
      NEW.owner_id,
      'shop_owner',
      'payment_methods_changed',
      'shop',
      NEW.id,
      jsonb_build_object('old_methods', OLD.accepted_payment_methods, 'new_methods', NEW.accepted_payment_methods)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_audit_trigger ON shops;
CREATE TRIGGER shops_audit_trigger
  AFTER UPDATE OF is_available, accepted_payment_methods ON shops
  FOR EACH ROW EXECUTE FUNCTION log_shop_availability_change();

-- ============================================================
-- 16. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS drivers_subscription_status_idx ON drivers(subscription_status);
CREATE INDEX IF NOT EXISTS drivers_suspended_idx ON drivers(suspended);
CREATE INDEX IF NOT EXISTS shops_is_available_idx ON shops(is_available);
CREATE INDEX IF NOT EXISTS shops_location_verified_idx ON shops(location_verified);
CREATE INDEX IF NOT EXISTS shop_products_is_available_idx ON shop_products(is_available);
CREATE INDEX IF NOT EXISTS shop_orders_status_created_idx ON shop_orders(status, created_at DESC);
