/*
# Make username and password_hash nullable for Google OAuth customers

1. Changes
- `customers.username`: changed from NOT NULL to nullable
- `customers.password_hash`: already nullable, no change needed
2. Rationale
- Customers who sign in with Google don't choose a username or password.
- These columns must be nullable so a Google-authenticated customer can have
  a row created before they complete their profile.
3. Security
- No RLS changes. Existing policies remain unchanged.
4. Notes
- Existing rows with usernames are unaffected.
- The login flow still checks username/password for non-Google customers.
*/

ALTER TABLE customers ALTER COLUMN username DROP NOT NULL;