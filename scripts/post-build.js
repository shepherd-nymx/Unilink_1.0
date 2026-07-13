#!/usr/bin/env node

/**
 * Post-build script for UniLink web export.
 *
 * 1. Generates a deterministic BUILD_ID from the hashed JS bundle filename
 *    (Expo Metro puts a content hash in the filename, e.g.
 *    _expo/static/js/web/entry-<hash>.js).  Falls back to a timestamp if
 *    no hashed bundle is found.
 *
 * 2. Writes dist/version.json so the running app can detect new deployments.
 *
 * 3. Copies public/service-worker.js → dist/service-worker.js and replaces
 *    the `self.__BUILD_ID__` placeholder with the real value so the service
 *    worker uses a stable, deployment-specific cache name.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(__dirname, '..', 'dist');
const PUBLIC_SW = path.join(__dirname, '..', 'public', 'service-worker.js');
const DIST_SW = path.join(DIST, 'service-worker.js');
const VERSION_FILE = path.join(DIST, 'version.json');
const APP_JSON = path.join(__dirname, '..', 'app.json');

// --- 1. Determine BUILD_ID --------------------------------------------------

function findBundleHash() {
  const jsDir = path.join(DIST, '_expo', 'static', 'js', 'web');
  if (!fs.existsSync(jsDir)) return null;
  const files = fs.readdirSync(jsDir);
  const bundle = files.find((f) => f.startsWith('entry-') && f.endsWith('.js'));
  if (!bundle) return null;
  // The hash is the hex string between "entry-" and ".js"
  const match = bundle.match(/entry-([a-f0-9]+)\.js/);
  return match ? match[1] : null;
}

const bundleHash = findBundleHash();
const buildId = bundleHash
  ? bundleHash.slice(0, 16)
  : crypto.randomBytes(8).toString('hex');

console.log(`[post-build] BUILD_ID: ${buildId}`);

// --- 2. Write dist/version.json --------------------------------------------

let appVersion = '1.0.0';
try {
  const appJson = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));
  appVersion = appJson.expo?.version || appVersion;
} catch {}

const versionPayload = {
  version: appVersion,
  buildId,
  builtAt: new Date().toISOString(),
};

fs.writeFileSync(VERSION_FILE, JSON.stringify(versionPayload, null, 2));
console.log(`[post-build] Wrote dist/version.json:`, versionPayload);

// --- 3. Inject BUILD_ID into service worker ---------------------------------

if (!fs.existsSync(PUBLIC_SW)) {
  console.error('[post-build] public/service-worker.js not found – skipping SW injection');
  process.exit(0);
}

let swSource = fs.readFileSync(PUBLIC_SW, 'utf8');

// Replace the placeholder declaration so the SW uses the real build id.
swSource = swSource.replace(
  /const BUILD_ID = self\.__BUILD_ID__ \|\| [^;]+;/,
  `const BUILD_ID = '${buildId}';`
);

fs.writeFileSync(DIST_SW, swSource);
console.log(`[post-build] Wrote dist/service-worker.js with BUILD_ID=${buildId}`);
