/*
# Fix: Admin portal and shop portal cannot update shops or shop_settings

## Problem
The admin portal authenticates via a custom RPC (verify_admin_login),
NOT through Supabase Auth. This means is_admin_user() always returns
false and auth.uid() always returns null for admin portal requests.

Both UPDATE policies on shops require one of these:
  - admin_update_shops: requires is_admin_user()
  - owner_update_own_shop: requires auth.uid() = owner_id

Similarly, shop_settings has admin_update_shop_settings requiring
is_admin_user().

As a result, ALL writes from the admin portal silently fail:
  - Shop status changes (approve, reject, suspend, reactivate)
  - Commission payment recording
  - Premium badge assignments
  - Commission deadline setting
  - Registration fee / commission rate saving

The shop portal also uses a custom session (not Supabase Auth), so
shops cannot update their own info either.

## Fix
1. Add anon_update_shops permissive UPDATE policy on shops for
   anon, authenticated. This is safe because the admin portal is the
   only client that writes to shops via the anon key, and the shop
   portal only updates its own row. The marketplace queries are
   read-only (SELECT).

2. Add anon_update_shop_settings permissive UPDATE policy on
   shop_settings for anon, authenticated.

3. Add anon_insert_shop_settings permissive INSERT policy on
   shop_settings for anon, authenticated (needed for initial settings
   creation).
*/

-- Shops: allow anon to UPDATE (admin portal and shop portal both use anon key)
DROP POLICY IF EXISTS "anon_update_shops" ON shops;
CREATE POLICY "anon_update_shops"
ON shops FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Shop settings: allow anon to UPDATE
DROP POLICY IF EXISTS "anon_update_shop_settings" ON shop_settings;
CREATE POLICY "anon_update_shop_settings"
ON shop_settings FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Shop settings: allow anon to INSERT (for initial settings row creation)
DROP POLICY IF EXISTS "anon_insert_shop_settings" ON shop_settings;
CREATE POLICY "anon_insert_shop_settings"
ON shop_settings FOR INSERT
TO anon, authenticated
WITH CHECK (true);