/*
# Fix: Admin portal cannot see pending/rejected/suspended shops

## Problem
The admin portal authenticates via a custom RPC (`verify_admin_login`),
NOT through Supabase Auth. This means `is_admin_user()` always returns
false for the admin portal's anon-key requests. The only SELECT policy
that grants access to the anon role is `public_read_active_shops`,
which filters `status = 'active'`. As a result, shops with status
`pending_approval`, `payment_required`, `payment_submitted`,
`suspended`, or `rejected` are invisible to the admin.

## Fix
Add a new permissive SELECT policy `anon_read_all_shops` that allows
the anon role to read ALL shops regardless of status. This is safe
because:
- The customer marketplace queries already filter `status = 'active'`
  at the application layer, so customers never see non-active shops.
- The admin portal needs full visibility to approve/reject/suspend shops.
- The `admin_update_shops` and `admin_delete_shops` policies still
  require `is_admin_user()`, so write access remains restricted.

## Changes
1. Add `anon_read_all_shops` SELECT policy on `shops` for `anon, authenticated`.
   This is ADDITIVE (permissive) — it ORs with existing policies.
2. The existing `public_read_active_shops` policy remains unchanged.
*/