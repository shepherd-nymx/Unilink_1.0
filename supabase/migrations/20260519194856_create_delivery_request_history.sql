/*
  # Create delivery request history table and trigger

  1. New Tables
    - `delivery_request_history`
      - Snapshot of completed delivery requests for audit trail
      - Columns mirror key fields from delivery_requests + joined customer/driver names

  2. Trigger
    - `on_delivery_request_delivered` — fires AFTER UPDATE on delivery_requests
    - Inserts a history snapshot when status transitions to 'delivered'

  3. Security
    - RLS enabled
    - anon + authenticated read/insert policies (open, consistent with app's custom auth)
*/

CREATE TABLE IF NOT EXISTS delivery_request_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  driver_id uuid,
  service_type text NOT NULL,
  delivery_mode text NOT NULL,
  payment_method text NOT NULL,
  delivery_method text NOT NULL,
  offer_fee numeric,
  delivery_fee numeric,
  notes text DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_request_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_request_history_anon_select"
  ON delivery_request_history FOR SELECT TO anon USING (true);

CREATE POLICY "delivery_request_history_auth_select"
  ON delivery_request_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "delivery_request_history_anon_insert"
  ON delivery_request_history FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "delivery_request_history_auth_insert"
  ON delivery_request_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION fn_archive_completed_delivery_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    INSERT INTO delivery_request_history (
      request_id, customer_id, driver_id, service_type, delivery_mode,
      payment_method, delivery_method, offer_fee, delivery_fee,
      notes, completed_at
    ) VALUES (
      NEW.id, NEW.customer_id, NEW.driver_id, NEW.service_type, NEW.delivery_mode,
      NEW.payment_method, NEW.delivery_method, NEW.offer_fee, NEW.delivery_fee,
      NEW.notes, NEW.completed_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_delivery_request_delivered ON delivery_requests;
CREATE TRIGGER on_delivery_request_delivered
  AFTER UPDATE ON delivery_requests
  FOR EACH ROW
  EXECUTE FUNCTION fn_archive_completed_delivery_request();
