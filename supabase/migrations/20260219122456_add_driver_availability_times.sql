/*
  # Add Driver Availability Times System

  1. Changes to Tables
    - `drivers` table
      - Add `availability_start_time` (time) - Start of driver's available hours
      - Add `availability_end_time` (time) - End of driver's available hours
      - Add `availability_days` (text[]) - Array of days driver is available (e.g., ['Monday', 'Tuesday'])
      - Add `next_available_time` (timestamptz) - Next specific time driver will be available

    - `deliveries` table
      - Add `scheduled_for` (timestamptz) - When customer wants delivery (null for immediate)
      - Add `is_scheduled` (boolean) - Whether this is a scheduled order
  
  2. Notes
    - Availability times help customers know when drivers are working
    - Customers can choose to place immediate orders or schedule for driver availability
    - Drivers can set regular weekly hours and specific availability times
*/

-- Add availability fields to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'availability_start_time'
  ) THEN
    ALTER TABLE drivers ADD COLUMN availability_start_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'availability_end_time'
  ) THEN
    ALTER TABLE drivers ADD COLUMN availability_end_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'availability_days'
  ) THEN
    ALTER TABLE drivers ADD COLUMN availability_days text[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'next_available_time'
  ) THEN
    ALTER TABLE drivers ADD COLUMN next_available_time timestamptz;
  END IF;
END $$;

-- Add scheduling fields to deliveries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'scheduled_for'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN scheduled_for timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'is_scheduled'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN is_scheduled boolean DEFAULT false;
  END IF;
END $$;