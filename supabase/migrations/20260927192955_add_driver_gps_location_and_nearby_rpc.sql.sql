/*
# Add driver GPS location and nearby driver lookup

## Purpose
Allows customers to see all verified, online messengers sorted by distance from their location, and pick the closest one when placing an order at a shop that uses customer-assigned driver mode.

## Changes

### 1. New columns on `drivers` table
- `home_latitude` (double precision, nullable) — the driver's registered home/base GPS latitude
- `home_longitude` (double precision, nullable) — the driver's registered home/base GPS longitude
- `home_address` (text, nullable) — a human-readable label for the driver's registered location (e.g. "Near UZ Maths Dept")

These are set by the driver in their settings page. They represent where the driver is typically based, not a live tracking ping.

### 2. New function: `get_nearby_drivers`
Returns all approved, non-suspended, available drivers who:
- Have an active subscription or valid subscription expiry
- Have a live push token (entry in `active_driver_tokens` view, meaning they've been active on mobile in the last 30 days)
- Have `home_latitude` and `home_longitude` set

The function accepts the customer's latitude/longitude and returns each driver's GPS coordinates plus the haversine distance in km. Results are sorted nearest-first.

### 3. RLS
No new tables. The new columns are covered by existing driver RLS policies (drivers can update their own row, public can read approved drivers). The function is SECURITY DEFINER so it bypasses RLS to join with `device_tokens`.

## Important notes
1. The `home_latitude`/`home_longitude` columns are nullable — existing drivers won't have GPS set until they update their settings.
2. The function filters to only drivers WITH GPS coordinates, so drivers who haven't set their location won't appear in the nearby list.
3. The `active_driver_tokens` view already filters to drivers active on mobile in the last 30 days — this is the "live token" check.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND table_schema = 'public' AND column_name = 'home_latitude'
  ) THEN
    ALTER TABLE drivers ADD COLUMN home_latitude double precision;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND table_schema = 'public' AND column_name = 'home_longitude'
  ) THEN
    ALTER TABLE drivers ADD COLUMN home_longitude double precision;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND table_schema = 'public' AND column_name = 'home_address'
  ) THEN
    ALTER TABLE drivers ADD COLUMN home_address text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_nearby_drivers(
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
  distance_km double precision
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
    END AS distance_km
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
