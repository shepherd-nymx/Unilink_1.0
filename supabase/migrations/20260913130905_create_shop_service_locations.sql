/*
# Shop Service Locations — multi-location customer targeting

1. New Tables
- `shop_service_locations` — stores which customer locations (universities + custom areas) a shop serves.
  - `id` (uuid, primary key)
  - `shop_id` (uuid, FK to shops, CASCADE DELETE)
  - `location_name` (text, not null) — the name of the university or custom area
  - `location_type` (text, not null, default 'university') — 'university' or 'custom'
  - `created_at` (timestamptz, default now())
  - Unique constraint on (shop_id, location_name) to prevent duplicates.

2. Security
- Enable RLS on `shop_service_locations`.
- Public read (anon, authenticated) — customers need to see which shops serve their location.
- Shops manage their own service locations (owner-scoped via shops.owner_id = auth.uid()).

3. Important Notes
- Shops can select multiple universities and add custom location names.
- The marketplace will filter shops to only show those serving the customer's location.
- If a shop has zero service locations, they are visible to all locations (backward compatible).
*/
CREATE TABLE IF NOT EXISTS shop_service_locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  location_name text NOT NULL,
  location_type text NOT NULL DEFAULT 'university',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, location_name)
);

ALTER TABLE shop_service_locations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ssl_shop_idx ON shop_service_locations (shop_id);
CREATE INDEX IF NOT EXISTS ssl_location_idx ON shop_service_locations (location_name);

DROP POLICY IF EXISTS "ssl_public_read" ON shop_service_locations;
CREATE POLICY "ssl_public_read"
  ON shop_service_locations FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "ssl_owner_insert" ON shop_service_locations;
CREATE POLICY "ssl_owner_insert"
  ON shop_service_locations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_service_locations.shop_id AND shops.owner_id = auth.uid()));

DROP POLICY IF EXISTS "ssl_owner_delete" ON shop_service_locations;
CREATE POLICY "ssl_owner_delete"
  ON shop_service_locations FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_service_locations.shop_id AND shops.owner_id = auth.uid()));
