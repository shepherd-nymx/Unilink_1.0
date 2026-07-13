/*
  # Allow 'paynow' in drivers.payment_methods

  Updates the CHECK constraint on drivers.payment_methods to accept
  'paynow' in addition to the existing 'pay_on_delivery' and 'ecocash' values.
*/

ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_payment_methods_check;

ALTER TABLE drivers
  ADD CONSTRAINT drivers_payment_methods_check
  CHECK (payment_methods <@ ARRAY['pay_on_delivery'::text, 'ecocash'::text, 'paynow'::text]);
