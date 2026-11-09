#!/bin/sh
# First Play upload only. Run locally so the key and its passwords stay with its owner.
set -eu
umask 077
if [ "$#" -ne 1 ]; then
  echo 'Usage: ./scripts/create-upload-key.sh /absolute/private/path/unilink-upload.jks' >&2
  exit 1
fi
case "$1" in /*) ;; *) echo 'Choose an absolute path outside the repository.' >&2; exit 1 ;; esac
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
repo_dir=$(CDPATH= cd -- "$project_dir/.." && pwd -P)
key_dir=$(CDPATH= cd -- "$(dirname -- "$1")" && pwd -P)
key_path="$key_dir/$(basename -- "$1")"
case "$key_path" in "$repo_dir"/*) echo 'Keep the signing key outside the repository.' >&2; exit 1 ;; esac
if [ -e "$key_path" ] || [ -L "$key_path" ]; then
  echo 'That path already exists. Existing keys are never overwritten.' >&2
  exit 1
fi
command -v keytool >/dev/null 2>&1 || { echo 'Install a full JDK and make keytool available first.' >&2; exit 1; }
printf 'Creating a NEW upload key for the first Play upload only.\nKeep its password and an encrypted backup privately.\n'
# keytool prompts for passwords and certificate details; none are command arguments.
keytool -genkeypair -v -storetype PKCS12 -keystore "$key_path" -alias unilink-upload -keyalg RSA -keysize 3072 -validity 10000
printf '\nUpload key created at %s\nAlias: unilink-upload\n' "$key_path"
printf 'Use Google Play App Signing for the delivered app. Verify its separate app-signing certificate against the website Digital Asset Links file.\n'
