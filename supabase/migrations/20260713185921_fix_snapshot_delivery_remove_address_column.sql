-- Fix: customers table has no 'address' column; remove it from snapshot
CREATE OR REPLACE FUNCTION snapshot_delivery_on_delivered()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    SELECT jsonb_build_object(
      'customer_id',   c.id,
      'full_name',     c.full_name,
      'phone_number',  c.phone_number,
      'latitude',      c.latitude,
      'longitude',     c.longitude,
      'university_id', c.university_id,
      'snapshotted_at', now()
    ) INTO NEW.delivered_snapshot
    FROM customers c
    WHERE c.id = NEW.customer_id;

    NEW.delivered_snapshot_expires_at := now() + interval '10 minutes';
  END IF;

  IF OLD.status = 'delivered' AND NEW.status != 'delivered' THEN
    NEW.delivered_snapshot := NULL;
    NEW.delivered_snapshot_expires_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;
