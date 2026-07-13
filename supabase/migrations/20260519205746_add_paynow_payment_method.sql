/*
  # Add Paynow as a payment method option

  ## Changes
  - Updates the CHECK constraint on delivery_requests.payment_method to allow 'paynow'
    in addition to existing 'pay_on_delivery' and 'ecocash' values.

  ## Notes
  - Existing rows are unaffected
  - No data migration needed
*/

ALTER TABLE delivery_requests
  DROP CONSTRAINT IF EXISTS delivery_requests_payment_method_check;

ALTER TABLE delivery_requests
  ADD CONSTRAINT delivery_requests_payment_method_check
  CHECK (payment_method IN ('pay_on_delivery', 'ecocash', 'paynow'));
