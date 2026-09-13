/*
# Extend chat system to support shop ↔ customer and customer ↔ driver (marketplace) conversations

## What this does
1. Adds `shop_id` (nullable FK to shops) and `order_id` (nullable FK to shop_orders) to `chat_conversations` so conversations can be anchored to a shop marketplace order.
2. Adds `unread_count_shop` column to `chat_conversations`.
3. Extends the `sender_type` CHECK on `chat_messages` to include `'shop'`.
4. Replaces the UNIQUE(driver_id, customer_id) constraint with a more flexible one that allows shop-only conversations (where driver_id is NULL).
5. Creates `get_or_create_shop_conversation(p_customer_id, p_shop_id, p_order_id)` RPC for shop conversations.
6. Creates `get_or_create_driver_order_conversation(p_customer_id, p_driver_id, p_order_id)` RPC for customer↔driver conversations tied to a marketplace order (messenger_id).
7. Updates both trigger functions to bump `unread_count_shop` when a customer sends a message in a shop conversation.
8. Updates `mark_messages_as_read` to handle `p_reader_type = 'shop'`.
9. Updates `get_unread_message_count` to handle `p_user_type = 'shop'`.

## Why
Customers ordering from the shop marketplace need to communicate with:
- The shop (about their order, before/after a driver is assigned)
- The assigned driver/messenger (once the shop assigns one)

The existing chat system only supports driver↔customer conversations. This migration extends it to support shop↔customer and order-anchored driver↔customer conversations.

## Security
No new tables. RLS on chat_conversations and chat_messages remains as-is (existing open policies). New columns inherit existing policies. New RPCs are SECURITY DEFINER.
*/

-- 1. Add shop_id and order_id columns to chat_conversations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_conversations' AND column_name = 'shop_id'
  ) THEN
    ALTER TABLE chat_conversations ADD COLUMN shop_id uuid REFERENCES shops(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_conversations' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE chat_conversations ADD COLUMN order_id uuid REFERENCES shop_orders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Add unread_count_shop column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_conversations' AND column_name = 'unread_count_shop'
  ) THEN
    ALTER TABLE chat_conversations ADD COLUMN unread_count_shop integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 3. Extend sender_type CHECK to include 'shop'
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'chat_messages')
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%driver%customer%'
  ) THEN
    ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_sender_type_check;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'chat_messages')
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%shop%'
  ) THEN
    ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_type_check
      CHECK (sender_type = ANY (ARRAY['driver'::text, 'customer'::text, 'shop'::text]));
  END IF;
END $$;

-- 4. Replace UNIQUE(driver_id, customer_id) with a flexible constraint
-- Drop the old unique constraint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'chat_conversations')
    AND contype = 'u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (driver_id, customer_id)'
  ) THEN
    ALTER TABLE chat_conversations DROP CONSTRAINT chat_conversations_driver_id_customer_id_key;
  END IF;
END $$;

-- Add new unique constraint that allows shop-only conversations (driver_id can be NULL)
-- This ensures: one conversation per (driver_id, customer_id, shop_id, order_id) combination
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'chat_conversations')
    AND contype = 'u'
    AND conname = 'chat_conversations_participants_key'
  ) THEN
    ALTER TABLE chat_conversations ADD CONSTRAINT chat_conversations_participants_key
      UNIQUE (driver_id, customer_id, shop_id, order_id);
  END IF;
END $$;

