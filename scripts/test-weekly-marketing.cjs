// Runs the deployed handler with a fake DB/provider. Never sends email.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
let ts; try { ts = require('typescript'); } catch { ts = require('/workspace/ChangeTrack/node_modules/typescript'); }
let handler;
let config = { id: 1, enabled: true, token_hash: crypto.createHash('sha256').update('private-test-token').digest('hex') };
const consent = { opted_in: true };
const deliveries = [], suppressions = [], emails = [];
let providerFailure = false;
const customer = { id: 'c1', email: 'shopper@example.test', full_name: '<Shopper>' };
function query(table) {
 let op = 'select', payload, filters = [];
 const run = () => {
  const collection = table === 'weekly_marketing_config' ? [config] : table === 'marketing_consents' ? [{customer_id:'c1',...consent}] : table === 'marketing_email_suppressions' ? suppressions : deliveries;
  let row = collection.find(r=>filters.every(([k,v])=>r[k]===v));
  if (op === 'insert') {
    if(deliveries.some(d=>d.email===payload.email && d.campaign_week===payload.campaign_week)) return {data:null,error:{code:'23505'}};
    row={...payload,id:'delivery-'+deliveries.length,unsubscribe_token:'11111111-1111-1111-1111-111111111111',status:'pending'}; collection.push(row);
  }
  if(op === 'update' && row) {Object.assign(row,payload); if(table==='marketing_consents') Object.assign(consent,payload);}
  if(op === 'upsert') {if(row) Object.assign(row,payload);else collection.push(payload);}
  return {data:row || null,error:null};
 };
 const builder = { select(){return this}, eq(k,v){filters.push([k,v]);return this}, insert(value){op='insert';payload=value;return this},update(value){op='update';payload=value;return this},upsert(value){op='upsert';payload=value;return this},single:async()=>run(), maybeSingle:async()=>run(),then(resolve,reject){return Promise.resolve(run()).then(resolve,reject)}};
 return builder;
}
const client = { from:query,rpc:async()=>({data:[customer],error:null}) };
const code = fs.readFileSync('supabase/functions/weekly-marketing/index.ts','utf8').replace(/^import .*;\n/gm,'');
class Monday extends Date {constructor(...args){super(...(args.length?args:['2026-11-23T07:00:00Z']))}}
vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText, {
 createClient:()=>client,Deno:{serve:fn=>{handler=fn},env:{get:key=>({SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'private-test',RESEND_API_KEY:'test-only'}[key])}},
 crypto:crypto.webcrypto, TextEncoder,Request,Response,URL,Date:Monday,AbortSignal,console,setTimeout:fn=>fn(),
 fetch:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');emails.push(JSON.parse(options.body));return new Response(JSON.stringify(providerFailure?{}:{id:'email-1'}),{status:providerFailure?503:200})}
});
const call = (token='private-test-token')=>handler(new Request('https://example.test/weekly-marketing',{method:'POST',headers:{'x-campaign-secret':token}}));
(async()=>{
 assert.equal((await call('public-token')).status,401);
 config.enabled=false;assert.equal((await (await call()).json()).status,'disabled');config.enabled=true;
 consent.opted_in=false;assert.equal((await (await call()).json()).skipped,1);assert.equal(emails.length,0);consent.opted_in=true;
 assert.equal((await (await call()).json()).sent,1);assert.equal(deliveries[0].status,'sent');
 assert.match(emails[0].html,/&lt;Shopper&gt;/);assert.equal(emails[0].to[0],customer.email);assert.ok(emails[0].headers['List-Unsubscribe-Post']);
 await call();assert.equal(emails.length,1);
 const unsub=()=>handler(new Request('https://example.test/?unsubscribe=11111111-1111-1111-1111-111111111111',{method:'POST'}));
 assert.equal((await unsub()).status,200);assert.equal(consent.opted_in,false);assert.equal(suppressions[0].email,customer.email);
 assert.equal((await unsub()).status,200);
 deliveries.length=0;await call();assert.equal(emails.length,1);
 consent.opted_in=true; suppressions.length=0;providerFailure=true;await call();assert.equal(deliveries[0].status,'failed');
 await call();assert.equal(emails.length,2); // Ambiguous failures do not resend automatically.
 assert.equal((await handler(new Request('https://example.test'))).status,405);
 console.log('PASS: private cron authorization, disabled campaign, consent, deduplication, escaping, one-click/repeated unsubscribe, suppression, provider failure handling.');
})().catch(error=>{console.error(error);process.exit(1)});
