/*
# Add shop distance-based delivery fee tiers

## Purpose
Shops can set delivery fees based on the distance from their location to the customer's location. When a customer checks out, the system calculates the distance and matches it to the shop's distance fee tier.

## Changes

### 1. New table: `shop_distance_fee_tiers`
- `id` (uuid, primary key)
- `shop_id` (uuid, foreign key to shops.id, ON DELETE CASCADE)
- `min_km` (numeric, not null) — minimum distance for this tier
- `max_km` (numeric, nullable) — maximum distance (null = open-ended)
- `fee` (numeric, not null) — delivery fee in USD
- `label` (text, nullable) — optional label
- `sort_order` (integer, default 0)
- `created_at` (timestamptz, default now())

### 2. RLS
- Shop owners can CRUD their own distance fee tiers (ownership via shop_id).
- Public can SELECT (so checkout can read them).
*/

CREATE TABLE IF NOT EXISTS shop_distance_fee_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  min_km numeric NOT NULL DEFAULT 0,
  max_km numeric,
  fee numeric NOT NULL DEFAULT 0,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shop_distance_fee_tiers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_shop_distance_fee_tiers_shop ON shop_distance_fee_tiers(shop_id);

DROP POLICY IF EXISTS "select_shop_distance_fee_tiers" ON shop_distance_fee_tiers;
CREATE POLICY "select_shop_distance_fee_tiers"
  ON shop_distance_fee_tiers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_shop_distance_fee_tiers" ON shop_distance_fee_tiers;
CREATE POLICY "insert_own_shop_distance_fee_tiers"
  ON shop_distance_fee_tiers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_shop_distance_fee_tiers" ON shop_distance_fee_tiers;
CREATE POLICY "update_own_shop_distance_fee_tiers"
  ON shop_distance_fee_tiers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_shop_distance_fee_tiers" ON shop_distance_fee_tiers;
CREATE POLICY "delete_own_shop_distance_fee_tiers"
  ON shop_distance_fee_tiers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM shops s WHERE s.id = shop_id AND s.owner_id = auth.uid())
  );
