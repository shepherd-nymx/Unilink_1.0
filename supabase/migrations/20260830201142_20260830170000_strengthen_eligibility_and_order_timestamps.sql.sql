/*
# Strengthen Messenger Eligibility & Add Order Status Timestamps

## Overview
This migration does two things:
1. Strengthens the get_eligible_drivers function to also enforce is_available = true
   and a valid (non-expired) monthly token (key_expires_at > now), in addition to the
   existing approval_status = 'approved', suspended = false, and subscription checks.
   This ensures backend-enforced eligibility — the UI is not the sole gatekeeper.
2. Adds missing status timestamp columns to the deliveries table for proper order
   lifecycle tracking: picked_up_at and cancelled_at. The accepted_at and delivered_at
   columns already exist.

## Changes

### 1. get_eligible_drivers (modified)
The function now also filters on:
- d.is_available = true  (messenger must be marked available)
- d.key_expires_at IS NOT NULL AND d.key_expires_at > now()  (monthly token must be valid)
This is in addition to existing checks: approval_status = 'approved', suspended = false,
subscription active or not expired, university match.

### 2. deliveries table
- Added picked_up_at (timestamptz, nullable) — when the messenger picks up the order
- Added cancelled_at (timestamptz, nullable) — when the order is cancelled

## Important Notes
1. No existing data is modified or deleted.
2. The function is recreated with CREATE OR REPLACE — existing callers are unaffected.
3. The new timestamp columns are nullable so existing rows are not impacted.
4. If key_expires_at is NULL on a driver, that driver is now excluded from eligible drivers
   — this is intentional: a driver without a valid token should not be assignable.
*/

-- ============================================================
-- 1. Strengthen get_eligible_drivers
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_eligible_drivers(p_university_id uuid DEFAULT NULL::uuid)
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
  subscription_expiry timestamptz,
  completed_deliveries bigint
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
  AND d.is_available = true
  AND d.key_expires_at IS NOT NULL
  AND d.key_expires_at > now()
  AND (
    d.subscription_status = 'active'
    OR (d.subscription_expiry IS NOT NULL AND d.subscription_expiry > now())
  )
  AND (
    p_university_id IS NULL
    OR d.active_university_id = p_university_id
    OR d.university_id = p_university_id
  )
ORDER BY d.is_available DESC, d.average_rating DESC NULLS LAST;
$function$;

-- ============================================================
-- 2. Add order status timestamps to deliveries
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'picked_up_at'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN picked_up_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;
