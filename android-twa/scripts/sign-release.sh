#!/bin/sh
# Sign an unsigned AAB with an EXISTING upload key. No key creation and no publishing.
set -eu
: "${UNILINK_KEYSTORE_PATH:?Set the absolute path to your existing upload keystore}"
: "${UNILINK_KEY_ALIAS:?Set the existing alias from that keystore}"
: "${UNILINK_KEYSTORE_PASSWORD:?Load the keystore password through your local secret mechanism}"
export UNILINK_KEYSTORE_PASSWORD
UNILINK_KEY_PASSWORD="${UNILINK_KEY_PASSWORD:-$UNILINK_KEYSTORE_PASSWORD}"
export UNILINK_KEY_PASSWORD
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
[ -f "$UNILINK_KEYSTORE_PATH" ] || { echo 'Existing keystore was not found.' >&2; exit 1; }
./gradlew --no-daemon bundleRelease
unsigned='app/build/outputs/bundle/release/app-release.aab'
signed='app/build/outputs/bundle/release/unilink-release-signed.aab'
cp "$unsigned" "$signed"
jarsigner -keystore "$UNILINK_KEYSTORE_PATH" -storepass:env UNILINK_KEYSTORE_PASSWORD -keypass:env UNILINK_KEY_PASSWORD -digestalg SHA-256 "$signed" "$UNILINK_KEY_ALIAS"
jarsigner -verify "$signed"
printf '\nSigned bundle: %s/%s\n' "$project_dir" "$signed"
printf 'Confirm the Play App Signing certificate in the website assetlinks.json before testing the Play-distributed build.\n'
