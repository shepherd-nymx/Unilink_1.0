-- Allow 'shop' as a valid user_type in notification_queue
ALTER TABLE notification_queue
  DROP CONSTRAINT IF EXISTS notification_queue_user_type_check;

ALTER TABLE notification_queue
  ADD CONSTRAINT notification_queue_user_type_check
  CHECK (user_type IN ('customer', 'driver', 'shop'));