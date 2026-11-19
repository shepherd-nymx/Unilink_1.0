# UniLink Android release

## Build configuration

The first Android release uses Expo SDK 54 / React Native 0.81.5 with Android target/compile SDK 36. The permanent application ID is `com.unilink.grocerydelivery`. It is linked to Expo project `@mufaro20/unilink`, ID `5c78443f-f061-4fb7-bf49-253663999949`.

`eas.json` has an APK preview profile and an Android App Bundle production profile. Production increments `android.versionCode` in `app.json`; commit that change after each release. `expo.version`, the package version and the Play release name start at 1.0.1. Do not change the package ID or replace an existing signing key after the first Play upload.

Build from a clean install with `npm ci`, then:

```sh
npm run typecheck
node scripts/test-native-release.cjs
npx expo-doctor
npx expo export --platform android --output-dir work/android-export
eas build --platform android --profile preview
eas build --platform android --profile production
```

The `work/`, generated `android/` and `ios/`, environment files, signing material and compiled artifacts must stay outside Git. EAS builds generate native projects from the Expo config. Keep the first upload key backed up in Expo's credentials manager and use Google Play App Signing.

## Service setup

1. Expo must have Developer or higher access to `mufaro20`. A Viewer-scoped device login can read project details but cannot configure environment variables or start builds.
2. Configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for both the production and preview EAS environments. These are public client values. Never add a Supabase service-role key or other server credentials to an `EXPO_PUBLIC_` variable.
3. Add `unilink:///customer/identity-callback` and `unilink:///driver/identity-callback` to Supabase Auth's redirect URL allowlist. Android uses PKCE and the system browser; the existing web callback URLs remain configured.
4. Android remote push needs Firebase Android configuration for this exact package (`google-services.json`, configured as `android.googleServicesFile`) and an FCM V1 service-account credential in EAS. Neither configuration was present when release preparation began. In-app features must work when push permission is declined or push is unconfigured; remote delivery notifications must be tested before they are promised to users. Keep service-account JSON private.

## Privacy and deletion

Public web routes are `/privacy-policy` and `/delete-account`. The privacy route displays the existing active published policy from `terms_and_conditions`; it does not invent a new policy. All three role portals link to privacy and account deletion. The deletion route composes a request email for the user to send to UniLink support without signing in. Support must verify ownership, fulfill requests, and explain any legally retained records in accordance with the actual policy.

## Production issues to resolve

The existing customer password login uses reversible base64 encoding in `app/customer/login.tsx`, and legacy portal authorization depends on client-managed account IDs. Encrypted local storage added for Android does not correct backend authorization. Before a public release, replace legacy authentication with server-verified identities, restrict database access to the authenticated account and role, review exposed security-definer RPCs, and reconcile the published policy's password/security statements with the actual implementation. Do not attest that passwords are securely hashed or that account access is isolated without verifying those fixes. Internal testing must use test accounts and non-sensitive data.

Google/email redirects, real-device login/logout and restoration, checkout/fees, shop product uploads, messenger location/map behavior, chat, deletion access and notifications still require device acceptance checks. JavaScript bundling and automated tests do not establish device acceptance or Google approval.

## Data Safety review worksheet

These are code-informed review items, not a completed declaration. The operator must check actual production data flows and provider terms before submitting Google's form.

| Data in UniLink | Typical purpose / recipient to verify |
| --- | --- |
| Names, username, email, phone, account identifiers | Accounts, authentication, support; Supabase and identity providers |
| Delivery addresses, shop coordinates, requested precise location | Shop discovery, delivery and pickup; relevant shops/messengers and map providers |
| Profile, product, request and messenger-verification photos/documents | Profiles, commerce, verification; storage and authorized reviewers |
| Orders, items, delivery requests, purchases, ratings, payment references | Order fulfillment, disputes, records; relevant shops/messengers and payment providers |
| In-app messages and support/deletion requests | Customer communication and support; message participants and service providers |
| Device/push identifiers and notification data | Operational notifications; Expo/Firebase/push providers |
| Assistant chat text where enabled | Shopping assistance; configured AI provider |
| Business activity and notification emails | Operations; UniLink and relevant shop/messenger recipients |

Distinguish data collection from Google's sharing definitions and service-provider exceptions. Check what is optional, deletion availability, retention, encryption in transit, and every enabled SDK. Do not select “no data collected.” No advertising SDK was identified in this preparation; confirm the production build and business behavior before answering the ads declaration. Target audience, content rating, financial features, permissions and app access forms also require truthful owner answers.

## First Play upload

The first upload must be made manually in Play Console before automated Android submissions are possible. Create/select UniLink, open Testing → Internal testing → Create new release, enable Play App Signing and upload the completed `.aab`. Use the listing draft in `store/google-play/listing.md`, add genuine Android screenshots and the feature graphic, complete App content and supply a dedicated working review account if any features require login. Do not put review passwords in Git.

Test using the internal-test opt-in link. Review Play's pre-launch report, crashes, Android 16 behavior and 16 KB page-size compatibility on the actual bundle. Newly created personal developer accounts may require 12 testers continuously opted in for 14 days in a closed test before applying for production access; Play Console determines the applicable requirement.

## Preparation checks on 19 November 2026

TypeScript, the native storage/session/OAuth regression tests, shop-map regressions, the Android Hermes export and the production web export passed. Expo Doctor passed 18/18 checks after enabling the environment's configured HTTPS proxy. Android prebuild verified the notification icon resource and removal directives for the blocked permissions. Browser checks loaded the real published privacy policy and verified deletion-page validation/email composition both with and without a saved account session; no email was sent. These checks do not include a signed cloud build, real Android device acceptance or Play review.

Official references:
- https://docs.expo.dev/build/setup/
- https://docs.expo.dev/submit/android/
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/14151465
