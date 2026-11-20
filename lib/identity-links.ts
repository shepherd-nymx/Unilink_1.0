const portals = new Set(['customer', 'driver']);
const webHosts = new Set(['unilinkbase.com', 'www.unilinkbase.com']);

/** HTTPS handoff pages never exchange a mobile PKCE code in the browser. */
export function isNativeAuthBridgeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const match = /^\/(customer|driver)\/identity-callback$/.exec(url.pathname);
    return url.protocol === 'https:' && webHosts.has(url.hostname) &&
      !!match && portals.has(match[1]) && url.searchParams.get('native') === '1';
  } catch {
    return false;
  }
}

export function nativeIdentityReturnUrl(value: string): string | null {
  if (!isNativeAuthBridgeUrl(value)) return null;
  const url = new URL(value);
  const portal = url.pathname.split('/')[1];
  const fragment = new URLSearchParams(url.hash.slice(1));
  const read = (key: string) => url.searchParams.get(key) || fragment.get(key);
  const result = new URLSearchParams();
  const error = read('error');
  const description = read('error_description');
  const code = read('code');
  if (error || description) {
    result.set('error', error || 'sign_in_failed');
    if (description) result.set('error_description', description);
    const errorCode = read('error_code');
    if (errorCode) result.set('error_code', errorCode);
  } else if (code && code.length <= 4096) {
    result.set('code', code);
  } else {
    return null;
  }
  // The destination is fixed; never forward arbitrary URLs or session tokens.
  return `unilink:///${portal}/identity-callback?${result}`;
}
