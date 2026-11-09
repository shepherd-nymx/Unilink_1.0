import { supabase } from './supabase';
import { saveUserData } from './storage-service';
import { registerForPushNotificationsOnLogin } from './notification-service';
import { registerDeviceToken } from './device-token-service';

export interface CustomerIdentityProfile { id: string; full_name: string; email: string }
export function customerCallbackUrl() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.unilinkbase.com';
  return `${origin}/customer/identity-callback`;
}
export async function verifiedCustomerIdentity() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email_confirmed_at) return null;
  return data.user;
}
export async function identityCustomerProfile(): Promise<CustomerIdentityProfile | null> {
  const { data, error } = await supabase.rpc('customer_identity_profile');
  if (error) throw error;
  return data;
}
export async function enterCustomerPortal(profile: CustomerIdentityProfile) {
  // Restore the portal's existing anon/custom-session data behavior after identity verification.
  await supabase.auth.signOut({ scope: 'local' });
  saveUserData({ id: profile.id, type: 'customer', name: profile.full_name });
  void registerForPushNotificationsOnLogin(profile.id, 'customer').catch(() => {});
  void registerDeviceToken(profile.id).catch(() => {});
  return { pathname: '/customer/dashboard' as const, params: { customerId: profile.id, customerName: profile.full_name } };
}
