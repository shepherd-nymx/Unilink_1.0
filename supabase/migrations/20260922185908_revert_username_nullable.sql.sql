/*
# Revert: restore username NOT NULL constraint

1. Changes
- `customers.username`: restored to NOT NULL
2. Rationale
- Reverting the Google OAuth feature. username must be NOT NULL as before.
3. Notes
- Existing rows with NULL username (if any were created) would cause this to fail.
- In that case those rows would need to be cleaned up first, but since the feature
  was never used in production, no rows should have NULL usernames.
*/

ALTER TABLE customers ALTER COLUMN username SET NOT NULL;