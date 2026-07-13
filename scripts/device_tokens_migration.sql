-- Run this in the Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/yysnoiamfoveltvyjzgx/sql/new

CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  device_id text NOT NULL,
  push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  last_active timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_push_token ON device_tokens(push_token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_last_active ON device_tokens(last_active);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own device tokens" ON device_tokens;
DROP POLICY IF EXISTS "Anyone can insert device tokens" ON device_tokens;
DROP POLICY IF EXISTS "Anyone can update device tokens" ON device_tokens;
DROP POLICY IF EXISTS "Users can delete own device tokens" ON device_tokens;

CREATE POLICY "Users can read own device tokens"
  ON device_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id::uuid);

CREATE POLICY "Anyone can insert device tokens"
  ON device_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update device tokens"
  ON device_tokens FOR UPDATE
  TO anon, authenticated
  USING (user_id IS NOT NULL)
  WITH CHECK (true);

CREATE POLICY "Users can delete own device tokens"
  ON device_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id::uuid);

CREATE OR REPLACE FUNCTION upsert_device_token(
  p_user_id text,
  p_device_id text,
  p_push_token text,
  p_platform text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO device_tokens (user_id, device_id, push_token, platform, last_active)
  VALUES (p_user_id, p_device_id, p_push_token, p_platform, now())
  ON CONFLICT (device_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    push_token = EXCLUDED.push_token,
    platform = EXCLUDED.platform,
    last_active = now();
END;
$$;

CREATE OR REPLACE FUNCTION get_user_push_tokens(p_user_id text)
RETURNS TABLE (
  id uuid,
  device_id text,
  push_token text,
  platform text,
  last_active timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dt.id,
    dt.device_id,
    dt.push_token,
    dt.platform,
    dt.last_active
  FROM device_tokens dt
  WHERE dt.user_id = p_user_id
    AND dt.last_active > now() - interval '60 days';
END;
$$;

CREATE OR REPLACE FUNCTION remove_invalid_token(p_push_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM device_tokens WHERE push_token = p_push_token;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_tokens()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM device_tokens
  WHERE last_active < now() - interval '60 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE VIEW active_driver_tokens AS
SELECT
  dt.id,
  dt.user_id,
  dt.device_id,
  dt.push_token,
  dt.platform,
  dt.last_active
FROM device_tokens dt
INNER JOIN drivers d ON d.id = dt.user_id::uuid
WHERE dt.last_active > now() - interval '30 days'
  AND dt.platform IN ('android', 'ios');
