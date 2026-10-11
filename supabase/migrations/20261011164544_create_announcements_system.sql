/*
# Create customer announcements system

1. New Tables
- `announcements`
  - `id` (uuid, primary key)
  - `message` (text, not null) - the broadcast text shown to customers
  - `urgency` (text, not null, default 'info') - one of 'info' | 'warning' | 'critical'
  - `is_active` (boolean, not null, default true) - only active announcements are shown to customers
  - `created_by` (text, nullable) - display name of the admin who wrote it
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now()) - changes when edited; used to re-show edited messages

2. Security
- Enable RLS on `announcements`.
- The admin portal and customer app both use the anon-key client (no Supabase
  auth sessions), matching the existing policy pattern in this project
  (e.g. deliveries): permissive CRUD for anon + authenticated.
- Urgency constrained by CHECK to the three supported levels.

3. Notes
- Customer dismissals are stored on-device (localStorage), keyed by
  announcement id + updated_at, so editing a message makes it pop up again.
*/

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL CHECK (char_length(message) <= 1000),
  urgency text NOT NULL DEFAULT 'info' CHECK (urgency IN ('info', 'warning', 'critical')),
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_announcements" ON public.announcements;
CREATE POLICY "anon_select_announcements" ON public.announcements FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_announcements" ON public.announcements;
CREATE POLICY "anon_insert_announcements" ON public.announcements FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_announcements" ON public.announcements;
CREATE POLICY "anon_update_announcements" ON public.announcements FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_announcements" ON public.announcements;
CREATE POLICY "anon_delete_announcements" ON public.announcements FOR DELETE
TO anon, authenticated USING (true);
