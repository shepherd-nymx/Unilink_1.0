/*
# Email Notification System — idempotency + delivery status tracking

## Purpose
Adds the `email_notifications` table that records every transactional email
sent through Resend, plus a unique idempotency constraint that prevents the
same email from being sent twice for a given (recipient + type + order_id)
combination. Also adds a DB trigger that enqueues an outbox row whenever a
delivery's status changes, so the edge-function dispatcher can send the
"Order Status" email without blocking the order flow.

## New Tables
- `email_notifications`
  - id, recipient_email, user_id, user_type, type, order_id, subject,
    status, resend_id, error_message, attempts, metadata, sent_at,
    delivered_at, created_at, updated_at

## Constraints
- status check (pending|sent|failed|delivered|bounced|complained|opened|clicked)
- type check (welcome|email_verification|password_reset|order_confirmation|
  order_status|messenger_assignment|shop_notification|payment_success|
  payment_failed|payment_refunded)
- UNIQUE (recipient_email, type, order_id) WHERE order_id IS NOT NULL
- UNIQUE (recipient_email, type) WHERE order_id IS NULL

## Security (RLS)
- Enabled. Deny-by-default for anon/authenticated.
- Admin SELECT policy via is_admin_user() helper (SECURITY DEFINER).
- Edge functions write/read with service-role key (bypasses RLS).

## Functions
- set_updated_at() — generic updated_at maintainer
- is_admin_user() — SECURITY DEFINER, checks JWT app_metadata.role='admin'
- enqueue_delivery_status_email() — trigger fn, writes to webhook_outbox

## Triggers
- email_notifications_set_updated_at (BEFORE UPDATE)
- deliveries_status_change_email (AFTER UPDATE OF status) — enqueues outbox row

## Notes
1. No existing table altered destructively.
2. The trigger only enqueues; the edge function owns Resend calls + idempotency.
3. A Resend outage never blocks the order flow — the outbox row retries later.
*/

-- ---------------------------------------------------------------------------
-- Helpers (defined first so triggers can reference them)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.enqueue_delivery_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO webhook_outbox (event_type, entity_table, entity_id, payload)
  VALUES (
    'email.order_status',
    'deliveries',
    NEW.id,
    jsonb_build_object(
      'delivery_id', NEW.id,
      'customer_id', NEW.customer_id,
      'driver_id', NEW.driver_id,
      'status_from', OLD.status,
      'status_to', NEW.status,
      'total_amount', NEW.total_amount,
      'delivery_fee', NEW.delivery_fee,
      'items', NEW.items,
      'payment_option', NEW.payment_option,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION public.enqueue_delivery_status_email() TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text        NOT NULL,
  user_id         uuid        NULL,
  user_type       text        NULL,
  type            text        NOT NULL,
  order_id        uuid        NULL,
  subject         text        NULL,
  status          text        NOT NULL DEFAULT 'pending',
  resend_id       text        NULL,
  error_message   text        NULL,
  attempts        integer     NOT NULL DEFAULT 0,
  metadata        jsonb       NULL,
  sent_at         timestamptz NULL,
  delivered_at    timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE email_notifications
  DROP CONSTRAINT IF EXISTS email_notifications_status_check;
ALTER TABLE email_notifications
  ADD CONSTRAINT email_notifications_status_check
  CHECK (status IN ('pending','sent','failed','delivered','bounced','complained','opened','clicked'));

ALTER TABLE email_notifications
  DROP CONSTRAINT IF EXISTS email_notifications_type_check;
ALTER TABLE email_notifications
  ADD CONSTRAINT email_notifications_type_check
  CHECK (type IN (
    'welcome',
    'email_verification',
    'password_reset',
    'order_confirmation',
    'order_status',
    'messenger_assignment',
    'shop_notification',
    'payment_success',
    'payment_failed',
    'payment_refunded'
  ));

DROP INDEX IF EXISTS email_notifications_order_idempotency_idx;
CREATE UNIQUE INDEX email_notifications_order_idempotency_idx
  ON email_notifications (recipient_email, type, order_id)
  WHERE order_id IS NOT NULL;

DROP INDEX IF EXISTS email_notifications_no_order_idempotency_idx;
CREATE UNIQUE INDEX email_notifications_no_order_idempotency_idx
  ON email_notifications (recipient_email, type)
  WHERE order_id IS NULL;

CREATE INDEX IF NOT EXISTS email_notifications_status_idx     ON email_notifications (status);
CREATE INDEX IF NOT EXISTS email_notifications_type_idx       ON email_notifications (type);
CREATE INDEX IF NOT EXISTS email_notifications_created_at_idx ON email_notifications (created_at DESC);

-- updated_at trigger
DROP TRIGGER IF EXISTS email_notifications_set_updated_at ON email_notifications;
CREATE TRIGGER email_notifications_set_updated_at
  BEFORE UPDATE ON email_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin-only SELECT policy
DROP POLICY IF EXISTS "admins_read_email_notifications" ON email_notifications;
CREATE POLICY "admins_read_email_notifications"
  ON email_notifications FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Delivery status change → outbox
DROP TRIGGER IF EXISTS deliveries_status_change_email ON deliveries;
CREATE TRIGGER deliveries_status_change_email
  AFTER UPDATE OF status ON deliveries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.enqueue_delivery_status_email();
