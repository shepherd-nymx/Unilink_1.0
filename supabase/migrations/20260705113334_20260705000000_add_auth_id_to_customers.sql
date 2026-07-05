/*
# Add auth_id to customers table

Links customers to Supabase Auth users so registrations use proper auth
(supabase.auth.signUp) instead of the insecure btoa password hash.

1. Modified Tables
   - `customers`: new nullable `auth_id uuid` column, unique, references auth.users(id).
     NULL for existing legacy accounts; populated for new registrations going forward.

2. Notes
   - Column is nullable so legacy customers (no auth account) are not broken.
   - ON DELETE SET NULL: if the auth user is deleted the customer row stays, avoiding
     data loss.
   - Legacy accounts continue to work via the existing password_hash btoa fallback in
     the login flow until they re-register.
*/

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
