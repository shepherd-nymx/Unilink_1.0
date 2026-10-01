/*
# Fix shop-open validation timezone and deliveries NOT NULL constraints

## Problem 1 — Timezone mismatch in validate_shop_order
The function compares server time (UTC) against shop operating hours stored in
Zimbabwe local time (CAT / UTC+2). A shop open "08:00-18:00" CAT looks open to
the customer at 09:00 CAT but the server sees 07:00 UTC and rejects the order.

## Problem 2 — deliveries.customer_latitude / customer_longitude are NOT NULL
These columns have no defaults and are NOT NULL. When a customer provides an
address without GPS coordinates the insert fails silently. The app already
handles NULL coordinates downstream.

## Changes
1. Recreate `validate_shop_order` to interpret operating hours as CAT (UTC+2)
   by adding 2 hours to the current server time before comparing.
2. Make `deliveries.customer_latitude` and `deliveries.customer_longitude`
   nullable so orders with address-only locations succeed.
*/

-- ===================================================
-- 1. Fix validate_shop_order timezone
-- ===================================================

CREATE OR REPLACE FUNCTION validate_shop_order(p_shop_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop RECORD;
  v_day_name text;
  v_day_entry jsonb;
  v_open_str text;
  v_close_str text;
  v_open_min int;
  v_close_min int;
  v_cur int;
  v_cat_now timestamptz;
  v_day_names text[] := ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
BEGIN
  SELECT status, is_available, operating_hours
  INTO v_shop
  FROM shops
  WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'reason', 'Shop not found.');
  END IF;

  IF v_shop.status IS NULL OR v_shop.status <> 'active' THEN
    RETURN json_build_object('allowed', false, 'reason', 'This shop is not currently active on the platform.');
  END IF;

  IF v_shop.is_available IS NOT TRUE THEN
    RETURN json_build_object('allowed', false, 'reason', 'This shop is currently unavailable for orders.');
  END IF;

  IF v_shop.operating_hours IS NULL OR NOT (v_shop.operating_hours::text ~ 'open|close') THEN
    RETURN json_build_object('allowed', true);
  END IF;

  -- Apply CAT (UTC+2) offset: shops store hours in Zimbabwe local time
  v_cat_now := now() + interval '2 hours';
  v_day_name := v_day_names[EXTRACT(DOW FROM v_cat_now)::int + 1];
  v_day_entry := (v_shop.operating_hours::jsonb)->v_day_name;

  IF v_day_entry IS NULL THEN
    RETURN json_build_object('allowed', true);
  END IF;

  IF v_day_entry = 'false'::jsonb OR (v_day_entry->>'closed') = 'true' THEN
    RETURN json_build_object('allowed', false, 'reason', 'This shop is closed today. Please check their operating hours.');
  END IF;

  v_open_str := v_day_entry->>'open';
  v_close_str := v_day_entry->>'close';

  IF v_open_str IS NULL OR v_open_str = '' THEN
    RETURN json_build_object('allowed', true);
  END IF;

  v_cur := EXTRACT(HOUR FROM v_cat_now)::int * 60 + EXTRACT(MINUTE FROM v_cat_now)::int;
  v_open_min := (split_part(v_open_str, ':', 1)::int) * 60 + COALESCE(split_part(v_open_str, ':', 2)::int, 0);

  IF v_close_str IS NULL OR v_close_str = '' THEN
    v_close_min := 24 * 60 - 1;
  ELSE
    v_close_min := (split_part(v_close_str, ':', 1)::int) * 60 + COALESCE(split_part(v_close_str, ':', 2)::int, 0);
  END IF;

  IF v_close_min <= v_open_min THEN
    IF v_cur >= v_open_min THEN
      RETURN json_build_object('allowed', true);
    ELSE
      RETURN json_build_object('allowed', false, 'reason', 'This shop is currently closed. They open at ' || v_open_str || '.');
    END IF;
  END IF;

  IF v_cur >= v_open_min AND v_cur < v_close_min THEN
    RETURN json_build_object('allowed', true);
  ELSE
    IF v_cur < v_open_min THEN
      RETURN json_build_object('allowed', false, 'reason', 'This shop is currently closed. They open at ' || v_open_str || '.');
    ELSE
      RETURN json_build_object('allowed', false, 'reason', 'This shop is currently closed. They closed at ' || v_close_str || '.');
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_shop_order(uuid) TO anon, authenticated;

-- ===================================================
-- 2. Fix deliveries lat/lng NOT NULL constraints
-- ===================================================

ALTER TABLE deliveries ALTER COLUMN customer_latitude DROP NOT NULL;
ALTER TABLE deliveries ALTER COLUMN customer_longitude DROP NOT NULL;