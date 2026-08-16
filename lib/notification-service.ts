import * as Notifications from 'expo-notifications';
import { Platform, AppState, AppStateStatus } from 'react-native';
import {
  registerFCMToken,
  refreshTokenOnLogin,
  updateTokenLastUsed,
  drainNotificationQueue,
  type UserType,
} from './fcm-service';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let currentUserId: string | null = null;
let currentUserType: UserType | null = null;
let _appStateSubscription: any = null;
let _swRegistration: ServiceWorkerRegistration | null = null;

async function playNotificationSound(type: 'message' | 'delivery' | 'default' = 'default') {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        const playTone = (freq: number, startTime: number, duration: number, gain: number, type: OscillatorType = 'sine') => {
          const osc = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          const compressor = audioContext.createDynamicsCompressor();

          osc.type = type;
          osc.frequency.setValueAtTime(freq, startTime);
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

          osc.connect(gainNode);
          gainNode.connect(compressor);
          compressor.connect(audioContext.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        const t = audioContext.currentTime;

        if (type === 'message') {
          playTone(880, t, 0.12, 0.9, 'sine');
          playTone(880, t, 0.12, 0.5, 'square');
          playTone(1320, t + 0.13, 0.18, 0.9, 'sine');
          playTone(1320, t + 0.13, 0.18, 0.4, 'square');
          playTone(1760, t + 0.32, 0.25, 1.0, 'sine');
          playTone(1760, t + 0.32, 0.25, 0.4, 'square');
        } else if (type === 'delivery') {
          playTone(440, t, 0.15, 0.9, 'sawtooth');
          playTone(660, t + 0.18, 0.15, 0.9, 'sawtooth');
          playTone(880, t + 0.36, 0.15, 0.9, 'sawtooth');
          playTone(1100, t + 0.54, 0.25, 1.0, 'sawtooth');
        } else {
          playTone(660, t, 0.12, 0.8, 'sine');
          playTone(880, t + 0.13, 0.2, 0.9, 'sine');
        }
      }
    }
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
}

async function ensureServiceWorkerRegistered(): Promise<ServiceWorkerRegistration | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    if (_swRegistration) return _swRegistration;

    const registrations = await navigator.serviceWorker.getRegistrations();
    const existing = registrations.find((r) => r.active || r.installing || r.waiting);

    if (existing) {
      _swRegistration = existing;
    } else {
      _swRegistration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none',
      });
    }

    _swRegistration.addEventListener('updatefound', () => {
      const newWorker = _swRegistration?.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      _swRegistration = null;
    });

    await navigator.serviceWorker.ready;
    return _swRegistration;
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return null;
  }
}

export function setCurrentUser(userId: string, userType: UserType): void {
  currentUserId = userId;
  currentUserType = userType;
}

export async function registerForPushNotificationsAsync(
  userId?: string,
  userType?: UserType
): Promise<string | null> {
  const uid = userId || currentUserId;
  const utype = userType || currentUserType;

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) return null;

    let permission = Notification.permission;
    if (permission !== 'granted' && permission !== 'denied') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') return null;

    await ensureServiceWorkerRegistered();

    if (uid && utype) {
      await registerFCMToken(uid, utype);
    }

    return 'granted';
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (uid && utype) {
    await registerFCMToken(uid, utype);
  }

  return 'granted';
}

export async function registerForPushNotificationsOnLogin(
  userId: string,
  userType: UserType
): Promise<string | null> {
  currentUserId = userId;
  currentUserType = userType;

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) return null;

    let permission = Notification.permission;
    if (permission !== 'granted' && permission !== 'denied') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') return null;

    await ensureServiceWorkerRegistered();
    await refreshTokenOnLogin(userId, userType);
    return 'granted';
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  await refreshTokenOnLogin(userId, userType);
  return 'granted';
}

export async function updateUserTokenActivity(): Promise<void> {
  if (currentUserId) {
    await updateTokenLastUsed(currentUserId);
  }
}

export function startAppStateTokenRefresh(): () => void {
  if (Platform.OS === 'web') {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && currentUserId && currentUserType) {
        await updateTokenLastUsed(currentUserId);
        await drainNotificationQueue();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }

  const handleAppState = async (nextState: AppStateStatus) => {
    if (nextState === 'active' && currentUserId && currentUserType) {
      await updateTokenLastUsed(currentUserId);
      await drainNotificationQueue();
    }
  };

  if (_appStateSubscription) {
    _appStateSubscription.remove();
  }
  _appStateSubscription = AppState.addEventListener('change', handleAppState);
  return () => {
    if (_appStateSubscription) {
      _appStateSubscription.remove();
      _appStateSubscription = null;
    }
  };
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: any
): Promise<void> {
  const notificationType: 'message' | 'delivery' | 'default' =
    data?.type === 'new_message' ? 'message' :
    data?.type === 'new_delivery' ? 'delivery' : 'default';

  await playNotificationSound(notificationType);

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const showViaServiceWorker = async (reg: ServiceWorkerRegistration) => {
      if (reg.active) {
        reg.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: {
            title,
            body,
            data,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: data?.type || 'unilink-notification',
          },
        });
      } else {
        new Notification(title, { body, icon: '/icon-192.png', silent: false });
      }
    };

    if (Notification.permission === 'granted') {
      const reg = await ensureServiceWorkerRegistered();
      if (reg) {
        await showViaServiceWorker(reg);
      } else {
        new Notification(title, { body, icon: '/icon-192.png', silent: false });
      }
      return;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const reg = await ensureServiceWorkerRegistered();
        if (reg) {
          await showViaServiceWorker(reg);
        } else {
          new Notification(title, { body, icon: '/icon-192.png', silent: false });
        }
      }
    }
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  });
}

export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseReceivedListener(
  listener: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export async function cancelAllNotificationsAsync(): Promise<void> {
  if (Platform.OS !== 'web') {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}
