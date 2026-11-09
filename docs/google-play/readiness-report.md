# Readiness check — 9 November 2026

Source baseline: `4fa7f42` (`main`). Checked without signing in or inspecting customer records.

| Check | Observed result |
|---|---|
| Canonical website | HTTPS `https://www.unilinkbase.com/`, HTTP 200 |
| Manifest | HTTP 200, standalone mode, root start URL |
| Digital Asset Links | HTTP 200 JSON on www; package `com.unilinkbase.twa` with two existing certificates |
| Customer login direct link | HTTP 404 |
| Support direct link | HTTP 404 |
| Privacy-policy direct link | HTTP 404 |
| Manifest icon dimensions | Both PNGs are 640×640; advertised dimensions are 192×192 and 512×512 |
| Signing-key possession | Owner has no previous key; confirmed first-ever Play upload. New upload-key instructions prepared; no real key generated here. |
| Play Console account | Owner reports organisation account registered; verification completion unknown |
| Android wrapper configuration | Verified package, canonical host, existing fingerprint preservation, API 36, source syntax and XML |
| Full Android build | `bundleRelease` and `assembleDebug` succeeded after workspace toolchain installation; unsigned AAB passed bundletool validation, debug APK passed package/signature checks. See `build-artifacts.md`. |
| Real Android device flow | Not yet tested. No signed upload-key release or Play submission was produced. |

A SPA route rewrite and Android wrapper source are prepared on this branch. This report describes the currently hosted website; these changes have not been merged or deployed to production.

The root index, assets and Digital Asset Links must keep working after deploying the rewrite. Account-deletion coverage and authentication security still need deliberate implementation work; see the release checklist.
