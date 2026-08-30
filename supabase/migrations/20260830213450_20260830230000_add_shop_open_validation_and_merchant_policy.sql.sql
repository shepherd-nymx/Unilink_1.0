/*
# Add Shop Open Validation and Merchant Policy

## Purpose
1. Creates a server-side function `validate_shop_order` that checks whether a shop is open
   (based on operating_hours + is_available) before allowing an order to be placed.
2. Creates a `merchant_policies` table to store merchant policies that shops must adhere to.

## New Functions
- `validate_shop_order(p_shop_id uuid)` — returns JSON:
  - `{ allowed: true }` if the shop is active, available, and currently open
  - `{ allowed: false, reason: '...' }` with a human-readable reason if not

## New Tables
- `merchant_policies` (id, version, title, content, is_active, created_at)

## Security
- RLS enabled on `merchant_policies` with public read access.
- Function granted to anon + authenticated.
*/

-- ============================================================
-- 1. Shop open validation function
-- ============================================================

CREATE OR REPLACE FUNCTION validate_shop_order(p_shop_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop RECORD;
  v_day_name text;
  v_day_entry jsonb;
  v_open_str text;
  v_close_str text;
  v_open_min int;
  v_close_min int;
  v_cur int;
  v_day_names text[] := ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
BEGIN
  SELECT status, is_available, operating_hours
  INTO v_shop
  FROM shops
  WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'reason', 'Shop not found.');
  END IF;

  IF v_shop.status IS NULL OR v_shop.status <> 'active' THEN
    RETURN json_build_object('allowed', false, 'reason', 'This shop is not currently active on the platform.');
  END IF;

  IF v_shop.is_available IS NOT TRUE THEN
    RETURN json_build_object('allowed', false, 'reason', 'This shop is currently unavailable for orders.');
  END IF;

  IF v_shop.operating_hours IS NULL OR NOT (v_shop.operating_hours::text ~ 'open|close') THEN
    RETURN json_build_object('allowed', true);
  END IF;

  v_day_name := v_day_names[EXTRACT(DOW FROM now())::int + 1];
  v_day_entry := (v_shop.operating_hours::jsonb)->v_day_name;

  IF v_day_entry IS NULL THEN
    RETURN json_build_object('allowed', true);
  END IF;

  IF v_day_entry = 'false'::jsonb OR (v_day_entry->>'closed') = 'true' THEN
    RETURN json_build_object('allowed', false, 'reason', 'This shop is closed today. Please check their operating hours.');
  END IF;

  v_open_str := v_day_entry->>'open';
  v_close_str := v_day_entry->>'close';

  IF v_open_str IS NULL OR v_open_str = '' THEN
    RETURN json_build_object('allowed', true);
  END IF;

  v_cur := EXTRACT(HOUR FROM now())::int * 60 + EXTRACT(MINUTE FROM now())::int;
  v_open_min := (split_part(v_open_str, ':', 1)::int) * 60 + COALESCE(split_part(v_open_str, ':', 2)::int, 0);

  IF v_close_str IS NULL OR v_close_str = '' THEN
    v_close_min := 24 * 60 - 1;
  ELSE
    v_close_min := (split_part(v_close_str, ':', 1)::int) * 60 + COALESCE(split_part(v_close_str, ':', 2)::int, 0);
  END IF;

  IF v_close_min <= v_open_min THEN
    IF v_cur >= v_open_min THEN
      RETURN json_build_object('allowed', true);
    ELSE
      RETURN json_build_object('allowed', false, 'reason', 'This shop is currently closed. They open at ' || v_open_str || '.');
    END IF;
  END IF;

  IF v_cur >= v_open_min AND v_cur < v_close_min THEN
    RETURN json_build_object('allowed', true);
  ELSE
    IF v_cur < v_open_min THEN
      RETURN json_build_object('allowed', false, 'reason', 'This shop is currently closed. They open at ' || v_open_str || '.');
    ELSE
      RETURN json_build_object('allowed', false, 'reason', 'This shop is currently closed. They closed at ' || v_close_str || '.');
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_shop_order(uuid) TO anon, authenticated;

-- ============================================================
-- 2. Merchant policies table
-- ============================================================

CREATE TABLE IF NOT EXISTS merchant_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE merchant_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_merchant_policies" ON merchant_policies;
CREATE POLICY "public_read_merchant_policies"
  ON merchant_policies FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- 3. Seed merchant policy v1.0
-- ============================================================

