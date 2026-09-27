/*
# Update get_nearby_drivers to accept shop driver region filter

## Changes
- Add parameter p_driver_region_ids (uuid[]) default NULL.
- When provided, filter drivers to those whose university_id or
  active_university_id matches any of the provided region IDs.
- When NULL, fall back to p_university_id (existing behaviour).
*/

DROP FUNCTION IF EXISTS public.get_nearby_drivers(
  p_customer_lat double precision,
  p_customer_lng double precision,
  p_university_id uuid
);

CREATE OR REPLACE FUNCTION public.get_nearby_drivers(
  p_customer_lat double precision DEFAULT NULL,
  p_customer_lng double precision DEFAULT NULL,
  p_university_id uuid DEFAULT NULL,
  p_driver_region_ids uuid[] DEFAULT NULL
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
    AND EXISTS (
      SELECT 1 FROM active_driver_tokens adt
      WHERE adt.user_id = d.id
    )
    AND (
      CASE
        WHEN p_driver_region_ids IS NOT NULL AND array_length(p_driver_region_ids, 1) > 0 THEN
          d.university_id = ANY(p_driver_region_ids)
          OR d.active_university_id = ANY(p_driver_region_ids)
        WHEN p_university_id IS NOT NULL THEN
          d.active_university_id = p_university_id
          OR d.university_id = p_university_id
        ELSE true
      END
    )
  ORDER BY
    distance_km ASC NULLS LAST,
    d.average_rating DESC NULLS LAST;
$function$;
