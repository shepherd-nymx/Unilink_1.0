import PageSkeleton from '@/components/PageSkeleton';
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Package, Clock, CircleCheck as CheckCircle,
  Circle as XCircle, FileText, CreditCard, Copy, CircleAlert as AlertCircle,
  RefreshCw, Truck, ShoppingBag, MapPin, MessageCircle, Navigation,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { DeliveryRequestRow } from '@/lib/delivery-request-types';

type Order = {
  id: string;
  items: any[];
  total_amount: number;
  delivery_fee: number;
  payment_option: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  declined_at: string | null;
  payment_received: boolean;
  drivers: {
    full_name: string;
    phone_number: string;
  } | null;
};

export default function CustomerOrders() {
  const router = useRouter();
  const { customerId, customerName } = useLocalSearchParams<{ customerId: string; customerName: string }>();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'grocery' | 'delivery'>('grocery');
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const P = isDark ? '#00e5ff' : '#1A73E8';
  const PL = isDark ? '#33ecff' : '#4A9EFF';
  const BG = isDark ? '#050D1A' : '#F0F4FF';
  const CARD = isDark ? '#0D1B2E' : '#FFFFFF';
  const CARD_B = isDark ? '#1A3A5C' : '#DDE8FF';
  const TX = isDark ? '#E8F4FF' : '#0A1628';
  const TX2 = isDark ? '#7AA3CC' : '#5A7A9A';
  const TX3 = isDark ? '#3A6A8A' : '#9AB0CC';
  const SUCCESS = '#10B981';
  const WARN = '#F59E0B';
  const ERR = '#EF4444';
  const AMBER = '#F59E0B';
  const GREEN = '#10B981';

  const showNotification = (message: string, type: 'success' | 'warning' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`*, drivers(full_name, phone_number)`)
        .eq('customer_id', customerId as string)
        .order('created_at', { ascending: false });
      if (!error) setOrders(data || []);
    } catch {}
  }, [customerId]);

  const loadDeliveryRequests = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('delivery_requests')
        .select(`
          *,
          delivery_request_buy_details(*),
          delivery_request_pickup_details(*),
          drivers(full_name, phone_number)
        `)
        .eq('customer_id', customerId as string)
        .order('created_at', { ascending: false });
      setDeliveryRequests((data as DeliveryRequestRow[]) ?? []);
    } catch {}
  }, [customerId]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadOrders(), loadDeliveryRequests()]);
  }, [loadOrders, loadDeliveryRequests]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));

    const channel = supabase
      .channel('customer-all-orders')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `customer_id=eq.${customerId}` }, (payload) => {
        const newStatus = (payload.new as any).status;
        const oldStatus = (payload.old as any).status;
        if (oldStatus === 'pending' && newStatus === 'accepted') showNotification('Your order has been accepted!', 'success');
        else if (newStatus === 'delivered') showNotification('Your order has been delivered!', 'success');
        else if (newStatus === 'declined') showNotification('Your order was declined. Place a new one.', 'warning');
        loadOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requests', filter: `customer_id=eq.${customerId}` }, (payload) => {
        const newStatus = (payload.new as any)?.status;
        const oldStatus = (payload.old as any)?.status;
        if (oldStatus === 'pending' && newStatus === 'accepted') showNotification('Your delivery request was accepted!', 'success');
        else if (newStatus === 'in_progress') showNotification('Driver is on the way!', 'success');
        else if (newStatus === 'delivered') showNotification('Your delivery has been completed!', 'success');
        loadDeliveryRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadAll, customerId]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const cancelDeliveryRequest = async (requestId: string) => {
    await supabase
      .from('delivery_requests')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', requestId);
    await loadDeliveryRequests();
  };

  const openChatWithDriver = (req: DeliveryRequestRow) => {
    if (!req.driver_id) return;
    router.push({
      pathname: '/customer/chat',
      params: {
        customerId,
        customerName: customerName ?? '',
        targetDriverId: req.driver_id,
        targetDriverName: (req as any).drivers?.full_name ?? 'Driver',
      },
    } as any);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return WARN;
      case 'accepted': return PL;
      case 'in_progress': return P;
      case 'delivered': return SUCCESS;
      case 'declined':
      case 'cancelled': return ERR;
      default: return TX3;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'PENDING';
      case 'accepted': return 'ACCEPTED';
      case 'in_progress': return 'IN PROGRESS';
      case 'delivered': return 'DELIVERED';
      case 'declined': return 'DECLINED';
      case 'cancelled': return 'CANCELLED';
      case 'expired': return 'EXPIRED';
      default: return status.toUpperCase();
    }
  };

  const viewReceipt = (order: Order) => {
    router.push({
      pathname: '/customer/receipt',
      params: { deliveryId: order.id, customerId },
    });
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
      backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: CARD_B,
    },
    backButton: {
      width: 40, height: 40, borderRadius: 12, borderWidth: 1,
      borderColor: CARD_B, justifyContent: 'center', alignItems: 'center',
      backgroundColor: BG, marginRight: 14,
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: TX, letterSpacing: 0.3 },
    tabs: {
      flexDirection: 'row', backgroundColor: CARD,
      borderBottomWidth: 1, borderBottomColor: CARD_B,
    },
    tab: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: P },
    tabText: { fontSize: 13, fontWeight: '700', color: TX3 },
    tabTextActive: { color: P },
    tabBadge: {
      minWidth: 20, height: 20, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
    },
    tabBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    notification: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 14, marginHorizontal: 16, marginTop: 12,
      borderRadius: 12, borderWidth: 1,
    },
    notificationText: { flex: 1, fontSize: 13, fontWeight: '600', color: TX },
    content: { flex: 1, paddingTop: 8 },
    emptyState: {
      alignItems: 'center', justifyContent: 'center',
      paddingVertical: 80, paddingHorizontal: 32, gap: 14,
    },
    emptyRing: {
      width: 88, height: 88, borderRadius: 44,
      borderWidth: 2, borderColor: CARD_B,
      justifyContent: 'center', alignItems: 'center', backgroundColor: CARD,
    },
    emptyStateText: { fontSize: 18, fontWeight: '800', color: TX2, textAlign: 'center' },
    emptyStateSubtext: { fontSize: 14, color: TX3, textAlign: 'center', lineHeight: 20 },

    orderCard: {
      backgroundColor: CARD, marginHorizontal: 16, marginBottom: 14,
      borderRadius: 18, borderWidth: 1, borderColor: CARD_B, overflow: 'hidden',
      shadowColor: P, shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.2 : 0.07, shadowRadius: 14, elevation: 4,
    },
    orderCardTop: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: CARD_B,
      backgroundColor: isDark ? 'rgba(26,115,232,0.05)' : 'rgba(26,115,232,0.02)',
    },
    statusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
    },
    statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
    orderDate: { fontSize: 12, color: TX3 },
    orderBody: { padding: 18 },
    detailRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 10,
    },
    detailLabel: { fontSize: 13, color: TX3 },
    detailValue: { fontSize: 14, fontWeight: '600', color: TX },
    detailValueBold: { fontSize: 15, fontWeight: '800', color: P },
    divider: { height: 1, backgroundColor: CARD_B, marginVertical: 12 },
    driverRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(26,115,232,0.06)' : 'rgba(26,115,232,0.04)',
      padding: 12, borderRadius: 10, borderWidth: 1, borderColor: CARD_B, marginTop: 4,
    },
    driverLabel: { fontSize: 12, color: TX3, marginBottom: 2 },
    driverName: { fontSize: 14, fontWeight: '700', color: TX },
    receiptButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginTop: 12, paddingVertical: 11,
      backgroundColor: isDark ? 'rgba(26,115,232,0.12)' : 'rgba(26,115,232,0.08)',
      borderRadius: 10, borderWidth: 1, borderColor: CARD_B,
    },
    receiptButtonText: { fontSize: 14, fontWeight: '700', color: P },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 10, borderRadius: 10,
    },
    actionBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    actionBtnOutline: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    },
    statusBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 12, borderRadius: 10, marginBottom: 10,
    },
    statusBarText: { fontSize: 13, fontWeight: '700' },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
    infoText: { flex: 1, fontSize: 13, color: TX2, lineHeight: 18 },
    infoBold: { fontWeight: '700', color: TX },
  });

  const renderGroceryOrders = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P} />}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyRing}><Package size={36} color={TX3} /></View>
          <Text style={styles.emptyStateText}>No grocery orders yet</Text>
          <Text style={styles.emptyStateSubtext}>Your order history will appear here once you place your first order</Text>
        </View>
      ) : (
        orders.map((order) => {
          const statusColor = getStatusColor(order.status);
          return (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderCardTop}>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18`, borderColor: statusColor }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>{getStatusLabel(order.status)}</Text>
                </View>
                <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={styles.orderBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order ID</Text>
                  <Text style={styles.detailValue}>{order.id.slice(0, 8)}...</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Items</Text>
                  <Text style={styles.detailValue}>{order.items.reduce((sum: number, item: any) => sum + item.quantity, 0)} items</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total</Text>
                  <Text style={styles.detailValueBold}>${(order.total_amount + order.delivery_fee).toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment</Text>
                  <Text style={styles.detailValue}>{order.payment_option === 'paynow' ? 'Paynow' : 'Pay on Delivery'}</Text>
                </View>
                {order.drivers && order.status !== 'declined' && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.driverRow}>
                      <View>
                        <Text style={styles.driverLabel}>DRIVER</Text>
                        <Text style={styles.driverName}>{order.drivers.full_name}</Text>
                      </View>
                      <Truck size={20} color={P} />
                    </View>
                  </>
                )}
                {order.status === 'declined' && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10, padding: 12, backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)', borderRadius: 10, borderWidth: 1, borderColor: ERR }}>
                    <XCircle size={16} color={ERR} />
                    <Text style={{ flex: 1, fontSize: 13, color: ERR, lineHeight: 18 }}>This order was declined by the driver.</Text>
                  </View>
                )}
                {order.drivers && (order.status === 'accepted' || order.status === 'in_progress') && order.payment_option === 'paynow' && (
                  <View style={{ marginTop: 12, padding: 14, backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)', borderRadius: 12, borderWidth: 1, borderColor: SUCCESS }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <CreditCard size={16} color={SUCCESS} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: SUCCESS }}>Paynow Payment Reference</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: SUCCESS, marginBottom: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: SUCCESS, letterSpacing: 0.5 }}>{order.id.slice(0, 8).toUpperCase()}</Text>
                      <Copy size={16} color={SUCCESS} />
                    </View>
                    <Text style={{ fontSize: 12, color: SUCCESS, lineHeight: 16 }}>Use this reference to send payment to your driver via Paynow</Text>
                  </View>
                )}
                {(order.status === 'accepted' || order.status === 'in_progress' || order.status === 'delivered') && (
                  <TouchableOpacity style={styles.receiptButton} onPress={() => viewReceipt(order)}>
                    <FileText size={16} color={P} />
                    <Text style={styles.receiptButtonText}>View Receipt</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  const renderDeliveryRequests = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P} />}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {deliveryRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyRing}><Truck size={36} color={TX3} /></View>
          <Text style={styles.emptyStateText}>No delivery requests yet</Text>
          <Text style={styles.emptyStateSubtext}>Your buy & deliver and pickup & deliver requests will appear here</Text>
        </View>
      ) : (
        deliveryRequests.map((req) => {
          const isBuy = req.service_type === 'buy_and_deliver';
          const buy = req.delivery_request_buy_details?.[0];
          const pickup = req.delivery_request_pickup_details?.[0];
          const accent = isBuy ? P : AMBER;
          const statusColor = getStatusColor(req.status);
          const driver = (req as any).drivers;
          const isActive = req.status === 'accepted' || req.status === 'in_progress';
          const isPending = req.status === 'pending';
          const age = Math.floor((Date.now() - new Date(req.created_at).getTime()) / 60000);

          return (
            <View key={req.id} style={[styles.orderCard, { borderColor: accent + '30' }]}>
              <View style={[styles.orderCardTop, { backgroundColor: accent + '08' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: accent + '18', justifyContent: 'center', alignItems: 'center' }}>
                    {isBuy ? <ShoppingBag size={16} color={accent} /> : <Package size={16} color={accent} />}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: TX }}>{isBuy ? 'Buy & Deliver' : 'Pickup & Deliver'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18`, borderColor: statusColor }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>{getStatusLabel(req.status)}</Text>
                  </View>
                  <Text style={styles.orderDate}>{age < 1 ? 'Just now' : `${age}m ago`}</Text>
                </View>
              </View>

              <View style={styles.orderBody}>
                {/* Tracking progress bar */}
                {(isActive || req.status === 'delivered') && (
                  <View style={[styles.statusBar, { backgroundColor: statusColor + '12', borderWidth: 1, borderColor: statusColor + '30' }]}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
                    <Text style={[styles.statusBarText, { color: statusColor }]}>
                      {req.status === 'accepted' ? 'Driver accepted — preparing your order' :
                       req.status === 'in_progress' ? 'Driver is on the way to you' :
                       'Delivery completed'}
                    </Text>
                  </View>
                )}

                {isBuy && buy && (
                  <>
                    <View style={styles.infoRow}>
                      <ShoppingBag size={14} color={P} />
                      <Text style={styles.infoText}><Text style={styles.infoBold}>{buy.item_name}</Text> × {buy.quantity} — ${buy.budget_estimate} budget</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <MapPin size={14} color={AMBER} />
                      <Text style={styles.infoText} numberOfLines={1}><Text style={styles.infoBold}>Shop:</Text> {buy.shop_name}{buy.shop_location ? ` · ${buy.shop_location}` : ''}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Navigation size={14} color={GREEN} />
                      <Text style={styles.infoText} numberOfLines={2}><Text style={styles.infoBold}>Deliver to:</Text> {buy.destination_address}</Text>
                    </View>
                  </>
                )}

                {!isBuy && pickup && (
                  <>
                    <View style={styles.infoRow}>
                      <MapPin size={14} color={AMBER} />
                      <Text style={styles.infoText} numberOfLines={1}><Text style={styles.infoBold}>Pickup:</Text> {pickup.pickup_address}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Navigation size={14} color={GREEN} />
                      <Text style={styles.infoText} numberOfLines={1}><Text style={styles.infoBold}>Deliver to:</Text> {pickup.destination_address}</Text>
                    </View>
                  </>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Request ID</Text>
                  <Text style={styles.detailValue}>#{req.id.slice(0, 8).toUpperCase()}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment</Text>
                  <Text style={styles.detailValue}>{req.payment_method === 'paynow' ? 'Paynow' : 'Pay on Delivery'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Method</Text>
                  <Text style={styles.detailValue}>{req.delivery_method === 'vehicle' ? 'Vehicle' : 'Walking'}</Text>
                </View>
                {req.offer_fee && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Offer Fee</Text>
                    <Text style={[styles.detailValueBold, { color: GREEN }]}>${req.offer_fee}</Text>
                  </View>
                )}

                {driver && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.driverRow}>
                      <View>
                        <Text style={styles.driverLabel}>MESSENGER</Text>
                        <Text style={styles.driverName}>{driver.full_name}</Text>
                      </View>
                      <Truck size={20} color={P} />
                    </View>
                  </>
                )}

                {/* Action buttons */}
                {(isActive || isPending) && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    {isActive && req.driver_id && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: P }]}
                        onPress={() => openChatWithDriver(req)}
                        activeOpacity={0.85}
                      >
                        <MessageCircle size={15} color="#fff" />
                        <Text style={styles.actionBtnText}>Chat</Text>
                      </TouchableOpacity>
                    )}
                    {isPending && (
                      <TouchableOpacity
                        style={[styles.actionBtnOutline, { borderColor: ERR }]}
                        onPress={() => cancelDeliveryRequest(req.id)}
                        activeOpacity={0.8}
                      >
                        <XCircle size={15} color={ERR} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: ERR }}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  if (loading) {
    return <PageSkeleton page="customer/orders"/>;
  }

  const activeDeliveryCount = deliveryRequests.filter(r => r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push({ pathname: '/customer/dashboard', params: { customerId, customerName } })}>
          <ArrowLeft size={18} color={TX2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order History</Text>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: '#0066ff' }]}
          onPress={() => router.push('/customer/marketplace/orders')}
        >
          <ShoppingBag size={18} color="#0066ff" />
        </TouchableOpacity>
      </View>

      {notification && (
        <View style={[
          styles.notification,
          notification.type === 'warning'
            ? { backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)', borderColor: WARN }
            : { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', borderColor: SUCCESS },
        ]}>
          {notification.type === 'success'
            ? <CheckCircle size={18} color={SUCCESS} />
            : <AlertCircle size={18} color={WARN} />}
          <Text style={styles.notificationText}>{notification.message}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'grocery' && styles.tabActive]} onPress={() => setActiveTab('grocery')}>
          <Package size={15} color={activeTab === 'grocery' ? P : TX3} />
          <Text style={[styles.tabText, activeTab === 'grocery' && styles.tabTextActive]}>Grocery</Text>
          {orders.length > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: isDark ? '#1A3A5C' : '#DDE8FF' }]}>
              <Text style={[styles.tabBadgeText, { color: TX2 }]}>{orders.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'delivery' && styles.tabActive]} onPress={() => setActiveTab('delivery')}>
          <Truck size={15} color={activeTab === 'delivery' ? P : TX3} />
          <Text style={[styles.tabText, activeTab === 'delivery' && styles.tabTextActive]}>Deliveries</Text>
          {activeDeliveryCount > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: WARN }]}>
              <Text style={styles.tabBadgeText}>{activeDeliveryCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'grocery' ? renderGroceryOrders() : renderDeliveryRequests()}
    </View>
  );
}
