import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

let consumedCode: string | null = null;
const pendingExchanges = new Map<string, Promise<void>>();

export function identityCallbackUrl(portal: 'customer' | 'driver') {
 if (Platform.OS !== 'web') return Linking.createURL(`/${portal}/identity-callback`, { scheme: 'unilink', isTripleSlashed: true });
 const origin = portal === 'driver' ? 'https://unilinkbase.com' : typeof window !== 'undefined' && window.location ? window.location.origin : 'https://www.unilinkbase.com';
 return `${origin}/${portal}/identity-callback`;
}

export async function acceptIdentityRedirect(url: string | null) {
 if (!url) return;
 const parsed = new URL(url);
 const query = parsed.searchParams, fragment = new URLSearchParams(parsed.hash.slice(1));
 const error = query.get('error_description') || fragment.get('error_description') || query.get('error') || fragment.get('error');
 if (error) throw new Error(error);
 const code = query.get('code');
 if (!code) return;
 const pending = pendingExchanges.get(code);
 if (pending) return pending;
 const exchange = (async () => {
  const { data } = await supabase.auth.getSession();
  if (consumedCode === code || (data.session && Platform.OS === 'web')) return;
  const result = await supabase.auth.exchangeCodeForSession(code);
  if (result.error) throw result.error;
  consumedCode = code;
 })();
 pendingExchanges.set(code, exchange);
 try { await exchange; } finally { pendingExchanges.delete(code); }
}

export async function acceptCurrentIdentityRedirect(portal: 'customer' | 'driver', params?: { code?: unknown; error_description?: unknown; error?: unknown }) {
 const error = params?.error_description || params?.error;
 if (typeof error === 'string') throw new Error(error);
 if (typeof params?.code === 'string') {
  await acceptIdentityRedirect(`${identityCallbackUrl(portal)}?code=${encodeURIComponent(params.code)}`);
  return;
 }
 const url = Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.location.href : null) : await Linking.getInitialURL();
 await acceptIdentityRedirect(url);
}
