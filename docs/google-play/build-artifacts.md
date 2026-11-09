# UniLink Android build artifacts — 9 November 2026

Application: `com.unilinkbase.twa` · version name `1.0.1` · version code `1` · minimum API24 · target/compile API36.

These artifacts are for preparation/testing. They have not been submitted to Play Console and do not resolve the release blockers in the main checklist.

| Download name | Purpose/status | SHA-256 |
|---|---|---|
| `unilink-1.0.1-unsigned.aab` | Release-format Android App Bundle; intentionally unsigned. Sign it locally with the owner's upload key before Play upload. | `5c5ae6a41eae8da33d2162c35e65abc0c3d45cc5826f813c4246fab134549bd3` |
| `unilink-1.0.1-debug.apk` | Phone-testing APK signed by a disposable Android Debug key. Not a Play upload or production-signed release; browser toolbar fallback is expected until the installed certificate matches website verification. | `e07a5a3fb65657e6c7dfea88468a92950e8c1e11a570a3ad515d43f90a79ec2e` |

Validation completed:

- Gradle `bundleRelease` and `assembleDebug`: successful.
- Official bundletool1.18.3 validation: passed; package and SDK versions inspected from the actual AAB.
- `jarsigner`: unsigned AAB confirmed unsigned.
- Android `aapt`: debug APK package/SDK metadata matches.
- Android `apksigner`: debug APK signature verifies; Android Debug certificate only.
- Signing helper: exercised against a copied prebuilt AAB using the disposable debug key; `jar signed` and `jar verified` passed. This helper-test AAB is not included in download artifacts.
- Wrapper config, JavaScript/shell syntax, XML and signing-path refusal checks passed.

No release/upload key, password, keystore, service-account credential or temporary debug private key is included in Git or the downloads.

The full build toolchain was installed under the execution workspace, with a full JDK21, SDK36/build-tools36 and Gradle8.11.1. The previous Java distribution-fetch failure was resolved by configuring inherited proxy/CA trust for Java; TLS verification was not disabled.

Next: follow [`console-handoff.md`](console-handoff.md), sign the unsigned bundle with the owner's locally created upload key, configure Google-managed Play App Signing, then validate a Play test-track installation and its website certificate association. Production submission remains blocked on the known authentication/privacy/deletion fixes and full device testing.
