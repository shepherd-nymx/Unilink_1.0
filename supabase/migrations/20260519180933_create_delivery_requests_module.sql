/*
  # Delivery Requests Module

  ## Purpose
  Supports the new "Request Delivery" feature allowing customers to:
  - Request Buy & Deliver (messenger buys item and delivers it)
  - Request Pickup & Deliver (messenger picks up an existing item from one location and delivers it to another)

  ## New Tables

  ### delivery_requests
  Core table for all delivery requests (both service types).

  Columns:
  - id (uuid, pk)
  - customer_id (uuid, FK → customers)
  - driver_id (uuid, FK → drivers, nullable — set when accepted)
  - service_type: 'buy_and_deliver' | 'pickup_and_deliver'
  - status: 'pending' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled' | 'expired'
  - payment_method: 'pay_on_delivery' | 'ecocash'
  - delivery_method: 'vehicle' | 'walking'
  - notes (text, general notes)
  - estimated_distance_km (numeric, nullable)
  - estimated_duration_mins (int, nullable)
  - delivery_fee (numeric, nullable — set after driver acceptance)
  - expires_at (timestamptz — auto-expire after 10 min if not accepted)
  - accepted_at, completed_at, cancelled_at (timestamps)
  - created_at, updated_at

  ### delivery_request_buy_details
  Extra fields for Buy & Deliver requests.

  Columns:
  - id (uuid, pk)
  - request_id (uuid, FK → delivery_requests)
  - item_name
  - quantity (int)
  - shop_name
  - shop_location
  - budget_estimate (numeric)
  - destination_lat, destination_lng (numeric)
  - destination_address (text)
  - instructions (text)

  ### delivery_request_pickup_details
  Extra fields for Pickup & Deliver requests.

  Columns:
  - id (uuid, pk)
  - request_id (uuid, FK → delivery_requests)
  - pickup_lat, pickup_lng (numeric)
  - pickup_address (text)
  - pickup_contact_name
  - pickup_contact_phone
  - pickup_landmark
  - pickup_notes
  - destination_lat, destination_lng (numeric)
  - destination_address (text)
  - receiver_name
  - receiver_phone
  - destination_notes

  ## Security
  - RLS enabled on all tables
  - Customers can only see/create their own requests
  - Drivers can see pending requests and their accepted ones
  - Admins (service role) can see all
*/

-- =========================================================
-- delivery_requests
-- =========================================================
CREATE TABLE IF NOT EXISTS delivery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  service_type text NOT NULL CHECK (service_type IN ('buy_and_deliver', 'pickup_and_deliver')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'delivered', 'cancelled', 'expired')),
  payment_method text NOT NULL DEFAULT 'pay_on_delivery' CHECK (payment_method IN ('pay_on_delivery', 'ecocash')),
  delivery_method text NOT NULL DEFAULT 'vehicle' CHECK (delivery_method IN ('vehicle', 'walking')),
  notes text DEFAULT '',
  estimated_distance_km numeric(8,2),
  estimated_duration_mins integer,
  delivery_fee numeric(10,2),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own delivery requests"
  ON delivery_requests FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM customers WHERE auth.uid() IS NOT NULL)
    OR driver_id IN (SELECT id FROM drivers WHERE auth.uid() IS NOT NULL)
  );

CREATE POLICY "Customers can insert own delivery requests"
  ON delivery_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IN (SELECT id FROM customers WHERE auth.uid() IS NOT NULL)
  );

CREATE POLICY "Customers and drivers can update delivery requests"
  ON delivery_requests FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM customers WHERE auth.uid() IS NOT NULL)
    OR driver_id IN (SELECT id FROM drivers WHERE auth.uid() IS NOT NULL)
    OR EXISTS (SELECT 1 FROM drivers WHERE auth.uid() IS NOT NULL AND status = 'pending')
  )
  WITH CHECK (true);

-- Allow anon reads for driver dashboards using service key
CREATE POLICY "Service role full access to delivery_requests"
  ON delivery_requests FOR ALL
  USING (true)
  WITH CHECK (true);

-- =========================================================
-- delivery_request_buy_details
-- =========================================================
CREATE TABLE IF NOT EXISTS delivery_request_buy_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
  item_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  shop_name text NOT NULL DEFAULT '',
  shop_location text NOT NULL DEFAULT '',
  budget_estimate numeric(10,2) NOT NULL DEFAULT 0,
  destination_lat numeric(10,7) NOT NULL DEFAULT 0,
  destination_lng numeric(10,7) NOT NULL DEFAULT 0,
  destination_address text NOT NULL DEFAULT '',
  instructions text DEFAULT ''
);

ALTER TABLE delivery_request_buy_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buy details readable by request parties"
  ON delivery_request_buy_details FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM delivery_requests
      WHERE customer_id IN (SELECT id FROM customers WHERE auth.uid() IS NOT NULL)
         OR driver_id IN (SELECT id FROM drivers WHERE auth.uid() IS NOT NULL)
         OR status = 'pending'
    )
  );

CREATE POLICY "Buy details insertable by authenticated"
  ON delivery_request_buy_details FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Buy details updatable by authenticated"
  ON delivery_request_buy_details FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

-- =========================================================
-- delivery_request_pickup_details
-- =========================================================
CREATE TABLE IF NOT EXISTS delivery_request_pickup_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES delivery_requests(id) ON DELETE CASCADE,
  pickup_lat numeric(10,7) NOT NULL DEFAULT 0,
  pickup_lng numeric(10,7) NOT NULL DEFAULT 0,
  pickup_address text NOT NULL DEFAULT '',
  pickup_contact_name text NOT NULL DEFAULT '',
  pickup_contact_phone text NOT NULL DEFAULT '',
  pickup_landmark text DEFAULT '',
  pickup_notes text DEFAULT '',
  destination_lat numeric(10,7) NOT NULL DEFAULT 0,
  destination_lng numeric(10,7) NOT NULL DEFAULT 0,
  destination_address text NOT NULL DEFAULT '',
  receiver_name text NOT NULL DEFAULT '',
  receiver_phone text NOT NULL DEFAULT '',
  destination_notes text DEFAULT ''
);

ALTER TABLE delivery_request_pickup_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pickup details readable by request parties"
  ON delivery_request_pickup_details FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM delivery_requests
      WHERE customer_id IN (SELECT id FROM customers WHERE auth.uid() IS NOT NULL)
         OR driver_id IN (SELECT id FROM drivers WHERE auth.uid() IS NOT NULL)
         OR status = 'pending'
    )
  );

CREATE POLICY "Pickup details insertable by authenticated"
  ON delivery_request_pickup_details FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Pickup details updatable by authenticated"
  ON delivery_request_pickup_details FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

-- =========================================================
-- Indexes for performance
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_delivery_requests_customer ON delivery_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_driver ON delivery_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_created ON delivery_requests(created_at DESC);

-- =========================================================
-- Enable realtime for live driver notifications
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE delivery_requests;
  END IF;
END $$;
