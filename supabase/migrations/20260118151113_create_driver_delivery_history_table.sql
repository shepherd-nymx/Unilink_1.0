/*
  # Create Driver Delivery History Table

  1. New Tables
    - `driver_delivery_history`
      - `id` (uuid, primary key) - Unique history record identifier
      - `delivery_id` (uuid, foreign key) - Reference to original delivery
      - `driver_id` (uuid, foreign key) - Driver who completed the delivery
      - `customer_id` (uuid, foreign key) - Customer who ordered
      - `customer_name` (text) - Customer's full name (denormalized for historical record)
      - `customer_phone` (text) - Customer's phone number
      - `pickup_location` (text) - Shop/town where items were purchased
      - `delivery_latitude` (decimal) - Delivery GPS latitude
      - `delivery_longitude` (decimal) - Delivery GPS longitude
      - `payment_method` (text) - Payment method used (e.g., EcoCash)
      - `total_amount` (decimal) - Total order amount
      - `delivery_fee` (decimal) - Delivery fee charged
      - `driver_earnings` (decimal) - Driver's commission/earnings
      - `items` (jsonb) - Order items snapshot
      - `payment_received_at` (timestamptz) - When payment was confirmed
      - `completed_at` (timestamptz) - When delivery was marked as delivered
      - `status` (text) - Status (always 'COMPLETED')
      - `created_at` (timestamptz) - When history record was created

  2. Functions
    - `archive_delivered_order()` - Trigger function to automatically move delivered orders to history

  3. Security
    - Enable RLS on `driver_delivery_history` table
    - Add policy for authenticated users to read history (app-level filtering by driver_id)
    - History records are read-only (no UPDATE or DELETE policies)

  4. Important Notes
    - This table preserves a permanent, immutable record of completed deliveries
    - Data is automatically inserted via trigger when delivery status becomes 'delivered'
    - No deletion or modification of history records is allowed
    - Driver filtering happens at application level
    - Driver earnings calculated as 85% of delivery fee for vehicle, 90% for walking
*/

-- Create the driver_delivery_history table
CREATE TABLE IF NOT EXISTS driver_delivery_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES deliveries(id) NOT NULL,
  driver_id uuid REFERENCES drivers(id) NOT NULL,
  customer_id uuid REFERENCES customers(id) NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  pickup_location text,
  delivery_latitude decimal NOT NULL,
  delivery_longitude decimal NOT NULL,
  payment_method text NOT NULL,
  total_amount decimal NOT NULL,
  delivery_fee decimal NOT NULL,
  driver_earnings decimal NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_received_at timestamptz,
  completed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'COMPLETED',
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries by driver and date
CREATE INDEX IF NOT EXISTS idx_driver_delivery_history_driver_id ON driver_delivery_history(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_delivery_history_completed_at ON driver_delivery_history(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_delivery_history_delivery_id ON driver_delivery_history(delivery_id);

-- Enable RLS
ALTER TABLE driver_delivery_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to history (filtering done at app level)
CREATE POLICY "Allow read access to delivery history"
  ON driver_delivery_history
  FOR SELECT
  USING (true);

-- Create function to automatically archive delivered orders
CREATE OR REPLACE FUNCTION archive_delivered_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Only archive when status changes to 'delivered' and driver_id is set
  IF NEW.status = 'delivered' AND NEW.driver_id IS NOT NULL THEN
    -- Check if this delivery is already in history
    IF NOT EXISTS (
      SELECT 1 FROM driver_delivery_history WHERE delivery_id = NEW.id
    ) THEN
      -- Insert into history table
      INSERT INTO driver_delivery_history (
        delivery_id,
        driver_id,
        customer_id,
        customer_name,
        customer_phone,
        pickup_location,
        delivery_latitude,
        delivery_longitude,
        payment_method,
        total_amount,
        delivery_fee,
        driver_earnings,
        items,
        payment_received_at,
        completed_at,
        status
      )
      SELECT
        NEW.id,
        NEW.driver_id,
        NEW.customer_id,
        c.full_name,
        c.phone_number,
        NEW.preferred_shops,
        NEW.customer_latitude,
        NEW.customer_longitude,
        NEW.payment_option,
        NEW.total_amount,
        NEW.delivery_fee,
        -- Calculate driver earnings (delivery_fee minus commission)
        -- Vehicle delivery: 85% to driver (15% commission)
        -- Walking delivery: 90% to driver (10% commission)
        CASE 
          WHEN 'vehicle' = ANY(d.delivery_type) THEN NEW.delivery_fee * 0.85
          ELSE NEW.delivery_fee * 0.90
        END,
        NEW.items,
        CASE WHEN NEW.payment_received THEN NEW.delivered_at ELSE NULL END,
        COALESCE(NEW.delivered_at, now()),
        'COMPLETED'
      FROM customers c
      JOIN drivers d ON d.id = NEW.driver_id
      WHERE c.id = NEW.customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to archive delivered orders
DROP TRIGGER IF EXISTS trigger_archive_delivered_order ON deliveries;
CREATE TRIGGER trigger_archive_delivered_order
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND OLD.status != 'delivered')
  EXECUTE FUNCTION archive_delivered_order();

-- Archive any existing delivered orders that aren't in history yet
INSERT INTO driver_delivery_history (
  delivery_id,
  driver_id,
  customer_id,
  customer_name,
  customer_phone,
  pickup_location,
  delivery_latitude,
  delivery_longitude,
  payment_method,
  total_amount,
  delivery_fee,
  driver_earnings,
  items,
  payment_received_at,
  completed_at,
  status
)
SELECT
  d.id,
  d.driver_id,
  d.customer_id,
  c.full_name,
  c.phone_number,
  d.preferred_shops,
  d.customer_latitude,
  d.customer_longitude,
  d.payment_option,
  d.total_amount,
  d.delivery_fee,
  CASE 
    WHEN 'vehicle' = ANY(dr.delivery_type) THEN d.delivery_fee * 0.85
    ELSE d.delivery_fee * 0.90
  END,
  d.items,
  CASE WHEN d.payment_received THEN d.delivered_at ELSE NULL END,
  COALESCE(d.delivered_at, d.created_at),
  'COMPLETED'
FROM deliveries d
JOIN customers c ON c.id = d.customer_id
JOIN drivers dr ON dr.id = d.driver_id
WHERE d.status = 'delivered'
  AND d.driver_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_delivery_history WHERE delivery_id = d.id
  );
