# Verified driver registration

Driver registration now begins with Continue with Google or an emailed sign-in link. These reuse the existing Google provider and email authentication settings, and the existing shared 14px Google button. After verification, the form prefills the Google name when available and locks the verified email. Email-only applicants enter their name. Existing phone, address, national ID/photo, service location, delivery type, vehicle fields and terms review remain required as before.

The driver callback is https://unilinkbase.com/driver/identity-callback. Read-only OAuth cancellation tests confirmed Supabase accepts this apex-domain callback; the www equivalent is not currently allowed. Apex redirects to www, preserving the callback path and fragment. This avoids requiring a new Google OAuth client or editing provider credentials. Existing customer callback behavior remains unchanged. Scoped Vercel rewrites support the new driver callback, registration, status and login URLs on direct navigation.

## Application and approval

Verified identity alone grants no driver portal session. Registration calls complete_driver_identity_profile, then shows Application Submitted. The server derives email from auth.users, creates approval_status=pending, is_available=false and no monthly key/expiry. It records current terms acceptance. Existing admin approval/rejection and monthly-key issuance remain in place. Returning verified applicants see their own application status. Approved applicants still use the admin-issued monthly key; rejected applicants are directed to support. The new identity-linked login guard checks approval and active/suspended status, while legacy monthly-key behavior is preserved.

Privileged implementations live in the non-exposed identity_private schema. Public RPCs are SECURITY INVOKER wrappers; only authenticated callers have execute access. Implementations verify auth.uid(), confirmed email and a server-signed oauth/otp/magiclink authentication method. A password-autoconfirm timestamp alone is insufficient. Names/provider metadata never authorize access. auth_id is unique per driver, and email/phone collisions with existing applications fail without claiming or overwriting the existing record. Identity/advisory locks and uniqueness prevent repeated submissions creating duplicates.

The server validates required fields, active service location, current terms, delivery/vehicle data, and a caller-owned storage object in the existing driver-id-cards bucket under auth.uid()/filename. Uploads are validated client-side and size/type/ownership metadata is checked server-side. Upload cleanup is attempted on submission failure. Welcome and admin-alert requests retain the existing email service after a successful application; tests never sent real emails.

## Existing security boundaries

This is an additive onboarding change, not a replacement of the app's legacy custom-session/admin authorization architecture. Existing permissive driver table policies and the existing public driver-id-cards bucket are unchanged. Those broad policies are pre-existing limitations; RPC checks do not harden all direct Data API access. National-ID-photo confidentiality requires a separate coordinated storage/admin-review change. New application RPCs do not return ID details, keys or another applicant's profile.

## Verification

- scripts/test-driver-identity.sql runs in one rolled-back transaction: Google/OTP proof, password-autoconfirm rejection, own-photo validation, explicit/current terms, pending/no-key defaults, idempotent application, profile isolation, consent record and approval refresh. No real driver or auth-user fixtures are retained, and no external email trigger is present.
- Browser tests with mocked Supabase/Auth/Storage/email cover both provider requests and callback URL, identity prefill, read-only email, full ID upload + form submission, declined terms, consent, RPC-only writes, welcome/admin email requests, pending/approved/rejected status and no automatic portal entry. Identity-linked pending key login is rejected; legacy key login and customer email callback remain unchanged. Email-only identities without a Google name can enter it manually.
- TypeScript, Expo web export and security advisors reviewed. No new exposed SECURITY DEFINER driver RPC finding remains.
- Real Google account selection and real email inbox delivery require an account-owner test; automated tests do not sign into someone else's Google account.
