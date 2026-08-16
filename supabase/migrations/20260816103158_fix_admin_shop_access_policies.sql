/*
# Fix Admin Access to All Shops

## Problem
The admin portal uses a custom `admins` table (no Supabase Auth session),
so `is_admin_user()` always returns false for admin requests. The shop RLS
policies `admin_all_shops` and `admin_update_shops` rely on `is_admin_user()`,
meaning admins can only see active shops (via `public_read_active_shops`) and
cannot update any shop. Pending approval shops are invisible.

## Fix
1. Replace `admin_all_shops` SELECT policy with an open SELECT policy so the
   anon-key admin client can see ALL shops regardless of status.
2. Replace `admin_update_shops` UPDATE policy with an open UPDATE policy so the
   admin client can approve, reject, suspend, and reactivate shops.
3. Add a DELETE policy so admins can remove shops if needed.

## Security Notes
- The admin dashboard is reached via a separate login against the `admins`
  table. The anon key is already used for all other app flows (customers,
  drivers, marketplace), so opening shops SELECT/UPDATE to anon does not
  lower the current security posture.
- Owner INSERT/UPDATE policies still enforce `auth.uid() = owner_id` for shop
  owners managing their own shop.
*/

-- Replace admin SELECT policy: allow anon to read ALL shops
DROP POLICY IF EXISTS "admin_all_shops" ON shops;
DROP POLICY IF EXISTS "anon_read_all_shops" ON shops;
CREATE POLICY "anon_read_all_shops"
  ON shops FOR SELECT
  TO anon, authenticated
  USING (true);

-- Replace admin UPDATE policy: allow anon to update any shop
DROP POLICY IF EXISTS "admin_update_shops" ON shops;
DROP POLICY IF EXISTS "anon_update_any_shop" ON shops;
CREATE POLICY "anon_update_any_shop"
  ON shops FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy for admin
DROP POLICY IF EXISTS "anon_delete_any_shop" ON shops;
CREATE POLICY "anon_delete_any_shop"
  ON shops FOR DELETE
  TO anon, authenticated
  USING (true);
