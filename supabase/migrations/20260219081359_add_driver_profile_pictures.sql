/*
  # Add Driver Profile Pictures

  1. Changes
    - Add `profile_picture_url` column to `drivers` table
      - Stores URL to driver's profile picture
      - Optional field (can be null)
      - Text type to store image URLs
    
  2. Notes
    - Profile pictures will be displayed in customer dashboard when selecting drivers
    - Profile pictures will be displayed in chat interfaces
    - Drivers can upload/update their profile picture from settings page
*/

-- Add profile_picture_url column to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'profile_picture_url'
  ) THEN
    ALTER TABLE drivers ADD COLUMN profile_picture_url text;
  END IF;
END $$;
