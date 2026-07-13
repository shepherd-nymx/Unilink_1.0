import { Platform } from 'react-native';

export type UserType = 'driver' | 'customer' | 'admin';

export interface SessionData {
  id: string;
  type: UserType;
  name?: string;
  expiresAt: number;
}

const SESSION_KEY = 'unilink_session_v2';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let _memorySession: SessionData | null = null;
let _asyncStorage: any = null;

async function getAsyncStorage() {
  if (_asyncStorage) return _asyncStorage;
  if (Platform.OS !== 'web') {
    try {
      const mod = await import('@react-native-async-storage/async-storage');
      _asyncStorage = mod.default;
      return _asyncStorage;
    } catch {
      return null;
    }
  }
  return null;
}

export async function saveSession(data: Omit<SessionData, 'expiresAt'>): Promise<void> {
  const session: SessionData = {
    ...data,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  _memorySession = session;
  const raw = JSON.stringify(session);

  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(SESSION_KEY, raw);
    } catch {}
    return;
  }

  const storage = await getAsyncStorage();
  if (storage) {
    try {
      await storage.setItem(SESSION_KEY, raw);
    } catch {}
  }
}

export async function loadSession(): Promise<SessionData | null> {
  if (_memorySession) {
    if (_memorySession.expiresAt > Date.now()) return _memorySession;
    _memorySession = null;
  }

  let raw: string | null = null;

  if (Platform.OS === 'web') {
    try {
      raw = localStorage.getItem(SESSION_KEY);
    } catch {}
  } else {
    const storage = await getAsyncStorage();
    if (storage) {
      try {
        raw = await storage.getItem(SESSION_KEY);
      } catch {}
    }
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed.id || !parsed.type) return null;
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      await clearSession();
      return null;
    }
    _memorySession = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  _memorySession = null;

  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
    return;
  }

  const storage = await getAsyncStorage();
  if (storage) {
    try {
      await storage.removeItem(SESSION_KEY);
    } catch {}
  }
}

export async function refreshSession(): Promise<boolean> {
  const session = await loadSession();
  if (!session) return false;
  await saveSession({ id: session.id, type: session.type, name: session.name });
  return true;
}

export function getMemorySession(): SessionData | null {
  if (_memorySession && _memorySession.expiresAt > Date.now()) return _memorySession;
  return null;
}
