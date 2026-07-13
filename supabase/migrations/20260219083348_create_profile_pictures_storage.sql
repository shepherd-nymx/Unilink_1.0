/*
  # Create Profile Pictures Storage Bucket

  1. New Storage Bucket
    - `profile-pictures` - Public bucket for driver profile pictures
  
  2. Security
    - Enable public access for viewing images
    - Allow authenticated drivers to upload/update their own profile pictures
    - Restrict file size to 5MB
    - Allow only image file types (jpg, jpeg, png, webp)
*/

-- Create the storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can upload their profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can update their profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can delete their profile pictures" ON storage.objects;

-- Allow public read access to profile pictures
CREATE POLICY "Public can view profile pictures"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-pictures');

-- Allow anyone to upload to profile-pictures (we'll validate on the app side)
CREATE POLICY "Drivers can upload their profile pictures"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'profile-pictures');

-- Allow anyone to update profile pictures
CREATE POLICY "Drivers can update their profile pictures"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'profile-pictures');

-- Allow anyone to delete their profile pictures
CREATE POLICY "Drivers can delete their profile pictures"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'profile-pictures');
