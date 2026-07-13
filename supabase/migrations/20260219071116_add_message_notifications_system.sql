/*
  # Add Message Notifications System

  1. Changes to Existing Tables
    - Update chat_messages table to track read status better
    - Update chat_conversations to improve unread counts

  2. New Functions
    - Function to increment unread counts
    - Function to mark messages as read

  3. Security
    - Policies already exist for chat_messages and chat_conversations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_conversation_on_message'
  ) THEN
    CREATE OR REPLACE FUNCTION update_conversation_on_message()
    RETURNS TRIGGER AS $func$
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
          WHEN NEW.sender_type = 'driver' THEN unread_count_customer + 1
          ELSE unread_count_customer
        END,
        updated_at = now()
      WHERE id = NEW.conversation_id;
      
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE TRIGGER update_conversation_on_message
      AFTER INSERT ON chat_messages
      FOR EACH ROW
      EXECUTE FUNCTION update_conversation_on_message();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION mark_messages_read(
  p_conversation_id uuid,
  p_user_type text
)
RETURNS void AS $$
BEGIN
  UPDATE chat_messages
  SET 
    read_by_receiver = true,
    read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_type != p_user_type
    AND read_by_receiver = false;
  
  IF p_user_type = 'driver' THEN
    UPDATE chat_conversations
    SET unread_count_driver = 0
    WHERE id = p_conversation_id;
  ELSE
    UPDATE chat_conversations
    SET unread_count_customer = 0
    WHERE id = p_conversation_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_unread_message_count(
  p_user_id uuid,
  p_user_type text
)
RETURNS integer AS $$
DECLARE
  unread_count integer;
BEGIN
  IF p_user_type = 'driver' THEN
    SELECT COALESCE(SUM(unread_count_driver), 0)
    INTO unread_count
    FROM chat_conversations
    WHERE driver_id = p_user_id;
  ELSE
    SELECT COALESCE(SUM(unread_count_customer), 0)
    INTO unread_count
    FROM chat_conversations
    WHERE customer_id = p_user_id;
  END IF;
  
  RETURN unread_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
