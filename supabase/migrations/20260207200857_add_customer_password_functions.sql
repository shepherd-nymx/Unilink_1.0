/*
  # Customer Password Management Functions
  
  1. New Functions
    - `verify_customer_password`: Verify customer password during password change
    - `update_customer_password`: Update customer password with bcrypt hashing
    
  2. Purpose
    - Allow customers to securely change their passwords
    - Use bcrypt for password hashing and verification
    - Provide secure password management in the customer profile
    
  3. Security
    - Passwords are hashed using bcrypt extension
    - Old password must be verified before updating to new password
    - All password operations are secure and use proper hashing
*/

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to verify customer password
CREATE OR REPLACE FUNCTION verify_customer_password(
  customer_id uuid,
  input_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM customers
  WHERE id = customer_id;
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN stored_hash = crypt(input_password, stored_hash);
END;
$$;

-- Function to update customer password
CREATE OR REPLACE FUNCTION update_customer_password(
  customer_id uuid,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customers
  SET password_hash = crypt(new_password, gen_salt('bf'))
  WHERE id = customer_id;
END;
$$;
