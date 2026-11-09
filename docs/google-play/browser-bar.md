# Android browser bar: observed cause and owner-local signing handoff

The owner installed the debug APK from the preparation download. Its certificate is intentionally not trusted by the production website, so the TWA opens using Chrome's browser UI with the domain displayed.

Observed on 9 November 2026:

- TWA launch origin: `https://www.unilinkbase.com/` (correct).
- Canonical Digital Asset Links: HTTP200 JSON served directly at `https://www.unilinkbase.com/.well-known/assetlinks.json`.
- The installed test APK uses a disposable Android Debug certificate with SHA-256 `15:3A:39:6B:D2:B6:82:09:19:58:87:87:5B:A1:94:15:B4:9B:55:20:02:EC:0B:0A:69:F2:78:A2:1F:9B:48:17`.
- Google's Digital Asset Links API confirms the existing site's certificate is linked; the disposable debug certificate is not linked.

Do not publish the disposable debug certificate as a production trust identity or replace the TWA with a WebView solely to hide the browser's security UI.

## Windows owner action

The owner confirmed Windows, no previous Play upload and no old key. The Windows signing kit in `../../android-twa/windows-signing/` creates/reuses a private upload key on the owner's machine, signs the already-built release APK and AAB, and exports the **public certificate fingerprint**. No private key or password should be sent back.

Send the kit's public certificate SHA-256 output after successful signing. The website's owner can then add that exact signer fingerprint to the existing `com.unilinkbase.twa` Digital Asset Links entry, preserve the legitimate current fingerprints, deploy the association file, and recheck it with Google's API. Until that association is published and Android verifies it, the release app can still show the domain bar.

A release APK signed with the new private key cannot normally update the existing debug-signed installation. Uninstall the test APK before installing the newly signed release APK if Android reports a signature conflict. Do not mistake that installation conflict for a website-verification failure.

This verifies directly installed release APKs. For the future Google Play installation, Google uses its separate app-signing certificate; retrieve and associate that public certificate too after Play App Signing setup. External payment or identity-provider websites may legitimately display browser UI.

## Unsigned release APK prepared

- Package `com.unilinkbase.twa`, version1.0.1/code1, minimum API24, target/compile API36.
- Release APK size 2,652,111 bytes, SHA-256 `0c1f22b8956d9bce4b2ab83e5de1c7a483b8fa9f1ede241965b5924cb620e901`.
- `assembleRelease`, ZIP CRC and zipalign checks passed. It is deliberately unsigned and cannot be installed until the owner signs it.
- The unsigned release AAB remains unchanged from `build-artifacts.md`.

The owner supplied the public Windows release fingerprint `42:E5:B6:8B:F9:4B:E8:19:AA:67:96:FA:55:FF:D3:0B:26:C5:30:CC:51:37:91:4D:BA:94:95:4F:1B:3E:66:3E`. It was added to the existing website association on main in commit `aa55be8`, preserving both earlier certificates. Only the owner-signed APK uses this certificate; the original debug APK remains untrusted. Device-side behavior must still be checked after website/Google association verification.
