/*
# Fix shop_ratings INSERT policy for no-auth customers

## Problem
The shop_ratings INSERT policy used `auth.uid()` to verify ownership of the
shop_order being rated. However, customers in this app do NOT use Supabase
Auth — they use a custom session stored in AsyncStorage. Their customer_id
is a plain UUID, not an auth.uid(). So auth.uid() always returns null and
every rating insert is rejected by RLS, making it impossible for customers
to rate shops.

## Fix
Replace the auth.uid()-based INSERT policy with one that verifies the
shop_order exists, is delivered, and its customer_id matches the
customer_id being inserted in the rating row. This is the same no-auth
pattern used by other shop marketplace tables in this app.

## Security
- SELECT remains open to anon/authenticated (ratings are public).
- INSERT now checks: order exists, order is delivered, order's customer_id
  matches the rating's customer_id, and the unique constraint on
  (customer_id, shop_order_id) prevents duplicate ratings.
- No UPDATE or DELETE policies are added (ratings are immutable from the
  client side; admin deletion is handled via service role).
*/

DROP POLICY IF EXISTS "insert_own_shop_rating" ON shop_ratings;

CREATE POLICY "insert_own_shop_rating" ON shop_ratings
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shop_orders so
      WHERE so.id = shop_order_id
        AND so.customer_id = shop_ratings.customer_id
        AND so.status = 'delivered'
    )
  );