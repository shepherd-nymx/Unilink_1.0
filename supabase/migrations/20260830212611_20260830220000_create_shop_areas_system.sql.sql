/*
# Create Shop Areas System

## Purpose
Creates a reference table of geographic areas/suburbs that shops can be tagged with.
Customers can then browse shops by area (e.g. "Selbourne Park") in the marketplace.

## New Tables
- `shop_areas`
  - `id` (uuid, primary key)
  - `name` (text, unique, not null) — area name e.g. "Selbourne Park"
  - `city` (text, nullable) — optional city grouping e.g. "Bulawayo"
  - `sort_order` (int, default 0) — for custom ordering
  - `created_at` (timestamptz)

## Modified Tables
- `shops` — the existing `location` text column is now used to store the area name selected
  during registration. No schema change needed; the column already exists as text.

## Security
- RLS enabled on `shop_areas`.
- Public read access (anon + authenticated) so the marketplace and registration form
  can load the area list without authentication.
- No inserts/updates/deletes from the client — areas are managed via admin/SQL only.

## Seed Data
- Inserts a starter set of common Bulawayo and Harare suburbs/areas.
*/

CREATE TABLE IF NOT EXISTS shop_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  city text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shop_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_shop_areas" ON shop_areas;
CREATE POLICY "public_read_shop_areas"
ON shop_areas FOR SELECT
TO anon, authenticated USING (true);

-- Seed common areas (idempotent via ON CONFLICT)
INSERT INTO shop_areas (name, city, sort_order) VALUES
  ('Selbourne Park', 'Bulawayo', 1),
  ('Hillside', 'Bulawayo', 2),
  ('Suburbs', 'Bulawayo', 3),
  ('Parklands', 'Bulawayo', 4),
  ('Kensington', 'Bulawayo', 5),
  ('Trenance', 'Bulawayo', 6),
  ('Mphophoma', 'Bulawayo', 7),
  ('Khetha', 'Bulawayo', 8),
  ('Nketa', 'Bulawayo', 9),
  ('Emganwini', 'Bulawayo', 10),
  ('Nkulumane', 'Bulawayo', 11),
  ('Pelandaba', 'Bulawayo', 12),
  ('Mzilikazi', 'Bulawayo', 13),
  ('Barbourfields', 'Bulawayo', 14),
  ('Makokoba', 'Bulawayo', 15),
  ('Luveve', 'Bulawayo', 16),
  ('Cowdray Park', 'Bulawayo', 17),
  ('Richmond', 'Bulawayo', 18),
  ('Burnside', 'Bulawayo', 19),
  ('Waterford', 'Bulawayo', 20),
  ('Hillside South', 'Bulawayo', 21),
  ('Matsheumhlope', 'Bulawayo', 22),
  ('Auckland', 'Bulawayo', 23),
  ('Montrose', 'Bulawayo', 24),
  ('Newlands', 'Bulawayo', 25),
  ('Mariami', 'Bulawayo', 26),
  ('Ntabazinduna', 'Bulawayo', 27),
  ('Mpopoma', 'Bulawayo', 28),
  ('Iminyela', 'Bulawayo', 29),
  ('Nguboyenja', 'Bulawayo', 30),
  ('Mbere', 'Bulawayo', 31),
  ('Mahatshula', 'Bulawayo', 32),
  ('Rangemore', 'Bulawayo', 33),
  ('Springfield', 'Bulawayo', 34),
  ('Orange Grove', 'Bulawayo', 35),
  ('Riverside', 'Bulawayo', 36),
  ('Hillcrest', 'Bulawayo', 37),
  ('Robert Sinyoka', 'Bulawayo', 38),
  ('Killarney', 'Bulawayo', 39),
  ('Lochview', 'Bulawayo', 40),
  ('Tshabalala', 'Bulawayo', 41),
  ('Sizinda', 'Bulawayo', 42),
  ('Mpopoma', 'Bulawayo', 43),
  ('Magwegwe', 'Bulawayo', 44),
  ('Ntshamathe', 'Bulawayo', 45),
  ('Pumula', 'Bulawayo', 46),
  ('Emakhandeni', 'Bulawayo', 47),
  ('Mabutweni', 'Bulawayo', 48),
  ('Ngwana', 'Bulawayo', 49),
  ('Dhube', 'Bulawayo', 50),
  ('Avondale', 'Harare', 51),
  ('Borrowdale', 'Harare', 52),
  ('Mount Pleasant', 'Harare', 53),
  ('Highlands', 'Harare', 54),
  ('Glen Lorne', 'Harare', 55),
  ('Hartmann Hill', 'Harare', 56),
  ('Alexandra Park', 'Harare', 57),
  ('Belgravia', 'Harare', 58),
  ('Eastlea', 'Harare', 59),
  ('Greendale', 'Harare', 60),
  ('Msasa Park', 'Harare', 61),
  ('Vainona', 'Harare', 62),
  ('Chisipite', 'Harare', 63),
  ('Marlborough', 'Harare', 64),
  ('Sentosa', 'Harare', 65),
  ('Glen View', 'Harare', 66),
  ('Budiriro', 'Harare', 67),
  ('Kuwadzana', 'Harare', 68),
  ('Dzivarasekwa', 'Harare', 69),
  ('Mufakose', 'Harare', 70),
  ('Kambuzuma', 'Harare', 71),
  ('Warren Park', 'Harare', 72),
  ('Highfield', 'Harare', 73),
  ('Mbare', 'Harare', 74),
  ('Waterfalls', 'Harare', 75),
  ('Southerton', 'Harare', 76),
  ('Willowvale', 'Harare', 77)
ON CONFLICT (name) DO NOTHING;

-- Create an index on shops.location for area-based filtering
CREATE INDEX IF NOT EXISTS idx_shops_location ON shops (location) WHERE location IS NOT NULL;
