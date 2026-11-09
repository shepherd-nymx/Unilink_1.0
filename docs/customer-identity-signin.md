# Customer Google and email sign-in

Adds Google OAuth and email sign-in links alongside the existing customer username/password login. Messenger, shop, admin, ordering, pricing and delivery screens are unchanged.

Verified customers are resolved by auth_id, or linked to one unclaimed existing profile with exactly the same verified email. Existing profile IDs are preserved. Ambiguous emails or profiles bound to another account fail closed. Only verified identities can call the additive registration RPC; new phone/location/current-terms details, default address and consent log are saved atomically. New identity-only customers cannot use the legacy first-password setup fallback. No provider's display-name metadata is used for authorization.

Google provides the display name/email for prefill. Email links verify mailbox ownership but do not provide a real name; the form requests it when unavailable. Remaining phone/location/GPS/terms requirements stay in place.

The customer portal currently uses its existing custom/anon data-session model. After verified identity linking/onboarding, the temporary Supabase session is signed out locally and the existing portal session/route is used. This preserves the existing data workflows; this change is not a migration of the application's broader authorization design. Other portals are untouched.

## Provider configuration

Google and email are already enabled on the connected production Supabase project. Ensure Supabase Authentication URL Configuration permits:

- https://www.unilinkbase.com/customer/identity-callback
- https://unilinkbase.com/customer/identity-callback (only if that origin is intentionally supported)

The Google Cloud OAuth client must permit Supabase's provider callback `https://yysnoiamfoveltvyjzgx.supabase.co/auth/v1/callback`. Keep the client secret only in Supabase's provider configuration. Supabase handles sending email sign-in links using its configured auth email service; this does not reconfigure the separate transactional welcome-email sender.

The one-route Vercel rewrite allows the callback URL to load directly. Real inbox delivery, Google consent/redirects and Android TWA behavior still require an account-owner test; the API reporting an enabled provider does not prove every external setting is correct.

## Verified

- TypeScript checks and production Expo web export passed.
- Transactional DB tests (rolled back) cover verified registration, repeated calls returning the same profile, default address/current terms, and unverified identity rejection.
- Mobile-browser mocked-provider tests cover preserved legacy username/password fields, successful email-link requests without premature login, verified Google name/email prefill and readonly email, no extra username/password requirements, and a returning identity reusing the existing profile ID/dashboard route.
- Google authorize endpoint returned a redirect to accounts.google.com; no Google credentials or real email messages were used in automated tests.

No existing user credentials or portal policies were changed. Security-definer RPCs use a fixed empty search_path, require auth.uid() plus a confirmed email from auth.users, and revoke anon/PUBLIC execution.
