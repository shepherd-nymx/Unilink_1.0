# Weekly shopping reminders

UniLink's `weekly-marketing` Supabase Edge Function uses the existing Resend credentials and verified sender. Customer email addresses come from saved customer records joined to `marketing_consents.opted_in = true`. No preference means no marketing. Suppressed, bounced and complained addresses are excluded. One delivery slot per normalized email and campaign week prevents duplicates, including overlapping scheduled invocations. A failed/uncertain provider result stays reserved for manual review rather than risking repeat emails.

## Schedule and capacity

Monday at 09:00 Africa/Harare (07:00 UTC). Supabase Cron polls every 10 minutes until 09:50 to drain batches of 20; each customer can receive at most one email that week. Current capacity is 120 recipients per week. Monitor eligible counts and expand the window or add a queue before exceeding that capacity. Customers opting in after Monday's window join the following week.

The cron token is generated inside Postgres and stored in Vault. Only its SHA-256 hash is in the service-only campaign configuration table. The function validates this token itself; ordinary users and publishable API keys cannot start campaigns. No server secret is committed or exposed in the frontend.

## Email

Subject: Need something in town? Let UniLink help this week

The message encourages browsing available shops or requesting errands for groceries, food, household essentials and other items. It links to https://unilinkbase.com and asks customers to check coverage, availability and fees. It does not promise that every item or town is supported.

A per-delivery unsubscribe token supports email clients' one-click POST. The ordinary footer opens `/unsubscribe.html`, which requires an explicit click before posting; link previews do not unsubscribe. No login is required. Unsubscribe disables the customer's marketing preference and suppresses the email address. Transactional messages are unchanged. Suppression takes priority over the existing preference toggle; contact support to remove a suppression after a fresh explicit opt-in.

## Operations

Tables: `weekly_marketing_config`, `weekly_marketing_deliveries`, `marketing_email_suppressions`. They use RLS and grant access only to `service_role`.

Pause: `update public.weekly_marketing_config set enabled=false where id=1;`
Resume: set `enabled=true` only after confirming the public unsubscribe page is deployed.

Inspect cron runs in Supabase Cron and delivery counts/statuses in `weekly_marketing_deliveries`. Investigate failures using the provider before manually retrying; never delete a delivery slot blindly. The sender uses `RESEND_API_KEY` and optional `RESEND_FROM_EMAIL` already used for registration emails. A private-token request with `?dry_run=true` reports configuration and first-batch eligibility without sending.

Tests: `node scripts/test-weekly-marketing.cjs` exercises the real handler with mocked database/provider calls. No real customers are emailed by tests. Run the public unsubscribe page in a browser with a synthetic token and mock the endpoint to check success/error states.
