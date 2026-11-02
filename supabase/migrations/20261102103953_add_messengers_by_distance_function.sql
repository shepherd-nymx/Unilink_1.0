/*
# Messenger selection by distance for a shop

1. New Function
- `get_messengers_by_distance(p_shop_id, p_customer_lat, p_customer_lng)` returns the messengers who can take work for a shop, nearest first.
- Each row has: id, full_name, profile_picture_url, average_rating, vehicle_type, distance_km (rounded to 2 decimals).
- Coordinates of messengers are never returned; only the distance is.

2. Eligibility (all required)
- Messenger is eligible under the existing rules (approved, not suspended, active subscription/token), via `is_driver_eligible`.
- Messenger has chosen to work for the shop (row in `driver_shop_preferences`).
- Messenger is marked available (`is_available = true`).
- Messenger has a saved home location. Messengers without one are excluded because their distance cannot be checked.

3. Security
- Read-only function; executable by the anon and authenticated roles because the customer app uses the anon key.
- Runs as SECURITY DEFINER with a fixed search_path so it can read driver rows the customer cannot read directly.

4. Important Notes
- Distance is the great-circle (haversine) distance in kilometres.
- Invalid customer coordinates return no rows.
*/

CREATE OR REPLACE FUNCTION public.get_messengers_by_distance(
  p_shop_id uuid,
  p_customer_lat double precision,
  p_customer_lng double precision
)
RETURNS TABLE (
  id uuid,
  full_name text,
  profile_picture_url text,
  average_rating numeric,
  vehicle_type text,
  distance_km numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ranked.id, ranked.full_name, ranked.profile_picture_url, ranked.average_rating, ranked.vehicle_type, ranked.distance_km
  FROM (
    SELECT
      d.id,
      d.full_name,
      d.profile_picture_url,
      d.average_rating,
      d.vehicle_type,
      round((
        6371 * 2 * asin(sqrt(
          power(sin(radians(d.home_latitude - p_customer_lat) / 2), 2)
          + cos(radians(p_customer_lat)) * cos(radians(d.home_latitude))
            * power(sin(radians(d.home_longitude - p_customer_lng) / 2), 2)
        ))
      )::numeric, 2) AS distance_km
    FROM drivers d
    JOIN driver_shop_preferences dsp
      ON dsp.driver_id = d.id AND dsp.shop_id = p_shop_id
    WHERE d.is_available = true
      AND d.home_latitude IS NOT NULL
      AND d.home_longitude IS NOT NULL
      AND p_customer_lat BETWEEN -90 AND 90
      AND p_customer_lng BETWEEN -180 AND 180
      AND public.is_driver_eligible(d.id)
  ) ranked
  ORDER BY ranked.distance_km ASC, ranked.full_name ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_messengers_by_distance(uuid, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_messengers_by_distance(uuid, double precision, double precision) TO anon, authenticated;
