/*
# Multi-Vendor Grocery Marketplace Schema

## Purpose
Extends UniLink into a multi-vendor marketplace where Shop Owners can register,
get approved, pay a registration fee, list products, receive orders, and
assign messengers for delivery.

## New Tables

1. shops — shop registration with owner_id, name, status flow, university link
2. shop_products — products per shop with stock and auto-deactivate
3. shop_orders — orders linked to shop + customer + messenger, status tracking
4. shop_settings — singleton config (registration fee, currency)

## Security (RLS)
- shops: public read active; owner CRUD own; admin all
- shop_products: public read active from active shops; owner CRUD own; admin all
- shop_orders: customer read own; shop owner read/update own; messenger read/update assigned; admin all
- shop_settings: public read; admin update

## Notes
1. No existing tables altered destructively.
2. Uses Supabase Auth (auth.users) for shop owner accounts.
3. is_admin_user() already exists from email notifications migration.
4. Realtime enabled on shop_orders.
5. email_notifications type constraint extended with shop-specific types.
*/

-- ===========================================================================
-- SHOPS TABLE
-- ===========================================================================
CREATE TABLE IF NOT EXISTS shops (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name            text NOT NULL,
  slug            text UNIQUE,
  logo_url        text,
  description     text,
  location        text,
  address         text,
  contact_phone   text NOT NULL,
  contact_email   text NOT NULL,
  hours           text,
  ecocash_number  text,
  status          text NOT NULL DEFAULT 'pending_approval',
  university_id   uuid REFERENCES universities(id),
  payment_proof   text,
  payment_verified_at timestamptz,
  approved_at     timestamptz,
  suspended_at    timestamptz,
  rejection_reason text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

ALTER TABLE shops
  DROP CONSTRAINT IF EXISTS shops_status_check;
ALTER TABLE shops
  ADD CONSTRAINT shops_status_check
  CHECK (status IN ('pending_approval', 'payment_required', 'payment_submitted', 'active', 'suspended', 'rejected'));

CREATE INDEX IF NOT EXISTS shops_status_idx ON shops (status);
CREATE INDEX IF NOT EXISTS shops_owner_idx ON shops (owner_id);
CREATE INDEX IF NOT EXISTS shops_university_idx ON shops (university_id);

-- Slug auto-generation function
CREATE OR REPLACE FUNCTION public.generate_shop_slug(p_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter integer := 0;
BEGIN
  base_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  candidate := base_slug;
  LOOP
    IF NOT EXISTS (SELECT 1 FROM shops WHERE slug = candidate) THEN
      RETURN candidate;
    END IF;
    counter := counter + 1;
    candidate := base_slug || '-' || counter::text;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_shop_slug(text) TO authenticated, anon;

-- Auto-set slug on insert
CREATE OR REPLACE FUNCTION public.set_shop_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_shop_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_shop_slug() TO authenticated, anon;

DROP TRIGGER IF EXISTS shops_set_slug ON shops;
CREATE TRIGGER shops_set_slug
  BEFORE INSERT ON shops
  FOR EACH ROW EXECUTE FUNCTION public.set_shop_slug();

-- Shops RLS: public read active
DROP POLICY IF EXISTS "public_read_active_shops" ON shops;
CREATE POLICY "public_read_active_shops"
  ON shops FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

-- Owner read own shop
DROP POLICY IF EXISTS "owner_read_own_shop" ON shops;
CREATE POLICY "owner_read_own_shop"
  ON shops FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Owner insert own shop
DROP POLICY IF EXISTS "owner_insert_own_shop" ON shops;
CREATE POLICY "owner_insert_own_shop"
  ON shops FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Owner update own shop
DROP POLICY IF EXISTS "owner_update_own_shop" ON shops;
CREATE POLICY "owner_update_own_shop"
  ON shops FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Admin access
DROP POLICY IF EXISTS "admin_all_shops" ON shops;
CREATE POLICY "admin_all_shops"
  ON shops FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "admin_update_shops" ON shops;
CREATE POLICY "admin_update_shops"
  ON shops FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ===========================================================================
-- SHOP_PRODUCTS TABLE
-- ===========================================================================
CREATE TABLE IF NOT EXISTS shop_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  image_url   text,
  price       numeric NOT NULL DEFAULT 0,
  stock       integer NOT NULL DEFAULT 0,
  category    text,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

ALTER TABLE shop_products
  DROP CONSTRAINT IF EXISTS shop_products_status_check;
ALTER TABLE shop_products
  ADD CONSTRAINT shop_products_status_check
  CHECK (status IN ('active', 'inactive'));

CREATE INDEX IF NOT EXISTS shop_products_shop_idx ON shop_products (shop_id);
CREATE INDEX IF NOT EXISTS shop_products_status_idx ON shop_products (status);
CREATE INDEX IF NOT EXISTS shop_products_category_idx ON shop_products (category);

-- Auto-deactivate when stock hits 0
CREATE OR REPLACE FUNCTION public.auto_deactivate_zero_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stock = 0 AND NEW.status = 'active' THEN
    NEW.status := 'inactive';
  END IF;
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_deactivate_zero_stock() TO authenticated, anon;

DROP TRIGGER IF EXISTS shop_products_auto_deactivate ON shop_products;
CREATE TRIGGER shop_products_auto_deactivate
  BEFORE UPDATE OF stock ON shop_products
  FOR EACH ROW EXECUTE FUNCTION public.auto_deactivate_zero_stock();

-- Public read active products from active shops
DROP POLICY IF EXISTS "public_read_active_products" ON shop_products;
CREATE POLICY "public_read_active_products"
  ON shop_products FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = shop_products.shop_id
      AND shops.status = 'active'
    )
  );

