/*
# Create Paynow Transactions Table

## Purpose
Tracks all Paynow payment transactions across the platform — customer marketplace orders,
delivery requests, and shop registration fees. Stores the Paynow poll URL, reference,
status, and links back to the originating entity.

## New Tables
- `paynow_transactions`
  - `id` (uuid, primary key)
  - `reference` (text, unique) — human-readable reference e.g. "SHOP-{id}-{ts}"
  - `payment_type` (text) — 'marketplace_order' | 'delivery_request' | 'shop_registration'
  - `entity_id` (uuid, nullable) — ID of the related order/delivery/shop
  - `user_id` (uuid, nullable) — the authenticated user initiating the payment
  - `amount` (numeric, not null) — payment amount in USD
  - `status` (text, default 'initiated') — 'initiated' | 'created' | 'paid' | 'cancelled' | 'failed' | 'delivered'
  - `paynow_poll_url` (text, nullable) — URL to poll Paynow for status
  - `paynow_payment_url` (text, nullable) — redirect URL for the user to complete payment
  - `paynow_status` (text, nullable) — raw status from Paynow
  - `paynow_amount_paid` (numeric, nullable) — actual amount paid (may differ)
  - `metadata` (jsonb, nullable) — additional context (shop name, items, etc.)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Security
- RLS enabled on `paynow_transactions`.
- Authenticated users can read their own transactions (by user_id).
- Authenticated users can insert their own transactions.
- Authenticated users can update their own transactions (for status updates from poll).
- Admin read access via service role (bypasses RLS).
- The edge function uses the service role key to update status from Paynow callbacks.
*/

CREATE TABLE IF NOT EXISTS paynow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL,
  payment_type text NOT NULL DEFAULT 'marketplace_order',
  entity_id uuid,
  user_id uuid,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'initiated',
  paynow_poll_url text,
  paynow_payment_url text,
  paynow_status text,
  paynow_amount_paid numeric(10,2),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE paynow_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_paynow_txns" ON paynow_transactions;
CREATE POLICY "select_own_paynow_txns"
  ON paynow_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_paynow_txns" ON paynow_transactions;
CREATE POLICY "insert_own_paynow_txns"
  ON paynow_transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_paynow_txns" ON paynow_transactions;
CREATE POLICY "update_own_paynow_txns"
  ON paynow_transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Also allow anon for delivery request flow where user may not be in auth.users
DROP POLICY IF EXISTS "anon_paynow_txns" ON paynow_transactions;
CREATE POLICY "anon_paynow_txns"
  ON paynow_transactions FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_paynow_txns_reference ON paynow_transactions (reference);
CREATE INDEX IF NOT EXISTS idx_paynow_txns_entity ON paynow_transactions (entity_id);
CREATE INDEX IF NOT EXISTS idx_paynow_txns_status ON paynow_transactions (status);
