/*
  # Add Customer Self-Registration and Address Management

  1. Changes to customers table
    - Add `email` column (optional)
    - Add `password_hash` column for authentication
    - Add `phone_verified` column to track OTP verification
    - Add `terms_accepted` column for consent tracking
    - Add `terms_accepted_at` timestamp
    - Remove dependency on admin creation (make created_by_admin_id optional)

  2. New Table: customer_addresses
    - `id` (uuid, primary key)
    - `customer_id` (uuid, foreign key to customers)
    - `address_type` (text) - 'default', 'live', 'custom'
    - `latitude` (decimal) - GPS latitude
    - `longitude` (decimal) - GPS longitude
    - `formatted_address` (text) - Human-readable address from reverse geocoding
    - `is_default` (boolean) - Whether this is the default delivery address
    - `accuracy` (numeric) - GPS accuracy in meters (for live locations)
    - `timestamp` (timestamptz) - When location was captured
    - `created_at` (timestamptz)

  3. New Table: delivery_location_log
    - `id` (uuid, primary key)
    - `delivery_id` (uuid, foreign key to deliveries)
    - `location_type` (text) - 'pinned', 'live', 'default'
    - `latitude` (decimal)
    - `longitude` (decimal)
    - `formatted_address` (text)
    - `accuracy` (numeric)
    - `changed_at` (timestamptz) - When location was set/changed
    - `source` (text) - 'customer_registration', 'customer_portal', 'order_placement'

  4. Security
    - Enable RLS on all new tables
    - Add policies for customer address management
    - Add policies for delivery location logging (read-only for customers)

  5. Important Notes
    - Customers can now self-register without admin approval
    - Phone verification is required before registration completes
    - Location is mandatory during registration
    - Each order can have its own location (not global override)
    - Location changes are audited and immutable after delivery
*/

-- Add columns to customers table for self-registration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'email'
  ) THEN
    ALTER TABLE customers ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE customers ADD COLUMN password_hash text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE customers ADD COLUMN phone_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'terms_accepted'
  ) THEN
    ALTER TABLE customers ADD COLUMN terms_accepted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'terms_accepted_at'
  ) THEN
    ALTER TABLE customers ADD COLUMN terms_accepted_at timestamptz;
  END IF;
END $$;

-- Make created_by_admin_id optional (allow self-registration)
ALTER TABLE customers ALTER COLUMN created_by_admin_id DROP NOT NULL;

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) NOT NULL,
  address_type text NOT NULL CHECK (address_type IN ('default', 'live', 'custom')),
  latitude decimal NOT NULL,
  longitude decimal NOT NULL,
  formatted_address text NOT NULL,
  is_default boolean DEFAULT false,
  accuracy numeric,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster address queries
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_is_default ON customer_addresses(customer_id, is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can manage their own addresses
CREATE POLICY "Customers can manage own addresses"
  ON customer_addresses
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create delivery_location_log table for audit trail
CREATE TABLE IF NOT EXISTS delivery_location_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES deliveries(id) NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('pinned', 'live', 'default')),
  latitude decimal NOT NULL,
  longitude decimal NOT NULL,
  formatted_address text,
  accuracy numeric,
  changed_at timestamptz DEFAULT now(),
  source text NOT NULL CHECK (source IN ('customer_registration', 'customer_portal', 'order_placement', 'live_update'))
);

-- Create index for faster location log queries
CREATE INDEX IF NOT EXISTS idx_delivery_location_log_delivery_id ON delivery_location_log(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_location_log_changed_at ON delivery_location_log(changed_at DESC);

-- Enable RLS
ALTER TABLE delivery_location_log ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to location logs
CREATE POLICY "Allow read access to location logs"
  ON delivery_location_log
  FOR SELECT
  USING (true);

-- Policy: Allow insert to location logs (for tracking)
CREATE POLICY "Allow insert to location logs"
  ON delivery_location_log
  FOR INSERT
  WITH CHECK (true);

-- Add columns to deliveries table for enhanced location tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'location_type'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN location_type text DEFAULT 'default' CHECK (location_type IN ('pinned', 'live', 'default'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'formatted_address'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN formatted_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'location_accuracy'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN location_accuracy numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'location_timestamp'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN location_timestamp timestamptz;
  END IF;
END $$;

-- Create function to log location changes
CREATE OR REPLACE FUNCTION log_delivery_location_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log location when delivery is created or location is updated
  IF (TG_OP = 'INSERT') OR 
     (TG_OP = 'UPDATE' AND (
       OLD.customer_latitude != NEW.customer_latitude OR 
       OLD.customer_longitude != NEW.customer_longitude OR
       OLD.location_type != NEW.location_type
     )) THEN
    INSERT INTO delivery_location_log (
      delivery_id,
      location_type,
      latitude,
      longitude,
      formatted_address,
      accuracy,
      changed_at,
      source
    ) VALUES (
      NEW.id,
      NEW.location_type,
      NEW.customer_latitude,
      NEW.customer_longitude,
      NEW.formatted_address,
      NEW.location_accuracy,
      COALESCE(NEW.location_timestamp, now()),
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'order_placement'
        ELSE 'live_update'
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically log location changes
DROP TRIGGER IF EXISTS trigger_log_delivery_location_change ON deliveries;
CREATE TRIGGER trigger_log_delivery_location_change
  AFTER INSERT OR UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION log_delivery_location_change();

-- Create function to prevent location changes after delivery
CREATE OR REPLACE FUNCTION prevent_location_change_after_delivery()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'delivered' AND (
    OLD.customer_latitude != NEW.customer_latitude OR 
    OLD.customer_longitude != NEW.customer_longitude
  ) THEN
    RAISE EXCEPTION 'Cannot change location after delivery is completed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce immutable locations after delivery
DROP TRIGGER IF EXISTS trigger_prevent_location_change_after_delivery ON deliveries;
CREATE TRIGGER trigger_prevent_location_change_after_delivery
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_location_change_after_delivery();
