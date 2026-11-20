const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
 const module = { exports: {} };
 const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
 }).outputText;
 vm.runInNewContext(source, {
  module, exports: module.exports, URL, URLSearchParams, ...globals,
  require(name) { if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`); return mocks[name]; },
 });
 return module.exports;
}

async function main() {
 const disk = new Map();
 let rejectWrite = () => false;
 const secure = {
  async getItemAsync(key) { return disk.get(key) ?? null; },
  async setItemAsync(key, value) {
   // Android/iOS SecureStore must never be handed oversized Unicode chunks.
   assert.ok(Buffer.byteLength(value, 'utf8') < 2048);
   if (rejectWrite(key, value)) throw new Error('Disk write failed');
   disk.set(key, value);
  },
  async deleteItemAsync(key) { disk.delete(key); },
 };
 const newStorage = () => load('lib/native-secure-storage.ts', { 'expo-secure-store': secure }).nativeSecureStorage;
 let storage = newStorage();
 const large = 'A😀é中文'.repeat(2000);
 await storage.setItem('auth-token', large);
 assert.equal(await storage.getItem('auth-token'), large);
 storage = newStorage(); // No in-memory state survives a real process restart.
 assert.equal(await storage.getItem('auth-token'), large);
 await Promise.all([storage.setItem('auth-token', 'first'), storage.setItem('auth-token', 'second')]);
 assert.equal(await storage.getItem('auth-token'), 'second');
 assert.equal(disk.size, 2, 'Old encrypted chunks must be removed');

 rejectWrite = key => key === 'unilink.secure.auth-token';
 await assert.rejects(storage.setItem('auth-token', 'replacement'), /Disk write failed/);
 assert.equal(await storage.getItem('auth-token'), 'second', 'Failed manifest write must preserve previous login');
 assert.equal(disk.size, 2, 'Failed writes must not leave fresh chunks');
 rejectWrite = (_, value) => value.includes('FAILED');
 await assert.rejects(storage.setItem('auth-token', 'FAILED'.repeat(200)), /Disk write failed/);
 assert.equal(await storage.getItem('auth-token'), 'second');
 assert.equal(disk.size, 2);
 rejectWrite = () => false;
 await storage.removeItem('auth-token');
 assert.equal(await newStorage().getItem('auth-token'), null);
 assert.equal(disk.size, 0);

 const platform = { OS: 'android' };
 const newSessions = () => load('lib/session-service.ts', {
  'react-native': { Platform: platform }, './native-secure-storage': { nativeSecureStorage: newStorage() },
 });
 let sessions = newSessions();
 await sessions.saveSession({ id: 'test-customer', type: 'customer', name: 'Test customer' });
 sessions = newSessions();
 assert.equal(sessions.getMemorySession(), null);
 assert.equal((await sessions.loadSession()).id, 'test-customer');
 const legacy = load('lib/storage-service.ts', { 'react-native': { Platform: platform }, './session-service': sessions });
 assert.equal(legacy.loadUserData().id, 'test-customer', 'Native dashboard receives restored account');
 await sessions.clearSession();
 assert.equal(await newSessions().loadSession(), null);

 const shops = () => load('lib/shop-session-service.ts', {
  'react-native': { Platform: platform }, './native-secure-storage': { nativeSecureStorage: newStorage() },
  './supabase': { supabase: { auth: { async signOut() {} } } },
 });
 await shops().saveShopSession({ shopId: 'shop', ownerId: 'owner', email: 'test@example.com', shopName: 'Test', shopStatus: 'active' });
 assert.equal((await shops().loadShopSession()).shopId, 'shop');
 await shops().clearShopSession();
 assert.equal(await shops().loadShopSession(), null);

 let session = null, initialURL = null, exchanges = [], failure = null;
 const auth = {
  async getSession() { return { data: { session } }; },
  async exchangeCodeForSession(code) { exchanges.push(code); if (failure) return { error: failure }; session = { user: { id: 'verified' } }; return { error: null }; },
 };
 const linking = {
  createURL(path, options) { assert.equal(options.scheme, 'unilink'); assert.equal(options.isTripleSlashed, true); return `unilink://${path}`; },
  async getInitialURL() { return initialURL; },
 };
 const identity = load('lib/identity-redirect.ts', {
  'react-native': { Platform: platform }, 'expo-linking': linking, './supabase': { supabase: { auth } },
 });
 assert.equal(identity.identityCallbackUrl('customer'), 'unilink:///customer/identity-callback');
 assert.equal(identity.identityCallbackUrl('driver'), 'unilink:///driver/identity-callback');
 assert.equal(identity.identityAuthRedirectUrl('customer'), 'https://unilinkbase.com/customer/identity-callback?native=1');
 assert.equal(identity.identityAuthRedirectUrl('driver'), 'https://unilinkbase.com/driver/identity-callback?native=1');
 await Promise.all(Array.from({ length: 3 }, () => identity.acceptIdentityRedirect('unilink:///customer/identity-callback?code=one')));
 assert.deepEqual(exchanges, ['one'], 'Browser return and deep link must share one PKCE exchange');
 await identity.acceptIdentityRedirect('unilink:///customer/identity-callback?code=one');
 assert.deepEqual(exchanges, ['one']);
 initialURL = 'unilink:///driver/identity-callback?code=cold';
 await identity.acceptCurrentIdentityRedirect('driver');
 await identity.acceptCurrentIdentityRedirect('customer', { code: 'warm' });
 assert.deepEqual(exchanges, ['one', 'cold', 'warm']);
 await assert.rejects(identity.acceptIdentityRedirect('unilink:///customer/identity-callback#error_description=Denied'), /Denied/);
 await assert.rejects(identity.acceptCurrentIdentityRedirect('customer', { error: 'Expired' }), /Expired/);
 failure = new Error('Code expired');
 await assert.rejects(identity.acceptCurrentIdentityRedirect('customer', { code: 'bad' }), /Code expired/);
 failure = null;
 await identity.acceptCurrentIdentityRedirect('customer', { code: 'bad' });
 assert.equal(exchanges.filter(code => code === 'bad').length, 2, 'Failed exchanges can retry');
 platform.OS = 'web';
 assert.equal(identity.identityAuthRedirectUrl('driver'), 'https://unilinkbase.com/driver/identity-callback');
 await identity.acceptIdentityRedirect('https://www.unilinkbase.com/customer/identity-callback?code=already-exchanged');
 assert.ok(!exchanges.includes('already-exchanged'), 'Web SDK owns its automatic exchange');

 const links = load('lib/identity-links.ts', {});
 const mobileUrl = 'https://unilinkbase.com/customer/identity-callback?native=1&code=phone-code';
 assert.equal(links.nativeIdentityReturnUrl(mobileUrl), 'unilink:///customer/identity-callback?code=phone-code');
 assert.equal(links.nativeIdentityReturnUrl('https://www.unilinkbase.com/driver/identity-callback?native=1#code=driver-code'), 'unilink:///driver/identity-callback?code=driver-code');
 const denied = new URL(links.nativeIdentityReturnUrl('https://unilinkbase.com/customer/identity-callback?native=1#error=access_denied&error_description=Cancelled'));
 assert.equal(denied.searchParams.get('error_description'), 'Cancelled');
 for (const url of [
  'https://attacker.example/customer/identity-callback?native=1&code=one',
  'https://unilinkbase.com/customer/identity-callback?code=web-code',
  'https://unilinkbase.com/admin/identity-callback?native=1&code=one',
  'https://unilinkbase.com/customer/identity-callback?native=1#access_token=secret&refresh_token=secret',
 ]) assert.equal(links.nativeIdentityReturnUrl(url), null, 'Only an explicit mobile PKCE handoff may open the app');
 const clientOptions = href => {
  let options;
  load('lib/supabase.ts', {
   'react-native-url-polyfill/auto': {},
   '@supabase/supabase-js': { createClient(_url, _key, value) { options=value; return {}; } },
   'react-native': { Platform: { OS: 'web' } },
   './native-secure-storage': { nativeSecureStorage: {} }, './identity-links': links,
  }, { process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-public-key' } }, window: { location: { href } } });
  return options;
 };
 assert.equal(clientOptions(mobileUrl).auth.detectSessionInUrl, false, 'The bridge must not consume the phone-only PKCE code');
 assert.equal(clientOptions('https://www.unilinkbase.com/customer/identity-callback?code=web-code').auth.detectSessionInUrl, true, 'Ordinary web sign-in still exchanges its own code');

 const states = { END: 5, CANCELLED: 3, ACTIVE: 4 };
 const AuthInput = load('components/AuthTextInput.native.tsx', {
  react: { forwardRef: fn => fn, useRef: () => ({ current: null }), useCallback: fn => fn },
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  'react-native-gesture-handler': { State: states, TextInput: function GestureInput() {} },
 }).default;
 let focused = false, focusCalls = 0;
 const input = { isFocused: () => focused, focus() { focusCalls++; focused=true; } };
 const forwarded = { current: null };
 const field = AuthInput({ value: '' }, forwarded);
 field.props.ref(input);
 field.props.onHandlerStateChange({ nativeEvent: { state: states.CANCELLED } });
 assert.equal(focusCalls, 0, 'Scrolling must not force input focus');
 field.props.onHandlerStateChange({ nativeEvent: { state: states.END } });
 assert.equal(focusCalls, 1, 'A native tap must show the text cursor and keyboard');
 assert.equal(forwarded.current, input);
 field.props.onHandlerStateChange({ nativeEvent: { state: states.END } });
 assert.equal(focusCalls, 1, 'Repeated taps must not reset an existing cursor');
 focused=false;
 const readonly = AuthInput({ editable: false }, null);
 readonly.props.ref(input);
 readonly.props.onHandlerStateChange({ nativeEvent: { state: states.END } });
 assert.equal(focusCalls, 1, 'Read-only fields stay read-only');

 let permissionRequests = 0;
 const photos = load('lib/photo-selection.ts', {
  'react-native': { Platform: platform }, 'expo-image-picker': { async requestMediaLibraryPermissionsAsync() { permissionRequests++; return { status: 'granted', granted: true }; } },
 });
 platform.OS = 'android';
 assert.equal((await photos.requestPhotoSelectionPermission()).granted, true);
 assert.equal(permissionRequests, 0, 'Android photo picker must not request broad photo access');
 platform.OS = 'ios';
 await photos.requestPhotoSelectionPermission();
 assert.equal(permissionRequests, 1);
 const opened = [], location = { href: '' };
 let openError = null;
 const payment = load('lib/paynow-service.ts', {
  './supabase': { supabase: {} },
  'react-native': { Platform: platform, Linking: { async openURL(url) { if(openError)throw openError; opened.push(url); } } },
 }, { window: { location } });
 platform.OS = 'android';
 await payment.redirectToPaynow('https://www.paynow.co.zw/payment/test-android');
 assert.equal(opened[0], 'https://www.paynow.co.zw/payment/test-android');
 assert.equal(location.href, '', 'Android must not access the browser window');
 platform.OS = 'web';
 await payment.redirectToPaynow('https://www.paynow.co.zw/payment/test-web');
 assert.equal(location.href, 'https://www.paynow.co.zw/payment/test-web');
 assert.equal(opened.length, 1);
 platform.OS = 'android';openError = new Error('No browser available');
 await assert.rejects(payment.redirectToPaynow('https://www.paynow.co.zw/payment/test-error'), /No browser available/);
 console.log('PASS: encrypted storage, cold login/logout, native tap-to-focus and read-only fields, mobile PKCE handoff without a browser exchange, OAuth/deep links, photo permissions and payment navigation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
