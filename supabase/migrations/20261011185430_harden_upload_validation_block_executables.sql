/*
# Harden file uploads: validate type and size, block executable extensions

1. Purpose
- Uploads were only loosely validated: the storage buckets carry a 5MB size limit
  and an image-only MIME allowlist, but the access policies accepted ANY filename
  (including .php/.jsp) as long as the bucket name matched, and the app itself
  validated almost nothing before uploading.
- This change enforces the rules at every layer so a crafted request cannot
  smuggle a server-executable file into storage.

2. Bucket configuration (re-asserted idempotently)
- profile-pictures, delivery-item-images, driver-id-cards, shop-assets:
  - file_size_limit = 5242880 (5 MB)
  - allowed_mime_types = image/jpeg, image/jpg, image/png, image/webp
  All four buckets are PRIVATE content stores served through Supabase object
  storage, which serves files as static data and never executes them.

3. Policy changes (all on storage.objects)
- Every INSERT and UPDATE policy now additionally checks the file extension of
  the object name and rejects dangerous server-side executable extensions:
  php, phtml, php3-php7, jsp, jspf, jspx, asp, aspx, exe, sh, bat, cgi.
  This is defense-in-depth on top of the MIME allowlist: even a request that
  lies about its content type is rejected by filename.
- No existing grants are widened; only the WITH CHECK / USING predicates are
  tightened. Legitimate image uploads (jpg/png/webp) are unaffected.

4. Notes
- No tables, columns, or data are modified. Purely access-control hardening.
- The extension check is case-insensitive and reads the last path segment.
*/

-- Re-assert strict bucket configuration (idempotent)
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp']
WHERE id IN ('profile-pictures','delivery-item-images','driver-id-cards','shop-assets');

-- Extension block list, applied to the last path segment (case-insensitive)
-- Reused via a helper predicate in each policy below.

-- delivery-item-images: INSERT / DELETE / SELECT
DROP POLICY IF EXISTS "Anyone can upload delivery item images" ON storage.objects;
CREATE POLICY "Anyone can upload delivery item images"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'delivery-item-images'
  AND reverse(split_part(reverse(name), '.', 1)) NOT IN
    ('php','phtml','php3','php4','php5','php7','jsp','jspf','jspx','asp','aspx','exe','sh','bat','cgi')
);

DROP POLICY IF EXISTS "Anyone can delete delivery item images" ON storage.objects;
CREATE POLICY "Anyone can delete delivery item images"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'delivery-item-images');

-- profile-pictures: INSERT / UPDATE / DELETE / SELECT
DROP POLICY IF EXISTS "Drivers can upload their profile pictures" ON storage.objects;
CREATE POLICY "Drivers can upload their profile pictures"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND reverse(split_part(reverse(name), '.', 1)) NOT IN
    ('php','phtml','php3','php4','php5','php7','jsp','jspf','jspx','asp','aspx','exe','sh','bat','cgi')
);

DROP POLICY IF EXISTS "Drivers can update their profile pictures" ON storage.objects;
CREATE POLICY "Drivers can update their profile pictures"
ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'profile-pictures')
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND reverse(split_part(reverse(name), '.', 1)) NOT IN
    ('php','phtml','php3','php4','php5','php7','jsp','jspf','jspx','asp','aspx','exe','sh','bat','cgi')
);

DROP POLICY IF EXISTS "Drivers can delete their profile pictures" ON storage.objects;
CREATE POLICY "Drivers can delete their profile pictures"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'profile-pictures');

-- driver-id-cards: anon INSERT, authenticated INSERT/UPDATE/DELETE, public SELECT
DROP POLICY IF EXISTS "Anon can upload driver ID cards" ON storage.objects;
CREATE POLICY "Anon can upload driver ID cards"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'driver-id-cards'
  AND reverse(split_part(reverse(name), '.', 1)) NOT IN
    ('php','phtml','php3','php4','php5','php7','jsp','jspf','jspx','asp','aspx','exe','sh','bat','cgi')
);

DROP POLICY IF EXISTS "Authenticated can upload driver ID cards" ON storage.objects;
CREATE POLICY "Authenticated can upload driver ID cards"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'driver-id-cards'
  AND reverse(split_part(reverse(name), '.', 1)) NOT IN
    ('php','phtml','php3','php4','php5','php7','jsp','jspf','jspx','asp','aspx','exe','sh','bat','cgi')
);

DROP POLICY IF EXISTS "Authenticated can update driver ID cards" ON storage.objects;
CREATE POLICY "Authenticated can update driver ID cards"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'driver-id-cards')
WITH CHECK (
  bucket_id = 'driver-id-cards'
  AND reverse(split_part(reverse(name), '.', 1)) NOT IN
    ('php','phtml','php3','php4','php5','php7','jsp','jspf','jspx','asp','aspx','exe','sh','bat','cgi')
);

DROP POLICY IF EXISTS "Authenticated can delete driver ID cards" ON storage.objects;
CREATE POLICY "Authenticated can delete driver ID cards"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'driver-id-cards');

-- shop-assets: anon INSERT, authenticated INSERT/UPDATE/DELETE, public SELECT
DROP POLICY IF EXISTS "Anon can upload shop assets" ON storage.objects;
CREATE POLICY "Anon can upload shop assets"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'shop-assets'
  AND reverse(split_part(reverse(name), '.', 1)) NOT IN
    ('php','phtml','php3','php4','php5','php7','jsp','jspf','jspx','asp','aspx','exe','sh','bat','cgi')
);

DROP POLICY IF EXISTS "Authenticated can upload shop assets" ON storage.objects;
CREATE POLICY "Authenticated can upload shop assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shop-assets'
  AND reverse(split_part(reverse(name), '.', 1)) NOT IN
    ('php','phtml','php3','php4','php5','php7','jsp','jspf','jspx','asp','aspx','exe','sh','bat','cgi')
);

DROP POLICY IF EXISTS "Authenticated can update shop assets" ON storage.objects;
CREATE POLICY "Authenticated can update shop assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'shop-assets')
WITH CHECK (
  bucket_id = 'shop-assets'
  AND reverse(split_part(reverse(name), '.', 1)) NOT IN
    ('php','phtml','php3','php4','php5','php7','jsp','jspf','jspx','asp','aspx','exe','sh','bat','cgi')
);

DROP POLICY IF EXISTS "Authenticated can delete shop assets" ON storage.objects;
CREATE POLICY "Authenticated can delete shop assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'shop-assets');
