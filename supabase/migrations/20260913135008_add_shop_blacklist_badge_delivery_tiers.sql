/*
# Add shop customer blacklist, premium badge, and delivery fee tiers

1. Schema Changes

## shop_customer_blacklist (new table)
- Lets shops temporarily ban/blacklist specific customers from placing orders.
- Columns: id, shop_id (FK shops), customer_id (FK customers), reason, created_at.
- Unique constraint on (shop_id, customer_id) to prevent duplicates.

## shops.premium_badge (new column)
- Added to shops table: text, nullable.
- Values: NULL (no badge), 'blue', 'green', 'platinum'.
- Assigned by admin only — customers see it on shop cards and profiles.

## shop_delivery_fee_tiers (new table)
- Lets shops configure delivery fees based on the cost of goods in an order.
- Columns: id, shop_id (FK shops), min_amount (numeric), max_amount (numeric, nullable for open-ended top tier), fee (numeric), label (text, optional), sort_order (int), created_at.
- Unique constraint on (shop_id, min_amount).
- A shop with no tiers falls back to the existing flat shops.delivery_fee.

2. Security (RLS)
- shop_customer_blacklist: RLS enabled, anon+authenticated CRUD (shop dashboard manages via anon key).
- shop_delivery_fee_tiers: RLS enabled, anon+authenticated CRUD (shop dashboard manages via anon key).
- shops.premium_badge: writable only via admin (existing admin RLS on shops covers this).

3. Important Notes
- No existing columns or data are modified or deleted.
- The shops table only gains one nullable column.
- Both new tables use ON DELETE CASCADE for shop_id and customer_id FKs.
*/

-- =========================
-- 1. shops.premium_badge column
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'premium_badge') THEN
    ALTER TABLE shops ADD COLUMN premium_badge text;
  END IF;
END $$;

-- =========================
-- 2. shop_customer_blacklist table
-- =========================
CREATE TABLE IF NOT EXISTS shop_customer_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, customer_id)
);

ALTER TABLE shop_customer_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_blacklist" ON shop_customer_blacklist;
CREATE POLICY "anon_select_blacklist" ON shop_customer_blacklist
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_blacklist" ON shop_customer_blacklist;
CREATE POLICY "anon_insert_blacklist" ON shop_customer_blacklist
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_blacklist" ON shop_customer_blacklist;
CREATE POLICY "anon_update_blacklist" ON shop_customer_blacklist
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_blacklist" ON shop_customer_blacklist;
CREATE POLICY "anon_delete_blacklist" ON shop_customer_blacklist
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_blacklist_shop ON shop_customer_blacklist (shop_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_customer ON shop_customer_blacklist (customer_id);

-- =========================
-- 3. shop_delivery_fee_tiers table
-- =========================
CREATE TABLE IF NOT EXISTS shop_delivery_fee_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  min_amount numeric NOT NULL DEFAULT 0,
  max_amount numeric,
  fee numeric NOT NULL DEFAULT 0,
  label text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, min_amount)
);

ALTER TABLE shop_delivery_fee_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fee_tiers" ON shop_delivery_fee_tiers;
CREATE POLICY "anon_select_fee_tiers" ON shop_delivery_fee_tiers
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fee_tiers" ON shop_delivery_fee_tiers;
CREATE POLICY "anon_insert_fee_tiers" ON shop_delivery_fee_tiers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fee_tiers" ON shop_delivery_fee_tiers;
CREATE POLICY "anon_update_fee_tiers" ON shop_delivery_fee_tiers
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fee_tiers" ON shop_delivery_fee_tiers;
CREATE POLICY "anon_delete_fee_tiers" ON shop_delivery_fee_tiers
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_fee_tiers_shop ON shop_delivery_fee_tiers (shop_id);
