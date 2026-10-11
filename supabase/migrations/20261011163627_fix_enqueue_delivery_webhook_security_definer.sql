/*
# Fix order placement blocked by webhook outbox trigger

1. Problem
- Placing an order (conventional/custom-item flow) failed with
  "Could not place your order" because the `deliveries_webhook_outbox_trigger`
  calls `enqueue_delivery_webhook()`, which inserts into `webhook_outbox`.
  That function ran with the caller's privileges (anon for the browser app),
  and `webhook_outbox` has no anon INSERT policy, so the whole delivery
  INSERT was rolled back.

2. Changes
- Recreate `enqueue_delivery_webhook()` as SECURITY DEFINER with a pinned
  search_path so the outbox insert always succeeds regardless of caller role.
  Table ownership is unchanged and `webhook_outbox` itself stays locked down.

3. Security
- No new grants or policies. The function remains trigger-only and performs
  a single fixed insert; no caller-controlled SQL beyond the NEW row values.
*/

CREATE OR REPLACE FUNCTION public.enqueue_delivery_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_event_type text;
  v_entity_table text := TG_TABLE_NAME;
  v_entity_id uuid;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.status IS NOT DISTINCT FROM OLD.status) THEN
      RETURN NEW;
    END IF;
  END IF;

  v_entity_id := NEW.id;

  IF v_entity_table = 'deliveries' THEN
    v_event_type := 'deliveries_status_changed';
    v_payload := jsonb_build_object(
      'delivery_id', NEW.id,
      'customer_id', NEW.customer_id,
      'driver_id', NEW.driver_id,
      'status', NEW.status,
      'accepted_at', NEW.accepted_at,
      'delivered_at', NEW.delivered_at,
      'declined_at', NEW.declined_at,
      'preferred_delivery_method', NEW.preferred_delivery_method,
      'payment_option', NEW.payment_option,
      'scheduled_for', NEW.scheduled_for
    );
  ELSIF v_entity_table = 'delivery_requests' THEN
    v_event_type := 'delivery_requests_status_changed';
    v_payload := jsonb_build_object(
      'delivery_request_id', NEW.id,
      'customer_id', NEW.customer_id,
      'driver_id', NEW.driver_id,
      'status', NEW.status,
      'service_type', NEW.service_type,
      'delivery_method', NEW.delivery_method,
      'payment_method', NEW.payment_method,
      'offer_fee', NEW.offer_fee,
      'accepted_at', NEW.accepted_at,
      'completed_at', NEW.completed_at,
      'cancelled_at', NEW.cancelled_at,
      'expires_at', NEW.expires_at,
      'delivery_mode', NEW.delivery_mode
    );
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.webhook_outbox (event_type, entity_table, entity_id, payload)
  VALUES (v_event_type, v_entity_table, v_entity_id, v_payload);

  RETURN NEW;
END;
$function$;
