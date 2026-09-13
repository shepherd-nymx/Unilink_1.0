-- Shop rating system - mirrors driver_ratings pattern
-- Allows customers to rate shops after delivered orders

CREATE TABLE IF NOT EXISTS shop_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  shop_order_id uuid NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, shop_order_id)
);

ALTER TABLE shop_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_all_shop_ratings" ON shop_ratings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_own_shop_rating" ON shop_ratings
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shop_orders so
      WHERE so.id = shop_order_id
        AND so.customer_id = auth.uid()
        AND so.status = 'delivered'
    )
  );

-- Add denormalized aggregate columns to shops
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'average_rating'
  ) THEN
    ALTER TABLE shops ADD COLUMN average_rating decimal(3,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'total_ratings'
  ) THEN
    ALTER TABLE shops ADD COLUMN total_ratings integer DEFAULT 0;
  END IF;
END $$;

-- Security definer function to recompute shop rating aggregates
-- Fires AFTER INSERT OR DELETE so admin deletions keep aggregates accurate
CREATE OR REPLACE FUNCTION update_shop_rating()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE shops
    SET average_rating = COALESCE(
      (SELECT ROUND(AVG(rating), 2) FROM shop_ratings WHERE shop_id = OLD.shop_id), 0
    ),
    total_ratings = (
      SELECT COUNT(*) FROM shop_ratings WHERE shop_id = OLD.shop_id
    )
    WHERE id = OLD.shop_id;
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT') THEN
    UPDATE shops
    SET average_rating = COALESCE(
      (SELECT ROUND(AVG(rating), 2) FROM shop_ratings WHERE shop_id = NEW.shop_id), 0
    ),
    total_ratings = (
      SELECT COUNT(*) FROM shop_ratings WHERE shop_id = NEW.shop_id
    )
    WHERE id = NEW.shop_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_shop_rating ON shop_ratings;
CREATE TRIGGER trigger_update_shop_rating
  AFTER INSERT OR DELETE ON shop_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_rating();

CREATE INDEX IF NOT EXISTS idx_shop_ratings_shop_id ON shop_ratings(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_ratings_customer_id ON shop_ratings(customer_id);
