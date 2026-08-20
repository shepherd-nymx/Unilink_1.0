
CREATE TABLE IF NOT EXISTS public.whatsapp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  phone_number text NOT NULL,
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_order_driver
  ON public.whatsapp_notifications(order_id, driver_id);

ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_whatsapp_notifications"
  ON public.whatsapp_notifications FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_whatsapp_notifications"
  ON public.whatsapp_notifications FOR INSERT
  TO authenticated WITH CHECK (true);

ALTER TABLE public.whatsapp_notifications
  ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'marketplace';
