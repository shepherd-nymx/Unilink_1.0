/*
  # Add Order Decline Notification System

  1. New Function
    - `notify_customer_on_decline()` - Trigger function that sends push notification to customer when order is declined

  2. Trigger
    - Fires after update on deliveries table when status changes to 'declined'
    - Calls edge function to send push notification to customer

  3. Security
    - Uses Supabase's built-in `http` extension to call edge function
    - Requires EXPO_ACCESS_TOKEN to be configured in edge function
*/

-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create function to notify customer when order is declined
CREATE OR REPLACE FUNCTION notify_customer_on_decline()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  customer_id_val uuid;
BEGIN
  -- Only proceed if status changed to 'declined'
  IF NEW.status = 'declined' AND (OLD.status IS NULL OR OLD.status != 'declined') THEN
    -- Get customer_id
    customer_id_val := NEW.customer_id;
    
    -- Get Supabase URL and service role key from environment
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- If settings are not available, use default vault values
    IF supabase_url IS NULL THEN
      supabase_url := current_setting('supabase_url', true);
    END IF;
    
    IF service_role_key IS NULL THEN
      service_role_key := current_setting('service_role_key', true);
    END IF;
    
    -- Call the edge function asynchronously to send push notification
    PERFORM extensions.http((
      'POST',
      supabase_url || '/functions/v1/send-push-notification',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || service_role_key),
        extensions.http_header('Content-Type', 'application/json')
      ],
      'application/json',
      json_build_object(
        'userIds', json_build_array(customer_id_val::text),
        'userType', 'customer',
        'title', 'Order Declined',
        'body', 'Your order has been declined by the driver. Please select another driver or place a new order.',
        'data', json_build_object('deliveryId', NEW.id::text, 'type', 'order_declined')
      )::text
    )::extensions.http_request);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_delivery_declined ON deliveries;

-- Create trigger that fires after delivery status is updated to declined
CREATE TRIGGER on_delivery_declined
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  WHEN (NEW.status = 'declined' AND (OLD.status IS DISTINCT FROM 'declined'))
  EXECUTE FUNCTION notify_customer_on_decline();
