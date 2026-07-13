import { Platform } from 'react-native';
import { saveSession, loadSession, clearSession, type SessionData } from './session-service';

export type UserType = 'driver' | 'customer' | 'admin';

export interface StoredUserData {
  id: string;
  type: UserType;
  name?: string;
}

const THEME_KEY = 'theme';

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

export function saveUserData(data: StoredUserData): void {
  saveSession({ id: data.id, type: data.type, name: data.name }).catch(() => {});

  if (!isWeb()) return;
  try {
    localStorage.setItem('userData', JSON.stringify({ id: data.id, type: data.type }));
  } catch {}
}

export function loadUserData(): StoredUserData | null {
  if (!isWeb()) return null;
  try {
    const raw = localStorage.getItem('userData');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUserData>;
    if (parsed.id && parsed.type) return parsed as StoredUserData;
    return null;
  } catch {
    return null;
  }
}

export async function loadUserDataAsync(): Promise<StoredUserData | null> {
  const session = await loadSession();
  if (!session) return null;
  return { id: session.id, type: session.type, name: session.name };
}

export function clearUserData(): void {
  clearSession().catch(() => {});
  if (!isWeb()) return;
  try {
    localStorage.removeItem('userData');
  } catch {}
}

export function saveTheme(theme: string): void {
  if (!isWeb()) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

export function loadTheme(): string | null {
  if (!isWeb()) return null;
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function getNotificationPermissionKey(userType: UserType): string {
  return `notification_permission_asked_${userType}`;
}

export function hasAskedNotificationPermission(userType: UserType): boolean {
  if (!isWeb()) return false;
  try {
    return localStorage.getItem(getNotificationPermissionKey(userType)) === 'true';
  } catch {
    return false;
  }
}

export function markNotificationPermissionAsked(userType: UserType): void {
  if (!isWeb()) return;
  try {
    localStorage.setItem(getNotificationPermissionKey(userType), 'true');
  } catch {}
}

const FIRST_VISIT_KEY = 'first_visit_notified';

export function isFirstVisit(): boolean {
  if (!isWeb()) return false;
  try {
    return localStorage.getItem(FIRST_VISIT_KEY) !== 'true';
  } catch {
    return false;
  }
}

export function markFirstVisitDone(): void {
  if (!isWeb()) return;
  try {
    localStorage.setItem(FIRST_VISIT_KEY, 'true');
  } catch {}
}
