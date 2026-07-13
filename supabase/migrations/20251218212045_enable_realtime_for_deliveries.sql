/*
  # Enable Realtime for Deliveries Table

  ## Overview
  Enable real-time notifications for the deliveries table to support:
  - Driver notifications when new orders are placed
  - Customer notifications when orders are accepted or delivered

  ## Changes
  - Enable realtime publication for the deliveries table
*/

-- Enable realtime for deliveries table
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
