/*
# Fix driver_distance_fee_tiers RLS for no-auth driver login

## Problem
Drivers log in with phone number + monthly key, NOT Supabase Auth.
So `auth.uid()` is always NULL for driver sessions.
The existing INSERT/UPDATE/DELETE policies on `driver_distance_fee_tiers`
check `d.id = auth.uid()`, which always evaluates to false —
drivers cannot insert, update, or delete their own distance fee tiers.

The `drivers` table itself already has fully open RLS policies
(`USING (true)` / `WITH CHECK (true)` for all roles) because of this
no-auth pattern. The tier table policies must match.

## Changes
- Drop the existing `authenticated`-only INSERT/UPDATE/DELETE policies.
- Re-create them as `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`,
  matching the `drivers` table access pattern.
- SELECT policy is already open (`USING (true)` to `anon, authenticated`) — left unchanged.

## Security Notes
1. This matches the existing security posture of the `drivers` table, which is
   already fully open to `anon` and `authenticated` for all CRUD operations.
2. The tier table has a foreign key to `drivers(id)` with ON DELETE CASCADE,
   so tiers are cleaned up when a driver is deleted.
3. No column-level changes, no data loss.
*/

-- INSERT: allow anon + authenticated (drivers don't have Supabase Auth sessions)
DROP POLICY IF EXISTS "insert_own_driver_distance_fee_tiers" ON driver_distance_fee_tiers;
CREATE POLICY "insert_own_driver_distance_fee_tiers"
  ON driver_distance_fee_tiers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- UPDATE: allow anon + authenticated
DROP POLICY IF EXISTS "update_own_driver_distance_fee_tiers" ON driver_distance_fee_tiers;
CREATE POLICY "update_own_driver_distance_fee_tiers"
  ON driver_distance_fee_tiers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- DELETE: allow anon + authenticated
DROP POLICY IF EXISTS "delete_own_driver_distance_fee_tiers" ON driver_distance_fee_tiers;
CREATE POLICY "delete_own_driver_distance_fee_tiers"
  ON driver_distance_fee_tiers FOR DELETE
  TO anon, authenticated USING (true);
