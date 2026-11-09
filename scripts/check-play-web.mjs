#!/usr/bin/env node
// Read-only release preflight. Does not log credentials or account records.
const origin = new URL(process.argv[2] || 'https://www.unilinkbase.com').origin;
if (!origin.startsWith('https://')) throw new Error('Use an HTTPS origin.');
const expectedPackage = 'com.unilinkbase.twa';
let failures = 0;
function report(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
  if (!ok) failures++;
}
async function get(path, redirect = 'follow') {
  const response = await fetch(new URL(path, origin), { redirect, signal: AbortSignal.timeout(20000) });
  return response;
}
const checks = [
  ['/', 'Launch page'],
  ['/customer/login', 'Direct shopper sign-in link'],
  ['/support', 'Direct support link'],
  ['/policies?type=privacy', 'Public privacy-policy route'],
];
await Promise.all(checks.map(async ([path, label]) => {
  try {
    const response = await get(path);
    report(response.ok && response.headers.get('content-type')?.includes('text/html'), label, `HTTP ${response.status}`);
  } catch (error) { report(false, label, error.message); }
}));
try {
  const response = await get('/.well-known/assetlinks.json', 'manual');
  const jsonType = response.headers.get('content-type')?.includes('json');
  report(response.status === 200 && jsonType, 'Digital Asset Links served directly as JSON', `HTTP ${response.status}`);
  if (response.status === 200 && jsonType) {
    const links = await response.json();
    const link = links.find(item => item.target?.namespace === 'android_app' && item.target.package_name === expectedPackage && item.relation?.includes('delegate_permission/common.handle_all_urls'));
    report(Boolean(link?.target?.sha256_cert_fingerprints?.length), 'Expected Android package and fingerprints', expectedPackage);
    console.log('NOTE Certificate presence does not prove possession of its key or a match to Play App Signing.');
  }
} catch (error) { report(false, 'Digital Asset Links', error.message); }
try {
  const response = await get('/manifest.json');
  const manifest = await response.json();
  report(response.ok && ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display), 'Installable manifest display');
  report(new URL(manifest.start_url, origin).origin === origin, 'Start URL uses launch origin');
  for (const icon of manifest.icons || []) {
    const iconUrl = new URL(icon.src, origin);
    if (iconUrl.origin !== origin) { report(false, 'Icon is on launch origin', iconUrl.pathname); continue; }
    const iconResponse = await get(iconUrl.pathname);
    const data = Buffer.from(await iconResponse.arrayBuffer());
    const png = data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const actual = png ? `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}` : 'not a PNG';
    report(iconResponse.ok && png && icon.sizes.split(/\s+/).includes(actual), `Manifest icon ${icon.src}`, `declared ${icon.sizes}; actual ${actual}`);
  }
} catch (error) { report(false, 'Web manifest', error.message); }
console.log('MANUAL Still verify account/data deletion, privacy accuracy, Data Safety, Android permissions, offline behavior, signing and device flows. This check does not establish Play policy compliance.');
process.exitCode = failures ? 1 : 0;
