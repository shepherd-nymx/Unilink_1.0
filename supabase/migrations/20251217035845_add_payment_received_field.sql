/*
  # Add Payment Received Field to Deliveries

  ## Overview
  Add tracking for EcoCash payment confirmation by drivers

  ## Changes
  1. Modified Tables
    - `deliveries`
      - Add `payment_received` (boolean) - tracks if EcoCash payment has been received by driver
      - Defaults to `false` for all orders
      - Only applicable when payment_option is 'ecocash'

  ## Notes
  - This field allows drivers to confirm they have received EcoCash payment before purchasing groceries
  - For 'pay_on_delivery' orders, this field is not used
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'payment_received'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN payment_received boolean DEFAULT false;
  END IF;
END $$;