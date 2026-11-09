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
  console.log('Generated unsigned Android source. No signing key created or changed.');
}).catch(error => { console.error(error); process.exitCode=1; });
