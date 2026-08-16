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
import {
  ArrowLeft,
  Truck,
  Package,
  CheckCircle,
  MapPin,
  Store,
  Phone,
  Clock,
  LogOut,
  Navigation,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type ShopOrder = {
  id: string;
  shop_id: string;
  products: any[];
  total_amount: number;
  delivery_fee: number;
  delivery_location: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  payment_method: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  created_at: string;
  shops: { name: string; address: string | null; contact_phone: string | null } | null;
};

const STATUS_FLOW = ['assigned', 'picked_up', 'out_for_delivery', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
};

export default function MessengerShopDeliveries() {
  const router = useRouter();
  const { isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [driverId, setDriverId] = useState<string | undefined>();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const stored = loadUserData();
    if (stored?.type === 'driver') setDriverId(stored.id);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (driverId) loadOrders();
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;
    const channel = supabase
      .channel('messenger-shop-orders')
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'shop_orders', filter: `messenger_id=eq.${driverId}` } as any,
        () => loadOrders()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  const loadOrders = async () => {
    if (!driverId) return;
    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('*, shops!shop_orders_shop_id_fkey(name, address, contact_phone)')
        .eq('messenger_id', driverId)
        .in('status', ['assigned', 'picked_up', 'out_for_delivery'])
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

  const updateStatus = async (order: ShopOrder, newStatus: string) => {
    setUpdating(true);
    const updates: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'picked_up') updates.picked_up_at = new Date().toISOString();
    if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString();

    const { error } = await supabase
      .from('shop_orders')
      .update(updates)
      .eq('id', order.id);
    if (error) return;
    setUpdating(false);
    loadOrders();
  };

  const sendEmail = async (type: string, to: string, data: Record<string, any>, orderId?: string) => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ type, to, data, orderId }),
      });
    } catch {}
  };

  const bg = isDark ? '#030810' : '#f0f4f8';
  const cardBg = isDark ? '#070f1c' : '#ffffff';
  const cardBorder = isDark ? '#1a2d4a' : '#e2e8f0';
  const textPrimary = isDark ? '#e0eeff' : '#0a1929';
  const textSecondary = isDark ? '#6a8fb0' : '#64748b';
  const primary = '#10b981';
  const cyan = '#00e5ff';

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
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Shop Deliveries</Text>
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
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Shop Deliveries</Text>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        >
          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Truck size={48} color={textSecondary} />
              <Text style={{ color: textSecondary, fontSize: 15, marginTop: 12 }}>No assigned deliveries</Text>
              <Text style={{ color: textSecondary, fontSize: 12, marginTop: 4 }}>
                Shop assignments will appear here
              </Text>
            </View>
          ) : (
            orders.map(order => {
              const currentStep = STATUS_FLOW.indexOf(order.status);
              return (
                <View key={order.id} style={[styles.orderCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <View style={styles.orderHeader}>
                    <Text style={[styles.orderId, { color: textPrimary }]}>#{order.id.slice(0, 8)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${primary}20`, borderColor: primary }]}>
                      <Text style={[styles.statusText, { color: primary }]}>
                        {STATUS_LABELS[order.status] || order.status}
                      </Text>
                    </View>
                  </View>

                  {/* Shop pickup info */}
                  <View style={styles.sectionBox}>
                    <View style={styles.sectionHeader}>
                      <Store size={14} color={cyan} />
                      <Text style={[styles.sectionTitle, { color: textSecondary }]}>PICKUP FROM SHOP</Text>
                    </View>
                    <Text style={[styles.sectionValue, { color: textPrimary }]}>
                      {order.shops?.name || 'Unknown Shop'}
                    </Text>
                    {order.shops?.address && (
                      <Text style={[styles.sectionSub, { color: textSecondary }]}>{order.shops.address}</Text>
                    )}
                    {order.shops?.contact_phone && (
                      <View style={[styles.phoneRow, { gap: 6 }]}>
                        <Phone size={12} color={cyan} />
                        <Text style={[styles.phoneText, { color: textSecondary }]}>{order.shops.contact_phone}</Text>
                      </View>
                    )}
                  </View>

                  {/* Delivery info */}
                  <View style={styles.sectionBox}>
                    <View style={styles.sectionHeader}>
                      <MapPin size={14} color={primary} />
                      <Text style={[styles.sectionTitle, { color: textSecondary }]}>DELIVER TO</Text>
                    </View>
                    <Text style={[styles.sectionValue, { color: textPrimary }]}>
                      {order.delivery_location || 'Address not specified'}
                    </Text>
                    <Text style={[styles.sectionSub, { color: textSecondary }]}>
                      {order.customer_name || 'Customer'}
                    </Text>
                    {order.customer_phone && (
                      <View style={[styles.phoneRow, { gap: 6 }]}>
                        <Phone size={12} color={primary} />
                        <Text style={[styles.phoneText, { color: textSecondary }]}>{order.customer_phone}</Text>
                      </View>
                    )}
                  </View>

                  {/* Items */}
                  <View style={styles.sectionBox}>
                    <View style={styles.sectionHeader}>
                      <Package size={14} color={cyan} />
                      <Text style={[styles.sectionTitle, { color: textSecondary }]}>ITEMS</Text>
                    </View>
                    {(Array.isArray(order.products) ? order.products : []).map((item: any, i: number) => (
                      <View key={i} style={styles.itemRow}>
                        <Text style={[styles.itemName, { color: textPrimary }]}>{item.name} ×{item.qty || 1}</Text>
                        <Text style={[styles.itemPrice, { color: textSecondary }]}>${Number(item.price || 0).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Payment */}
                  <View style={[styles.paymentRow, { borderTopColor: cardBorder }]}>
                    <Text style={[styles.paymentLabel, { color: textSecondary }]}>Payment: {order.payment_method}</Text>
                    <Text style={[styles.paymentTotal, { color: primary }]}>${Number(order.total_amount).toFixed(2)}</Text>
                  </View>

                  {/* Status buttons */}
                  <View style={styles.statusButtons}>
                    {order.status === 'assigned' && (
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: cyan }]}
                        onPress={() => updateStatus(order, 'picked_up')}
                        disabled={updating}
                      >
                        <Package size={16} color="#000" />
                        <Text style={styles.statusBtnTextDark}>Mark Picked Up</Text>
                      </TouchableOpacity>
                    )}
                    {order.status === 'picked_up' && (
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: '#ff6b00' }]}
                        onPress={() => updateStatus(order, 'out_for_delivery')}
                        disabled={updating}
                      >
                        <Truck size={16} color="#fff" />
                        <Text style={styles.statusBtnText}>Out for Delivery</Text>
                      </TouchableOpacity>
                    )}
                    {order.status === 'out_for_delivery' && (
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: primary }]}
                        onPress={() => {
                          updateStatus(order, 'delivered');
                          if (order.customer_email) {
                            sendEmail('shop_order_status', order.customer_email, {
                              orderNumber: order.id.slice(0, 8),
                              statusTo: 'delivered',
                            }, order.id);
                          }
                        }}
                        disabled={updating}
                      >
                        <CheckCircle size={16} color="#fff" />
                        <Text style={styles.statusBtnText}>Mark Delivered</Text>
                      </TouchableOpacity>
                    )}
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
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 4 },
  orderCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId: { fontSize: 15, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  sectionBox: { marginTop: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  sectionValue: { fontSize: 14, fontWeight: '600' },
  sectionSub: { fontSize: 12, marginTop: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  phoneText: { fontSize: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  itemName: { fontSize: 13 },
  itemPrice: { fontSize: 13 },
  paymentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, marginTop: 12, borderTopWidth: 1,
  },
  paymentLabel: { fontSize: 12 },
  paymentTotal: { fontSize: 17, fontWeight: '800' },
  statusButtons: { marginTop: 14, gap: 8 },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 10, paddingVertical: 14,
  },
  statusBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  statusBtnTextDark: { color: '#000', fontSize: 14, fontWeight: '700' },
});
