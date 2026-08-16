import { useState, useEffect, useCallback } from 'react';
import {
  loadShopSession,
  refreshShopSession,
  clearShopSession,
  type ShopSessionData,
} from '@/lib/shop-session-service';

export function useShopSession() {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [session, setSession] = useState<ShopSessionData | null>(null);

  const restoreSession = useCallback(async () => {
    const stored = await loadShopSession();
    if (!stored) {
      setStatus('unauthenticated');
      return;
    }
    await refreshShopSession();
    setSession(stored);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const signOut = useCallback(async () => {
    await clearShopSession();
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  return { status, session, signOut, restoreSession };
}
