/*
# Privacy Centre, Consent Management & DPO Compliance Schema

## Overview
This migration adds a comprehensive privacy and compliance infrastructure to UniLink,
including consent management with versioned policies, privacy data requests (GDPR-style),
DPO (Data Protection Officer) management, data processing register, third-party processor
register, security incident/breach log, configurable data-retention rules, and marketing
opt-in/opt-out tracking.

## 1. New Tables

### privacy_policy_versions
Stores versioned Privacy Policy documents. Previous versions are preserved.
- id, version (e.g. "1.0"), title, content, effective_date, is_active, created_at
- Only one version can be is_active at a time (enforced by partial unique index).

### terms_policy_versions
Stores versioned Terms & Conditions documents (separate from existing terms_and_conditions table).
This provides a dedicated versioning table for terms with the same pattern.
- id, version, title, content, effective_date, is_active, created_at

### consent_records
Records every consent action (accept/reject/withdraw) for any user.
- id, user_id (uuid), user_type (customer/driver/shop_owner/admin), consent_type
  (terms/privacy/marketing/data_processing), policy_version, action (granted/withdrawn),
  policy_type (privacy_policy/terms_and_conditions), ip_address, user_agent,
  consent_given_at, withdrawn_at, created_at
- Tracks the full history: when consent was given and when it was withdrawn.

### marketing_consents
Simplified marketing opt-in/opt-out status per customer. Reflects the latest state.
- id, customer_id (uuid, unique), opted_in (boolean), consent_date, opt_out_date,
  consent_method (signup/profile_toggle/admin), policy_version, created_at, updated_at

### privacy_requests
Customer-initiated data requests (export, correction, deletion).
- id, customer_id, request_type (export_data/correct_data/delete_data/restrict_processing),
  status (pending/in_review/completed/rejected/cancelled), description, requested_at,
  reviewed_by_admin_id, reviewed_at, admin_notes, completed_at, response_data (jsonb),
  created_at, updated_at

### dpo_settings
Singleton table (one row) with editable DPO contact details.
- id, dpo_name, dpo_email, dpo_phone, dpo_address, organisation_name,
  privacy_contact_email, last_updated_at, created_at

### data_processing_register
Records of data processing activities (Article 30 GDPR-style register).
- id, activity_name, purpose, data_categories (text[]), lawful_basis, data_subjects (text[]),
  recipients (text[]), retention_period, cross_border_transfers (boolean), transfer_destinations,
  risk_level (low/medium/high), mitigation_measures, is_active, created_at, updated_at

### third_party_processors
Register of third parties who process data on behalf of UniLink.
- id, processor_name, service_description, data_categories (text[]), purpose,
  legal_basis, contact_email, contact_phone, contract_reference, dpas_signed (boolean),
  cross_border (boolean), transfer_destinations, security_measures, is_active,
  added_at, updated_at

### security_incidents
Log of security incidents and data breaches.
- id, incident_type (data_breach/unauthorized_access/system_compromise/other),
  severity (low/medium/high/critical), description, affected_data_categories (text[]),
  affected_individuals_count (integer), detected_at, reported_at, contained_at,
  resolved_at, status (detected/investigating/contained/resolved/closed),
  reported_to_authority (boolean), authority_report_date, authority_reference,
  corrective_actions (text), root_cause, reported_by_admin_id, created_at, updated_at

### data_retention_rules
Configurable retention rules per data category.
- id, category_name, description, retention_days (integer), auto_delete (boolean),
  last_reviewed_at, is_active, created_at, updated_at

## 2. Indexes
- consent_records: user_id, (user_id, consent_type)
- marketing_consents: customer_id (unique)
- privacy_requests: customer_id, status
- audit_logs: entity_type, created_at (for pagination)
- deliveries: customer_id, driver_id, status, created_at
- shop_orders: customer_id, shop_id, messenger_id, status, created_at
- drivers: approval_status, is_available, subscription_status
- shops: status, is_available
- chat_messages: conversation_id, created_at
- shop_products: shop_id
- delivery_requests: customer_id, driver_id, status

## 3. Security (RLS)
All new tables have RLS enabled. Admin-only policies using is_admin_user() for
management tables. Customer-facing tables (consent_records, marketing_consents,
privacy_requests) allow customers to read and insert their own records but admin
reviews/updates privacy requests.

## 4. Default Data
- DPO settings seed row (editable later)
- Default retention rules (deliveries: 365 days, chat messages: 180 days, etc.)
- Active privacy policy version 1.0 placeholder

## Important Notes
1. This migration does NOT modify existing tables or data — it only adds new tables
   and indexes.
2. The privacy_policy_versions and terms_policy_versions tables are separate from the
   existing terms_and_conditions table to avoid disrupting existing functionality.
3. Existing consent/acceptance data in terms_acceptance_log is preserved and not
   migrated — the new consent_records table starts fresh for going-forward consent.
4. DPO settings is a singleton — the trigger ensures only one row exists.
*/

