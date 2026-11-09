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
| Signing-key possession | Not verified; no key supplied or generated |
| Play Console account | Owner reports not yet registered |
| Android wrapper configuration | Verified package, canonical host, existing fingerprint preservation, API 36, source syntax and XML |
| Full Android build/device test | Not completed: bounded Gradle attempt failed downloading its distribution (`java.net.ConnectException: Connection refused`); compilation was not reached. Full JDK/Android SDK are absent. No APK or AAB was produced. |

A SPA route rewrite and Android wrapper source are prepared on this branch. This report describes the currently hosted website; these changes have not been merged or deployed to production.

The root index, assets and Digital Asset Links must keep working after deploying the rewrite. Account-deletion coverage and authentication security still need deliberate implementation work; see the release checklist.