INSERT INTO merchant_policies (version, title, content, is_active)
VALUES (
  '1.0',
  'UniLink Merchant Policy',
  'UNILINK MERCHANT POLICY
Version 1.0 — Effective 30 August 2026

1. ELIGIBILITY & REGISTRATION

1.1 To register as a merchant on UniLink, you must:
   (a) Be at least 18 years of age
   (b) Operate a legitimate business or be an authorised representative
   (c) Provide accurate business name, physical address, contact details, and area/location
   (d) Have a valid EcoCash merchant number or other approved payment method

1.2 All shop registrations are subject to approval by UniLink administrators.
    Shops will not appear in the marketplace until approved and the registration fee paid.

1.3 Merchants must register under the correct area/suburb so customers can find them
    by location. Providing a false area may result in suspension.

2. SHOP AVAILABILITY & OPERATING HOURS

2.1 Merchants are responsible for keeping their operating hours accurate and up to date.

2.2 When a shop is marked as closed (either by operating hours or the is_available toggle):
   (a) Customers cannot place orders from the shop
   (b) No payments can be processed for the shop
   (c) The shop will display a "Closed" badge in the marketplace

2.3 Merchants should not leave their shop marked as open outside of actual business hours,
    as this leads to unfulfilled orders and customer complaints.

2.4 If a merchant needs to temporarily close (e.g. stock shortage, emergency), they should
    toggle is_available to false immediately.

3. ORDERS & FULFILMENT

3.1 Merchants must fulfil all confirmed orders within a reasonable timeframe.

3.2 If a merchant cannot fulfil an order (out of stock, closed, etc.), they must decline
    the order promptly so the customer is notified and can seek alternatives.

3.3 Merchants must maintain accurate product listings including:
   (a) Correct prices in USD
   (b) Accurate stock levels
   (c) Clear product names and descriptions
   (d) Appropriate categories

3.4 Deliberately listing products that are not in stock is prohibited.

3.5 Merchants must not manipulate prices to exploit customers during peak hours or emergencies.

4. PAYMENTS & FEES

4.1 A one-time registration fee is required after approval before the shop becomes active.
    The fee amount is set by UniLink administrators.

4.2 Merchants must provide a valid EcoCash number (or other approved payment method)
    so customers can pay for EcoCash orders.

4.3 The EcoCash number displayed on order tickets must belong to the shop or its authorised
    representative. Using a third-party number without consent is prohibited.

4.4 Merchants are responsible for verifying that EcoCash payments have been received
    before releasing goods to the messenger/customer.

4.5 UniLink is not liable for payment disputes between merchants and customers. However,
    repeated payment-related complaints may result in account review.

5. DELIVERY & MESSENGERS

5.1 UniLink connects customers with independent drivers/messengers for delivery.

5.2 Merchants are not responsible for delivery fees — these are negotiated between the
    customer and the messenger.

5.3 Merchants should prepare orders promptly once a messenger is assigned so the delivery
    is not delayed.

5.4 If a messenger fails to collect an order, the merchant should notify UniLink support
    rather than cancelling the order unilaterally.

6. PROHIBITED CONDUCT

6.1 Merchants must not:
   (a) Sell counterfeit, expired, or illegal goods
   (b) List products that violate Zimbabwean law or university regulations
   (c) Engage in fraudulent payment practices
   (d) Harass or threaten customers, messengers, or UniLink staff
   (e) Create multiple shop accounts to circumvent suspensions
   (f) Share customer personal data with third parties

6.2 Violations may result in immediate suspension or permanent removal from the platform.

7. RATINGS & REVIEWS

7.1 Customers may rate and review shops after completed orders.

7.2 Merchants cannot pay customers for positive reviews or retaliate against negative reviews.

7.3 Shops with consistently low ratings may be reviewed by UniLink administrators and
    required to improve or face removal.

8. DATA & PRIVACY

8.1 Merchants will have access to customer contact details (name, phone, email) for order
    fulfilment purposes only.

8.2 This data must not be used for marketing, shared with third parties, or retained after
    order completion.

8.3 Merchants must comply with the UniLink Privacy Policy and applicable data protection laws.

9. ACCOUNT SUSPENSION & TERMINATION

9.1 UniLink reserves the right to suspend or terminate any merchant account that:
   (a) Violates this Merchant Policy
   (b) Receives excessive valid complaints
   (c) Fails to maintain accurate shop information
   (d) Engages in fraudulent activity

9.2 Suspended merchants may appeal by contacting UniLink support.

9.3 Terminated merchants forfeit their registration fee and may not re-register.

10. CHANGES TO THIS POLICY

10.1 UniLink may update this Merchant Policy at any time.

10.2 Merchants will be notified of significant changes via email or in-app notification.

10.3 Continued use of the platform after changes take effect constitutes acceptance of the
     updated policy.

11. CONTACT

For questions about this policy, contact UniLink support through the in-app support page
or email support@unilink.co.zw',
  true
)
ON CONFLICT (version) DO NOTHING;
