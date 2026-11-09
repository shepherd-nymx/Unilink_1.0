# UniLink Android PWA wrapper

This is a Trusted Web Activity (TWA): an Android launcher for the existing website, rendered by a supporting browser. It does not fork the Expo app or embed a WebView. Website updates continue to ship through the website.

- Website and launch origin: **https://www.unilinkbase.com/** (the apex domain redirects here).
- Existing Android identity: **com.unilinkbase.twa**, preserved from the website's existing Digital Asset Links file.
- Version seed: **1.0.1 / versionCode 1**. Check for any previous uploaded build before using this number; every subsequent Play upload needs a greater versionCode.
- Generated with **GoogleChromeLabs Bubblewrap core 1.27.0**; Android Browser Helper **2.7.4**.
- Android **compile SDK / target SDK 36**, minimum SDK 24; Gradle 8.11.1 and Android Gradle Plugin 8.9.1.

## What is ready

The checked-in Android project includes Gradle wrapper, Java launcher/delegation classes, Android manifest, launcher/splash/notification resources, a pinned generator and lockfile, and `twa-manifest.json`. It reuses UniLink's existing artwork. `npm run verify` checks the package, canonical launch origin, existing certificate fingerprints and API36 configuration against the repository's website config.

No production/upload signing key was created, no website certificate was replaced, and no app was submitted to Google Play. A disposable debug key was generated only for local test artifacts, outside Git. The placeholder `signingKey` fields in `twa-manifest.json` deliberately contain no credentials. The release signing script reads the real upload keystore and alias from environment variables instead. See the first-upload instructions below.

## Install and check

Requires Node.js 20+ for generation/verification:

```sh
cd android-twa
npm ci
npm run verify
```

A complete Android build also requires a **full JDK** (17 or 21, including `javac`), Android SDK Platform 36 and Android SDK Build Tools, and an Android SDK location via `ANDROID_HOME` or ignored `local.properties`. Android Studio can install these tools. Accept the SDK licenses on your build machine.

```sh
# Unsigned bundle: app/build/outputs/bundle/release/app-release.aab
./gradlew --no-daemon bundleRelease

# Local test APK (debug certificate; not a Play upload or proof of TWA verification)
./gradlew --no-daemon assembleDebug
```

An unsigned bundle cannot be uploaded to Google Play. A debug APK will normally show the browser toolbar because its debug certificate is not among the production website fingerprints; do not add arbitrary debug certificates to the production site to hide this.

## Sign the first Play release

The owner confirmed on 9 November 2026 that this is UniLink's **first Play Console upload**, that the developer account is an **organisation account**, and that earlier packaging key files are unavailable. Organisation verification completion is still unknown.

A new upload key may therefore be created for this first upload. Use **Google Play App Signing** for the app-signing key delivered to users. Create the separate upload key on the owner's private machine and keep an encrypted backup:

```sh
# Replace this with a private directory outside the repository that already exists.
./scripts/create-upload-key.sh /absolute/private/path/unilink-upload.jks
```

The helper prompts locally for the password and certificate details. It refuses existing files and repository paths; its alias is `unilink-upload`. Its path/refusal checks were tested; no real release key has been created in this workspace. Never paste passwords in chat or commit a keystore, password, service-account file, or signed release artifact.

Do not guess what the two existing website certificate fingerprints represent. After Play App Signing is configured, compare the actual Play app-signing certificate and add it to the website only after review. If a prior upload is discovered despite the owner's current confirmation, stop the new-key path and follow that existing application's signing/recovery procedure.

For a **downloaded prebuilt unsigned AAB**, only a full JDK with `jarsigner` is needed to sign it locally; the Android SDK is not needed for this step. Set the key path/alias (neither is the password) and pass the absolute bundle path:

```sh
UNILINK_KEYSTORE_PATH=/absolute/private/path/unilink-upload.jks \
UNILINK_KEY_ALIAS=unilink-upload \
./scripts/sign-release.sh /absolute/path/to/unilink-1.0.1-unsigned.aab
```

The password is prompted locally by `jarsigner`. The script signs the file, verifies its JAR signature and writes `app/build/outputs/bundle/release/unilink-release-signed.aab`. It does not upload anything. For controlled automation, optional `UNILINK_KEYSTORE_PASSWORD` and `UNILINK_KEY_PASSWORD` environment variables are supported; no password is placed in command arguments. Do not run this on an untrusted bundle: verify its SHA-256 against the handoff first.

Omit the bundle argument to rebuild from source first, which requires the full Android SDK as well as the JDK. Keep an encrypted backup of the upload keystore outside the repository.

After enrolling in Play App Signing, use the **app signing certificate's SHA-256** shown in Play Console's App integrity page for website verification. Play signs delivered apps with that certificate; the upload certificate alone is not enough. Compare it with `../public/.well-known/assetlinks.json` and only add a confirmed missing fingerprint with the owner's approval. The file must be served directly over HTTPS from the canonical host. Use a Play test-track installation to verify full-screen launch, web login, location, camera, notifications and order flows on a real Android device.

If the existing signing key cannot be recovered, determine whether this package has ever been registered/published before choosing a replacement key or package. Do not blindly change `com.unilinkbase.twa` or existing fingerprints.

## Regenerate source

```sh
npm ci
npm run generate
npm run verify
```

Generation uses the checked-in `twa-manifest.json` for Android settings and the exact pinned Bubblewrap core version; it downloads the configured icon artwork and embeds a web-manifest snapshot from the website. It does not automatically adopt new web-manifest settings into the Android config. It respects the standard HTTPS proxy/CA environment. Generated Gradle, Java and resource files are overwritten, so keep app-specific settings in `twa-manifest.json`, review the diff, and re-run the checks. Do not add general unverified external origins to the trust list: an external identity provider should open through the browser's normal handling.

The root Expo identity (`com.unilink.grocerydelivery`) describes a different native packaging route. Do not replace this TWA package with it or combine the two release paths accidentally.

## Build and validation in this workspace

The toolchain blocker is resolved. A full JDK21, Android SDK Platform36/Build Tools36 and Gradle8.11.1 were installed in a workspace-only tools directory. Java used the inherited proxy with a task-local trusted CA store; TLS verification stayed enabled.

`bundleRelease` and `assembleDebug` both succeeded. The Android Browser Helper dependency requires minimum SDK24; the generated config was corrected accordingly, and obsolete manifest package metadata was removed in favor of Gradle's namespace.

- The release **unsigned AAB** passed official bundletool validation. Its actual manifest reports `com.unilinkbase.twa`, version1.0.1/code1, minimum SDK24 and target/compile SDK36. It is intentionally unsigned and cannot be uploaded until the owner signs it.
- The **debug APK** passed Android package metadata and APK signature checks. It uses a disposable Android Debug certificate, not the website's release certificates or an upload key.
- The local prebuilt-bundle signing helper was exercised with that disposable debug key, and JAR signing/verification passed. That test output is not a release upload artifact and is not included in the release downloads.
- No real-device/end-to-end Android test has been completed here. Generated wrapper checks do not establish that ordering, identity checks, payments, notifications or every web feature works on Android.

See `../docs/google-play/build-artifacts.md` for artifact names, checksums and status. The organisation account's verification, the real upload key and Play App Signing setup, store/reviewer content, privacy/account deletion and the documented web/authentication blockers remain outstanding. This build does not establish Google Play approval.

References: [Google's TWA guide](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start), [Bubblewrap source](https://github.com/GoogleChromeLabs/bubblewrap), [current Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878).
