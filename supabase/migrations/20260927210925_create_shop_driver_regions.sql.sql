/*
# Create shop_driver_regions table

## Purpose
Allows shops to specify which university/locations the drivers that appear
to them (during marketplace checkout) should come from.
This is a non-GPS, region/location-based filter.

## New Table
- `shop_driver_regions`
  - `id` (uuid, PK)
  - `shop_id` (uuid, FK to shops, CASCADE DELETE)
  - `university_id` (uuid, FK to universities, CASCADE DELETE)
  - `created_at` (timestamptz)
  - UNIQUE (shop_id, university_id)

## Security
- RLS enabled.
- Public read (anon + authenticated) so marketplace can query regions.
- Insert/update/delete: only the shop owner (auth.uid = shops.owner_id).
*/

CREATE TABLE IF NOT EXISTS shop_driver_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, university_id)
);

ALTER TABLE shop_driver_regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_shop_driver_regions" ON shop_driver_regions;
CREATE POLICY "public_read_shop_driver_regions"
  ON shop_driver_regions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_shop_driver_regions" ON shop_driver_regions;
CREATE POLICY "owner_insert_shop_driver_regions"
  ON shop_driver_regions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_driver_regions.shop_id AND shops.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "owner_delete_shop_driver_regions" ON shop_driver_regions;
CREATE POLICY "owner_delete_shop_driver_regions"
  ON shop_driver_regions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_driver_regions.shop_id AND shops.owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_shop_driver_regions_shop ON shop_driver_regions (shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_driver_regions_uni ON shop_driver_regions (university_id);
