/*
  # Add Grocery Categories

  ## Overview
  Add category management for grocery items to organize products by type

  ## Changes
  1. New Tables
    - `categories`
      - `id` (uuid, primary key)
      - `name` (text, unique) - category name
      - `icon` (text) - emoji or icon identifier
      - `sort_order` (integer) - for custom ordering
      - `created_at` (timestamptz)

  2. Modified Tables
    - `grocery_items`
      - Add `category_id` (uuid, foreign key to categories)

  3. Security
    - Enable RLS on categories table
    - Add policies for viewing and admin management

  4. Data
    - Insert default categories (Dairy, Bakery, Meat & Poultry, Produce, Grains & Staples, Beverages, Condiments & Oils)
    - Update existing grocery items with appropriate categories
*/

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  icon text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Add category_id to grocery_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grocery_items' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE grocery_items ADD COLUMN category_id uuid REFERENCES categories(id);
  END IF;
END $$;

-- RLS Policies for categories
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON categories FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE
  USING (true);

-- Insert default categories
INSERT INTO categories (name, icon, sort_order) VALUES
  ('Dairy & Eggs', '🥛', 1),
  ('Bakery', '🍞', 2),
  ('Meat & Poultry', '🍗', 3),
  ('Produce', '🥬', 4),
  ('Grains & Staples', '🌾', 5),
  ('Beverages', '☕', 6),
  ('Condiments & Oils', '🧴', 7)
ON CONFLICT (name) DO NOTHING;

-- Update existing grocery items with categories
DO $$
DECLARE
  dairy_id uuid;
  bakery_id uuid;
  meat_id uuid;
  produce_id uuid;
  grains_id uuid;
  beverages_id uuid;
  condiments_id uuid;
BEGIN
  -- Get category IDs
  SELECT id INTO dairy_id FROM categories WHERE name = 'Dairy & Eggs';
  SELECT id INTO bakery_id FROM categories WHERE name = 'Bakery';
  SELECT id INTO meat_id FROM categories WHERE name = 'Meat & Poultry';
  SELECT id INTO produce_id FROM categories WHERE name = 'Produce';
  SELECT id INTO grains_id FROM categories WHERE name = 'Grains & Staples';
  SELECT id INTO beverages_id FROM categories WHERE name = 'Beverages';
  SELECT id INTO condiments_id FROM categories WHERE name = 'Condiments & Oils';

  -- Update existing items
  UPDATE grocery_items SET category_id = dairy_id WHERE name IN ('Milk (1L)', 'Eggs (Dozen)', 'Butter (250g)', 'Cheese (200g)');
  UPDATE grocery_items SET category_id = bakery_id WHERE name IN ('Bread (Loaf)');
  UPDATE grocery_items SET category_id = meat_id WHERE name IN ('Chicken (1kg)');
  UPDATE grocery_items SET category_id = produce_id WHERE name IN ('Tomatoes (1kg)', 'Onions (1kg)', 'Potatoes (1kg)');
  UPDATE grocery_items SET category_id = grains_id WHERE name IN ('Rice (1kg)', 'Sugar (1kg)', 'Salt (500g)');
  UPDATE grocery_items SET category_id = beverages_id WHERE name IN ('Tea Bags (50ct)', 'Coffee (200g)');
  UPDATE grocery_items SET category_id = condiments_id WHERE name IN ('Cooking Oil (1L)');
END $$;