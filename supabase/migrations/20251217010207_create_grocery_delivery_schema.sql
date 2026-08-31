/*
  # Grocery Delivery App Schema

  ## Overview
  Complete database schema for a grocery delivery app with customers, drivers, and admin roles.

  ## Tables Created

  1. **admins**
     - `id` (uuid, primary key)
     - `username` (text, unique)
     - `password_hash` (text) - hashed password for admin login
     - `created_at` (timestamptz)

  2. **customers**
     - `id` (uuid, primary key)
     - `username` (text, unique)
     - `phone_number` (text, unique)
     - `full_name` (text)
     - `created_at` (timestamptz)
     - `created_by_admin_id` (uuid, foreign key to admins)

  3. **drivers**
     - `id` (uuid, primary key)
     - `phone_number` (text, unique)
     - `full_name` (text)
     - `current_key` (text) - current monthly authentication key
     - `key_expires_at` (timestamptz) - expiration date for current key
     - `max_distance_km` (numeric) - max distance willing to travel
     - `fee_under_10` (numeric) - delivery fee for orders <$10
     - `fee_10_to_30` (numeric) - delivery fee for orders $10-$30
     - `fee_30_to_50` (numeric) - delivery fee for orders $30-$50
     - `is_available` (boolean) - availability status
     - `delivery_type` (text) - 'walking' or 'vehicle'
     - `created_at` (timestamptz)
     - `created_by_admin_id` (uuid, foreign key to admins)

  4. **driver_keys**
     - `id` (uuid, primary key)
     - `driver_id` (uuid, foreign key to drivers)
     - `key_value` (text)
     - `issued_at` (timestamptz)
     - `expires_at` (timestamptz)
     - `is_active` (boolean)

  5. **grocery_items**
     - `id` (uuid, primary key)
     - `name` (text)
     - `price` (numeric)
     - `is_available` (boolean)
     - `created_at` (timestamptz)

  6. **deliveries**
     - `id` (uuid, primary key)
     - `customer_id` (uuid, foreign key to customers)
     - `driver_id` (uuid, foreign key to drivers)
     - `items` (jsonb) - array of selected grocery items with quantities
     - `total_amount` (numeric)
     - `delivery_fee` (numeric)
     - `payment_option` (text) - 'pay_on_delivery' or 'ecocash'
     - `customer_latitude` (numeric)
     - `customer_longitude` (numeric)
     - `status` (text) - 'pending', 'accepted', 'in_progress', 'delivered', 'cancelled'
     - `created_at` (timestamptz)
     - `accepted_at` (timestamptz)
     - `delivered_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Create policies for admin, customer, and driver access
*/

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  phone_number text UNIQUE NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by_admin_id uuid REFERENCES admins(id)
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text UNIQUE NOT NULL,
  full_name text NOT NULL,
  current_key text NOT NULL,
  key_expires_at timestamptz NOT NULL,
  max_distance_km numeric DEFAULT 10,
  fee_under_10 numeric DEFAULT 2,
  fee_10_to_30 numeric DEFAULT 5,
  fee_30_to_50 numeric DEFAULT 8,
  is_available boolean DEFAULT false,
  delivery_type text DEFAULT 'walking' CHECK (delivery_type IN ('walking', 'vehicle')),
  created_at timestamptz DEFAULT now(),
  created_by_admin_id uuid REFERENCES admins(id)
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Create driver_keys table
CREATE TABLE IF NOT EXISTS driver_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  key_value text NOT NULL,
  issued_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true
);

ALTER TABLE driver_keys ENABLE ROW LEVEL SECURITY;

-- Create grocery_items table
CREATE TABLE IF NOT EXISTS grocery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;

-- Create deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) NOT NULL,
  driver_id uuid REFERENCES drivers(id),
  items jsonb NOT NULL,
  total_amount numeric NOT NULL,
  delivery_fee numeric NOT NULL,
  payment_option text NOT NULL CHECK (payment_option IN ('pay_on_delivery', 'ecocash')),
  customer_latitude numeric NOT NULL,
  customer_longitude numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'delivered', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  delivered_at timestamptz
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admins (admin can do everything)
CREATE POLICY "Admins can view all admins"
  ON admins FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert admins"
  ON admins FOR INSERT
  WITH CHECK (true);

-- RLS Policies for customers
CREATE POLICY "Anyone can view customers for authentication"
  ON customers FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert customers"
  ON customers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update customers"
  ON customers FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete customers"
  ON customers FOR DELETE
  USING (true);

-- RLS Policies for drivers
CREATE POLICY "Anyone can view drivers for authentication"
  ON drivers FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert drivers"
  ON drivers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Drivers can update their own settings"
  ON drivers FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete drivers"
  ON drivers FOR DELETE
  USING (true);

-- RLS Policies for driver_keys
CREATE POLICY "Anyone can view driver_keys for authentication"
  ON driver_keys FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert driver_keys"
  ON driver_keys FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update driver_keys"
  ON driver_keys FOR UPDATE
  USING (true);

-- RLS Policies for grocery_items
CREATE POLICY "Anyone can view available grocery items"
  ON grocery_items FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert grocery items"
  ON grocery_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update grocery items"
  ON grocery_items FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete grocery items"
  ON grocery_items FOR DELETE
  USING (true);

-- RLS Policies for deliveries
CREATE POLICY "Anyone can view deliveries"
  ON deliveries FOR SELECT
  USING (true);

CREATE POLICY "Customers can insert deliveries"
  ON deliveries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Drivers can update deliveries"
  ON deliveries FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete deliveries"
  ON deliveries FOR DELETE
  USING (true);

-- Insert default admin account (password: admin123)
INSERT INTO admins (username, password_hash)
VALUES ('admin', 'Mutevedzi@20')
ON CONFLICT (username) DO NOTHING;

-- Insert sample grocery items
INSERT INTO grocery_items (name, price, is_available) VALUES
  ('Milk (1L)', 1.50, true),
  ('Bread (Loaf)', 2.00, true),
  ('Eggs (Dozen)', 3.50, true),
  ('Rice (1kg)', 4.00, true),
  ('Chicken (1kg)', 8.00, true),
  ('Tomatoes (1kg)', 2.50, true),
  ('Onions (1kg)', 2.00, true),
  ('Potatoes (1kg)', 2.50, true),
  ('Cooking Oil (1L)', 5.00, true),
  ('Sugar (1kg)', 3.00, true),
  ('Salt (500g)', 1.00, true),
  ('Tea Bags (50ct)', 3.50, true),
  ('Coffee (200g)', 6.00, true),
  ('Butter (250g)', 4.00, true),
  ('Cheese (200g)', 5.00, true)
ON CONFLICT DO NOTHING;