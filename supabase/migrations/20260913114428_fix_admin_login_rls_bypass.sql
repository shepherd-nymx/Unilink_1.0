-- Admin login is broken because the `admins` table has RLS enabled with a
-- SELECT policy that requires `is_admin_user()` (JWT app_metadata.role = 'admin').
-- A user trying to log in has no admin JWT yet, so the SELECT always returns
-- zero rows and login can never succeed.
--
-- Fix: create a SECURITY DEFINER function that bypasses RLS to verify
-- credentials and return the admin row. Only expose the minimum columns
-- needed for the session (id, username) — never the password_hash.

CREATE OR REPLACE FUNCTION public.verify_admin_login(p_username text, p_password text)
RETURNS TABLE (id uuid, username text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.username
  FROM admins a
  WHERE a.username = p_username
    AND a.password_hash = p_password
  LIMIT 1;
$$;

-- Allow anyone (anon + authenticated) to call the login function.
-- This is safe: it only returns id + username on a correct username/password
-- match, and returns nothing otherwise.
GRANT EXECUTE ON FUNCTION public.verify_admin_login(text, text) TO anon, authenticated;
