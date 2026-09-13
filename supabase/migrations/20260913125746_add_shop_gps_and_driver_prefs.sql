-- Add GPS coordinates to shops for driver navigation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE shops ADD COLUMN latitude numeric;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE shops ADD COLUMN longitude numeric;
  END IF;
END $$;

-- Add goods_received timestamp to shop_orders for messenger confirmation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_orders' AND column_name = 'goods_received_at'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN goods_received_at timestamptz;
  END IF;
END $$;

-- Driver-Shop preferences: which shops a driver is available to
CREATE TABLE IF NOT EXISTS driver_shop_preferences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, shop_id)
);

ALTER TABLE driver_shop_preferences ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS driver_shop_prefs_driver_idx ON driver_shop_preferences (driver_id);
CREATE INDEX IF NOT EXISTS driver_shop_prefs_shop_idx ON driver_shop_preferences (shop_id);

DROP POLICY IF EXISTS "driver_manage_own_prefs" ON driver_shop_preferences;
CREATE POLICY "driver_manage_own_prefs"
  ON driver_shop_preferences FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "shop_read_driver_prefs" ON driver_shop_preferences;
CREATE POLICY "shop_read_driver_prefs"
  ON driver_shop_preferences FOR SELECT
  TO anon, authenticated
  USING (true);