-- 5. Create get_or_create_shop_conversation RPC
CREATE OR REPLACE FUNCTION get_or_create_shop_conversation(
  p_customer_id uuid,
  p_shop_id uuid,
  p_order_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_conversation_id uuid;
BEGIN
  SELECT id INTO v_conversation_id
  FROM chat_conversations
  WHERE shop_id = p_shop_id
    AND customer_id = p_customer_id
    AND (order_id = p_order_id OR (order_id IS NULL AND p_order_id IS NULL));

  IF v_conversation_id IS NULL THEN
    INSERT INTO chat_conversations (customer_id, shop_id, order_id, driver_id)
    VALUES (p_customer_id, p_shop_id, p_order_id, NULL)
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$function$;

-- 6. Create get_or_create_driver_order_conversation RPC
-- For customer↔driver conversations tied to a specific marketplace order
CREATE OR REPLACE FUNCTION get_or_create_driver_order_conversation(
  p_customer_id uuid,
  p_driver_id uuid,
  p_order_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_conversation_id uuid;
BEGIN
  SELECT id INTO v_conversation_id
  FROM chat_conversations
  WHERE driver_id = p_driver_id
    AND customer_id = p_customer_id
    AND (order_id = p_order_id OR (order_id IS NULL AND p_order_id IS NULL));

  IF v_conversation_id IS NULL THEN
    INSERT INTO chat_conversations (customer_id, driver_id, order_id, shop_id)
    VALUES (p_customer_id, p_driver_id, p_order_id, NULL)
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$function$;

-- 7. Update both trigger functions to handle shop unread counts
CREATE OR REPLACE FUNCTION update_conversation_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
UPDATE chat_conversations
SET
  last_message = NEW.message,
  last_message_at = NEW.created_at,
  unread_count_driver = CASE
    WHEN NEW.sender_type = 'customer' THEN unread_count_driver + 1
    ELSE unread_count_driver
  END,
  unread_count_customer = CASE
    WHEN NEW.sender_type IN ('driver', 'shop') THEN unread_count_customer + 1
    ELSE unread_count_customer
  END,
  unread_count_shop = CASE
    WHEN NEW.sender_type = 'customer' THEN unread_count_shop + 1
    ELSE unread_count_shop
  END,
  updated_at = NEW.created_at
WHERE id = NEW.conversation_id;

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
UPDATE chat_conversations
SET
  last_message = NEW.message,
  last_message_at = NEW.created_at,
  unread_count_driver = CASE
    WHEN NEW.sender_type = 'customer' THEN unread_count_driver + 1
    ELSE unread_count_driver
  END,
  unread_count_customer = CASE
    WHEN NEW.sender_type IN ('driver', 'shop') THEN unread_count_customer + 1
    ELSE unread_count_customer
  END,
  unread_count_shop = CASE
    WHEN NEW.sender_type = 'customer' THEN unread_count_shop + 1
    ELSE unread_count_shop
  END,
  updated_at = now()
WHERE id = NEW.conversation_id;

RETURN NEW;
END;
$function$;

-- 8. Update mark_messages_as_read to handle 'shop' reader type
CREATE OR REPLACE FUNCTION mark_messages_as_read(p_conversation_id uuid, p_reader_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
UPDATE chat_messages
SET
  read_by_receiver = true,
  read_at = now()
WHERE
  conversation_id = p_conversation_id
  AND read_by_receiver = false
  AND sender_type != p_reader_type;

IF p_reader_type = 'driver' THEN
  UPDATE chat_conversations SET unread_count_driver = 0 WHERE id = p_conversation_id;
ELSIF p_reader_type = 'shop' THEN
  UPDATE chat_conversations SET unread_count_shop = 0 WHERE id = p_conversation_id;
ELSE
  UPDATE chat_conversations SET unread_count_customer = 0 WHERE id = p_conversation_id;
END IF;
END;
$function$;

-- 9. Update get_unread_message_count to handle 'shop' user type
CREATE OR REPLACE FUNCTION get_unread_message_count(p_user_id uuid, p_user_type text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  unread_count integer;
BEGIN
IF p_user_type = 'driver' THEN
  SELECT COALESCE(SUM(unread_count_driver), 0)
  INTO unread_count
  FROM chat_conversations
  WHERE driver_id = p_user_id;
ELSIF p_user_type = 'shop' THEN
  SELECT COALESCE(SUM(unread_count_shop), 0)
  INTO unread_count
  FROM chat_conversations
  WHERE shop_id = p_user_id;
ELSE
  SELECT COALESCE(SUM(unread_count_customer), 0)
  INTO unread_count
  FROM chat_conversations
  WHERE customer_id = p_user_id;
END IF;

RETURN unread_count;
END;
$function$;
