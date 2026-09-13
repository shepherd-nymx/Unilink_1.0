-- Add whatsapp_number column to shops table
-- Allows shops to provide a WhatsApp number for customer order notifications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE shops ADD COLUMN whatsapp_number text;
  END IF;
END $$;
