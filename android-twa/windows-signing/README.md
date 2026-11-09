# Sign UniLink on your own Windows PC

This kit replaces the temporary **debug** app with a release APK signed by a private upload key that stays on your PC. It also signs the existing Android App Bundle for a first Google Play upload. It does not upload anything or change the website.

## Before running

1. Download the prepared signing ZIP from the UniLink maintainer and **Extract All** into a folder you can write to. Do not run it from inside the ZIP.
2. Have a full **JDK 17 or 21** installed. Android Studio's bundled JBR works if it includes `java.exe`, `keytool.exe` and `jarsigner.exe`. Otherwise install [Temurin JDK 21 for Windows](https://adoptium.net/temurin/releases/?version=21), enabling `JAVA_HOME` or adding Java to `PATH`, then reopen the kit.
3. Decide on a strong upload-keystore password and keep it in your password manager. The native JDK tools will prompt for it; the script never saves it in a variable or supplies it as a command-line argument.

The complete ZIP contains:

```text
Sign-UniLink.cmd
Sign-UniLink.ps1
unilink-release-unsigned.apk
unilink-release-unsigned.aab
tools/apksigner.jar
licenses/...
```

A source-code checkout omits the unsigned binaries and JAR; the maintainer packages those exact files with the sources. The script refuses missing or altered inputs before creating a key.

## Run

Double-click **Sign-UniLink.cmd**. It runs Windows PowerShell 5.1 with a policy setting limited to this one process; it does not change your saved execution policy. If your organisation blocks scripts through Group Policy, ask your administrator rather than disabling that protection.

- It checks the APK, AAB and APK-signing-tool hashes.
- It finds a full JDK through `JAVA_HOME`, Android Studio's JBR, `PATH`, or a standard Temurin install.
- On the first run, type **CREATE** when asked to create the upload key. On later runs it reuses the key and never overwrites it.
- Enter the keystore password whenever native **keytool**, **apksigner** or **jarsigner** asks. Password input may look blank. Use the same password for the PKCS12 keystore and key.

The private key is always outside the extracted kit, at:

```text
%LOCALAPPDATA%\UniLinkSigning\unilink-upload.p12
```

Alias: `unilink-upload`. Keep an encrypted backup of that file and save its password separately. Do not delete it to retry a failed signing run. Repeated Play uploads must use the appropriate same upload key unless you complete Google's formal upload-key reset process.

Successful output goes into a new dated folder under `signed\`:

- `UniLink-release-signed.apk` — installable release test build.
- `UniLink-upload-signed.aab` — signed bundle for Play Console.
- `PUBLIC-CERTIFICATE-SHA256.txt` — **public** certificate fingerprint, safe to send to your website maintainer.
- `UniLink-public-certificate.der` — the public certificate, not a private key.
- `SHA256SUMS.txt` — checksums of your locally signed outputs.

## Remove the browser bar correctly

Send **only `PUBLIC-CERTIFICATE-SHA256.txt`** to the UniLink website maintainer. Never send the `.p12` file or its password. The website must trust the signing certificate of the APK actually installed on the phone.

The old debug APK and your release APK have different signatures. Android will not update one over the other: uninstall the debug app before installing `UniLink-release-signed.apk`. Uninstalling can remove device-local app data; keep anything important first. Website account data remains on the service.

After the confirmed public fingerprint is published at `https://www.unilinkbase.com/.well-known/assetlinks.json`, test the release APK with an up-to-date Chrome browser. Website verification/browser caching can take time. A fresh launch after the trust relationship validates should use the full-screen Trusted Web Activity.

Google Play normally re-signs delivered apps with its **Play App Signing** certificate. For the Play-distributed app, obtain that separate SHA-256 fingerprint from **Play Console → App integrity → App signing**, and have the website maintainer verify/publish it too. Publishing only the upload certificate does not prove trust for a Play-signed installation.

## Pinned inputs

| File | SHA-256 |
| --- | --- |
| `unilink-release-unsigned.apk` | `0c1f22b8956d9bce4b2ab83e5de1c7a483b8fa9f1ede241965b5924cb620e901` |
| `unilink-release-unsigned.aab` | `5c5ae6a41eae8da33d2162c35e65abc0c3d45cc5826f813c4246fab134549bd3` |
| `tools/apksigner.jar` | `00ef9948f843fe395d2440ae3ef41405b8040a6d5d46493bd1902ac0ee6deae7` |

The signing tool is the unmodified AOSP `apksigner.jar` from official Android SDK Build Tools **35.0.0**. AOSP apksig is licensed under **Apache License 2.0**, which permits binary redistribution subject to its conditions. This kit includes the Apache license, the upstream apksig license notice and the complete Build Tools notice file. The JDK is not bundled.

The compiled inputs use `com.unilinkbase.twa`, version `1.0.1` / code `1`, minimum Android API 24 and target/compile API 36. Do not change the package or upload duplicate version codes blindly.

The signing commands and unsigned inputs were validated in a Linux build environment. **The Windows launcher has not been executed on a Windows PC in this workspace.** The unsigned artifacts and signing certificate do not establish Play policy compliance, approval or on-device testing; follow the main Google Play release checklist as well.
