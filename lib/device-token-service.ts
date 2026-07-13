import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

export type NotificationPlatform = 'android' | 'ios' | 'web';

export interface DeviceTokenRow {
  id: string;
  device_id: string;
  push_token: string;
  platform: NotificationPlatform;
  last_active: string;
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

let _cachedDeviceId: string | null = null;
let _cachedPushToken: string | null = null;

function getStableDeviceId(): string {
  if (_cachedDeviceId) return _cachedDeviceId;

  if (Platform.OS === 'web') {
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem('_unilink_device_id')
      : null;
    if (stored) {
      _cachedDeviceId = stored;
      return stored;
    }
    const generated = 'web-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('_unilink_device_id', generated);
    }
    _cachedDeviceId = generated;
    return generated;
  }

  const nativeId =
    Constants.sessionId ||
    Constants.deviceName ||
    Constants.expoConfig?.name + '-unknown';

  const suffix = (Constants.expoConfig?.version || '1').replace(/\./g, '');
  _cachedDeviceId = `${Platform.OS}-${nativeId}-${suffix}`;
  return _cachedDeviceId;
}

async function getNativePushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  if (_cachedPushToken) return _cachedPushToken;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[DeviceTokenService] No EAS projectId configured');
      return null;
    }

    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    _cachedPushToken = result.data;
    return result.data;
  } catch (err) {
    console.error('[DeviceTokenService] Failed to get native push token:', err);
    return null;
  }
}

async function getWebPushToken(): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return null;
      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(base64);
      const key = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
    return JSON.stringify(sub);
  } catch (err) {
    return null;
  }
}

export async function registerDeviceToken(userId: string | null): Promise<boolean> {
  try {
    const deviceId = getStableDeviceId();
    const platform: NotificationPlatform = Platform.OS === 'web'
      ? 'web'
      : Platform.OS === 'ios' ? 'ios' : 'android';

    const pushToken = Platform.OS === 'web'
      ? await getWebPushToken()
      : await getNativePushToken();

    if (!pushToken) return false;

    _cachedPushToken = pushToken;

    const { error } = await supabase.rpc('upsert_device_token', {
      p_user_id: userId,
      p_device_id: deviceId,
      p_push_token: pushToken,
      p_platform: platform,
    });

    if (error) {
      console.error('[DeviceTokenService] upsert_device_token error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[DeviceTokenService] registerDeviceToken error:', err);
    return false;
  }
}

export async function refreshDeviceTokenOnLogin(userId: string): Promise<void> {
  _cachedPushToken = null;
  await registerDeviceToken(userId);
}

export async function unregisterCurrentDevice(userId: string): Promise<void> {
  try {
    const deviceId = getStableDeviceId();
    await supabase
      .from('device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);
    _cachedPushToken = null;
  } catch (err) {
    console.error('[DeviceTokenService] unregisterCurrentDevice error:', err);
  }
}

export async function getUserDeviceTokens(userId: string): Promise<DeviceTokenRow[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_push_tokens', {
      p_user_id: userId,
    });
    if (error) {
      console.error('[DeviceTokenService] get_user_push_tokens error:', error);
      return [];
    }
    return (data as DeviceTokenRow[]) || [];
  } catch (err) {
    console.error('[DeviceTokenService] getUserDeviceTokens error:', err);
    return [];
  }
}

export async function getActiveDriverTokens(): Promise<DeviceTokenRow[]> {
  try {
    const { data, error } = await supabase
      .from('active_driver_tokens')
      .select('id, user_id, device_id, push_token, platform, last_active');
    if (error) {
      console.error('[DeviceTokenService] getActiveDriverTokens error:', error);
      return [];
    }
    return (data as DeviceTokenRow[]) || [];
  } catch (err) {
    console.error('[DeviceTokenService] getActiveDriverTokens error:', err);
    return [];
  }
}

export async function sendToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const tokens = await getUserDeviceTokens(userId);
    if (tokens.length === 0) continue;

    const messages: PushMessage[] = tokens
      .filter((t) => t.platform !== 'web' && t.push_token.startsWith('ExponentPushToken'))
      .map((t) => ({
        to: t.push_token,
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }));

    if (messages.length === 0) continue;

    const result = await sendToExpo(messages);
    sent += result.sent;
    failed += result.failed;
  }

  return { sent, failed };
}

export async function broadcastToAllDrivers(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  const tokens = await getActiveDriverTokens();
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const messages: PushMessage[] = tokens
    .filter((t) => t.platform !== 'web' && t.push_token.startsWith('ExponentPushToken'))
    .map((t) => ({
      to: t.push_token,
      title,
      body,
      data: data || {},
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    }));

  return sendToExpo(messages);
}

async function sendToExpo(
  messages: PushMessage[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const CHUNK_SIZE = 100;
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        console.error('[DeviceTokenService] Expo HTTP error:', res.status);
        failed += chunk.length;
        continue;
      }

      const json: { data: ExpoTicket[] } = await res.json();
      const tickets = json.data || [];

      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (ticket.status === 'ok') {
          sent++;
        } else {
          failed++;
          const errCode = ticket.details?.error;
          if (errCode === 'DeviceNotRegistered' || errCode === 'InvalidCredentials') {
            const token = chunk[j]?.to;
            if (token) {
              await removeInvalidToken(token);
            }
          }
        }
      }
    } catch (err) {
      console.error('[DeviceTokenService] sendToExpo chunk error:', err);
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

export async function removeInvalidToken(pushToken: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('remove_invalid_token', {
      p_push_token: pushToken,
    });
    if (error) {
      console.error('[DeviceTokenService] remove_invalid_token error:', error);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error('[DeviceTokenService] removeInvalidToken error:', err);
    return false;
  }
}

export async function checkReceiptsAndCleanup(
  ticketIds: string[]
): Promise<void> {
  if (ticketIds.length === 0) return;

  const CHUNK_SIZE = 300;
  for (let i = 0; i < ticketIds.length; i += CHUNK_SIZE) {
    const chunk = ticketIds.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch(EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids: chunk }),
      });

      if (!res.ok) continue;

      const json: { data: Record<string, ExpoReceipt> } = await res.json();
      const receipts = json.data || {};

      for (const [, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'error') {
          const errCode = receipt.details?.error;
          if (errCode === 'DeviceNotRegistered') {
            console.warn('[DeviceTokenService] DeviceNotRegistered in receipt — token already cleaned up at ticket stage');
          }
        }
      }
    } catch (err) {
      console.error('[DeviceTokenService] checkReceipts error:', err);
    }
  }
}

export async function runTokenCleanup(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_old_tokens');
    if (error) {
      console.error('[DeviceTokenService] cleanup_old_tokens error:', error);
      return 0;
    }
    return (data as number) || 0;
  } catch (err) {
    console.error('[DeviceTokenService] runTokenCleanup error:', err);
    return 0;
  }
}
