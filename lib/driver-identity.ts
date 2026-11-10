import { supabase } from './supabase';
export type DriverIdentityProfile = { id: string; full_name: string; email: string; approval_status: 'pending'|'approved'|'rejected' };
// The configured Supabase Site URL permits apex-domain callbacks. Apex redirects
// to www while preserving the callback path and OAuth fragment in the browser.
export function driverCallbackUrl() { return 'https://unilinkbase.com/driver/identity-callback'; }
export async function driverIdentityProfile(): Promise<DriverIdentityProfile|null> {
  const {data,error}=await supabase.rpc('driver_identity_profile');
  if(error)throw error;
  return data;
}
