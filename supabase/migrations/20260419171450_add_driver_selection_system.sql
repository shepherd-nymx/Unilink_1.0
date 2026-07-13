ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS open_request_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS driver_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(delivery_id, driver_id)
);

ALTER TABLE driver_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_requests' AND policyname = 'Drivers can insert their own requests') THEN
    EXECUTE $policy$ CREATE POLICY "Drivers can insert their own requests" ON driver_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id) $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_requests' AND policyname = 'Drivers can read their own requests') THEN
    EXECUTE $policy$ CREATE POLICY "Drivers can read their own requests" ON driver_requests FOR SELECT TO authenticated USING (auth.uid() = driver_id) $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_requests' AND policyname = 'Drivers can update their own requests') THEN
    EXECUTE $policy$ CREATE POLICY "Drivers can update their own requests" ON driver_requests FOR UPDATE TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id) $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_requests' AND policyname = 'Customers can read requests for their deliveries') THEN
    EXECUTE $policy$ CREATE POLICY "Customers can read requests for their deliveries" ON driver_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM deliveries WHERE deliveries.id = driver_requests.delivery_id AND deliveries.customer_id = auth.uid())) $policy$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_driver_requests_delivery_id ON driver_requests(delivery_id);
CREATE INDEX IF NOT EXISTS idx_driver_requests_driver_id ON driver_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_requests_status ON driver_requests(status);