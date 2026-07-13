/*
  # Add Driver Payment Methods and Enhanced Delivery Options

  ## Changes
  
  1. **Add payment_methods column to drivers table**
     - Type: text array
     - Stores multiple payment methods accepted by the driver
     - Options: 'pay_on_delivery', 'ecocash'
     - Default: empty array
  
  2. **Update delivery_type column**
     - Change from single value to array to support drivers who can do both walking and vehicle delivery
     - Type: text array
     - Options: 'walking', 'vehicle'
     - Default: ['walking']
  
  ## Purpose
  Allows drivers to specify:
  - Multiple delivery methods (walking, vehicle, or both)
  - Multiple accepted payment methods
  
  Enables customers to filter and select drivers based on their preferred delivery method and payment option.
*/

-- Add payment_methods column to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'payment_methods'
  ) THEN
    ALTER TABLE drivers ADD COLUMN payment_methods text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- Drop the existing delivery_type constraint if it exists
DO $$
BEGIN
  ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_delivery_type_check;
END $$;

-- Change delivery_type from text to text array to support multiple delivery methods
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' 
    AND column_name = 'delivery_type'
    AND data_type = 'text'
  ) THEN
    -- Drop default first
    ALTER TABLE drivers ALTER COLUMN delivery_type DROP DEFAULT;
    
    -- Convert existing data from text to array
    ALTER TABLE drivers 
    ALTER COLUMN delivery_type TYPE text[] 
    USING ARRAY[delivery_type];
    
    -- Set new default for array type
    ALTER TABLE drivers 
    ALTER COLUMN delivery_type SET DEFAULT ARRAY['walking']::text[];
  END IF;
END $$;

-- Add check constraints for valid values
DO $$
BEGIN
  -- Check constraint for delivery_type array values
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_delivery_type_values_check'
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_delivery_type_values_check
    CHECK (
      delivery_type <@ ARRAY['walking', 'vehicle']::text[]
      AND array_length(delivery_type, 1) > 0
    );
  END IF;

  -- Check constraint for payment_methods array values
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_payment_methods_check'
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_payment_methods_check
    CHECK (payment_methods <@ ARRAY['pay_on_delivery', 'ecocash']::text[]);
  END IF;
END $$;