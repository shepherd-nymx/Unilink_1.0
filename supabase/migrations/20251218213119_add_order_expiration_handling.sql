/*
  # Add Order Expiration Handling

  1. Changes
    - Add a database function to automatically delete pending orders older than 10 minutes
    - This function can be called from the client to clean up expired orders
    
  2. Purpose
    - Ensure customers are notified to choose another driver if their order isn't accepted within 10 minutes
    - Keep the database clean by removing stale pending orders
*/

-- Function to delete expired pending orders (older than 10 minutes)
CREATE OR REPLACE FUNCTION delete_expired_pending_orders()
RETURNS TABLE(deleted_order_id uuid, customer_id uuid) AS $$
BEGIN
  RETURN QUERY
  DELETE FROM deliveries
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '10 minutes'
  RETURNING id, deliveries.customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;