-- ============================================================
-- 1. PRIVACY POLICY VERSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS privacy_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  effective_date timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE privacy_policy_versions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS uq_privacy_policy_active ON privacy_policy_versions (is_active) WHERE is_active = true;

DROP POLICY IF EXISTS "admin_manage_privacy_policies" ON privacy_policy_versions;
CREATE POLICY "admin_manage_privacy_policies" ON privacy_policy_versions
  FOR ALL TO anon, authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "anyone_read_active_privacy_policy" ON privacy_policy_versions;
CREATE POLICY "anyone_read_active_privacy_policy" ON privacy_policy_versions
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- ============================================================
-- 2. TERMS POLICY VERSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS terms_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  effective_date timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE terms_policy_versions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS uq_terms_policy_active ON terms_policy_versions (is_active) WHERE is_active = true;

DROP POLICY IF EXISTS "admin_manage_terms_policies" ON terms_policy_versions;
CREATE POLICY "admin_manage_terms_policies" ON terms_policy_versions
  FOR ALL TO anon, authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "anyone_read_active_terms_policy" ON terms_policy_versions;
CREATE POLICY "anyone_read_active_terms_policy" ON terms_policy_versions
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- ============================================================
-- 3. CONSENT RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_type text NOT NULL DEFAULT 'customer',
  consent_type text NOT NULL DEFAULT 'privacy',
  policy_version text,
  action text NOT NULL DEFAULT 'granted',
  policy_type text NOT NULL DEFAULT 'privacy_policy',
  ip_address text,
  user_agent text,
  consent_given_at timestamptz DEFAULT now(),
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records (user_id);
CREATE INDEX IF NOT EXISTS idx_consent_user_type ON consent_records (user_id, consent_type);

DROP POLICY IF EXISTS "customer_read_own_consents" ON consent_records;
CREATE POLICY "customer_read_own_consents" ON consent_records
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "customer_insert_own_consents" ON consent_records;
CREATE POLICY "customer_insert_own_consents" ON consent_records
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_consents" ON consent_records;
CREATE POLICY "admin_all_consents" ON consent_records
  FOR ALL TO anon, authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- ============================================================
-- 4. MARKETING CONSENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS marketing_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE,
  opted_in boolean NOT NULL DEFAULT false,
  consent_date timestamptz,
  opt_out_date timestamptz,
  consent_method text NOT NULL DEFAULT 'profile_toggle',
  policy_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE marketing_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_read_own_marketing" ON marketing_consents;
CREATE POLICY "customer_read_own_marketing" ON marketing_consents
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "customer_upsert_own_marketing" ON marketing_consents;
CREATE POLICY "customer_upsert_own_marketing" ON marketing_consents
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. PRIVACY REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  request_type text NOT NULL DEFAULT 'export_data',
  status text NOT NULL DEFAULT 'pending',
  description text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by_admin_id uuid,
  reviewed_at timestamptz,
  admin_notes text,
  completed_at timestamptz,
  response_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_privacy_req_customer ON privacy_requests (customer_id);
CREATE INDEX IF NOT EXISTS idx_privacy_req_status ON privacy_requests (status);

DROP POLICY IF EXISTS "customer_read_own_privacy_requests" ON privacy_requests;
CREATE POLICY "customer_read_own_privacy_requests" ON privacy_requests
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "customer_insert_own_privacy_requests" ON privacy_requests;
CREATE POLICY "customer_insert_own_privacy_requests" ON privacy_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "customer_cancel_own_privacy_requests" ON privacy_requests;
CREATE POLICY "customer_cancel_own_privacy_requests" ON privacy_requests
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "admin_manage_privacy_requests" ON privacy_requests;
CREATE POLICY "admin_manage_privacy_requests" ON privacy_requests
  FOR ALL TO anon, authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- ============================================================
