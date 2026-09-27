/*
# Add per-shop commission percentage

## Purpose
Admins can set a commission percentage per individual shop, instead of one global rate for all shops.

## Changes
- Adds `commission_percentage` column to `shops` table (decimal, default 5.00)
- Backfilled from the global `shop_settings.commission_rate` value
*/
ALTER TABLE shops ADD COLUMN IF NOT EXISTS commission_percentage decimal(5,2) DEFAULT 5.00;

-- Backfill from global setting if available
DO $$
DECLARE
  global_rate decimal(5,2);
BEGIN
  SELECT commission_rate INTO global_rate FROM shop_settings LIMIT 1;
  IF global_rate IS NOT NULL THEN
    UPDATE shops SET commission_percentage = global_rate WHERE commission_percentage IS NULL;
  END IF;
END $$;
