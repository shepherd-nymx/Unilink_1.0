import { supabase } from './supabase';

const SHOP_SESSION_KEY = 'unilink_shop_session';
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export interface ShopSessionData {
  shopId: string;
  ownerId: string;
  email: string;
  shopName: string;
  shopStatus: string;
  expiresAt: number;
}

let _memorySession: ShopSessionData | null = null;

export async function saveShopSession(data: Omit<ShopSessionData, 'expiresAt'>): Promise<void> {
  const session: ShopSessionData = {
    ...data,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  _memorySession = session;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SHOP_SESSION_KEY, JSON.stringify(session));
    }
  } catch {}
}

export async function loadShopSession(): Promise<ShopSessionData | null> {
  if (_memorySession) {
    if (_memorySession.expiresAt > Date.now()) return _memorySession;
    _memorySession = null;
    return null;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SHOP_SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as ShopSessionData;
      if (session.expiresAt <= Date.now()) {
        localStorage.removeItem(SHOP_SESSION_KEY);
        return null;
      }
      _memorySession = session;
      return session;
    }
  } catch {}
  return null;
}

export function getMemoryShopSession(): ShopSessionData | null {
  if (_memorySession && _memorySession.expiresAt > Date.now()) return _memorySession;
  return null;
}

export async function refreshShopSession(): Promise<void> {
  const session = await loadShopSession();
  if (session) {
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    _memorySession = session;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SHOP_SESSION_KEY, JSON.stringify(session));
      }
    } catch {}
  }
}

export async function clearShopSession(): Promise<void> {
  _memorySession = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SHOP_SESSION_KEY);
    }
  } catch {}
  try {
    await supabase.auth.signOut();
  } catch {}
}
