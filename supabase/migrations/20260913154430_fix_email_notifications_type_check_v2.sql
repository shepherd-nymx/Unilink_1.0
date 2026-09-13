/*
# Fix email_notifications type CHECK constraint

The original CHECK constraint only allowed 10 email types. The edge function
now supports 17 types (6 shop types + new_dm added). This migration drops the
old constraint and adds a new one so all types can be inserted.

## Changes
- Drop old email_notifications_type_check constraint
- Add new CHECK constraint with all 17 allowed types
*/

ALTER TABLE email_notifications
  DROP CONSTRAINT IF EXISTS email_notifications_type_check;

ALTER TABLE email_notifications
  ADD CONSTRAINT email_notifications_type_check
  CHECK (type IN (
    'welcome',
    'email_verification',
    'password_reset',
    'order_confirmation',
    'order_status',
    'messenger_assignment',
    'shop_notification',
    'payment_success',
    'payment_failed',
    'payment_refunded',
    'shop_approval',
    'shop_payment_required',
    'shop_activated',
    'shop_new_order',
    'shop_order_status',
    'shop_messenger_assigned',
    'new_dm'
  ));