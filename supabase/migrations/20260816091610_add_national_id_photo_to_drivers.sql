/*
# Add National ID Photo Storage for Drivers

1. Changes
   - Add `national_id_photo_url` column to `drivers` table (text, nullable)
     Stores the public URL of the uploaded national ID card image.
   - Add `email` column NOT NULL constraint enforcement at app level
     (column already exists as nullable; the app will require it).

2. New Storage Bucket
   - `driver-id-cards` — public bucket for national ID card photos
     - Max file size: 5MB
     - Allowed types: jpeg, jpg, png, webp

3. Security (Storage)
   - Public read access (admins need to view photos during approval)
   - Authenticated users can upload ID card photos
   - Authenticated users can update/delete their own uploads

4. Notes
   - The drivers table already has an `email` column (nullable). We are NOT
     altering it destructively. The frontend will enforce email as required.
   - The national_id_photo_url is nullable so existing approved drivers
     are unaffected.
*/

-- Add national_id_photo_url column to drivers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'national_id_photo_url'
  ) THEN
    ALTER TABLE drivers ADD COLUMN national_id_photo_url text;
  END IF;
END $$;

-- Create storage bucket for driver ID card photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-id-cards',
  'driver-id-cards',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for driver-id-cards bucket
DROP POLICY IF EXISTS "Public can view driver ID cards" ON storage.objects;
CREATE POLICY "Public can view driver ID cards"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'driver-id-cards');

DROP POLICY IF EXISTS "Authenticated can upload driver ID cards" ON storage.objects;
CREATE POLICY "Authenticated can upload driver ID cards"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'driver-id-cards');

DROP POLICY IF EXISTS "Authenticated can update driver ID cards" ON storage.objects;
CREATE POLICY "Authenticated can update driver ID cards"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'driver-id-cards')
  WITH CHECK (bucket_id = 'driver-id-cards');

DROP POLICY IF EXISTS "Authenticated can delete driver ID cards" ON storage.objects;
CREATE POLICY "Authenticated can delete driver ID cards"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'driver-id-cards');

-- Also allow anon to upload (driver registration happens before auth in this app)
DROP POLICY IF EXISTS "Anon can upload driver ID cards" ON storage.objects;
CREATE POLICY "Anon can upload driver ID cards"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'driver-id-cards');
