/*
# Create notification_queue table

Used by fcm-service.ts to queue failed push notifications for retry with
exponential backoff. Each row represents one notification attempt for one user.
*/

CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('customer', 'driver')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz DEFAULT now(),
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status_retry
  ON notification_queue (status, next_retry_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_queue_user
  ON notification_queue (user_id, user_type);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage their own queue entries
CREATE POLICY "select_own_notifications" ON notification_queue
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

CREATE POLICY "insert_own_notifications" ON notification_queue
  FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "update_own_notifications" ON notification_queue
  FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "delete_own_notifications" ON notification_queue
  FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- Also allow anon (the edge function uses service role which bypasses RLS,
-- but client-side queue inserts use the anon key)
CREATE POLICY "insert_notifications_anon" ON notification_queue
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "select_notifications_anon" ON notification_queue
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "update_notifications_anon" ON notification_queue
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);