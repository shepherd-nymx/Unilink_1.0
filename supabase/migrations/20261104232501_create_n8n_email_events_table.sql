/*
# n8n email event deduplication table

1. New Table
- `n8n_email_events` stores one row per unique email event sent to n8n.
- `dedupe_key` is unique, so re-delivering the same event (e.g. from a webhook retry) is ignored.

2. Security
- RLS enabled. No anon or authenticated grants: this table is only written by the
  send-email-event edge function using the service role key, which bypasses RLS.
- No policies are added, so anon/authenticated clients have no access at all.

3. Important Notes
- The edge function inserts a row before forwarding to n8n, and deletes it if
  n8n returns an error, so a failed forward can be retried successfully.
*/

CREATE TABLE IF NOT EXISTS n8n_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE n8n_email_events ENABLE ROW LEVEL SECURITY;
