/*
  # Add Item Images to Deliveries

  1. Changes
    - Add `item_image_url` column to `deliveries` table to store uploaded item images
    - Create `delivery-item-images` storage bucket for storing customer item photos

  2. Security
    - Bucket configured with 5MB file size limit
    - Only image mime types allowed
    - Private bucket with authenticated access
*/

-- Add item_image_url column to deliveries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'item_image_url'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN item_image_url text;
  END IF;
END $$;

-- Create storage bucket for delivery item images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-item-images',
  'delivery-item-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;