-- Add notification_email column to drivers table
-- This lets drivers specify a separate email for order notifications,
-- falling back to the existing email column if not set.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'notification_email'
  ) THEN
    ALTER TABLE drivers ADD COLUMN notification_email text;
  END IF;
END$$;