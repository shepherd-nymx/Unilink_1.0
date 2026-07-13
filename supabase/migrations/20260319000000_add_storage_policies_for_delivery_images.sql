/*
  # Add Storage Policies for Delivery Item Images

  1. Storage Policies
    - Make bucket publicly accessible for easier viewing
    - Allow anyone to upload images (validation happens at app level)
    - Allow public read access for drivers to view images
    - Allow deletion of images

  2. Security
    - Public bucket for easy access by drivers
    - File size limited to 5MB (configured in bucket)
    - Only image mime types allowed (configured in bucket)
*/

-- Update bucket to be public for easier access
UPDATE storage.buckets
SET public = true
WHERE id = 'delivery-item-images';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view delivery item images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload delivery item images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete delivery item images" ON storage.objects;

-- Allow public read access to all delivery item images
CREATE POLICY "Public can view delivery item images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'delivery-item-images');

-- Allow anyone to upload images (app validates customer identity)
CREATE POLICY "Anyone can upload delivery item images"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'delivery-item-images');

-- Allow anyone to delete images
CREATE POLICY "Anyone can delete delivery item images"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'delivery-item-images');
