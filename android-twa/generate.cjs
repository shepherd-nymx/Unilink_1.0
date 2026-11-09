#!/usr/bin/env node
// GoogleChromeLabs Bubblewrap core, pinned in package-lock.json.
const fs = require('node:fs');
const path = require('node:path');
const {TwaGenerator,TwaManifest,ConsoleLog,fetchUtils} = require('@bubblewrap/core');
const root = __dirname;
// Respect the environment's HTTPS proxy and CA rather than weakening TLS.
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  const {HttpsProxyAgent} = require('https-proxy-agent');
  const fetch = require('node-fetch');
  const agent = new HttpsProxyAgent(process.env.HTTPS_PROXY || process.env.https_proxy);
  fetchUtils.fetch = (url) => fetch(url, {agent,redirect:'follow'});
}
const config = JSON.parse(fs.readFileSync(path.join(root,'twa-manifest.json'),'utf8'));
const manifest = new TwaManifest(config);
new TwaGenerator().createTwaProject(root,manifest,new ConsoleLog('UniLink')).then(() => {
  // AGP 8+ uses the Gradle namespace; Bubblewrap's template still emits package.
  const androidManifest = path.join(root,'app/src/main/AndroidManifest.xml');
  let xml = fs.readFileSync(androidManifest,'utf8');
  xml = xml.replace(/<!-- The "package" attribute[\s\S]*?-->\s*/, '');
  xml = xml.replace(/\s+package="com\.unilinkbase\.twa"/, '');
  fs.writeFileSync(androidManifest, xml);
  console.log('Generated unsigned Android source. No signing key created or changed.');
}).catch(error => { console.error(error); process.exitCode=1; });
