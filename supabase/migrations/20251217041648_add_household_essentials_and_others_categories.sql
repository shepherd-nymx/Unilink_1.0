/*
  # Add Household Essentials and Others Categories

  ## Overview
  Add two new categories for better product organization

  ## Changes
  1. New Categories
    - Household Essentials - for cleaning supplies, toiletries, paper products
    - Others - catch-all category for miscellaneous items

  ## Notes
  - Categories will appear in both admin and customer portals
  - Sort order placed after existing categories
*/

-- Insert new categories
INSERT INTO categories (name, icon, sort_order) VALUES
  ('Household Essentials', '🧼', 8),
  ('Others', '📦', 9)
ON CONFLICT (name) DO NOTHING;