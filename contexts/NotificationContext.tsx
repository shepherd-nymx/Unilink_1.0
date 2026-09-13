import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { loadUserData, loadUserDataAsync } from '@/lib/storage-service';
import {
  registerForPushNotificationsAsync,
  registerForPushNotificationsOnLogin,
  scheduleLocalNotification,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  startAppStateTokenRefresh,
  setCurrentUser,
} from '@/lib/notification-service';
import { sendPushNotification, drainNotificationQueue } from '@/lib/fcm-service';
import { registerDeviceToken } from '@/lib/device-token-service';

const SHOP_STATUS_LABELS: Record<string, string> = {
  pending: 'Order received',
  confirmed: 'Order confirmed',
  preparing: 'Being prepared',
  ready: 'Ready for pickup',
  picked_up: 'Picked up by messenger',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export type InAppMessage = {
  title: string;
  body: string;
  data?: any;
};

interface NotificationContextType {
  unreadMessageCount: number;
  pendingDeliveriesCount: number;
  pendingRequestsCount: number;
  hasNotificationPermission: boolean;
  inAppMessage: InAppMessage | null;
  clearInAppMessage: () => void;
  refreshUnreadCount: () => Promise<void>;
  refreshPendingDeliveries: () => Promise<void>;
  refreshPendingRequests: () => Promise<void>;
  requestNotificationPermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pendingDeliveriesCount, setPendingDeliveriesCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [inAppMessage, setInAppMessage] = useState<InAppMessage | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userType, setUserType] = useState<'driver' | 'customer' | 'admin' | 'shop' | null>(null);
  const subscriptionsRef = useRef<any[]>([]);
  const prevUserIdRef = useRef<string | null>(null);

  const clearInAppMessage = useCallback(() => setInAppMessage(null), []);

  const syncUserFromStorage = useCallback(() => {
    if (Platform.OS !== 'web') {
      loadUserDataAsync().then((data) => {
        if (data) {
          setUserId(data.id);
          setUserType(data.type as 'driver' | 'customer' | 'admin');
        } else {
          setUserId(null);
          setUserType(null);
        }
      }).catch(() => {});
      return;
    }
    const data = loadUserData();
    if (data) {
      setUserId(data.id);
      setUserType(data.type as 'driver' | 'customer' | 'admin');
    } else {
      setUserId(null);
      setUserType(null);
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    const permission = await registerForPushNotificationsAsync();
    setHasNotificationPermission(permission === 'granted');
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId || !userType || userType === 'admin') return;
    try {
      const { data, error } = await supabase.rpc('get_unread_message_count', {
        p_user_id: userId,
        p_user_type: userType,
      });
      if (!error && data !== null) setUnreadMessageCount(data);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [userId, userType]);

  const refreshPendingDeliveries = useCallback(async () => {
    if (!userId || userType !== 'driver') return;
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .is('driver_id', null);
      if (!error && data !== null) {
        setPendingDeliveriesCount((data as any).length || 0);
      }
    } catch (error) {
      console.error('Error fetching pending deliveries:', error);
    }
  }, [userId, userType]);

  const refreshPendingRequests = useCallback(async () => {
    if (!userId || userType !== 'driver') return;
    try {
      const { data, error } = await supabase
        .from('delivery_requests')
        .select('id')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .or(`delivery_mode.eq.open_request,and(delivery_mode.eq.direct,driver_id.eq.${userId})`);
      if (!error) setPendingRequestsCount(data?.length ?? 0);
    } catch {
      // ignore
    }
  }, [userId, userType]);

  useEffect(() => {
    syncUserFromStorage();
  }, [syncUserFromStorage]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'userData') syncUserFromStorage();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncUserFromStorage();
        drainNotificationQueue().catch(() => {});
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'FLUSH_QUEUE' });
        }
      }
    };

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [syncUserFromStorage]);

  useEffect(() => {
    if (!userId || !userType || userType === 'admin') return;

    const isNewUser = prevUserIdRef.current !== userId;
    prevUserIdRef.current = userId;

    setCurrentUser(userId, userType as 'driver' | 'customer');

    if (isNewUser) {
      registerForPushNotificationsOnLogin(userId, userType as 'driver' | 'customer')
        .then((permission) => {
          setHasNotificationPermission(permission === 'granted');
          if (permission === 'granted') {
            drainNotificationQueue().catch(() => {});
            registerDeviceToken(userId).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [userId, userType]);

  useEffect(() => {
    if (!userId || !userType) return;
    const cleanup = startAppStateTokenRefresh();
    return cleanup;
  }, [userId, userType]);

  useEffect(() => {
    subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
    subscriptionsRef.current = [];

    if (!userId || !userType) {
      setUnreadMessageCount(0);
      setPendingDeliveriesCount(0);
      setPendingRequestsCount(0);
      return;
    }

    const notify = async (
      title: string,
      body: string,
      data?: any,
      targetUserIds?: string[],
      targetUserType?: 'customer' | 'driver' | 'shop'
    ) => {
      if (data?.type === 'new_message') {
        setInAppMessage({ title, body, data });
      }
      if (hasNotificationPermission) {
        await scheduleLocalNotification(title, body, data);
      }
      if (targetUserIds && targetUserIds.length > 0 && targetUserType) {
        await sendPushNotification(targetUserIds, targetUserType, title, body, data);
      }
    };

    // ─── ADMIN SUBSCRIPTIONS ────────────────────────────────────────────────
    if (userType === 'admin') {
      const adminDeliveryInsertSub = supabase
        .channel(`admin-delivery-insert-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deliveries' }, async (payload) => {
          const { data: customerData } = await supabase
            .from('customers').select('full_name').eq('id', payload.new.customer_id).maybeSingle();
          const customerName = customerData?.full_name || 'A customer';
          await notify('New Order Placed', `${customerName} placed a new delivery order.`,
            { type: 'new_delivery', deliveryId: payload.new.id });
        })
        .subscribe();
      subscriptionsRef.current.push(adminDeliveryInsertSub);

      const adminDriverInsertSub = supabase
        .channel(`admin-driver-insert-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drivers' }, async (payload) => {
          const driverName = payload.new.full_name || 'A new driver';
          await notify('New Driver Registration', `${driverName} has registered and is awaiting approval.`,
            { type: 'new_driver', driverId: payload.new.id });
        })
        .subscribe();
      subscriptionsRef.current.push(adminDriverInsertSub);

      const adminCustomerInsertSub = supabase
        .channel(`admin-customer-insert-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, async (payload) => {
          const customerName = payload.new.full_name || 'A new customer';
          await notify('New Customer Registered', `${customerName} has created an account.`,
            { type: 'new_customer', customerId: payload.new.id });
        })
        .subscribe();
      subscriptionsRef.current.push(adminCustomerInsertSub);

      const adminDeliveryStatusSub = supabase
        .channel(`admin-delivery-status-${userId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliveries' }, async (payload) => {
          const oldStatus = payload.old.status;
          const newStatus = payload.new.status;
          if (oldStatus === newStatus) return;
          if (newStatus === 'accepted') {
            const { data: driverData } = await supabase
              .from('drivers').select('full_name').eq('id', payload.new.driver_id).maybeSingle();
            const driverName = driverData?.full_name || 'A driver';
            await notify('Order Accepted by Driver', `${driverName} accepted a delivery order.`,
              { type: 'order_accepted', deliveryId: payload.new.id });
          } else if (newStatus === 'delivered') {
            await notify('Order Delivered', 'A delivery order has been completed successfully.',
              { type: 'order_delivered', deliveryId: payload.new.id });
          } else if (newStatus === 'declined') {
            await notify('Order Declined', 'A delivery order was declined by the driver.',
              { type: 'order_declined', deliveryId: payload.new.id });
          }
        })
        .subscribe();
      subscriptionsRef.current.push(adminDeliveryStatusSub);

      return () => {
        subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
        subscriptionsRef.current = [];
      };
    }

    // ─── DRIVER SUBSCRIPTIONS ───────────────────────────────────────────────
    if (userType === 'driver') {
      refreshUnreadCount();
      refreshPendingDeliveries();
      refreshPendingRequests();

      const driverDeliverySub = supabase
        .channel(`driver-delivery-${userId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'deliveries', filter: 'status=eq.pending' },
          async (payload) => {
            refreshPendingDeliveries();
            await notify(
              'New Delivery Available',
              'A new grocery delivery order is waiting for you!',
              { type: 'new_delivery', deliveryId: payload.new.id },
              [userId], 'driver'
            );
          }
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliveries' },
          () => { refreshPendingDeliveries(); }
        )
        .subscribe();
      subscriptionsRef.current.push(driverDeliverySub);

      // Watch delivery_requests for new pending requests (open or direct to this driver)
      const driverRequestSub = supabase
        .channel(`driver-delivery-requests-${userId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'delivery_requests' },
          async (payload) => {
            const r = payload.new;
            const isRelevant =
              r.status === 'pending' &&
              (r.delivery_mode === 'open_request' ||
                (r.delivery_mode === 'direct' && r.driver_id === userId));
            if (!isRelevant) return;
            refreshPendingRequests();
            await notify(
              'New Delivery Request',
              r.delivery_mode === 'direct'
                ? 'A customer has sent you a direct delivery request!'
                : 'A new open delivery request is available.',
              { type: 'new_delivery_request', requestId: r.id },
              [userId], 'driver'
            );
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'delivery_requests' },
          () => { refreshPendingRequests(); }
        )
        .subscribe();
      subscriptionsRef.current.push(driverRequestSub);

      const driverOrderStatusSub = supabase
        .channel(`driver-order-status-${userId}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `driver_id=eq.${userId}` },
          async (payload) => {
            const oldStatus = payload.old.status;
            const newStatus = payload.new.status;
            if (oldStatus === newStatus) return;
            if (newStatus === 'cancelled') {
              await notify(
                'Order Cancelled',
                'The customer has cancelled the delivery order.',
                { type: 'order_cancelled', deliveryId: payload.new.id },
                [userId], 'driver'
              );
            }
          }
        )
        .subscribe();
      subscriptionsRef.current.push(driverOrderStatusSub);

      const driverConversationSub = supabase
        .channel(`driver-conversation-${userId}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'chat_conversations', filter: `driver_id=eq.${userId}` },
          () => { refreshUnreadCount(); }
        )
        .subscribe();
      subscriptionsRef.current.push(driverConversationSub);

      const driverMessageSub = supabase
        .channel(`driver-messages-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
          if (payload.new.sender_type !== 'customer') return;
          const { data: convData } = await supabase
            .from('chat_conversations').select('driver_id').eq('id', payload.new.conversation_id).maybeSingle();
          if (convData?.driver_id !== userId) return;
          refreshUnreadCount();
          const { data: customerData } = await supabase
            .from('customers').select('full_name').eq('id', payload.new.sender_id).maybeSingle();
          const senderName = customerData?.full_name || 'Customer';
          await notify(
            `Message from ${senderName}`, payload.new.message,
            { type: 'new_message', conversationId: payload.new.conversation_id, senderType: 'customer', driverId: userId },
            [userId], 'driver'
          );
        })
        .subscribe();
      subscriptionsRef.current.push(driverMessageSub);
    }

    // ─── SHOP SUBSCRIPTIONS ─────────────────────────────────────────────────
    if (userType === 'shop') {
      const shopOrderInsertSub = supabase
        .channel(`shop-order-insert-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shop_orders' }, async (payload) => {
          const newOrder = payload.new;
          if (newOrder.shop_id !== userId) return;
          const customerName = newOrder.customer_name || 'A customer';
          await notify(
            'New Order Received!',
            `${customerName} placed a new order from your shop.`,
            { type: 'shop_new_order', orderId: newOrder.id },
            [userId], 'shop'
          );
        })
        .subscribe();
      subscriptionsRef.current.push(shopOrderInsertSub);

      const shopOrderStatusSub = supabase
        .channel(`shop-order-status-${userId}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'shop_orders', filter: `shop_id=eq.${userId}` },
          async (payload) => {
            const oldStatus = payload.old.status;
            const newStatus = payload.new.status;
            if (oldStatus === newStatus) return;
            if (newStatus === 'cancelled') {
              await notify(
                'Order Cancelled',
                `Order #${payload.new.id.slice(0, 8)} was cancelled by the customer.`,
                { type: 'shop_order_cancelled', orderId: payload.new.id },
                [userId], 'shop'
              );
            } else if (newStatus === 'delivered') {
              await notify(
                'Order Delivered',
                `Order #${payload.new.id.slice(0, 8)} has been delivered successfully.`,
                { type: 'shop_order_delivered', orderId: payload.new.id },
                [userId], 'shop'
              );
            }
          }
        )
        .subscribe();
      subscriptionsRef.current.push(shopOrderStatusSub);
    }

    // ─── CUSTOMER SUBSCRIPTIONS ─────────────────────────────────────────────
    if (userType === 'customer') {
      refreshUnreadCount();

      const customerShopOrderSub = supabase
        .channel(`customer-shop-order-${userId}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'shop_orders', filter: `customer_id=eq.${userId}` },
          async (payload) => {
            const oldStatus = payload.old.status;
            const newStatus = payload.new.status;
            if (oldStatus === newStatus) return;
            const label = SHOP_STATUS_LABELS[newStatus] || newStatus;
            if (newStatus === 'confirmed') {
              await notify(
                'Order Confirmed!',
                `Your shop order has been confirmed. The shop is preparing your items.`,
                { type: 'shop_order_status', status: newStatus, orderId: payload.new.id },
                [userId], 'customer'
              );
            } else if (newStatus === 'preparing') {
              await notify(
                'Order Being Prepared',
                'The shop is now preparing your order.',
                { type: 'shop_order_status', status: newStatus, orderId: payload.new.id },
                [userId], 'customer'
              );
            } else if (newStatus === 'ready') {
              await notify(
                'Order Ready!',
                'Your order is ready and waiting for a messenger to pick it up.',
                { type: 'shop_order_status', status: newStatus, orderId: payload.new.id },
                [userId], 'customer'
              );
            } else if (newStatus === 'picked_up') {
              await notify(
                'Order Picked Up',
                'A messenger has picked up your order and is on the way.',
                { type: 'shop_order_status', status: newStatus, orderId: payload.new.id },
                [userId], 'customer'
              );
            } else if (newStatus === 'out_for_delivery') {
              await notify(
                'Out for Delivery!',
                'Your order is on its way to you.',
                { type: 'shop_order_status', status: newStatus, orderId: payload.new.id },
                [userId], 'customer'
              );
            } else if (newStatus === 'delivered') {
              await notify(
                'Order Delivered!',
                'Your shop order has been delivered successfully.',
                { type: 'shop_order_status', status: newStatus, orderId: payload.new.id },
                [userId], 'customer'
              );
            } else if (newStatus === 'cancelled') {
              await notify(
                'Order Cancelled',
                'Your shop order has been cancelled.',
                { type: 'shop_order_status', status: newStatus, orderId: payload.new.id },
                [userId], 'customer'
              );
            }
          }
        )
        .subscribe();
      subscriptionsRef.current.push(customerShopOrderSub);

      const customerConversationSub = supabase
        .channel(`customer-conversation-${userId}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'chat_conversations', filter: `customer_id=eq.${userId}` },
          () => { refreshUnreadCount(); }
        )
        .subscribe();
      subscriptionsRef.current.push(customerConversationSub);

      const customerOrderSub = supabase
        .channel(`customer-order-status-${userId}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `customer_id=eq.${userId}` },
          async (payload) => {
            const oldStatus = payload.old.status;
            const newStatus = payload.new.status;
            if (oldStatus === newStatus) return;
            if (newStatus === 'accepted') {
              const { data: driverData } = await supabase
                .from('drivers').select('full_name').eq('id', payload.new.driver_id).maybeSingle();
              const driverName = driverData?.full_name || 'A driver';
              await notify(
                'Order Accepted!', `${driverName} has accepted your order and is on the way.`,
                { type: 'order_status', status: 'accepted', deliveryId: payload.new.id, customerId: payload.new.customer_id },
                [userId], 'customer'
              );
            } else if (newStatus === 'in_progress') {
              await notify(
                'Order In Progress', 'Your driver is now shopping for your items.',
                { type: 'order_status', status: 'in_progress', deliveryId: payload.new.id, customerId: payload.new.customer_id },
                [userId], 'customer'
              );
            } else if (newStatus === 'delivered') {
              await notify(
                'Order Delivered!', 'Your order has been delivered successfully.',
                { type: 'order_status', status: 'delivered', deliveryId: payload.new.id, customerId: payload.new.customer_id },
                [userId], 'customer'
              );
            } else if (newStatus === 'declined') {
              await notify(
                'Order Declined', 'Your order was declined. Please try selecting another driver.',
                { type: 'order_status', status: 'declined', deliveryId: payload.new.id, customerId: payload.new.customer_id },
                [userId], 'customer'
              );
            } else if (newStatus === 'cancelled') {
              await notify(
                'Order Cancelled', 'Your delivery order has been cancelled.',
                { type: 'order_status', status: 'cancelled', deliveryId: payload.new.id, customerId: payload.new.customer_id },
                [userId], 'customer'
              );
            }
          }
        )
        .subscribe();
      subscriptionsRef.current.push(customerOrderSub);

      const customerMessageSub = supabase
        .channel(`customer-messages-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
          if (payload.new.sender_type === 'customer') return;
          const { data: convData } = await supabase
            .from('chat_conversations').select('customer_id').eq('id', payload.new.conversation_id).maybeSingle();
          if (convData?.customer_id !== userId) return;
          refreshUnreadCount();
          let senderName = 'Driver';
          if (payload.new.sender_type === 'shop') {
            const { data: shopData } = await supabase
              .from('shops').select('name').eq('id', payload.new.sender_id).maybeSingle();
            senderName = shopData?.name || 'Shop';
          } else {
            const { data: driverData } = await supabase
              .from('drivers').select('full_name').eq('id', payload.new.sender_id).maybeSingle();
            senderName = driverData?.full_name || 'Driver';
          }
          await notify(
            `Message from ${senderName}`, payload.new.message,
            { type: 'new_message', conversationId: payload.new.conversation_id, senderType: payload.new.sender_type, customerId: userId },
            [userId], 'customer'
          );
        })
        .subscribe();
      subscriptionsRef.current.push(customerMessageSub);
    }

    return () => {
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [userId, userType, hasNotificationPermission, refreshUnreadCount, refreshPendingDeliveries, refreshPendingRequests]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const receivedListener = addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    const responseListener = addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
    });

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleSWMessage = (event: MessageEvent) => {
      if (!event.data) return;

      if (event.data.type === 'PUSH_NOTIFICATION') {
        const { title, body, data } = event.data.payload;
        scheduleLocalNotification(title, body, data).catch(() => {});
      }

      if (event.data.type === 'QUEUED_NOTIFICATION_DELIVER') {
        const { title, body, data } = event.data.payload;
        scheduleLocalNotification(title, body, data).catch(() => {});
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
  }, []);

  const value = {
    unreadMessageCount,
    pendingDeliveriesCount,
    pendingRequestsCount,
    hasNotificationPermission,
    inAppMessage,
    clearInAppMessage,
    refreshUnreadCount,
    refreshPendingDeliveries,
    refreshPendingRequests,
    requestNotificationPermission,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
