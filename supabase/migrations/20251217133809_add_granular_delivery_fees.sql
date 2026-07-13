/*
  # Add Granular Delivery Fee Tiers
  
  ## Overview
  Replaces the simple 3-tier fee structure with granular price-based tiers to give drivers more control over their pricing.
  
  ## Changes
  
  1. **New Fee Columns Added**
     - `fee_up_to_10` - Fee for orders up to $10
     - `fee_up_to_20` - Fee for orders $10-$20
     - `fee_up_to_30` - Fee for orders $20-$30
     - `fee_up_to_40` - Fee for orders $30-$40
     - `fee_up_to_50` - Fee for orders $40-$50
     - `fee_up_to_100` - Fee for orders $50-$100 (primarily for vehicle)
     - `fee_up_to_200` - Fee for orders $100-$200 (vehicle only)
     - `fee_up_to_300` - Fee for orders $200-$300 (vehicle only)
     - `fee_up_to_400` - Fee for orders $300-$400 (vehicle only)
     - `fee_up_to_500` - Fee for orders $400-$500 (vehicle only)
  
  2. **Data Migration**
     - Migrates existing fee_under_10 to fee_up_to_10
     - Migrates existing fee_10_to_30 to fee_up_to_20 and fee_up_to_30
     - Migrates existing fee_30_to_50 to fee_up_to_40 and fee_up_to_50
     - Sets default values for new higher tiers
  
  3. **Old Columns Retained**
     - Keeps old columns temporarily for backwards compatibility
     - Can be removed in a future migration once all code is updated
  
  ## Purpose
  Enables drivers to set specific delivery fees for each price tier, with walking drivers typically setting fees up to $50 and vehicle drivers setting fees up to $500.
*/

-- Add new granular fee columns
DO $$
BEGIN
  -- Fees for all delivery types (walking and vehicle)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'fee_up_to_10') THEN
    ALTER TABLE drivers ADD COLUMN fee_up_to_10 numeric(10,2) DEFAULT 2.00;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'fee_up_to_20') THEN
    ALTER TABLE drivers ADD COLUMN fee_up_to_20 numeric(10,2) DEFAULT 3.50;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'fee_up_to_30') THEN
    ALTER TABLE drivers ADD COLUMN fee_up_to_30 numeric(10,2) DEFAULT 5.00;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'fee_up_to_40') THEN
    ALTER TABLE drivers ADD COLUMN fee_up_to_40 numeric(10,2) DEFAULT 6.50;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'fee_up_to_50') THEN
    ALTER TABLE drivers ADD COLUMN fee_up_to_50 numeric(10,2) DEFAULT 8.00;
  END IF;
  
  -- Fees primarily for vehicle delivery types
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'fee_up_to_100') THEN
    ALTER TABLE drivers ADD COLUMN fee_up_to_100 numeric(10,2) DEFAULT 12.00;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'fee_up_to_200') THEN
    ALTER TABLE drivers ADD COLUMN fee_up_to_200 numeric(10,2) DEFAULT 18.00;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'fee_up_to_300') THEN
    ALTER TABLE drivers ADD COLUMN fee_up_to_300 numeric(10,2) DEFAULT 25.00;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'fee_up_to_400') THEN
    ALTER TABLE drivers ADD COLUMN fee_up_to_400 numeric(10,2) DEFAULT 32.00;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'fee_up_to_500') THEN
    ALTER TABLE drivers ADD COLUMN fee_up_to_500 numeric(10,2) DEFAULT 40.00;
  END IF;
END $$;

-- Migrate existing data from old fee structure to new structure
UPDATE drivers
SET 
  fee_up_to_10 = COALESCE(fee_under_10, 2.00),
  fee_up_to_20 = COALESCE(fee_10_to_30, 3.50),
  fee_up_to_30 = COALESCE(fee_10_to_30, 5.00),
  fee_up_to_40 = COALESCE(fee_30_to_50, 6.50),
  fee_up_to_50 = COALESCE(fee_30_to_50, 8.00)
WHERE fee_up_to_10 = 2.00 
  AND fee_up_to_20 = 3.50 
  AND fee_up_to_30 = 5.00;