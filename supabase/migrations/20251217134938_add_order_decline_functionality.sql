/*
  # Add Order Decline Functionality

  ## Overview
  Enables drivers to decline orders and notifies customers when this happens.

  ## Changes

  1. **Add declined_at timestamp to deliveries**
     - Tracks when a driver declined an order
     - Nullable field (only set when status is 'declined')

  2. **Add declined status support**
     - Ensures 'declined' is a valid status value
     - No constraint changes needed as the original schema supports any text value

  ## Purpose
  - Allows drivers to decline orders they cannot fulfill
  - Provides visibility to customers when their order is declined
  - Helps track order lifecycle including declined orders
*/

-- Add declined_at timestamp to deliveries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'declined_at'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN declined_at timestamptz;
  END IF;
END $$;