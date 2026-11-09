# Android build verification

The wrapper was compiled successfully on 9 November 2026 with:

- Eclipse Temurin **JDK 21.0.13+9** (a complete JDK including `javac`).
- Gradle **8.11.1** and Android Gradle Plugin **8.9.1**, as pinned in this project.
- Android SDK Platform **36**. The plugin selected Build Tools **35.0.0**; Build Tools **36.0.0** was also installed.
- The checked-in TWA configuration: **com.unilinkbase.twa**, version **1.0.1 / code 1**, minimum Android API **24**, target/compile API **36**.

## Results

`./gradlew --no-daemon --max-workers=2 bundleRelease assembleDebug` completed successfully: **70 tasks, 1 minute 18 seconds** after dependency/toolchain installation.

| Artifact | SHA-256 | Intended use |
| --- | --- | --- |
| `app/build/outputs/bundle/release/app-release.aab` | `5c5ae6a41eae8da33d2162c35e65abc0c3d45cc5826f813c4246fab134549bd3` | **Unsigned** release bundle; must be signed with the owner's upload key before a Play upload. |
| `app/build/outputs/apk/debug/app-debug.apk` | `e07a5a3fb65657e6c7dfea88468a92950e8c1e11a570a3ad515d43f90a79ec2e` | Local Android testing only, signed with a disposable Android debug certificate. |

Checks performed:

- Official Google **bundletool 1.18.3**: `validate` passed; `dump manifest` confirms package, version and SDK values above.
- JDK `jarsigner -verify`: release AAB is **unsigned**, as intended.
- Android `aapt dump badging`: debug APK package/version/SDK values match the bundle.
- Android `apksigner verify --verbose --print-certs`: APK signature verifies under the **v2** scheme with **Android Debug** certificate.
- Both ZIP containers pass CRC checks. Neither contains native `.so` libraries.
- `npm run verify`, JavaScript syntax checks, shell syntax checks and Android XML parsing passed.

These are compilation and package-structure checks. **No Android device/emulator run, Play upload, Play pre-launch report or store approval is claimed.** The debug certificate is intentionally absent from production Digital Asset Links, so the test APK can show a browser toolbar until verified with an appropriate real release identity. No production certificate or signing key was changed.

## Reproducing the build

On a normal developer machine, use a full JDK 17/21 and Android Studio's SDK Manager to install SDK Platform 36 and the required Build Tools, configure `ANDROID_HOME`, and run the Gradle command above. Use `ANDROID_USER_HOME` for an alternate Android preferences directory; do not also set deprecated `ANDROID_PREFS_ROOT` to a conflicting path.

In this managed workspace, the recovered toolchain is under `/workspace/work/android-tools/` and the command was:

```sh
cd /workspace/work/Unilink_1.0/android-twa
/workspace/work/android-tools/with-toolchain.sh ./gradlew --no-daemon --max-workers=2 bundleRelease assembleDebug
```

The task-local launcher sets workspace-only Gradle/Android preferences directories, uses the inherited HTTPS proxy for Java clients, and supplies a task-local Java truststore containing the environment's public proxy CA. TLS verification stayed enabled. The temporary debug keystore is in the workspace Android preferences directory, outside the repository. No production/upload key was generated.

The prior failure documented during source preparation was a missing build environment; it is resolved for this workspace. Google Play account setup, owner-controlled upload signing, Play signing-certificate verification and the root release checklist still apply.
