-- Add Ecocash payment details to shop_settings for commission payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_settings' AND column_name = 'payment_ecocash_number'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN payment_ecocash_number text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_settings' AND column_name = 'payment_ecocash_name'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN payment_ecocash_name text;
  END IF;
END $$;
