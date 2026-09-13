/*
# Add shop category column

Adds a `category` column to the shops table to enable shop-level categorization
(e.g. Grocery, Pharmacy, Restaurant, Stationery, Electronics, Fashion, etc.).
This mirrors the existing shop_areas pattern where the column stores a string value.
*/

ALTER TABLE shops ADD COLUMN IF NOT EXISTS category text;

-- Backfill any existing shops with a default category
UPDATE shops SET category = 'General' WHERE category IS NULL;

-- Create an index for category filtering
CREATE INDEX IF NOT EXISTS idx_shops_category ON shops (category)
  WHERE category IS NOT NULL;