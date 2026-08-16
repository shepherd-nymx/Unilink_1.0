import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

export type UserType = 'customer' | 'driver';

interface DeviceInfo {
  platform: string;
  model?: string;
  osVersion?: string;
  appVersion?: string;
}

let _cachedToken: string | null = null;
let _tokenUserId: string | null = null;

export async function getExpoPushToken(forceRefresh = false): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return null;
    }

    if (_cachedToken && !forceRefresh) {
      return _cachedToken;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('No EAS project ID found');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    _cachedToken = token.data;
    return token.data;
  } catch (error) {
    console.error('Error getting Expo push token:', error);
    return null;
  }
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  return {
    platform: Platform.OS,
    model: Constants.deviceName || 'unknown',
    osVersion: Platform.Version?.toString() || 'unknown',
    appVersion: Constants.expoConfig?.version || '1.0.0',
  };
}

export async function getWebPushToken(): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        return null;
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    }

    return JSON.stringify(subscription);
  } catch (err) {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerFCMToken(
  userId: string,
  userType: UserType,
  forceRefresh = false
): Promise<boolean> {
  try {
    let token: string | null = null;

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !('Notification' in window)) return false;
      if (Notification.permission !== 'granted') return false;
      token = await getWebPushToken();
    } else {
      token = await getExpoPushToken(forceRefresh);
    }

    if (!token) {
      return false;
    }

    if (_tokenUserId && _tokenUserId !== userId && !forceRefresh) {
      forceRefresh = true;
    }
    _tokenUserId = userId;

    const deviceInfo = await getDeviceInfo();

    const { error } = await supabase.rpc('upsert_fcm_token', {
      p_user_id: userId,
      p_user_type: userType,
      p_token: token,
      p_device_info: { ...deviceInfo, platform: Platform.OS },
    });

    if (error) {
      console.error('Error registering FCM token:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in registerFCMToken:', error);
    return false;
  }
}

export async function refreshTokenOnLogin(userId: string, userType: UserType): Promise<void> {
  _cachedToken = null;
  await registerFCMToken(userId, userType, true);
}

export async function unregisterFCMToken(
  userId: string,
  token?: string
): Promise<boolean> {
  try {
    let tokenToRemove: string | null | undefined = token;

    if (!tokenToRemove) {
      tokenToRemove = Platform.OS === 'web'
        ? await getWebPushToken()
        : await getExpoPushToken();
    }

    if (!tokenToRemove) {
      return false;
    }

    const { error } = await supabase
      .from('fcm_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', tokenToRemove);

    if (error) {
      console.error('Error unregistering FCM token:', error);
      return false;
    }

    _cachedToken = null;
    _tokenUserId = null;
    return true;
  } catch (error) {
    console.error('Error in unregisterFCMToken:', error);
    return false;
  }
}

export async function updateTokenLastUsed(userId: string): Promise<void> {
  try {
    const token = Platform.OS === 'web'
      ? await getWebPushToken()
      : await getExpoPushToken();

    if (!token) return;

    await supabase
      .from('fcm_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token', token);
  } catch (error) {
    console.error('Error updating token last used:', error);
  }
}

export async function deactivateStaleTokens(userId: string): Promise<void> {
  try {
    const staleThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('fcm_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .lt('last_used_at', staleThreshold)
      .eq('is_active', true);
  } catch (error) {
    console.error('Error deactivating stale tokens:', error);
  }
}

export async function getUserTokens(
  userId: string,
  userType: UserType
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('user_type', userType)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching user tokens:', error);
      return [];
    }

    return data.map((item) => item.token);
  } catch (error) {
    console.error('Error in getUserTokens:', error);
    return [];
  }
}

export async function sendPushNotification(
  userIds: string[],
  userType: UserType,
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { userIds, userType, title, body, data },
    });

    if (error) {
      console.error('Error sending push notification:', error);
      await queueFailedNotification(userIds, userType, title, body, data);
    }
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    await queueFailedNotification(userIds, userType, title, body, data);
  }
}

async function queueFailedNotification(
  userIds: string[],
  userType: UserType,
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    const rows = userIds.map((uid) => ({
      user_id: uid,
      user_type: userType,
      title,
      body,
      data: data || {},
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
      status: 'pending',
      last_error: 'Network error during initial send',
    }));
    await supabase.from('notification_queue').insert(rows);
  } catch (err) {
    console.error('Error queuing notification:', err);
  }
}

export async function drainNotificationQueue(): Promise<void> {
  try {
    const { data: pending } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .lt('attempt_count', 5)
      .order('next_retry_at', { ascending: true })
      .limit(20);

    if (!pending || pending.length === 0) return;

    for (const item of pending) {
      await supabase
        .from('notification_queue')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', item.id);

      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userIds: [item.user_id],
          userType: item.user_type,
          title: item.title,
          body: item.body,
          data: item.data,
          queueId: item.id,
        },
      });

      if (error) {
        const nextDelay = Math.min(30 * Math.pow(2, item.attempt_count), 3600);
        await supabase
          .from('notification_queue')
          .update({
            status: item.attempt_count + 1 >= 5 ? 'failed' : 'pending',
            attempt_count: item.attempt_count + 1,
            last_error: error.message,
            next_retry_at: new Date(Date.now() + nextDelay * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
      }
    }
  } catch (err) {
    console.error('Error draining notification queue:', err);
  }
}
