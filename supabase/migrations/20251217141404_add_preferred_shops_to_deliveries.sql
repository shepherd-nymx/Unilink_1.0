/*
  # Add Preferred Shops Field to Deliveries

  1. Changes
    - Add `preferred_shops` column to `deliveries` table
      - Type: text (nullable/optional)
      - Stores customer's preferred shop names as a text string
  
  2. Purpose
    - Allows customers to optionally specify which shops they prefer groceries be purchased from
    - Visible to delivery personnel to guide their shopping decisions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'preferred_shops'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN preferred_shops text;
  END IF;
END $$;
