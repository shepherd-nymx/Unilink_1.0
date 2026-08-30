import { useState, useEffect, useCallback } from 'react';
import { loadSession, clearSession, refreshSession, type SessionData } from '@/lib/session-service';
import { registerDeviceToken } from '@/lib/device-token-service';
import { registerForPushNotificationsOnLogin } from '@/lib/notification-service';
import { supabase } from '@/lib/supabase';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface UseSessionResult {
  status: SessionStatus;
  session: SessionData | null;
  signOut: () => Promise<void>;
}

export function useSession(): UseSessionResult {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [session, setSession] = useState<SessionData | null>(null);

  const restoreSession = useCallback(async () => {
    try {
      const stored = await loadSession();

      if (stored) {
        await refreshSession();

        if (stored.type !== 'admin') {
          registerForPushNotificationsOnLogin(stored.id, stored.type as 'driver' | 'customer').catch(() => {});
          registerDeviceToken(stored.id).catch(() => {});
        }

        setSession(stored);
        setStatus('authenticated');
        return;
      }

      // No custom session — check if there's an active Supabase Auth session
      // (e.g. customer who logged in via Supabase Auth and reloads the page)
      const { data: authData } = await supabase.auth.getSession();
      if (authData.session?.user) {
        const authUser = authData.session.user;
        // Look up the customer record linked to this auth user
        const { data: customer } = await supabase
          .from('customers')
          .select('id, full_name')
          .eq('auth_id', authUser.id)
          .maybeSingle();

        if (customer) {
          const newSession: Omit<SessionData, 'expiresAt'> = {
            id: customer.id,
            type: 'customer',
            name: customer.full_name,
          };
          const { saveSession } = await import('@/lib/session-service');
          await saveSession(newSession);
          registerForPushNotificationsOnLogin(customer.id, 'customer').catch(() => {});
          registerDeviceToken(customer.id).catch(() => {});
          setSession({ ...newSession, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
          setStatus('authenticated');
          return;
        }
      }

      setStatus('unauthenticated');
      setSession(null);
    } catch {
      setStatus('unauthenticated');
      setSession(null);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const signOut = useCallback(async () => {
    await clearSession();
    try {
      await supabase.auth.signOut();
    } catch {}
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  return { status, session, signOut };
}
