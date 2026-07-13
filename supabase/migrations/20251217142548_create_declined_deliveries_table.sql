/*
  # Create Declined Deliveries Table

  1. New Tables
    - `declined_deliveries`
      - `id` (uuid, primary key)
      - `original_delivery_id` (uuid) - Reference to the original delivery
      - `customer_id` (uuid) - Customer who placed the order
      - `driver_id` (uuid) - Driver who declined
      - `items` (jsonb) - Order items
      - `total_amount` (numeric) - Total order amount
      - `delivery_fee` (numeric) - Delivery fee
      - `payment_option` (text) - Payment method
      - `preferred_delivery_method` (text) - Walking or vehicle
      - `preferred_shops` (text) - Preferred shops if any
      - `customer_latitude` (numeric) - Customer location
      - `customer_longitude` (numeric) - Customer location
      - `declined_at` (timestamp) - When it was declined
      - `original_created_at` (timestamp) - When order was originally created
      - `decline_reason` (text) - Optional reason for decline

  2. Security
    - Enable RLS on `declined_deliveries` table
    - Add policy for admins to view all declined deliveries
    
  3. Purpose
    - Keeps historical records of declined deliveries for admin tracking
    - Allows analysis of decline patterns and driver behavior
*/

CREATE TABLE IF NOT EXISTS declined_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_delivery_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id),
  driver_id uuid NOT NULL REFERENCES drivers(id),
  items jsonb NOT NULL,
  total_amount numeric NOT NULL,
  delivery_fee numeric NOT NULL,
  payment_option text NOT NULL CHECK (payment_option = ANY (ARRAY['pay_on_delivery'::text, 'ecocash'::text])),
  preferred_delivery_method text CHECK (preferred_delivery_method = ANY (ARRAY['walking'::text, 'vehicle'::text])),
  preferred_shops text,
  customer_latitude numeric NOT NULL,
  customer_longitude numeric NOT NULL,
  declined_at timestamptz DEFAULT now(),
  original_created_at timestamptz NOT NULL,
  decline_reason text
);

ALTER TABLE declined_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all declined deliveries"
  ON declined_deliveries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );
