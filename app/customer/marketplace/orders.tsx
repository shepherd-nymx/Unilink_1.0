import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { loadUserData } from '@/lib/storage-service';
import { A } from '@/lib/admin-theme';
import { ArrowLeft, ShoppingBag, Store, Truck, Package, CircleCheck as CheckCircle, Clock, Circle as XCircle, MapPin, Phone, Download } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type ShopOrder = {
  id: string;
  shop_id: string;
  products: any[];
  total_amount: number;
  delivery_fee: number;
  delivery_location: string | null;
  payment_method: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  shops: { name: string; address: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  assigned: 'Messenger Assigned',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  pending: A.amber,
  confirmed: A.blue,
  preparing: A.blue,
  ready: A.cyan,
  assigned: A.cyan,
  picked_up: A.orange,
  out_for_delivery: A.orange,
  delivered: A.green,
  cancelled: A.red,
};

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  confirmed: CheckCircle,
  preparing: Package,
  ready: Package,
  assigned: Truck,
  picked_up: Truck,
  out_for_delivery: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery', 'delivered'];

export default function ShopOrders() {
  const router = useRouter();
  const { isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const stored = loadUserData();
    if (stored?.type === 'customer') setCustomerId(stored.id);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (customerId) loadOrders();
  }, [customerId]);

  // Realtime subscription
  useEffect(() => {
    if (!customerId) return;
    const channel = supabase
      .channel('customer-shop-orders')
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'shop_orders', filter: `customer_id=eq.${customerId}` } as any,
        () => loadOrders()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [customerId]);

  const loadOrders = async () => {
    if (!customerId) return;
    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('*, shops!shop_orders_shop_id_fkey(name, address)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const bg = isDark ? '#050b16' : '#f0f4f8';
  const cardBg = isDark ? '#0a1220' : '#ffffff';
  const cardBorder = isDark ? '#1a2d4a' : '#e2e8f0';
  const textPrimary = isDark ? '#e0eeff' : '#0a1929';
  const textSecondary = isDark ? '#6a8fb0' : '#64748b';
  const primary = '#0066ff';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: cardBorder }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={18} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>My Shop Orders</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: cardBorder }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={18} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>My Shop Orders</Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: cardBorder }]}
          onPress={() => router.push('/customer/marketplace')}
        >
          <ShoppingBag size={18} color={primary} />
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        >
          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <ShoppingBag size={48} color={textSecondary} />
              <Text style={{ color: textSecondary, fontSize: 15, marginTop: 12 }}>No shop orders yet</Text>
              <TouchableOpacity
                style={[styles.shopBtn, { backgroundColor: primary }]}
                onPress={() => router.push('/customer/marketplace')}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Browse Marketplace</Text>
              </TouchableOpacity>
            </View>
          ) : (
            orders.map(order => {
              const statusColor = STATUS_COLORS[order.status] || textSecondary;
              const StatusIcon = STATUS_ICONS[order.status] || Clock;
              const currentStepIndex = STATUS_FLOW.indexOf(order.status);
              const isCancelled = order.status === 'cancelled';
              const isDelivered = order.status === 'delivered';

              return (
                <View key={order.id} style={[styles.orderCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <View style={styles.orderHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.orderId, { color: textPrimary }]}>#{order.id.slice(0, 8)}</Text>
                      <View style={[styles.shopRow, { gap: 6 }]}>
                        <Store size={12} color={primary} />
                        <Text style={[styles.orderShop, { color: textSecondary }]} numberOfLines={1}>
                          {order.shops?.name || 'Unknown Shop'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
                      <StatusIcon size={12} color={statusColor} />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {STATUS_LABELS[order.status] || order.status}
                      </Text>
                    </View>
                  </View>

                  {/* Items */}
                  <View style={styles.itemsSection}>
                    {(Array.isArray(order.products) ? order.products : []).map((item: any, i: number) => (
                      <View key={i} style={styles.itemRow}>
                        <Text style={[styles.itemName, { color: textPrimary }]}>{item.name} ×{item.qty || 1}</Text>
                        <Text style={[styles.itemPrice, { color: textSecondary }]}>${Number(item.price || 0).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Delivery info */}
                  {order.delivery_location && (
                    <View style={[styles.deliveryRow, { gap: 6 }]}>
                      <MapPin size={14} color={primary} />
                      <Text style={[styles.deliveryText, { color: textSecondary }]} numberOfLines={2}>
                        {order.delivery_location}
                      </Text>
                    </View>
                  )}

                  {/* Status tracker */}
                  {!isCancelled && (
                    <View style={styles.trackerRow}>
                      {STATUS_FLOW.map((step, i) => {
                        const isActive = i <= currentStepIndex;
                        const stepColor = isActive ? (i === currentStepIndex ? statusColor : A.green) : (isDark ? '#1a2d4a' : '#e2e8f0');
                        const isLast = i === STATUS_FLOW.length - 1;
                        return (
                          <View key={step} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={{ alignItems: 'center' }}>
                              <View style={[styles.trackerDot, { backgroundColor: stepColor, borderColor: stepColor }]} />
                              {!isLast && (
                                <View style={{ position: 'absolute', top: 5, left: 14, width: 20, height: 2, backgroundColor: i < currentStepIndex ? A.green : (isDark ? '#1a2d4a' : '#e2e8f0') }} />
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Footer */}
                  <View style={[styles.orderFooter, { borderTopColor: cardBorder }]}>
                    <View>
                      <Text style={[styles.orderTotal, { color: primary }]}>${Number(order.total_amount).toFixed(2)}</Text>
                      <Text style={[styles.orderDate, { color: textSecondary }]}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.ticketBtn, { backgroundColor: `${primary}12`, borderColor: `${primary}30` }]}
                      onPress={() => router.push({ pathname: '/customer/marketplace/ticket', params: { orderId: order.id } })}
                      activeOpacity={0.8}
                    >
                      <Download size={14} color={primary} />
                      <Text style={[styles.ticketBtnText, { color: primary }]}>Ticket</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  shopBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, marginTop: 12 },
  orderCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontSize: 15, fontWeight: '700' },
  shopRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  orderShop: { fontSize: 12 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  itemsSection: { marginTop: 12, gap: 4 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 13 },
  itemPrice: { fontSize: 13 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  deliveryText: { fontSize: 12, flex: 1 },
  trackerRow: { flexDirection: 'row', marginTop: 14, paddingVertical: 4 },
  trackerDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  orderFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, marginTop: 12, borderTopWidth: 1,
  },
  orderTotal: { fontSize: 17, fontWeight: '800' },
  orderDate: { fontSize: 11 },
  ticketBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  ticketBtnText: { fontSize: 12, fontWeight: '700' },
});
