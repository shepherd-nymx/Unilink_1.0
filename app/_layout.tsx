import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import CustomerNavigation from '@/components/CustomerNavigation';
import * as Notifications from 'expo-notifications';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { checkAndApplyUpdate } from '@/lib/version-service';
import { loadSession } from '@/lib/session-service';
import { registerDeviceToken } from '@/lib/device-token-service';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10B981',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync('deliveries', {
    name: 'New Deliveries',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#10B981',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3B82F6',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

async function requestAndRegister(userId: string | null): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted' && existing !== 'denied') {
      const { status: requested } = await Notifications.requestPermissionsAsync();
      status = requested;
    }
    if (status === 'granted') {
      await registerDeviceToken(userId);
    }
  } catch {}
}

function RootNavigator() {
  const { isDark } = useTheme();
  const router = useRouter();
  const notificationResponseListener = useRef<Notifications.Subscription | null>(null);
  const sessionRestored = useRef(false);

  useEffect(() => {
    if (sessionRestored.current) return;
    sessionRestored.current = true;

    (async () => {
      try {
        await setupAndroidChannel();

        const session = await loadSession();

        await requestAndRegister(session?.id ?? null);

        if (!session) return;

        if (session.type === 'customer') {
          router.replace({
            pathname: '/customer/dashboard',
            params: { customerId: session.id, customerName: session.name || '' },
          });
        } else if (session.type === 'driver') {
          router.replace({
            pathname: '/driver/dashboard',
            params: { driverId: session.id, driverName: session.name || '' },
          });
        } else if (session.type === 'admin') {
          router.replace({ pathname: '/admin/dashboard' });
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as any;
        if (!data) return;

        if (data.type === 'order_status' && data.customerId) {
          router.push({
            pathname: '/customer/orders',
            params: { customerId: data.customerId },
          });
        } else if (data.type === 'new_message') {
          if (data.senderType === 'customer' && data.driverId) {
            router.push({
              pathname: '/driver/chat',
              params: { driverId: data.driverId, driverName: '' },
            });
          } else if (data.senderType === 'driver' && data.customerId) {
            router.push({
              pathname: '/customer/chat',
              params: { customerId: data.customerId, customerName: '' },
            });
          }
        } else if (data.type === 'new_delivery') {
          loadSession().then((s) => {
            if (s?.type === 'driver') {
              router.push({
                pathname: '/driver/dashboard',
                params: { driverId: s.id, driverName: s.name || '' },
              });
            }
          }).catch(() => {});
        }
      });

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, []);

  return (
    <>
      <View style={{ flex: 1, minHeight: 0 }}>
        <View style={{ flex: 1, minHeight: 0 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="+not-found" />
          </Stack>
        </View>
        <CustomerNavigation />
      </View>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .catch(() => {});
    }

    checkAndApplyUpdate();
  }, []);

  return (
    <ThemeProvider>
      <NotificationProvider>
        <RootNavigator />
      </NotificationProvider>
    </ThemeProvider>
  );
}
