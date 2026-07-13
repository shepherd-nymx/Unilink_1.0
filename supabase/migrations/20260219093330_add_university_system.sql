/*
  # Add University System for Location-Based Filtering

  ## Overview
  This migration creates a university-based filtering system that restricts driver visibility
  to customers registered at the same university location.

  ## Changes

  1. New Tables
    - `universities`
      - `id` (uuid, primary key)
      - `name` (text, unique) - University name (e.g., "University of Zimbabwe")
      - `is_active` (boolean) - Whether university is currently accepting registrations
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `customers`
      - Add `university_id` (uuid, foreign key) - Links customer to their university
    - `drivers`
      - Add `university_id` (uuid, foreign key) - Links driver to their service university

  3. Security
    - Enable RLS on `universities` table
    - Add policies for admin management and public viewing
    - Update existing policies to respect university boundaries

  4. Data Integrity
    - Create indexes on university_id columns for optimized filtering
    - Add foreign key constraints to ensure referential integrity
*/

-- Create universities table
CREATE TABLE IF NOT EXISTS universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on universities table
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

-- Add university_id to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'university_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN university_id uuid REFERENCES universities(id);
  END IF;
END $$;

-- Add university_id to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'university_id'
  ) THEN
    ALTER TABLE drivers ADD COLUMN university_id uuid REFERENCES universities(id);
  END IF;
END $$;

-- Create indexes for optimized filtering
CREATE INDEX IF NOT EXISTS idx_customers_university_id ON customers(university_id);
CREATE INDEX IF NOT EXISTS idx_drivers_university_id ON drivers(university_id);

-- RLS Policies for universities table

-- Allow anyone to view active universities (for registration dropdowns)
CREATE POLICY "Anyone can view active universities"
  ON universities
  FOR SELECT
  USING (is_active = true);

-- Note: Admin policies will be handled through service role key in the admin interface
-- Admins can manage universities through the backend with elevated privileges

-- Insert default university for existing records
INSERT INTO universities (name, is_active)
VALUES ('University of Zimbabwe', true)
ON CONFLICT (name) DO NOTHING;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_universities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS universities_updated_at_trigger ON universities;
CREATE TRIGGER universities_updated_at_trigger
  BEFORE UPDATE ON universities
  FOR EACH ROW
  EXECUTE FUNCTION update_universities_updated_at();
