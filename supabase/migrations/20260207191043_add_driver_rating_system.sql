/*
  # Driver Rating System

  1. New Tables
    - `driver_ratings`
      - `id` (uuid, primary key)
      - `driver_id` (uuid) - references drivers table
      - `customer_id` (uuid) - references customers table
      - `delivery_id` (uuid) - references deliveries table
      - `rating` (integer) - 1 to 5 stars
      - `review_text` (text, optional) - written review
      - `created_at` (timestamptz)

  2. Changes
    - Add `average_rating` and `total_ratings` to drivers table for performance
    - Add index on driver_id for faster queries

  3. Security
    - Enable RLS on driver_ratings table
    - Customers can only rate deliveries they ordered
    - Customers can read all ratings
    - One rating per delivery per customer

  4. Functions
    - Create function to update driver average rating
    - Create trigger to auto-update ratings when new rating is added
*/

-- Create driver_ratings table
CREATE TABLE IF NOT EXISTS driver_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, delivery_id)
);

ALTER TABLE driver_ratings ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_driver_ratings_driver_id ON driver_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_customer_id ON driver_ratings(customer_id);

-- Anyone can read ratings (they're public)
CREATE POLICY "Anyone can read driver ratings"
  ON driver_ratings
  FOR SELECT
  USING (true);

-- Customers can insert ratings for their own deliveries
CREATE POLICY "Customers can rate their deliveries"
  ON driver_ratings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries
      WHERE deliveries.id = driver_ratings.delivery_id
      AND deliveries.customer_id = driver_ratings.customer_id
      AND deliveries.status IN ('completed', 'delivered')
    )
  );

-- Add rating fields to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'average_rating'
  ) THEN
    ALTER TABLE drivers ADD COLUMN average_rating decimal(3,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'total_ratings'
  ) THEN
    ALTER TABLE drivers ADD COLUMN total_ratings integer DEFAULT 0;
  END IF;
END $$;

-- Function to update driver average rating
CREATE OR REPLACE FUNCTION update_driver_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE drivers
  SET 
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM driver_ratings
      WHERE driver_id = NEW.driver_id
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM driver_ratings
      WHERE driver_id = NEW.driver_id
    )
  WHERE id = NEW.driver_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update ratings
DROP TRIGGER IF EXISTS trigger_update_driver_rating ON driver_ratings;
CREATE TRIGGER trigger_update_driver_rating
  AFTER INSERT ON driver_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_rating();