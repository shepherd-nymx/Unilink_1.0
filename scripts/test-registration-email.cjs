// Exercise the real edge handler without sending mail or accessing a database.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'supabase/functions/resend-email/index.ts'), 'utf8').replace(/^import .*;\n/gm, '');
const env = { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'server-test', RESEND_API_KEY: 'test-only', GMAIL_USER: 'support@example.test', GMAIL_APP_PASSWORD: 'test-only' };
const accounts = {
  customers: { c1: { id: 'c1', email: 'customer@example.test', full_name: '<Customer>' }, c2: { id: 'c2', email: 'retry@example.test', full_name: 'Retry' } },
  drivers: { d1: { id: 'd1', email: 'driver@example.test', full_name: 'Messenger' } },
  shops: { s1: { id: 's1', contact_email: 'shop@example.test', name: '<Shop>' } },
};
const rows = [];
const resend = [];
const gmail = [];
let providerFailure = false;
let handler;
const db = { from(table) { return {
  select() { return { eq(_, id) { return { async maybeSingle() { return { data: table === 'email_notifications' ? rows.find(r => r.id === id) : accounts[table]?.[id], error: null }; } }; } }; },
  insert(row) { return { select() { return { async maybeSingle() {
    if (rows.some(r => r.recipient_email === row.recipient_email && r.type === row.type && !r.order_id)) return { error: { code: '23505' } };
    const next = { id: `mail-${rows.length + 1}`, ...row }; rows.push(next); return { data: { id: next.id } };
  } }; } }; },
  update(update) { return { async eq(_, id) { Object.assign(rows.find(r => r.id === id), update); return { error: null }; } }; },
}; } };
const context = {
  createClient: () => db,
  nodemailer: { createTransport: () => ({ sendMail: async payload => { gmail.push(payload); return { messageId: 'gmail-id' }; } }) },
  Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn; } },
  Request, Response, AbortSignal, console,
  fetch: async (url, options) => { assert.equal(url, 'https://api.resend.com/emails'); resend.push({ headers: options.headers, payload: JSON.parse(options.body) }); return new Response(JSON.stringify(providerFailure ? { message: 'provider unavailable' } : { id: `resend-${resend.length}` }), { status: providerFailure ? 503 : 200 }); },
};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const call = async body => (await handler(new Request('https://example.test/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))).json();
(async () => {
  const customer = { type: 'welcome', to: 'CUSTOMER@example.test', userId: 'c1', userType: 'customer', data: { name: 'Spoofed name' } };
  const first = await call(customer); assert.equal(first.status, 'sent');
  assert.equal(resend[0].payload.from, 'UniLink <no-reply@unilinkbase.com>');
  assert.match(resend[0].payload.html, /&lt;Customer&gt;/); assert.doesNotMatch(resend[0].payload.html, /Spoofed name/);
  assert.equal(resend[0].headers['Idempotency-Key'], `registration/${first.id}`);
  assert.equal((await call(customer)).status, 'duplicate'); assert.equal(resend.length, 1);
  assert.equal((await call({ ...customer, to: 'someoneelse@example.test' })).status, 'skipped'); assert.equal(resend.length, 1);
  assert.equal((await call({ ...customer, userId: null })).status, 'skipped');
  assert.equal((await call({ type: 'welcome', to: 'driver@example.test', userId: 'd1', userType: 'driver' })).status, 'sent');
  assert.match(resend[1].payload.text, /messenger application.*awaiting review/);
  assert.equal((await call({ type: 'shop_notification', to: 'shop@example.test', userType: 'shop', data: { shopId: 's1', action: 'registration_received', shopName: 'Spoofed' } })).status, 'sent');
  assert.match(resend[2].payload.html, /&lt;Shop&gt;/); assert.doesNotMatch(resend[2].payload.html, /Spoofed/);
  await call({ type: 'order_confirmation', to: 'existing@example.test', data: {} }); assert.equal(gmail.length, 1); assert.equal(resend.length, 3);
  providerFailure = true;
  const failed = await call({ ...customer, to: 'retry@example.test', userId: 'c2' }); assert.equal(failed.status, 'failed');
  providerFailure = false;
  assert.equal((await call({ retry: true, id: failed.id })).status, 'sent');
  assert.equal(resend.at(-1).headers['Idempotency-Key'], resend.at(-2).headers['Idempotency-Key']);
  assert.equal((await call({ retry: true, id: failed.id })).status, 'already_sent');
  console.log('PASS: customer, messenger and shop registration; recipient checks; escaping; duplicates; provider failure/retry; existing Gmail notifications.');
})().catch(error => { console.error(error); process.exitCode = 1; });
