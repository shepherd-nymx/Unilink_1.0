/*
# Add driver distance-based delivery fee tiers

## Purpose
Messengers can set the delivery fee they charge based on the distance (in km) from their base location to the customer. When a customer selects a messenger for a customer-assigned shop order, the system looks up the fee tier matching the distance and charges that amount.

## Changes

### 1. New table: `driver_distance_fee_tiers`
- `id` (uuid, primary key)
- `driver_id` (uuid, foreign key to drivers.id, ON DELETE CASCADE)
- `min_km` (numeric, not null) — minimum distance for this tier
- `max_km` (numeric, nullable) — maximum distance for this tier (null = open-ended)
- `fee` (numeric, not null) — the delivery fee in USD for this distance range
- `label` (text, nullable) — optional human-readable label
- `sort_order` (integer, default 0)
- `created_at` (timestamptz, default now())

### 2. Update `get_nearby_drivers` RPC
Adds a `distance_fee` column. The function looks up the driver's fee tier matching the calculated distance_km and returns the fee. If no tier matches, returns NULL.

### 3. RLS
- Drivers can CRUD their own fee tiers (ownership via driver_id = auth.uid()).
- Public can SELECT fee tiers.
*/

CREATE TABLE IF NOT EXISTS driver_distance_fee_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  min_km numeric NOT NULL DEFAULT 0,
  max_km numeric,
  fee numeric NOT NULL DEFAULT 0,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE driver_distance_fee_tiers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_driver_distance_fee_tiers_driver ON driver_distance_fee_tiers(driver_id);

DROP POLICY IF EXISTS "select_driver_distance_fee_tiers" ON driver_distance_fee_tiers;
CREATE POLICY "select_driver_distance_fee_tiers"
  ON driver_distance_fee_tiers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_driver_distance_fee_tiers" ON driver_distance_fee_tiers;
CREATE POLICY "insert_own_driver_distance_fee_tiers"
  ON driver_distance_fee_tiers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_id AND d.id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_driver_distance_fee_tiers" ON driver_distance_fee_tiers;
CREATE POLICY "update_own_driver_distance_fee_tiers"
  ON driver_distance_fee_tiers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_id AND d.id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_id AND d.id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_driver_distance_fee_tiers" ON driver_distance_fee_tiers;
CREATE POLICY "delete_own_driver_distance_fee_tiers"
  ON driver_distance_fee_tiers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_id AND d.id = auth.uid())
  );

DROP FUNCTION IF EXISTS public.get_nearby_drivers(double precision, double precision, uuid);

CREATE FUNCTION public.get_nearby_drivers(
  p_customer_lat double precision DEFAULT NULL,
  p_customer_lng double precision DEFAULT NULL,
  p_university_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  full_name text,
  phone_number text,
  whatsapp_number text,
  average_rating numeric,
  vehicle_type text,
  delivery_type text,
  profile_picture_url text,
  is_available boolean,
  completed_deliveries bigint,
  home_latitude double precision,
  home_longitude double precision,
  home_address text,
  distance_km double precision,
  distance_fee numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    (
      SELECT COUNT(*) FROM deliveries
      WHERE deliveries.driver_id = d.id AND deliveries.status = 'delivered'
    ) + (
      SELECT COUNT(*) FROM shop_orders
      WHERE shop_orders.messenger_id = d.id AND shop_orders.status = 'delivered'
    ) AS completed_deliveries,
    d.home_latitude,
    d.home_longitude,
    d.home_address,
    CASE
      WHEN p_customer_lat IS NOT NULL AND p_customer_lng IS NOT NULL
        AND d.home_latitude IS NOT NULL AND d.home_longitude IS NOT NULL
      THEN
        6371 * acos(
          greatest(-1.0, least(1.0,
            cos(radians(p_customer_lat)) * cos(radians(d.home_latitude)) *
            cos(radians(d.home_longitude) - radians(p_customer_lng)) +
            sin(radians(p_customer_lat)) * sin(radians(d.home_latitude))
          ))
        )
      ELSE NULL
    END AS distance_km,
    (
      SELECT t.fee FROM driver_distance_fee_tiers t
      WHERE t.driver_id = d.id
        AND (
          (CASE
            WHEN p_customer_lat IS NOT NULL AND p_customer_lng IS NOT NULL
              AND d.home_latitude IS NOT NULL AND d.home_longitude IS NOT NULL
            THEN
              6371 * acos(
                greatest(-1.0, least(1.0,
                  cos(radians(p_customer_lat)) * cos(radians(d.home_latitude)) *
                  cos(radians(d.home_longitude) - radians(p_customer_lng)) +
                  sin(radians(p_customer_lat)) * sin(radians(d.home_latitude))
                ))
              )
            ELSE NULL
          END) >= t.min_km
        )
        AND (t.max_km IS NULL OR
          (CASE
            WHEN p_customer_lat IS NOT NULL AND p_customer_lng IS NOT NULL
              AND d.home_latitude IS NOT NULL AND d.home_longitude IS NOT NULL
            THEN
              6371 * acos(
                greatest(-1.0, least(1.0,
                  cos(radians(p_customer_lat)) * cos(radians(d.home_latitude)) *
                  cos(radians(d.home_longitude) - radians(p_customer_lng)) +
                  sin(radians(p_customer_lat)) * sin(radians(d.home_latitude))
                ))
              )
            ELSE NULL
          END) < t.max_km
        )
      ORDER BY t.sort_order ASC, t.min_km ASC
      LIMIT 1
    ) AS distance_fee
  FROM drivers d
  WHERE d.approval_status = 'approved'
    AND d.suspended = false
    AND d.is_available = true
    AND d.key_expires_at IS NOT NULL
    AND d.key_expires_at > now()
    AND (
      d.subscription_status = 'active'
      OR (d.subscription_expiry IS NOT NULL AND d.subscription_expiry > now())
    )
    AND d.home_latitude IS NOT NULL
    AND d.home_longitude IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM active_driver_tokens adt
      WHERE adt.user_id = d.id
    )
    AND (
      p_university_id IS NULL
      OR d.active_university_id = p_university_id
      OR d.university_id = p_university_id
    )
  ORDER BY
    distance_km ASC NULLS LAST,
    d.average_rating DESC NULLS LAST;
$function$;
