# UniLink Android PWA wrapper

This is a Trusted Web Activity (TWA): an Android launcher for the existing website, rendered by a supporting browser. It does not fork the Expo app or embed a WebView. Website updates continue to ship through the website.

- Website and launch origin: **https://www.unilinkbase.com/** (the apex domain redirects here).
- Existing Android identity: **com.unilinkbase.twa**, preserved from the website's existing Digital Asset Links file.
- Version seed: **1.0.1 / versionCode 1**. Check for any previous uploaded build before using this number; every subsequent Play upload needs a greater versionCode.
- Generated with **GoogleChromeLabs Bubblewrap core 1.27.0**; Android Browser Helper **2.7.4**.
- Android **compile SDK / target SDK 36**, minimum SDK 23; Gradle 8.11.1 and Android Gradle Plugin 8.9.1.

## What is ready

The checked-in Android project includes Gradle wrapper, Java launcher/delegation classes, Android manifest, launcher/splash/notification resources, a pinned generator and lockfile, and `twa-manifest.json`. It reuses UniLink's existing artwork. `npm run verify` checks the package, canonical launch origin, existing certificate fingerprints and API36 configuration against the repository's website config.

No signing key was created, no existing certificate was replaced, and no app was submitted to Google Play. The placeholder `signingKey` fields in `twa-manifest.json` deliberately contain no credential or invented identity. The release signing script reads the real keystore and alias from environment variables instead.

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

## Sign the release

Recover the **existing upload keystore and actual alias** from the person/machine that prepared UniLink's prior Android packaging. Do not guess which of the two current website fingerprints represents an upload certificate versus a Play signing certificate. Never commit a keystore, password, service-account file, or signed release artifact.

Load `UNILINK_KEYSTORE_PATH` (absolute path), `UNILINK_KEY_ALIAS`, `UNILINK_KEYSTORE_PASSWORD` and optionally `UNILINK_KEY_PASSWORD` into your local environment through a secure password prompt or secret manager, then run:

```sh
./scripts/sign-release.sh
```

The script signs with that existing key, verifies the JAR signature and writes `app/build/outputs/bundle/release/unilink-release-signed.aab`. It neither creates a new key nor uploads anything. Keep an encrypted backup of the existing upload keystore outside the repository.

After enrolling in Play App Signing, use the **app signing certificate's SHA-256** shown in Play Console's App integrity page for website verification. Play signs delivered apps with that certificate; the upload certificate alone is not enough. Compare it with `../public/.well-known/assetlinks.json` and only add a confirmed missing fingerprint with the owner's approval. The file must be served directly over HTTPS from the canonical host. Use a Play test-track installation to verify full-screen launch, web login, location, camera, notifications and order flows on a real Android device.

If the existing signing key cannot be recovered, determine whether this package has ever been registered/published before choosing a replacement key or package. Do not blindly change `com.unilinkbase.twa` or existing fingerprints.

## Regenerate source

```sh
npm ci
npm run generate
npm run verify
```

Generation uses the checked-in `twa-manifest.json` for Android settings and the exact pinned Bubblewrap core version; it downloads the configured icon artwork from the website. It does not automatically adopt new web-manifest settings into the Android config. It respects the standard HTTPS proxy/CA environment. Generated Gradle, Java and resource files are overwritten, so keep app-specific settings in `twa-manifest.json`, review the diff, and re-run the checks. Do not add general unverified external origins to the trust list: an external identity provider should open through the browser's normal handling.

The root Expo identity (`com.unilink.grocerydelivery`) describes a different native packaging route. Do not replace this TWA package with it or combine the two release paths accidentally.

## Release blockers and verification in this workspace

Source generation and the config verification passed. A signed AAB has **not** been produced: this workspace has only a JRE (no Java compiler), no configured Android SDK and no existing upload keystore. A bounded `./gradlew --no-daemon bundleRelease` attempt stopped while fetching Gradle 8.11.1 with `java.net.ConnectException: Connection refused`; it did not reach compilation. The inherited Node/curl proxy setup used during generation is not automatically used by the Java Gradle wrapper. Configure the build machine’s approved Java/Gradle proxy and CA trust as needed, without disabling TLS. Install the full JDK and Android SDK locally or in a suitable build environment before expecting an APK/AAB.

The developer account, Play App Signing setup, store listing, reviewer access, privacy/account-deletion URLs and any required closed test still need completion. See `../docs/google-play/README.md` for the repository's release checklist and known website blockers. This source project does not by itself establish Play policy compliance or app approval.

References: [Google's TWA guide](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start), [Bubblewrap source](https://github.com/GoogleChromeLabs/bubblewrap), [current Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878).
