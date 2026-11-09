# UniLink: Google Play preparation

This release path packages the existing UniLink website using an Android Trusted Web Activity (TWA). Customers keep using the hosted application, including future web updates.

**Status: preparation only. This is not a signed, tested, approved Play release.** The owner has now registered an organisation Play Console account; verification status is not yet known. The existing website verification identifies the Android application as `com.unilinkbase.twa`; preserve this package identity. The owner confirmed that there has never been a Play upload, so a new upload key can be created locally for this first release; the actual Play app-signing certificate must then be linked to the website. The different package in `app.json` belongs to the separate Expo-native build route.

## Publisher account — registered, verification to confirm

1. The owner reports registering an organisation account. Open <https://play.google.com/console> with that same Google account and check the home-page setup and verification tasks.
2. Choose the account type that matches the actual publisher. UniLink identifies Future Pulse Investments as its operator in its privacy policy; an organization account requires the corresponding organization verification (generally including a D-U-N-S number). Do not register an organization as a personal developer merely to skip verification.
3. Complete the requested organisation/identity/contact verification in Play Console and resolve any registration-payment task it still shows. Do not share passwords, identity documents, service-account keys, or signing passwords in chat or commit them to Git.
4. Create the UniLink application. Check that `com.unilinkbase.twa` is the intended permanent package before its first upload.

Official registration and account requirements: <https://support.google.com/googleplay/android-developer/answer/6112435> and <https://support.google.com/googleplay/android-developer/answer/13628312>.

## Android identity and release bundle

- Canonical launch origin: `https://www.unilinkbase.com` (the apex redirects to www).
- Android application ID already advertised by the website: `com.unilinkbase.twa`.
- Verification file: `public/.well-known/assetlinks.json`. It already contains two certificate fingerprints. Their provenance has not been confirmed. Neither proves that we possess a matching signing key.
- New phone applications must target Android 16 / API 36 or later as of 9 November 2026. New releases need an Android App Bundle (`.aab`) signed with the upload key, plus Play App Signing.
- When Play App Signing is configured, obtain its **app-signing certificate SHA-256**, not just the upload certificate. Add the matching fingerprint to the website verification file on the exact launch origin. Preserve existing legitimate fingerprints. Check any other origin the application needs to treat as trusted separately.
- For this confirmed first upload, use `android-twa/scripts/create-upload-key.sh` locally to create the upload key outside the repository. The helper never replaces an existing key. Keep signing keys, passwords, and service-account JSON outside the repository and backed up securely. An unsigned bundle or a debug APK is not a Play upload artifact.
- Follow the Android wrapper's README for the concrete build configuration and remaining prerequisites.

Sources: <https://support.google.com/googleplay/android-developer/answer/11926878?hl=en>, <https://developer.android.com/guide/app-bundle>, <https://developer.chrome.com/docs/android/trusted-web-activity/quick-start>.

## Findings to resolve before submission

The following were observed in the code or live website; they are not declarations that the current app meets Play policy.

- [ ] **Public routes:** direct navigation to `/customer/login`, `/customer/register`, `/support`, and `/policies?type=privacy` currently returns HTTP 404 on the live website. A SPA rewrite is proposed in this branch; deploy it and verify normal deep links as well as `.well-known/assetlinks.json`, scripts, icons and missing files before release.
- [ ] **Public account deletion:** provide a public URL for requesting deletion of the UniLink account **and associated data**, and a discoverable in-app option for every account role. `app/customer/privacy-centre.tsx` currently records a pending data-deletion request; this does not establish that account/data deletion is fulfilled. Confirm the operational process and retention exceptions before publishing claims about it.
- [ ] **Password security:** `app/customer/login.tsx` reads customer records and compares `btoa(password)` in browser code. Base64 is reversible encoding, not secure password hashing. Replace this with server-enforced authentication and review exposure of existing customer credentials before a store release. The existing privacy text claiming one-way password protection must match the implementation.
- [ ] **PWA assets:** `/icon-192.png` and `/icon-512.png` currently contain 640×640 PNGs. Export correctly sized icons and verify maskable safe areas. The store also needs its own exact 512×512 icon.
- [ ] **Offline launch:** the service worker precaches icons and the manifest, but has no explicit offline fallback document. Verify cold/offline startup and uncached route failures on Android; never imply orders or chat were sent while offline.
- [ ] **Device flow:** test TWA domain verification, shopper registration/login, location permission denied/granted, order placement, tracking/chat, merchant login, messenger login/acceptance, camera/file upload, payments, notifications and back navigation on real Android hardware. A desktop PWA test is not a substitute.
- [ ] **Payments review:** grocery purchases and delivery are physical goods/services and do not use Google Play Billing. Separately assess any messenger/merchant access fees if they purchase digital functionality.

The password finding is intentionally documented rather than silently migrated during packaging. Fixing authentication needs its own reviewed database/client change and regression tests.

## Play Console listing draft

See `listing.md`. This is a draft based on the website and code, not a promise of coverage, dispatch speed, or approval. Confirm support contact, supported delivery zones, and publisher identity before submission.

Required artwork: a 512×512 PNG app icon, a 1024×500 feature graphic, and at least two genuine app screenshots. The previously created promotional flyer is not a substitute for store screenshots. Never include customer or messenger personal data in screenshots.

Sources: <https://support.google.com/googleplay/android-developer/answer/9859152>, <https://support.google.com/googleplay/android-developer/answer/9866151>.

## App content and reviewer access

- Complete Data Safety from actual data flows and SDK behavior: contact/account details, precise location, order/payment references, chat, images/ID documents, and device/push data need review. A web wrapper does not mean "no data collected."
- Provide an unauthenticated public privacy-policy URL, the external account-deletion URL, content rating, target audience, ads declaration, and app-access instructions.
- Supply working, reusable review accounts for restricted shopper, messenger, and shop features. Reviewers must be able to access the app independently of their location. Explain how location matching and any time-limited messenger keys work in the review environment. Keep credentials in Play Console's App access section, not this document.
- Do not request background location simply to obtain a foreground delivery location.

Sources: <https://support.google.com/googleplay/android-developer/answer/10144311?hl=en>, <https://support.google.com/googleplay/android-developer/answer/13327111?hl=en>, <https://support.google.com/googleplay/android-developer/answer/10787469?hl=en>, <https://support.google.com/googleplay/android-developer/answer/15748846?hl=en>.

## Test, then submit

Start with internal testing after the signed AAB is available. For a new personal developer account, Google requires at least **12 testers continuously opted in for 14 days** in closed testing, followed by an application for production access. This requirement depends on the account type/date; verify the exact tasks shown in the new account.

Production publication is a later, explicit release step after the owner has reviewed the listing, declarations, signing/domain verification and test results. Google makes the final approval decision.

Source: <https://support.google.com/googleplay/android-developer/answer/14151465?hl=en>.

## Recheck the hosted PWA

Run `node scripts/check-play-web.mjs` using Node 22 or later. If the machine uses an HTTPS proxy, use a Node version with environment-proxy support and run `NODE_USE_ENV_PROXY=1 node scripts/check-play-web.mjs`; preserve the configured CA trust. The command is read-only and exits nonzero for observed web prerequisites that fail. It does not sign an app, upload to Play, validate policy wording or substitute for Android testing.

For the newly registered organisation account, follow [`console-handoff.md`](console-handoff.md). It covers checking verification status, the first-upload signing path and internal testing before any production submission.
