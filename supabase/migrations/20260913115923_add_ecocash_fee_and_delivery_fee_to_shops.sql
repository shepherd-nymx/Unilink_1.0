/*
# Add EcoCash fee and delivery fee settings to shops

## What this does
1. Adds two new columns to the `shops` table:
   - `ecocash_fee` (numeric, default 0) — the fee a shop charges when a customer pays via EcoCash
   - `delivery_fee` (numeric, default 0) — the default delivery fee a shop charges based on customer GPS location
2. Adds `ecocash_fee_amount` (numeric, default 0) to `shop_orders` so the EcoCash surcharge is stored per order

## Why
Shops need to configure their own EcoCash surcharge and delivery fee. The marketplace checkout will display these to customers as a cost breakdown (items + EcoCash fee + delivery fee) before they place an order.

## Security
No new tables. No RLS policy changes. Existing policies on `shops` and `shop_orders` already cover the new columns.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'ecocash_fee'
  ) THEN
    ALTER TABLE shops ADD COLUMN ecocash_fee numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'delivery_fee'
  ) THEN
    ALTER TABLE shops ADD COLUMN delivery_fee numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'ecocash_fee_amount'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN ecocash_fee_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