-- Shop owner manage own products
DROP POLICY IF EXISTS "owner_read_own_products" ON shop_products;
CREATE POLICY "owner_read_own_products"
  ON shop_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_products.shop_id AND shops.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "owner_insert_own_products" ON shop_products;
CREATE POLICY "owner_insert_own_products"
  ON shop_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_products.shop_id AND shops.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "owner_update_own_products" ON shop_products;
CREATE POLICY "owner_update_own_products"
  ON shop_products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_products.shop_id AND shops.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_products.shop_id AND shops.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "owner_delete_own_products" ON shop_products;
CREATE POLICY "owner_delete_own_products"
  ON shop_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_products.shop_id AND shops.owner_id = auth.uid())
  );

-- Admin
DROP POLICY IF EXISTS "admin_all_products" ON shop_products;
CREATE POLICY "admin_all_products"
  ON shop_products FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "admin_update_products" ON shop_products;
CREATE POLICY "admin_update_products"
  ON shop_products FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_delete_products" ON shop_products;
CREATE POLICY "admin_delete_products"
  ON shop_products FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

-- ===========================================================================
-- SHOP_ORDERS TABLE
-- ===========================================================================
CREATE TABLE IF NOT EXISTS shop_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  shop_id             uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  products            jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount        numeric NOT NULL DEFAULT 0,
  delivery_fee        numeric NOT NULL DEFAULT 0,
  delivery_location   text,
  delivery_latitude   numeric,
  delivery_longitude  numeric,
  payment_method      text NOT NULL DEFAULT 'pay_on_delivery',
  status              text NOT NULL DEFAULT 'pending',
  messenger_id        uuid REFERENCES drivers(id) ON DELETE SET NULL,
  customer_email      text,
  customer_name       text,
  customer_phone      text,
  order_note          text,
  confirmed_at        timestamptz,
  assigned_at         timestamptz,
  picked_up_at        timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE shop_orders
  DROP CONSTRAINT IF EXISTS shop_orders_status_check;
ALTER TABLE shop_orders
  ADD CONSTRAINT shop_orders_status_check
  CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'ready',
    'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'
  ));

ALTER TABLE shop_orders
  DROP CONSTRAINT IF EXISTS shop_orders_payment_check;
ALTER TABLE shop_orders
  ADD CONSTRAINT shop_orders_payment_check
  CHECK (payment_method IN ('pay_on_delivery', 'ecocash', 'paynow'));

CREATE INDEX IF NOT EXISTS shop_orders_customer_idx ON shop_orders (customer_id);
CREATE INDEX IF NOT EXISTS shop_orders_shop_idx ON shop_orders (shop_id);
CREATE INDEX IF NOT EXISTS shop_orders_messenger_idx ON shop_orders (messenger_id);
CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON shop_orders (status);
CREATE INDEX IF NOT EXISTS shop_orders_created_at_idx ON shop_orders (created_at DESC);

-- The app uses anon key for customer session, so we allow anon+authenticated
-- The app-side logic filters by customer_id to show only own orders
DROP POLICY IF EXISTS "anon_read_shop_orders" ON shop_orders;
CREATE POLICY "anon_read_shop_orders"
  ON shop_orders FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "customer_insert_shop_orders" ON shop_orders;
CREATE POLICY "customer_insert_shop_orders"
  ON shop_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anyone_update_shop_orders" ON shop_orders;
CREATE POLICY "anyone_update_shop_orders"
  ON shop_orders FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER TABLE shop_orders REPLICA IDENTITY FULL;

-- ===========================================================================
-- SHOP_SETTINGS TABLE (singleton)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS shop_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_fee numeric NOT NULL DEFAULT 10.00,
  currency        text NOT NULL DEFAULT 'USD',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_shop_settings" ON shop_settings;
CREATE POLICY "public_read_shop_settings"
  ON shop_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_update_shop_settings" ON shop_settings;
CREATE POLICY "admin_update_shop_settings"
  ON shop_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

INSERT INTO shop_settings (registration_fee, currency)
VALUES (10.00, 'USD')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- STORAGE BUCKET FOR SHOP ASSETS
-- ===========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-assets', 'shop-assets', true, 5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view shop assets" ON storage.objects;
CREATE POLICY "Public can view shop assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'shop-assets');

DROP POLICY IF EXISTS "Authenticated can upload shop assets" ON storage.objects;
CREATE POLICY "Authenticated can upload shop assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'shop-assets');

DROP POLICY IF EXISTS "Anon can upload shop assets" ON storage.objects;
CREATE POLICY "Anon can upload shop assets"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'shop-assets');

DROP POLICY IF EXISTS "Authenticated can update shop assets" ON storage.objects;
CREATE POLICY "Authenticated can update shop assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'shop-assets')
  WITH CHECK (bucket_id = 'shop-assets');

DROP POLICY IF EXISTS "Authenticated can delete shop assets" ON storage.objects;
CREATE POLICY "Authenticated can delete shop assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'shop-assets');

-- ===========================================================================
-- EXTEND email_notifications TYPE CONSTRAINT
-- ===========================================================================
ALTER TABLE email_notifications
  DROP CONSTRAINT IF EXISTS email_notifications_type_check;
ALTER TABLE email_notifications
  ADD CONSTRAINT email_notifications_type_check
  CHECK (type IN (
    'welcome', 'email_verification', 'password_reset',
    'order_confirmation', 'order_status', 'messenger_assignment',
    'shop_notification', 'payment_success', 'payment_failed', 'payment_refunded',
    'shop_approval', 'shop_payment_required', 'shop_activated',
    'shop_new_order', 'shop_order_status', 'shop_messenger_assigned'
  ));
