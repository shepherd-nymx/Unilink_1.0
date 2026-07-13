/*
  # Terms & Conditions System

  1. New Tables
    - `terms_and_conditions`
      - `id` (uuid, primary key)
      - `version` (text, unique) - semantic version of the terms
      - `content` (text) - full terms content
      - `effective_date` (timestamptz) - when this version becomes active
      - `is_active` (boolean) - whether this is the currently active version
      - `created_at` (timestamptz)
    
    - `terms_acceptance_log`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - references auth.users
      - `user_type` (text) - 'customer' or 'driver'
      - `terms_version` (text) - which version was accepted
      - `ip_address` (text) - for audit purposes
      - `user_agent` (text) - browser/device info
      - `accepted_at` (timestamptz)

  2. Changes
    - Add terms acceptance fields to `customers` table
    - Add terms acceptance fields to `drivers` table

  3. Security
    - Enable RLS on all new tables
    - Add policies for reading active terms (public)
    - Add policies for logging acceptance (authenticated users only)
    - Customers/drivers can only update their own acceptance status
*/

-- Create terms_and_conditions table
CREATE TABLE IF NOT EXISTS terms_and_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text UNIQUE NOT NULL,
  content text NOT NULL,
  effective_date timestamptz DEFAULT now(),
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE terms_and_conditions ENABLE ROW LEVEL SECURITY;

-- Anyone can read active terms
CREATE POLICY "Anyone can read active terms"
  ON terms_and_conditions
  FOR SELECT
  USING (is_active = true);

-- Create terms_acceptance_log table
CREATE TABLE IF NOT EXISTS terms_acceptance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('customer', 'driver')),
  terms_version text NOT NULL,
  ip_address text,
  user_agent text,
  accepted_at timestamptz DEFAULT now()
);

ALTER TABLE terms_acceptance_log ENABLE ROW LEVEL SECURITY;

-- Users can only read their own acceptance logs
CREATE POLICY "Users can read own acceptance logs"
  ON terms_acceptance_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own acceptance logs
CREATE POLICY "Users can log their own acceptance"
  ON terms_acceptance_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add terms acceptance fields to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'terms_accepted'
  ) THEN
    ALTER TABLE customers ADD COLUMN terms_accepted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'terms_version'
  ) THEN
    ALTER TABLE customers ADD COLUMN terms_version text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'terms_accepted_at'
  ) THEN
    ALTER TABLE customers ADD COLUMN terms_accepted_at timestamptz;
  END IF;
END $$;

-- Add terms acceptance fields to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'terms_accepted'
  ) THEN
    ALTER TABLE drivers ADD COLUMN terms_accepted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'terms_version'
  ) THEN
    ALTER TABLE drivers ADD COLUMN terms_version text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'terms_accepted_at'
  ) THEN
    ALTER TABLE drivers ADD COLUMN terms_accepted_at timestamptz;
  END IF;
END $$;

