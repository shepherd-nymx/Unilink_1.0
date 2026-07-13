/*
  # Add EcoCash Payment Code to Drivers

  1. Changes
    - Add `ecocash_code` column to drivers table
      - Stores the EcoCash payment code/number for the driver
      - Nullable to allow drivers to add it later
      - Text field to accommodate various code formats

  2. Notes
    - Drivers can set and update their EcoCash code in settings
    - Customers will see this code when they select the driver for delivery
    - This enables customers to make EcoCash payments directly to the driver
*/

-- Add ecocash_code column to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'ecocash_code'
  ) THEN
    ALTER TABLE drivers ADD COLUMN ecocash_code text;
  END IF;
END $$;

-- Add comment to the column
COMMENT ON COLUMN drivers.ecocash_code IS 'EcoCash payment code/number for receiving payments from customers';
