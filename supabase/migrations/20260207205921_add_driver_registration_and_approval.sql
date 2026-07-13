/*
  # Add Driver Self-Registration and Approval System

  1. Schema Changes
    - Add `approval_status` to drivers table (pending, approved, rejected)
    - Add `email` field for driver registration
    - Add `address` field for driver location
    - Add `vehicle_type` and `vehicle_registration` for vehicle details
    - Add `national_id` for identification
    - Add `rejection_reason` for admin feedback
    - Make `current_key` and `key_expires_at` nullable (assigned after approval)
    - Add `approved_by_admin_id` to track who approved
    - Add `approved_at` timestamp

  2. Security
    - Update RLS policies to allow public driver registration
    - Allow viewing of driver registrations
*/

-- Add new columns to drivers table
DO $$
BEGIN
  -- Add approval_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE drivers ADD COLUMN approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;

  -- Add email column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'email'
  ) THEN
    ALTER TABLE drivers ADD COLUMN email text;
  END IF;

  -- Add address column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'address'
  ) THEN
    ALTER TABLE drivers ADD COLUMN address text;
  END IF;

  -- Add vehicle_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'vehicle_type'
  ) THEN
    ALTER TABLE drivers ADD COLUMN vehicle_type text;
  END IF;

  -- Add vehicle_registration column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'vehicle_registration'
  ) THEN
    ALTER TABLE drivers ADD COLUMN vehicle_registration text;
  END IF;

  -- Add national_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'national_id'
  ) THEN
    ALTER TABLE drivers ADD COLUMN national_id text;
  END IF;

  -- Add rejection_reason column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE drivers ADD COLUMN rejection_reason text;
  END IF;

  -- Add approved_by_admin_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'approved_by_admin_id'
  ) THEN
    ALTER TABLE drivers ADD COLUMN approved_by_admin_id uuid REFERENCES admins(id);
  END IF;

  -- Add approved_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE drivers ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

-- Make current_key and key_expires_at nullable (will be set after approval)
ALTER TABLE drivers ALTER COLUMN current_key DROP NOT NULL;
ALTER TABLE drivers ALTER COLUMN key_expires_at DROP NOT NULL;

-- Update existing drivers to be approved
UPDATE drivers 
SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at) 
WHERE approval_status IS NULL OR (approval_status = 'pending' AND current_key IS NOT NULL);

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage drivers" ON drivers;
DROP POLICY IF EXISTS "Drivers can view own data" ON drivers;

-- Create new RLS policies for driver registration
CREATE POLICY "Anyone can register as driver"
  ON drivers FOR INSERT
  WITH CHECK (approval_status = 'pending');

CREATE POLICY "Anyone can view drivers"
  ON drivers FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update drivers"
  ON drivers FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete drivers"
  ON drivers FOR DELETE
  USING (true);
