/*
  # Add GPS Coordinates to Customers Table

  ## Changes
  1. Add latitude and longitude columns to customers table
     - `latitude` (numeric) - Customer's GPS latitude coordinate
     - `longitude` (numeric) - Customer's GPS longitude coordinate
  
  ## Notes
  - Coordinates are optional to maintain backward compatibility
  - Will be used by drivers to navigate to customer locations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE customers ADD COLUMN latitude numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE customers ADD COLUMN longitude numeric;
  END IF;
END $$;