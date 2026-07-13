import { useState, useEffect, useCallback } from 'react';
import { loadSession, clearSession, refreshSession, type SessionData } from '@/lib/session-service';
import { registerDeviceToken } from '@/lib/device-token-service';
import { registerForPushNotificationsOnLogin } from '@/lib/notification-service';

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

      if (!stored) {
        setStatus('unauthenticated');
        setSession(null);
        return;
      }

      await refreshSession();

      if (stored.type !== 'admin') {
        registerForPushNotificationsOnLogin(stored.id, stored.type as 'driver' | 'customer').catch(() => {});
        registerDeviceToken(stored.id).catch(() => {});
      }

      setSession(stored);
      setStatus('authenticated');
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
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  return { status, session, signOut };
}
