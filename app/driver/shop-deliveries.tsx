import PageSkeleton from '@/components/PageSkeleton';
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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { loadUserData } from '@/lib/storage-service';
import {
  ArrowLeft, Truck, Package, CircleCheck as CheckCircle, MapPin, Store,
  Phone, LogOut, Navigation, ShoppingBag, Settings, X, CircleAlert as AlertCircle,
  Navigation2, User,
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
  goods_received_at: string | null;
  created_at: string;
  shops: {
    name: string;
    address: string | null;
    contact_phone: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

type Shop = {
  id: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
  latitude: number | null;
  longitude: number | null;
  university_id: string | null;
};

const STATUS_FLOW = ['assigned', 'picked_up', 'out_for_delivery', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
};

const CYAN = '#00e5ff';
const GREEN = '#00ff88';
const AMBER = '#ffb300';
const RED = '#ff6b6b';
const BG = '#030810';
const CARD = '#070f1c';
const CARD2 = '#0b1628';
const TEXT = '#d0eaff';
const TEXT2 = '#4a7a9b';
const TEXT3 = '#1e3a5f';

export default function MessengerShopDeliveries() {
  const router = useRouter();
  const { isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [driverId, setDriverId] = useState<string | undefined>();
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [preferredShopIds, setPreferredShopIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [togglingShop, setTogglingShop] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'shops'>('orders');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = loadUserData();
    if (stored?.type === 'driver') setDriverId(stored.id);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (driverId) {
      loadDriverInfo();
      loadOrders();
      loadShopsAndPreferences();
    }
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;
    const channel = supabase
      .channel('messenger-shop-orders-v2')
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'shop_orders', filter: `messenger_id=eq.${driverId}` } as any,
        () => loadOrders()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  const loadDriverInfo = async () => {
    if (!driverId) return;
    const { data } = await supabase
      .from('drivers')
      .select('active_university_id, university_id')
      .eq('id', driverId)
      .single();
    if (data) setDriverInfo(data);
  };

  const loadOrders = async () => {
    if (!driverId) return;
    try {
      const { data, error: err } = await supabase
        .from('shop_orders')
        .select('*, shops!shop_orders_shop_id_fkey(name, address, contact_phone, latitude, longitude)')
        .eq('messenger_id', driverId)
        .in('status', ['assigned', 'picked_up', 'out_for_delivery'])
        .order('created_at', { ascending: false });
      if (err) throw err;
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadShopsAndPreferences = async () => {
    if (!driverId) return;
    try {
      const uniId = driverInfo?.active_university_id ?? driverInfo?.university_id;
      let shopQuery = supabase
        .from('shops')
        .select('id, name, address, contact_phone, latitude, longitude, university_id')
        .eq('status', 'active')
        .order('name');
      if (uniId) shopQuery = shopQuery.eq('university_id', uniId);
      const { data: shops, error: shopErr } = await shopQuery;
      if (shopErr) throw shopErr;
      setAllShops(shops || []);

      const { data: prefs } = await supabase
        .from('driver_shop_preferences')
        .select('shop_id')
        .eq('driver_id', driverId);
      setPreferredShopIds(new Set((prefs || []).map((p: any) => p.shop_id)));
    } catch (err: any) {
      setError(err.message || 'Failed to load shops');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
    loadShopsAndPreferences();
  };

  const updateStatus = async (order: ShopOrder, newStatus: string) => {
    setUpdating(true);
    const updates: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'picked_up') updates.picked_up_at = new Date().toISOString();
    if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString();

    const { error: err } = await supabase
      .from('shop_orders')
      .update(updates)
      .eq('id', order.id);
    if (err) { setError(err.message); setUpdating(false); return; }
    setUpdating(false);
    loadOrders();
  };

  const tickGoodsReceived = async (order: ShopOrder) => {
    setUpdating(true);
    const { error: err } = await supabase
      .from('shop_orders')
      .update({ goods_received_at: new Date().toISOString() })
      .eq('id', order.id);
    if (err) { setError(err.message); setUpdating(false); return; }
    setUpdating(false);
    loadOrders();
  };

  const toggleShopPreference = async (shopId: string) => {
    if (!driverId) return;
    setTogglingShop(shopId);
    try {
      if (preferredShopIds.has(shopId)) {
        await supabase
          .from('driver_shop_preferences')
          .delete()
          .eq('driver_id', driverId)
          .eq('shop_id', shopId);
        setPreferredShopIds(prev => { const n = new Set(prev); n.delete(shopId); return n; });
      } else {
        await supabase
          .from('driver_shop_preferences')
          .insert({ driver_id: driverId, shop_id: shopId });
        setPreferredShopIds(prev => { const n = new Set(prev); n.add(shopId); return n; });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingShop(null);
    }
  };

  const openInMaps = (lat: number, lng: number) => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  };

  if (loading) {
    return <PageSkeleton page="driver/shop-deliveries" onBack={() => router.back()}/>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={18} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shop Deliveries</Text>
        <TouchableOpacity onPress={() => { loadUserData(); supabase.auth.signOut(); router.replace('/driver/login'); }}>
          <LogOut size={18} color={TEXT2} />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}><X size={14} color={RED} /></TouchableOpacity>
        </View>
      ) : null}

      {/* Tab selector */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Package size={15} color={activeTab === 'orders' ? CYAN : TEXT2} />
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
            Shop Orders {orders.length > 0 ? `(${orders.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shops' && styles.tabActive]}
          onPress={() => setActiveTab('shops')}
        >
          <Store size={15} color={activeTab === 'shops' ? CYAN : TEXT2} />
          <Text style={[styles.tabText, activeTab === 'shops' && styles.tabTextActive]}>
            My Shops {preferredShopIds.size > 0 ? `(${preferredShopIds.size})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {activeTab === 'orders' ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
          >
            {orders.length === 0 ? (
              <View style={styles.emptyState}>
                <Truck size={48} color={TEXT3} />
                <Text style={styles.emptyText}>No assigned deliveries</Text>
                <Text style={styles.emptySub}>Shop assignments will appear here</Text>
              </View>
            ) : (
              orders.map(order => {
                const currentStep = STATUS_FLOW.indexOf(order.status);
                const goodsReceived = !!order.goods_received_at;
                const shopLat = order.shops?.latitude;
                const shopLng = order.shops?.longitude;
                const custLat = order.delivery_latitude;
                const custLng = order.delivery_longitude;
                return (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${GREEN}20`, borderColor: GREEN }]}>
                        <Text style={styles.statusText}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Text>
                      </View>
                    </View>

                    {/* Shop pickup info with GPS */}
                    <View style={styles.sectionBox}>
                      <View style={styles.sectionHeader}>
                        <Store size={14} color={CYAN} />
                        <Text style={styles.sectionTitle}>PICKUP FROM SHOP</Text>
                      </View>
                      <Text style={styles.sectionValue}>
                        {order.shops?.name || 'Unknown Shop'}
                      </Text>
                      {order.shops?.address && (
                        <Text style={styles.sectionSub}>{order.shops.address}</Text>
                      )}
                      {order.shops?.contact_phone && (
                        <TouchableOpacity
                          style={styles.phoneRow}
                          onPress={() => Linking.openURL(`tel:${order.shops!.contact_phone!}`)}
                        >
                          <Phone size={12} color={CYAN} />
                          <Text style={styles.phoneText}>{order.shops.contact_phone}</Text>
                        </TouchableOpacity>
                      )}
                      {shopLat != null && shopLng != null && (
                        <TouchableOpacity
                          style={styles.gpsButton}
                          onPress={() => openInMaps(shopLat, shopLng)}
                        >
                          <Navigation2 size={12} color={CYAN} />
                          <Text style={styles.gpsButtonText}>Open Shop Location in Maps</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Delivery info with GPS */}
                    <View style={styles.sectionBox}>
                      <View style={styles.sectionHeader}>
                        <MapPin size={14} color={GREEN} />
                        <Text style={styles.sectionTitle}>DELIVER TO</Text>
                      </View>
                      <Text style={styles.sectionValue}>
                        {order.delivery_location || 'Address not specified'}
                      </Text>
                      <Text style={styles.sectionSub}>{order.customer_name || 'Customer'}</Text>
                      {order.customer_phone && (
                        <TouchableOpacity
                          style={styles.phoneRow}
                          onPress={() => Linking.openURL(`tel:${order.customer_phone!}`)}
                        >
                          <Phone size={12} color={GREEN} />
                          <Text style={styles.phoneText}>{order.customer_phone}</Text>
                        </TouchableOpacity>
                      )}
                      {custLat != null && custLng != null && (
                        <TouchableOpacity
                          style={[styles.gpsButton, { borderColor: `${GREEN}44` }]}
                          onPress={() => openInMaps(custLat, custLng)}
                        >
                          <Navigation2 size={12} color={GREEN} />
                          <Text style={[styles.gpsButtonText, { color: GREEN }]}>Open Customer Location in Maps</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Items with prices */}
                    <View style={styles.sectionBox}>
                      <View style={styles.sectionHeader}>
                        <Package size={14} color={CYAN} />
                        <Text style={styles.sectionTitle}>ITEMS & PRICES</Text>
                      </View>
                      {(Array.isArray(order.products) ? order.products : []).map((item: any, i: number) => (
                        <View key={i} style={styles.itemRow}>
                          <Text style={styles.itemName}>{item.name} ×{item.qty || 1}</Text>
                          <Text style={styles.itemPrice}>${Number(item.price || 0).toFixed(2)}</Text>
                        </View>
                      ))}
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>${Number(order.total_amount).toFixed(2)}</Text>
                      </View>
                      <View style={styles.feeRow}>
                        <Text style={styles.feeLabel}>Delivery Fee</Text>
                        <Text style={styles.feeValue}>${Number(order.delivery_fee).toFixed(2)}</Text>
                      </View>
                      <Text style={styles.paymentMethod}>Payment: {order.payment_method}</Text>
                    </View>

                    {/* Goods received confirmation */}
                    {order.status === 'assigned' && (
                      <View style={styles.goodsSection}>
                        {goodsReceived ? (
                          <View style={styles.goodsConfirmed}>
                            <CheckCircle size={16} color={GREEN} />
                            <Text style={styles.goodsConfirmedText}>Goods received from shop</Text>
                            <Text style={styles.goodsTime}>
                              {new Date(order.goods_received_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.goodsBtn, updating && { opacity: 0.5 }]}
                            onPress={() => tickGoodsReceived(order)}
                            disabled={updating}
                          >
                            <Package size={16} color="#000" />
                            <Text style={styles.goodsBtnText}>Tick: Goods Received from Shop</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Status progression buttons */}
                    <View style={styles.statusButtons}>
                      {order.status === 'assigned' && (
                        <TouchableOpacity
                          style={[styles.statusBtn, { backgroundColor: CYAN }, updating && { opacity: 0.5 }]}
                          onPress={() => updateStatus(order, 'picked_up')}
                          disabled={updating}
                        >
                          <Package size={16} color="#000" />
                          <Text style={styles.statusBtnTextDark}>Mark Picked Up</Text>
                        </TouchableOpacity>
                      )}
                      {order.status === 'picked_up' && (
                        <TouchableOpacity
                          style={[styles.statusBtn, { backgroundColor: '#ff6b00' }, updating && { opacity: 0.5 }]}
                          onPress={() => updateStatus(order, 'out_for_delivery')}
                          disabled={updating}
                        >
                          <Truck size={16} color="#fff" />
                          <Text style={styles.statusBtnText}>Out for Delivery</Text>
                        </TouchableOpacity>
                      )}
                      {order.status === 'out_for_delivery' && (
                        <TouchableOpacity
                          style={[styles.statusBtn, { backgroundColor: GREEN }, updating && { opacity: 0.5 }]}
                          onPress={() => updateStatus(order, 'delivered')}
                          disabled={updating}
                        >
                          <CheckCircle size={16} color="#000" />
                          <Text style={styles.statusBtnTextDark}>Mark Delivered</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        ) : (
          /* My Shops tab — choose which shops can see your availability */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
          >
            <View style={styles.infoBanner}>
              <AlertCircle size={14} color={AMBER} />
              <Text style={styles.infoBannerText}>
                Select which shops can see your availability and select you for deliveries.
                Only shops you opt into will see you as an available messenger.
              </Text>
            </View>

            {allShops.length === 0 ? (
              <View style={styles.emptyState}>
                <Store size={48} color={TEXT3} />
                <Text style={styles.emptyText}>No active shops found</Text>
                <Text style={styles.emptySub}>Shops in your area will appear here</Text>
              </View>
            ) : (
              allShops.map(shop => {
                const isPreferred = preferredShopIds.has(shop.id);
                const isToggling = togglingShop === shop.id;
                return (
                  <View key={shop.id} style={[styles.shopCard, isPreferred && styles.shopCardActive]}>
                    <View style={styles.shopCardTop}>
                      <View style={styles.shopIconWrap}>
                        <Store size={18} color={isPreferred ? GREEN : TEXT2} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={styles.shopName}>{shop.name}</Text>
                        {shop.address && (
                          <Text style={styles.shopAddress} numberOfLines={1}>{shop.address}</Text>
                        )}
                        {shop.contact_phone && (
                          <View style={styles.shopPhoneRow}>
                            <Phone size={11} color={TEXT2} />
                            <Text style={styles.shopPhone}>{shop.contact_phone}</Text>
                          </View>
                        )}
                        {shop.latitude != null && shop.longitude != null && (
                          <TouchableOpacity
                            style={styles.shopGpsLink}
                            onPress={() => openInMaps(shop.latitude!, shop.longitude!)}
                          >
                            <Navigation2 size={10} color={CYAN} />
                            <Text style={styles.shopGpsText}>View on Map</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.shopToggle,
                          isPreferred ? styles.shopToggleOn : styles.shopToggleOff,
                          isToggling && { opacity: 0.5 },
                        ]}
                        onPress={() => toggleShopPreference(shop.id)}
                        disabled={isToggling}
                      >
                        {isToggling ? (
                          <ActivityIndicator size="small" color={isPreferred ? GREEN : TEXT2} />
                        ) : isPreferred ? (
                          <CheckCircle size={16} color={GREEN} />
                        ) : (
                          <View style={styles.plusCircle} />
                        )}
                        <Text style={[styles.shopToggleText, isPreferred && styles.shopToggleTextOn]}>
                          {isPreferred ? 'Available' : 'Opt In'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: TEXT3, gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: TEXT },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 8, padding: 10,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { flex: 1, color: RED, fontSize: 12 },
  tabBar: {
    flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: TEXT3,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
  },
  tabActive: { backgroundColor: 'rgba(0,229,255,0.1)', borderColor: 'rgba(0,229,255,0.3)' },
  tabText: { fontSize: 12, fontWeight: '700', color: TEXT2 },
  tabTextActive: { color: CYAN },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 4 },
  emptyText: { color: TEXT2, fontSize: 15, marginTop: 12 },
  emptySub: { color: TEXT3, fontSize: 12, marginTop: 4 },
  orderCard: {
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,229,255,0.15)',
    backgroundColor: CARD, padding: 16, marginBottom: 14,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId: { fontSize: 15, fontWeight: '700', color: TEXT },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700', color: GREEN },
  sectionBox: {
    marginTop: 10, padding: 12, borderRadius: 10,
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: TEXT2, letterSpacing: 0.5 },
  sectionValue: { fontSize: 14, fontWeight: '600', color: TEXT },
  sectionSub: { fontSize: 12, color: TEXT2, marginTop: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  phoneText: { fontSize: 12, color: TEXT2 },
  gpsButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8,
    backgroundColor: 'rgba(0,229,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,255,0.25)',
    alignSelf: 'flex-start',
  },
  gpsButtonText: { fontSize: 11, fontWeight: '600', color: CYAN },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  itemName: { fontSize: 13, color: TEXT, flex: 1 },
  itemPrice: { fontSize: 13, color: TEXT2, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: TEXT3,
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: TEXT },
  totalValue: { fontSize: 16, fontWeight: '800', color: GREEN },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  feeLabel: { fontSize: 12, color: TEXT2 },
  feeValue: { fontSize: 12, fontWeight: '600', color: CYAN },
  paymentMethod: { fontSize: 11, color: TEXT2, marginTop: 6 },
  goodsSection: { marginTop: 12 },
  goodsConfirmed: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10,
    backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)',
  },
  goodsConfirmedText: { flex: 1, fontSize: 13, fontWeight: '600', color: GREEN },
  goodsTime: { fontSize: 11, color: TEXT2 },
  goodsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 10, paddingVertical: 14, backgroundColor: AMBER,
  },
  goodsBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  statusButtons: { marginTop: 10, gap: 8 },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 10, paddingVertical: 14,
  },
  statusBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  statusBtnTextDark: { color: '#000', fontSize: 14, fontWeight: '700' },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderRadius: 10, marginBottom: 14,
    backgroundColor: 'rgba(255,179,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.25)',
  },
  infoBannerText: { flex: 1, fontSize: 11, color: AMBER, lineHeight: 17 },
  shopCard: {
    borderRadius: 14, borderWidth: 1, borderColor: TEXT3,
    backgroundColor: CARD, padding: 14, marginBottom: 10,
  },
  shopCardActive: { borderColor: 'rgba(0,255,136,0.3)', borderWidth: 1.5 },
  shopCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  shopIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
    justifyContent: 'center', alignItems: 'center',
  },
  shopName: { fontSize: 14, fontWeight: '700', color: TEXT },
  shopAddress: { fontSize: 11, color: TEXT2 },
  shopPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  shopPhone: { fontSize: 11, color: TEXT2 },
  shopGpsLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  shopGpsText: { fontSize: 10, fontWeight: '600', color: CYAN },
  shopToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    minWidth: 90, justifyContent: 'center',
  },
  shopToggleOn: { backgroundColor: 'rgba(0,255,136,0.1)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)' },
  shopToggleOff: { backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3 },
  shopToggleText: { fontSize: 12, fontWeight: '700', color: TEXT2 },
  shopToggleTextOn: { color: GREEN },
  plusCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: TEXT2 },
});
