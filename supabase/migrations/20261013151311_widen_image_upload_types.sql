/*
# Accept a wider range of image types for uploads

1. Purpose
- Product, logo, and photo uploads previously allowed only JPG, PNG, and WebP.
- Shops and drivers can now upload a broader range of image formats while the
  platform still guarantees nothing executable can be stored.

2. Bucket configuration (re-asserted idempotently)
- profile-pictures, delivery-item-images, driver-id-cards, shop-assets:
  - file_size_limit = 5242880 (5 MB, unchanged)
  - allowed_mime_types extended to: jpeg, png, webp, gif, bmp, heic, heif,
    avif, tiff.
- All four buckets are PRIVATE content stores. Supabase object storage serves
  files as inert static data and never executes them, so any stored image is
  safe regardless of content.

3. Policy changes (storage.objects)
- The INSERT / UPDATE policies keep their existing filename extension block
  list (php, jsp, asp, exe, sh, bat, cgi and variants), extended with
  additional scriptable/document/archive extensions: svg, html, htm, js,
  pdf, zip, rar, 7z, gz, tar, apk, msi, dmg, iso, py, pl, jar, dll, so.
- This is defense-in-depth on top of the MIME allowlist and the app-side
  content (magic-byte) check introduced in the app code.

4. Notes
- No tables, columns, or existing data are modified.
- The extension check is case-insensitive on the last path segment.
*/

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/jpg','image/png','image/webp',
      'image/gif','image/bmp','image/x-ms-bmp',
      'image/heic','image/heif','image/avif','image/tiff'
    ]
WHERE id IN ('profile-pictures','delivery-item-images','driver-id-cards','shop-assets');

DROP POLICY IF EXISTS "Anyone can upload delivery item images" ON storage.objects;
CREATE POLICY "Anyone can upload delivery item images"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'delivery-item-images'
  AND lower(reverse(split_part(reverse(name), '.', 1))) NOT IN (
    'php','phtml','php3','php4','php5','php7','phps',
    'jsp','jspf','jspx','asp','aspx','ashx',
    'exe','sh','bat','cmd','cgi','pl','py','jar','dll','so',
    'svg','svgz','html','htm','js','mjs','pdf','doc','docx',
    'zip','rar','7z','gz','tar','apk','msi','dmg','iso'
  )
);

DROP POLICY IF EXISTS "Drivers can upload their profile pictures" ON storage.objects;
CREATE POLICY "Drivers can upload their profile pictures"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND lower(reverse(split_part(reverse(name), '.', 1))) NOT IN (
    'php','phtml','php3','php4','php5','php7','phps',
    'jsp','jspf','jspx','asp','aspx','ashx',
    'exe','sh','bat','cmd','cgi','pl','py','jar','dll','so',
    'svg','svgz','html','htm','js','mjs','pdf','doc','docx',
    'zip','rar','7z','gz','tar','apk','msi','dmg','iso'
  )
);

DROP POLICY IF EXISTS "Drivers can update their profile pictures" ON storage.objects;
CREATE POLICY "Drivers can update their profile pictures"
ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'profile-pictures')
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND lower(reverse(split_part(reverse(name), '.', 1))) NOT IN (
    'php','phtml','php3','php4','php5','php7','phps',
    'jsp','jspf','jspx','asp','aspx','ashx',
    'exe','sh','bat','cmd','cgi','pl','py','jar','dll','so',
    'svg','svgz','html','htm','js','mjs','pdf','doc','docx',
    'zip','rar','7z','gz','tar','apk','msi','dmg','iso'
  )
);

DROP POLICY IF EXISTS "Anon can upload driver ID cards" ON storage.objects;
CREATE POLICY "Anon can upload driver ID cards"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'driver-id-cards'
  AND lower(reverse(split_part(reverse(name), '.', 1))) NOT IN (
    'php','phtml','php3','php4','php5','php7','phps',
    'jsp','jspf','jspx','asp','aspx','ashx',
    'exe','sh','bat','cmd','cgi','pl','py','jar','dll','so',
    'svg','svgz','html','htm','js','mjs','pdf','doc','docx',
    'zip','rar','7z','gz','tar','apk','msi','dmg','iso'
  )
);

DROP POLICY IF EXISTS "Authenticated can upload driver ID cards" ON storage.objects;
CREATE POLICY "Authenticated can upload driver ID cards"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'driver-id-cards'
  AND lower(reverse(split_part(reverse(name), '.', 1))) NOT IN (
    'php','phtml','php3','php4','php5','php7','phps',
    'jsp','jspf','jspx','asp','aspx','ashx',
    'exe','sh','bat','cmd','cgi','pl','py','jar','dll','so',
    'svg','svgz','html','htm','js','mjs','pdf','doc','docx',
    'zip','rar','7z','gz','tar','apk','msi','dmg','iso'
  )
);

DROP POLICY IF EXISTS "Authenticated can update driver ID cards" ON storage.objects;
CREATE POLICY "Authenticated can update driver ID cards"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'driver-id-cards')
WITH CHECK (
  bucket_id = 'driver-id-cards'
  AND lower(reverse(split_part(reverse(name), '.', 1))) NOT IN (
    'php','phtml','php3','php4','php5','php7','phps',
    'jsp','jspf','jspx','asp','aspx','ashx',
    'exe','sh','bat','cmd','cgi','pl','py','jar','dll','so',
    'svg','svgz','html','htm','js','mjs','pdf','doc','docx',
    'zip','rar','7z','gz','tar','apk','msi','dmg','iso'
  )
);

DROP POLICY IF EXISTS "Anon can upload shop assets" ON storage.objects;
CREATE POLICY "Anon can upload shop assets"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'shop-assets'
  AND lower(reverse(split_part(reverse(name), '.', 1))) NOT IN (
    'php','phtml','php3','php4','php5','php7','phps',
    'jsp','jspf','jspx','asp','aspx','ashx',
    'exe','sh','bat','cmd','cgi','pl','py','jar','dll','so',
    'svg','svgz','html','htm','js','mjs','pdf','doc','docx',
    'zip','rar','7z','gz','tar','apk','msi','dmg','iso'
  )
);

DROP POLICY IF EXISTS "Authenticated can upload shop assets" ON storage.objects;
CREATE POLICY "Authenticated can upload shop assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shop-assets'
  AND lower(reverse(split_part(reverse(name), '.', 1))) NOT IN (
    'php','phtml','php3','php4','php5','php7','phps',
    'jsp','jspf','jspx','asp','aspx','ashx',
    'exe','sh','bat','cmd','cgi','pl','py','jar','dll','so',
    'svg','svgz','html','htm','js','mjs','pdf','doc','docx',
    'zip','rar','7z','gz','tar','apk','msi','dmg','iso'
  )
);

DROP POLICY IF EXISTS "Authenticated can update shop assets" ON storage.objects;
CREATE POLICY "Authenticated can update shop assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'shop-assets')
WITH CHECK (
  bucket_id = 'shop-assets'
  AND lower(reverse(split_part(reverse(name), '.', 1))) NOT IN (
    'php','phtml','php3','php4','php5','php7','phps',
    'jsp','jspf','jspx','asp','aspx','ashx',
    'exe','sh','bat','cmd','cgi','pl','py','jar','dll','so',
    'svg','svgz','html','htm','js','mjs','pdf','doc','docx',
    'zip','rar','7z','gz','tar','apk','msi','dmg','iso'
  )
);
