-- Add commission rate to shop_settings and deadline tracking to shops
-- Allows admin to set a platform commission percentage and per-shop payment deadlines

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_settings' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN commission_rate decimal(5,2) DEFAULT 5.00;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'commission_deadline'
  ) THEN
    ALTER TABLE shops ADD COLUMN commission_deadline timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'commission_paid'
  ) THEN
    ALTER TABLE shops ADD COLUMN commission_paid decimal(10,2) DEFAULT 0;
  END IF;
END $$;
