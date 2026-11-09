# Registration emails

New customer welcome emails, messenger welcome emails, and the existing shop registration confirmation use Resend. Other transactional messages keep their existing Gmail transport. Existing accounts are not emailed in bulk.

## Server configuration

Supabase Edge Function secrets:

- `RESEND_API_KEY`: Resend sending key permitted for the verified `unilinkbase.com` domain.
- `RESEND_FROM_EMAIL`: optional sender override; default `no-reply@unilinkbase.com`.
- Keep `GMAIL_USER` and `GMAIL_APP_PASSWORD` for other notification types.

Registration emails reply to `unilinkbase@gmail.com`. No secret belongs in an `EXPO_PUBLIC_*` variable. Supabase Auth's Google/email-link provider settings are separate and unchanged.

The `resend-email` function resolves registration recipient/name from the saved customer, driver or shop record and rejects a different recipient. It preserves the existing database deduplication (one no-order email per recipient/type) and uses the email log ID as the Resend idempotency key for retries. A failed registration log is reclaimed atomically with the current saved account details; a successfully sent or in-flight message is not sent again. Email errors do not fail successful registrations. Shop and messenger messages accurately describe pending approval.

## Verification

Run `node scripts/test-registration-email.cjs` after installing the repository dependencies. It exercises the real handler with mocked database/provider calls: each portal, recipient matching, escaped display names, duplicate prevention, provider failure/retry, and unchanged Gmail delivery for other types.

TypeScript checking and Expo web export passed. The deployed function sent a test to Resend's documented simulated `delivered+...@resend.dev` recipient successfully, rejected a mismatched recipient, and returned duplicate for a repeated request. No real inbox was emailed during this check. The temporary customer record was removed; its email log remains marked `simulated_delivery_check`.

Existing delivery-event webhook configuration is not changed by this work. A `sent` log means provider acceptance; real inbox placement still depends on the receiving mail service.