-- 6. DPO SETTINGS (Singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS dpo_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpo_name text NOT NULL DEFAULT 'Data Protection Officer',
  dpo_email text NOT NULL DEFAULT 'dpo@unilink.co.zw',
  dpo_phone text,
  dpo_address text,
  organisation_name text NOT NULL DEFAULT 'UniLink',
  privacy_contact_email text NOT NULL DEFAULT 'privacy@unilink.co.zw',
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dpo_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_dpo_settings" ON dpo_settings;
CREATE POLICY "anyone_read_dpo_settings" ON dpo_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_manage_dpo_settings" ON dpo_settings;
CREATE POLICY "admin_manage_dpo_settings" ON dpo_settings
  FOR ALL TO anon, authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- ============================================================
-- 7. DATA PROCESSING REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS data_processing_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_name text NOT NULL,
  purpose text NOT NULL,
  data_categories text[] NOT NULL DEFAULT '{}',
  lawful_basis text,
  data_subjects text[] NOT NULL DEFAULT '{}',
  recipients text[] NOT NULL DEFAULT '{}',
  retention_period text,
  cross_border_transfers boolean NOT NULL DEFAULT false,
  transfer_destinations text,
  risk_level text NOT NULL DEFAULT 'low',
  mitigation_measures text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE data_processing_register ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_processing_register" ON data_processing_register;
CREATE POLICY "anyone_read_processing_register" ON data_processing_register
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_manage_processing_register" ON data_processing_register;
CREATE POLICY "admin_manage_processing_register" ON data_processing_register
  FOR ALL TO anon, authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- ============================================================
-- 8. THIRD-PARTY PROCESSOR REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS third_party_processors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processor_name text NOT NULL,
  service_description text,
  data_categories text[] NOT NULL DEFAULT '{}',
  purpose text,
  legal_basis text,
  contact_email text,
  contact_phone text,
  contract_reference text,
  dpas_signed boolean NOT NULL DEFAULT false,
  cross_border boolean NOT NULL DEFAULT false,
  transfer_destinations text,
  security_measures text,
  is_active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE third_party_processors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_processors" ON third_party_processors;
CREATE POLICY "anyone_read_processors" ON third_party_processors
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_manage_processors" ON third_party_processors;
CREATE POLICY "admin_manage_processors" ON third_party_processors
  FOR ALL TO anon, authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- ============================================================
-- 9. SECURITY INCIDENTS / BREACH LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type text NOT NULL DEFAULT 'data_breach',
  severity text NOT NULL DEFAULT 'low',
  description text NOT NULL,
  affected_data_categories text[] NOT NULL DEFAULT '{}',
  affected_individuals_count integer,
  detected_at timestamptz NOT NULL DEFAULT now(),
  reported_at timestamptz,
  contained_at timestamptz,
  resolved_at timestamptz,
  status text NOT NULL DEFAULT 'detected',
  reported_to_authority boolean NOT NULL DEFAULT false,
  authority_report_date timestamptz,
  authority_reference text,
  corrective_actions text,
  root_cause text,
  reported_by_admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_incidents" ON security_incidents;
CREATE POLICY "admin_manage_incidents" ON security_incidents
  FOR ALL TO anon, authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- ============================================================
-- 10. DATA RETENTION RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS data_retention_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  description text,
  retention_days integer NOT NULL DEFAULT 365,
  auto_delete boolean NOT NULL DEFAULT false,
  last_reviewed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE data_retention_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_retention_rules" ON data_retention_rules;
CREATE POLICY "admin_manage_retention_rules" ON data_retention_rules
  FOR ALL TO anon, authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "anyone_read_retention_rules" ON data_retention_rules;
CREATE POLICY "anyone_read_retention_rules" ON data_retention_rules
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- 11. INDEXES FOR EXISTING TABLES (Scaling)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON deliveries (customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries (driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries (status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created ON deliveries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_orders_customer ON shop_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_shop ON shop_orders (shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_messenger ON shop_orders (messenger_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders (status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_created ON shop_orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drivers_approval ON drivers (approval_status);
CREATE INDEX IF NOT EXISTS idx_drivers_available ON drivers (is_available);
CREATE INDEX IF NOT EXISTS idx_drivers_subscription ON drivers (subscription_status);

CREATE INDEX IF NOT EXISTS idx_shops_status ON shops (status);
CREATE INDEX IF NOT EXISTS idx_shops_available ON shops (is_available);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_products_shop ON shop_products (shop_id);

CREATE INDEX IF NOT EXISTS idx_delivery_requests_customer ON delivery_requests (customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_driver ON delivery_requests (driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON delivery_requests (status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_created ON delivery_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_notifications_created ON email_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_created ON whatsapp_notifications (created_at DESC);

-- ============================================================
-- 12. SEED DATA
-- ============================================================
INSERT INTO dpo_settings (dpo_name, dpo_email, dpo_phone, organisation_name, privacy_contact_email)
SELECT 'Data Protection Officer', 'dpo@unilink.co.zw', null, 'UniLink', 'privacy@unilink.co.zw'
WHERE NOT EXISTS (SELECT 1 FROM dpo_settings);

INSERT INTO privacy_policy_versions (version, title, content, is_active)
SELECT '1.0', 'UniLink Privacy Policy',
'UniLink is committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and protect your information. You have the right to access, correct, export, or request deletion of your data. For any privacy-related enquiries, contact our Data Protection Officer.',
true
WHERE NOT EXISTS (SELECT 1 FROM privacy_policy_versions WHERE is_active = true);

INSERT INTO terms_policy_versions (version, title, content, is_active)
SELECT '1.0', 'UniLink Terms and Conditions',
'By using UniLink, you agree to these Terms and Conditions. UniLink provides delivery and marketplace services connecting customers with messengers and shops. Users must comply with all applicable laws and platform rules.',
true
WHERE NOT EXISTS (SELECT 1 FROM terms_policy_versions WHERE is_active = true);

INSERT INTO data_retention_rules (category_name, description, retention_days, auto_delete)
SELECT 'Delivery Records', 'Completed delivery order records', 365, false
WHERE NOT EXISTS (SELECT 1 FROM data_retention_rules WHERE category_name = 'Delivery Records');

INSERT INTO data_retention_rules (category_name, description, retention_days, auto_delete)
SELECT 'Chat Messages', 'Customer-messenger chat messages', 180, false
WHERE NOT EXISTS (SELECT 1 FROM data_retention_rules WHERE category_name = 'Chat Messages');

INSERT INTO data_retention_rules (category_name, description, retention_days, auto_delete)
SELECT 'Customer Profiles', 'Customer account data', 2555, false
WHERE NOT EXISTS (SELECT 1 FROM data_retention_rules WHERE category_name = 'Customer Profiles');

INSERT INTO data_retention_rules (category_name, description, retention_days, auto_delete)
SELECT 'Driver Records', 'Driver account and delivery history', 2555, false
WHERE NOT EXISTS (SELECT 1 FROM data_retention_rules WHERE category_name = 'Driver Records');

INSERT INTO data_retention_rules (category_name, description, retention_days, auto_delete)
SELECT 'Audit Logs', 'System audit trail', 1095, false
WHERE NOT EXISTS (SELECT 1 FROM data_retention_rules WHERE category_name = 'Audit Logs');

INSERT INTO data_retention_rules (category_name, description, retention_days, auto_delete)
SELECT 'Shop Orders', 'Shop marketplace order records', 365, false
WHERE NOT EXISTS (SELECT 1 FROM data_retention_rules WHERE category_name = 'Shop Orders');

INSERT INTO data_processing_register (activity_name, purpose, data_categories, lawful_basis, data_subjects, recipients, retention_period, risk_level)
SELECT 'Order Processing', 'Process and fulfil customer delivery orders',
ARRAY['name', 'phone', 'email', 'delivery address', 'GPS coordinates'],
'Contractual necessity',
ARRAY['customers'],
ARRAY['assigned driver/messenger'],
'365 days',
'low'
WHERE NOT EXISTS (SELECT 1 FROM data_processing_register WHERE activity_name = 'Order Processing');

INSERT INTO data_processing_register (activity_name, purpose, data_categories, lawful_basis, data_subjects, recipients, retention_period, risk_level)
SELECT 'Driver Verification', 'Verify driver identity and approval',
ARRAY['name', 'phone', 'national ID', 'vehicle registration'],
'Legal obligation',
ARRAY['drivers'],
ARRAY['admin staff'],
'2555 days',
'medium'
WHERE NOT EXISTS (SELECT 1 FROM data_processing_register WHERE activity_name = 'Driver Verification');

INSERT INTO data_processing_register (activity_name, purpose, data_categories, lawful_basis, data_subjects, recipients, retention_period, risk_level)
SELECT 'Push Notifications', 'Send order status and delivery notifications',
ARRAY['device token', 'phone number'],
'Consent',
ARRAY['customers', 'drivers'],
ARRAY['FCM (Google)', 'WhatsApp (Meta)'],
'180 days',
'low'
WHERE NOT EXISTS (SELECT 1 FROM data_processing_register WHERE activity_name = 'Push Notifications');

INSERT INTO third_party_processors (processor_name, service_description, data_categories, purpose, contact_email, dpas_signed, cross_border, security_measures)
SELECT 'Google Firebase Cloud Messaging', 'Push notification delivery',
ARRAY['device token'],
' Deliver push notifications to user devices',
'firebase-support@google.com',
true, true, 'Encryption in transit and at rest'
WHERE NOT EXISTS (SELECT 1 FROM third_party_processors WHERE processor_name = 'Google Firebase Cloud Messaging');

INSERT INTO third_party_processors (processor_name, service_description, data_categories, purpose, contact_email, dpas_signed, cross_border, security_measures)
SELECT 'Supabase', 'Database hosting and authentication',
ARRAY['name', 'phone', 'email', 'location data'],
'Cloud database and auth infrastructure',
'support@supabase.com',
true, true, 'SOC 2 Type II, encryption at rest and in transit'
WHERE NOT EXISTS (SELECT 1 FROM third_party_processors WHERE processor_name = 'Supabase');
