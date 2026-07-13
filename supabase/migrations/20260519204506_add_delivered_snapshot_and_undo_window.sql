/*
  # Add delivered snapshot for 10-minute undo window

  ## Purpose
  When a driver marks a delivery as delivered, we preserve a snapshot of all
  relevant location/contact data for 10 minutes. This allows the system to restore
  the delivery to in_progress if the driver tapped "delivered" by mistake.

  ## Changes

  ### deliveries table
  - `delivered_snapshot` (jsonb) — stores customer location, GPS, address, phone at time of delivery
  - `delivered_snapshot_expires_at` (timestamptz) — 10 minutes after delivered_at; after this the snapshot is cleared

  ### delivery_requests table
  - `delivered_snapshot` (jsonb) — stores pickup/destination details, customer contact at time of delivery
  - `delivered_snapshot_expires_at` (timestamptz) — 10 minutes after completed_at

  ## Notes
  - Snapshot is populated server-side via a trigger so it is always consistent
  - After expiry the snapshot columns are set to NULL (no data leakage)
  - The undo operation simply sets status back to 'in_progress', clears delivered/completed_at, and nullifies snapshot columns
*/

-- ── deliveries table ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'delivered_snapshot'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN delivered_snapshot jsonb DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'delivered_snapshot_expires_at'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN delivered_snapshot_expires_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- ── delivery_requests table ───────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_requests' AND column_name = 'delivered_snapshot'
  ) THEN
    ALTER TABLE delivery_requests ADD COLUMN delivered_snapshot jsonb DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_requests' AND column_name = 'delivered_snapshot_expires_at'
  ) THEN
    ALTER TABLE delivery_requests ADD COLUMN delivered_snapshot_expires_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- ── Trigger: snapshot deliveries on delivery ─────────────────────────────────

CREATE OR REPLACE FUNCTION snapshot_delivery_on_delivered()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only fire when transitioning INTO delivered status
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    -- Build snapshot from customer record joined at trigger time
    SELECT jsonb_build_object(
      'customer_id',   c.id,
      'full_name',     c.full_name,
      'phone_number',  c.phone_number,
      'latitude',      c.latitude,
      'longitude',     c.longitude,
      'address',       c.address,
      'university_id', c.university_id,
      'snapshotted_at', now()
    ) INTO NEW.delivered_snapshot
    FROM customers c
    WHERE c.id = NEW.customer_id;

    NEW.delivered_snapshot_expires_at := now() + interval '10 minutes';
  END IF;

  -- Clear snapshot when status moves away from delivered (undo)
  IF OLD.status = 'delivered' AND NEW.status != 'delivered' THEN
    NEW.delivered_snapshot := NULL;
    NEW.delivered_snapshot_expires_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_delivery ON deliveries;
CREATE TRIGGER trg_snapshot_delivery
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION snapshot_delivery_on_delivered();

-- ── Trigger: snapshot delivery_requests on delivered ─────────────────────────

CREATE OR REPLACE FUNCTION snapshot_delivery_request_on_delivered()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_buy  jsonb;
  v_pick jsonb;
  v_cust jsonb;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    -- Customer info
    SELECT jsonb_build_object(
      'full_name',    c.full_name,
      'phone_number', c.phone_number
    ) INTO v_cust
    FROM customers c WHERE c.id = NEW.customer_id;

    -- Buy details
    SELECT jsonb_build_object(
      'item_name',           b.item_name,
      'quantity',            b.quantity,
      'shop_name',           b.shop_name,
      'shop_location',       b.shop_location,
      'budget_estimate',     b.budget_estimate,
      'destination_lat',     b.destination_lat,
      'destination_lng',     b.destination_lng,
      'destination_address', b.destination_address,
      'instructions',        b.instructions
    ) INTO v_buy
    FROM delivery_request_buy_details b WHERE b.request_id = NEW.id;

    -- Pickup details
    SELECT jsonb_build_object(
      'pickup_lat',           p.pickup_lat,
      'pickup_lng',           p.pickup_lng,
      'pickup_address',       p.pickup_address,
      'pickup_contact_name',  p.pickup_contact_name,
      'pickup_contact_phone', p.pickup_contact_phone,
      'pickup_landmark',      p.pickup_landmark,
      'pickup_notes',         p.pickup_notes,
      'destination_lat',      p.destination_lat,
      'destination_lng',      p.destination_lng,
      'destination_address',  p.destination_address,
      'receiver_name',        p.receiver_name,
      'receiver_phone',       p.receiver_phone,
      'destination_notes',    p.destination_notes
    ) INTO v_pick
    FROM delivery_request_pickup_details p WHERE p.request_id = NEW.id;

    NEW.delivered_snapshot := jsonb_build_object(
      'customer',       COALESCE(v_cust, '{}'::jsonb),
      'buy_details',    v_buy,
      'pickup_details', v_pick,
      'service_type',   NEW.service_type,
      'snapshotted_at', now()
    );
    NEW.delivered_snapshot_expires_at := now() + interval '10 minutes';
  END IF;

  -- Clear snapshot on undo
  IF OLD.status = 'delivered' AND NEW.status != 'delivered' THEN
    NEW.delivered_snapshot := NULL;
    NEW.delivered_snapshot_expires_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_delivery_request ON delivery_requests;
CREATE TRIGGER trg_snapshot_delivery_request
  BEFORE UPDATE ON delivery_requests
  FOR EACH ROW EXECUTE FUNCTION snapshot_delivery_request_on_delivered();
