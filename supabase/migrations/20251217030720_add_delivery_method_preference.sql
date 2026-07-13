/*
  # Add Delivery Method Preference to Deliveries

  ## Changes
  1. Add `preferred_delivery_method` column to deliveries table
     - Stores customer's preference for 'walking' or 'vehicle' delivery
     - Defaults to 'vehicle' for backward compatibility
  
  ## Notes
  - Customers can now choose their preferred delivery method when placing orders
  - System will attempt to match drivers with the preferred delivery type
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'preferred_delivery_method'
  ) THEN
    ALTER TABLE deliveries 
    ADD COLUMN preferred_delivery_method text DEFAULT 'vehicle' CHECK (preferred_delivery_method IN ('walking', 'vehicle'));
  END IF;
END $$;
