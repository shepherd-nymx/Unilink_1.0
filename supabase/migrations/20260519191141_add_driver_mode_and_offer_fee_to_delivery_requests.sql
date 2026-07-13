/*
  # Add delivery_mode and offer_fee to delivery_requests

  ## Changes
  - Adds `delivery_mode` column: 'direct' (customer chose a specific driver) or 'open_request' (broadcast)
  - Adds `offer_fee` column: fee the customer proposes when selecting a direct driver
  - Both columns are nullable/have safe defaults so existing rows are unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_requests' AND column_name = 'delivery_mode'
  ) THEN
    ALTER TABLE delivery_requests
      ADD COLUMN delivery_mode text NOT NULL DEFAULT 'open_request'
        CHECK (delivery_mode IN ('direct', 'open_request'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_requests' AND column_name = 'offer_fee'
  ) THEN
    ALTER TABLE delivery_requests ADD COLUMN offer_fee numeric(10,2);
  END IF;
END $$;
