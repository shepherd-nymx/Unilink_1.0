/*
# Add EcoCash name to shops and proof of payment to shop_orders

1. Modified Tables
- `shops`: adds `ecocash_name` (text, nullable) — the account holder name customers should send EcoCash money to.
- `shop_orders`: adds `ecocash_pop` (text, nullable) — proof of payment text submitted by the customer (e.g. transaction reference code).

2. Security
- No new tables. No policy changes — existing shop_orders RLS already covers the new column.

3. Notes
- Both columns are nullable so existing rows are unaffected.
- `ecocash_name` is shown to customers at checkout when they select EcoCash as their payment method.
- `ecocash_pop` is set by the customer after placing an order and is visible to the shop in the order detail modal.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'ecocash_name') THEN
    ALTER TABLE shops ADD COLUMN ecocash_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_orders' AND column_name = 'ecocash_pop') THEN
    ALTER TABLE shop_orders ADD COLUMN ecocash_pop text;
  END IF;
END $$;