-- Insert initial Terms & Conditions
INSERT INTO terms_and_conditions (version, content, is_active, effective_date)
VALUES (
  '1.0.0',
  E'TERMS AND CONDITIONS OF USE\n\nLast Updated: February 7, 2026\nVersion: 1.0.0\n\n1. ACCEPTANCE OF TERMS\n\nBy accessing or using the UNILINK platform ("Platform"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you must not use the Platform.\n\n2. PLATFORM ROLE AND DISCLAIMER\n\n2.1 TECHNOLOGY INTERMEDIARY\n\nUNILINK operates solely as a technology platform that connects customers with independent delivery drivers. UNILINK is NOT a delivery service provider, logistics company, or employer of drivers.\n\n2.2 NO LIABILITY FOR DELIVERY ISSUES\n\nThe Platform owner, operator, developer, and any affiliated parties ("UNILINK Parties") are NOT responsible for:\n\n• Delivery failures, delays, or cancellations\n• Damaged, spoiled, incorrect, or missing goods\n• Quality, freshness, or safety of purchased items\n• Actions or omissions of drivers or customers\n• Theft, fraud, or criminal activity by drivers or customers\n• Payment disputes between customers and drivers\n• Personal injury or property damage arising from deliveries\n• Any losses, damages, or harm of any kind\n\n2.3 DIRECT RELATIONSHIP\n\nAll delivery transactions occur directly between the Customer and the Driver. The UNILINK Parties are not parties to these transactions and bear no responsibility for the outcome.\n\n3. USER RESPONSIBILITIES\n\n3.1 CUSTOMER RESPONSIBILITIES\n\n• You are solely responsible for evaluating driver trustworthiness\n• You assume all risks when engaging with drivers\n• You are responsible for verifying delivered items\n• You must handle all disputes directly with drivers\n• You must pay drivers as agreed\n\n3.2 DRIVER RESPONSIBILITIES\n\n• You operate as an independent contractor, not an employee\n• You are solely responsible for all delivery outcomes\n• You must handle goods with care and deliver as promised\n• You are responsible for your own insurance, licensing, and compliance\n• You must handle all disputes directly with customers\n\n4. LIMITATION OF LIABILITY\n\nTO THE MAXIMUM EXTENT PERMITTED BY LAW:\n\n• UNILINK PARTIES PROVIDE THE PLATFORM "AS IS" WITHOUT WARRANTIES\n• UNILINK PARTIES SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES\n• YOUR SOLE REMEDY FOR DISSATISFACTION IS TO STOP USING THE PLATFORM\n\n5. INDEMNIFICATION\n\nYou agree to indemnify and hold harmless the UNILINK Parties from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:\n\n• Your use of the Platform\n• Your violation of these Terms\n• Your transactions with other users\n• Your violation of any rights of another party\n\n6. DISPUTE RESOLUTION\n\nAll disputes between Customers and Drivers must be resolved directly between the parties. UNILINK does not provide dispute resolution, mediation, arbitration, or customer support for transaction disputes.\n\n7. USER CONDUCT\n\nYou agree NOT to:\n\n• Use the Platform for illegal purposes\n• Harass, threaten, or defraud other users\n• Provide false information\n• Attempt to manipulate or hack the Platform\n• Violate any applicable laws or regulations\n\n8. ACCOUNT TERMINATION\n\nUNILINK reserves the right to suspend or terminate your account at any time, for any reason, without notice or liability.\n\n9. CHANGES TO TERMS\n\nUNILINK may modify these Terms at any time. Continued use after changes constitutes acceptance of the new Terms. You will be required to accept updated Terms to continue using the Platform.\n\n10. GOVERNING LAW\n\nThese Terms are governed by the laws of the jurisdiction where UNILINK operates.\n\n11. SEVERABILITY\n\nIf any provision of these Terms is found unenforceable, the remaining provisions remain in full effect.\n\n12. ACKNOWLEDGMENT\n\nBY ACCEPTING THESE TERMS, YOU ACKNOWLEDGE THAT:\n\n✓ You have read and understood all provisions\n✓ You understand UNILINK is only a technology platform\n✓ You accept all risks of using the Platform\n✓ You will not hold UNILINK Parties liable for any issues\n✓ You are solely responsible for your interactions with other users\n✓ You have no expectation of customer support for delivery disputes\n\nIF YOU DO NOT AGREE TO THESE TERMS, YOU CANNOT USE THE PLATFORM.',
  true,
  now()
)
ON CONFLICT (version) DO NOTHING;

-- Create function to get current terms version
CREATE OR REPLACE FUNCTION get_current_terms_version()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT version FROM terms_and_conditions WHERE is_active = true ORDER BY effective_date DESC LIMIT 1;
$$;

-- Create function to check if user has accepted current terms
CREATE OR REPLACE FUNCTION check_terms_acceptance(user_type_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_version text;
  user_version text;
  has_accepted boolean;
BEGIN
  -- Get current terms version
  SELECT version INTO current_version FROM terms_and_conditions WHERE is_active = true LIMIT 1;
  
  -- Get user's accepted version
  IF user_type_param = 'customer' THEN
    SELECT terms_version, terms_accepted INTO user_version, has_accepted
    FROM customers WHERE user_id = auth.uid();
  ELSIF user_type_param = 'driver' THEN
    SELECT terms_version, terms_accepted INTO user_version, has_accepted
    FROM drivers WHERE user_id = auth.uid();
  END IF;
  
  -- Return true if user has accepted current version
  RETURN (has_accepted = true AND user_version = current_version);
END;
$$;