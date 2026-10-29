/*
# Add Student-Owned and Free Delivery flags to shops

1. New Columns on `shops`
- `is_student_owned` (boolean, default false) — set by admin to mark a shop as student-owned. Visible to customers.
- `offers_free_delivery` (boolean, default false) — set by the shop owner to advertise free delivery. Visible to customers.

2. Security
- No new tables. Existing RLS policies on `shops` already cover SELECT/UPDATE for anon and authenticated roles.
- These are boolean flags with safe defaults; no additional policy changes needed.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'is_student_owned') THEN
    ALTER TABLE shops ADD COLUMN is_student_owned boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'offers_free_delivery') THEN
    ALTER TABLE shops ADD COLUMN offers_free_delivery boolean NOT NULL DEFAULT false;
  END IF;
END $$;
