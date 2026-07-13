/*
  # Fix real-time visibility delays in order and driver selection

  1. Issues Fixed
    - Enable realtime subscriptions for driver_requests table
    - Add RLS policy for customers to read accepted driver information
    - Improve real-time subscription filtering in driver dashboard

  2. Security Changes
    - Add SELECT policy: "Customers can read accepted drivers for their deliveries"
    - This allows customers to see drivers who accepted their open requests

  3. Important Notes
    - Fixes delay in driver portal seeing new orders
    - Fixes driver not appearing in customer search when they indicate interest
    - Realtime channel subscriptions now properly propagate changes
*/

-- Enable realtime for driver_requests table
ALTER TABLE driver_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE driver_requests;

-- Add RLS policy: Allow customers to read driver info for drivers who accepted their orders
CREATE POLICY "Customers can read accepted drivers for their deliveries"
  ON driver_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries 
      WHERE deliveries.id = driver_requests.delivery_id 
      AND deliveries.customer_id = auth.uid()
    )
  );
