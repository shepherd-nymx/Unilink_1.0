#!/bin/sh
# Sign a first/repeat upload with the owner's private upload key. Never publish.
set -eu
if [ "$#" -gt 1 ]; then
  echo 'Usage: ./scripts/sign-release.sh [/absolute/path/to/unsigned.aab]' >&2
  exit 1
fi
: "${UNILINK_KEYSTORE_PATH:?Set the absolute path to your upload keystore}"
case "$UNILINK_KEYSTORE_PATH" in /*) ;; *) echo 'Use an absolute keystore path.' >&2; exit 1 ;; esac
: "${UNILINK_KEY_ALIAS:?Set the alias from that keystore}"
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
cd "$project_dir"
[ -f "$UNILINK_KEYSTORE_PATH" ] || { echo 'Upload keystore was not found.' >&2; exit 1; }
if [ "$#" -eq 1 ]; then
  case "$1" in /*) ;; *) echo 'Use an absolute unsigned-bundle path.' >&2; exit 1 ;; esac
  unsigned="$1"
  [ -f "$unsigned" ] || { echo 'Unsigned bundle was not found.' >&2; exit 1; }
else
  ./gradlew --no-daemon bundleRelease
  unsigned='app/build/outputs/bundle/release/app-release.aab'
fi
output_dir='app/build/outputs/bundle/release'
mkdir -p "$output_dir"
signed="$output_dir/unilink-release-signed.aab"
cp "$unsigned" "$signed"
if [ -n "${UNILINK_KEYSTORE_PASSWORD:-}" ]; then
  export UNILINK_KEYSTORE_PASSWORD
  UNILINK_KEY_PASSWORD="${UNILINK_KEY_PASSWORD:-$UNILINK_KEYSTORE_PASSWORD}"
  export UNILINK_KEY_PASSWORD
  jarsigner -keystore "$UNILINK_KEYSTORE_PATH" -storepass:env UNILINK_KEYSTORE_PASSWORD -keypass:env UNILINK_KEY_PASSWORD -digestalg SHA-256 "$signed" "$UNILINK_KEY_ALIAS"
else
  # Interactive local password prompts; no password in arguments or shell history.
  jarsigner -keystore "$UNILINK_KEYSTORE_PATH" -digestalg SHA-256 "$signed" "$UNILINK_KEY_ALIAS"
fi
jarsigner -verify "$signed"
printf '\nSigned bundle: %s/%s\n' "$project_dir" "$signed"
printf 'Confirm the Play App Signing certificate in the website assetlinks.json before testing the Play-distributed build.\n'
