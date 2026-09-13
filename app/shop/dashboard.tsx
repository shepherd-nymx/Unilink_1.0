import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Image as RNImage,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { loadShopSession, clearShopSession } from '@/lib/shop-session-service';
import { A } from '@/lib/admin-theme';
import { SkeletonList } from '@/components/Skeleton';
import { HistoryTab } from '@/components/shop/HistoryTab';
import { AnalyticsTab } from '@/components/shop/AnalyticsTab';
import { ProfileTab } from '@/components/shop/ProfileTab';
import { OrderDetailModal } from '@/components/shop/OrderDetailModal';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  type ShopStatus,
  type ShopOrder,
  type ShopProduct,
  type Driver,
  type ShopData,
} from '@/lib/shop-types';
import {
  Store,
  Package,
  ShoppingBag,
  LogOut,
  Plus,
  Trash2,
  Circle as XCircle,
  Clock,
  Truck,
  DollarSign,
  TrendingUp,
  X,
  Image as ImageIcon,
  CircleAlert as AlertCircle,
  Bell,
  Ban,
  ShieldCheck,
  MessageSquare,
  ChevronRight,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

type TabKey = 'orders' | 'products' | 'history' | 'analytics' | 'messages' | 'profile';

export default function ShopDashboard() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<ShopData | null>(null);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [registrationFee, setRegistrationFee] = useState(10);
  const [activeTab, setActiveTab] = useState<TabKey>('orders');
  const [refreshing, setRefreshing] = useState(false);
  const [paynowLoading, setPaynowLoading] = useState(false);
  const [error, setError] = useState('');
  const [newOrderBanner, setNewOrderBanner] = useState<string | null>(null);
  const prevOrderCount = useRef(0);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productAvailable, setProductAvailable] = useState(true);
  const [productImageUri, setProductImageUri] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [assigningDriver, setAssigningDriver] = useState(false);
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    initDashboard();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!shop) return;
    const channel = supabase
      .channel('shop-orders-realtime')
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'shop_orders', filter: `shop_id=eq.${shop.id}` } as any,
        () => loadOrders(shop.id),
      )
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'shop_products', filter: `shop_id=eq.${shop.id}` } as any,
        () => loadProducts(shop.id),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [shop]);

  useEffect(() => {
    const pending = orders.filter((o) => o.status === 'pending');
    if (pending.length > prevOrderCount.current && prevOrderCount.current !== 0 && shop?.status === 'active') {
      const latest = pending[0];
      setNewOrderBanner(`New order from ${latest.customer_name || 'a customer'}!`);
      Animated.timing(bannerAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      const t = setTimeout(() => {
        Animated.timing(bannerAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
          setNewOrderBanner(null),
        );
      }, 4500);
      return () => clearTimeout(t);
    }
    prevOrderCount.current = pending.length;
  }, [orders, shop?.status]);

  const initDashboard = async () => {
    const sess = await loadShopSession();
    if (!sess) {
      router.replace('/shop/login');
      return;
    }
    await Promise.all([loadShop(sess.shopId), loadSettings()]);
    setLoading(false);
  };

  const loadShop = async (shopId: string) => {
    const { data, error: err } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .maybeSingle();
    if (err) {
      setError(err.message);
      return;
    }
    if (!data) {
      router.replace('/shop/login');
      return;
    }
    setShop(data as ShopData);
    await Promise.all([loadOrders(shopId), loadProducts(shopId)]);
  };

  const loadOrders = async (shopId: string) => {
    const { data, error: err } = await supabase
      .from('shop_orders')
      .select('*, customer_id')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      return;
    }
    setOrders((data || []) as ShopOrder[]);
  };

  const loadProducts = async (shopId: string) => {
    const { data, error: err } = await supabase
      .from('shop_products')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      return;
    }
    setProducts((data || []) as ShopProduct[]);
  };

  const loadSettings = async () => {
    const { data } = await supabase
      .from('shop_settings')
      .select('registration_fee')
      .maybeSingle();
    if (data) setRegistrationFee(Number(data.registration_fee));
  };

  const onRefresh = async () => {
    if (!shop) return;
    setRefreshing(true);
    await Promise.all([loadOrders(shop.id), loadProducts(shop.id), loadShop(shop.id)]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await clearShopSession();
    router.replace('/');
  };

  const sendEmail = async (type: string, to: string, data: Record<string, any>, orderId?: string) => {
    try {
      const { SUPABASE_URL } = { SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL };
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(`${SUPABASE_URL}/functions/v1/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ type, to, data, orderId, userType: 'shop' }),
      });
    } catch {}
  };

  const updateOrderStatus = async (order: ShopOrder, newStatus: string) => {
    const updates: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'confirmed') updates.confirmed_at = new Date().toISOString();
    if (newStatus === 'picked_up') updates.picked_up_at = new Date().toISOString();
    if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString();
    if (newStatus === 'cancelled') updates.cancelled_at = new Date().toISOString();

    const { error: err } = await supabase
      .from('shop_orders')
      .update(updates)
      .eq('id', order.id);
    if (err) {
      setError(err.message);
      return;
    }

    if (order.customer_email) {
      sendEmail('shop_order_status', order.customer_email, {
        orderNumber: order.id.slice(0, 8),
        statusTo: newStatus,
      }, order.id);
    }

    if (shop) loadOrders(shop.id);
    setSelectedOrder(null);
    setShowOrderModal(false);
  };

  const openOrderDetail = async (order: ShopOrder) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
    setAssignError('');
    const { data, error: rpcErr } = await supabase.rpc('get_eligible_drivers', { p_university_id: null });
    if (rpcErr) {
      setAvailableDrivers([]);
      return;
    }
    setAvailableDrivers((data || []) as Driver[]);
  };

  const assignMessenger = async (driverId: string) => {
    if (!selectedOrder || !shop) return;
    setAssigningDriver(true);
    setAssignError('');
    try {
      const { data, error: rpcErr } = await supabase.rpc('assign_shop_driver', {
        p_order_id: selectedOrder.id,
        p_driver_id: driverId,
      });
      if (rpcErr) {
        setAssignError(rpcErr.message);
        setAssigningDriver(false);
        return;
      }
      const result = data as { success?: boolean; error?: string; driver_name?: string; driver_phone?: string; driver_whatsapp?: string } | null;
      if (result && result.success === false) {
        setAssignError(result.error || 'Assignment failed');
        setAssigningDriver(false);
        return;
      }
      if (result?.driver_phone || result?.driver_whatsapp) {
        try {
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
          await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
            body: JSON.stringify({
              orderId: selectedOrder.id,
              orderNumber: selectedOrder.id.slice(0, 8),
              driverId,
              driverPhone: result.driver_phone,
              driverWhatsApp: result.driver_whatsapp,
              shopName: shop.name,
              shopAddress: shop.address || shop.name,
              shopWhatsApp: shop.whatsapp_number || null,
              recipientType: 'driver',
              customerName: selectedOrder.customer_name || 'Customer',
              customerPhone: selectedOrder.customer_phone || 'N/A',
              deliveryLocation: selectedOrder.delivery_location || 'See app',
              items: (selectedOrder.products || []).map((p: any) => ({ name: p.name, qty: p.qty, price: p.price })),
              totalAmount: Number(selectedOrder.total_amount) || 0,
              deliveryFee: Number(selectedOrder.delivery_fee) || 0,
              paymentMethod: selectedOrder.payment_method || 'pay_on_delivery',
            }),
          });
        } catch {}
      }
      setAssigningDriver(false);
      setSelectedOrder(null);
      setShowOrderModal(false);
      loadOrders(shop.id);
    } catch (e: any) {
      setAssignError(e.message || 'Assignment failed');
      setAssigningDriver(false);
    }
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductName('');
    setProductPrice('');
    setProductStock('');
    setProductCategory('');
    setProductDesc('');
    setProductAvailable(true);
    setProductImageUri(null);
    setShowProductModal(true);
  };

  const openEditProduct = (p: ShopProduct) => {
    setEditingProduct(p);
    setProductName(p.name);
    setProductPrice(String(p.price));
    setProductStock(String(p.stock));
    setProductCategory(p.category || '');
    setProductDesc(p.description || '');
    setProductAvailable(p.is_available !== false);
    setProductImageUri(null);
    setShowProductModal(true);
  };

  const pickProductImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setProductImageUri(result.assets[0].uri);
    }
  };

  const saveProduct = async () => {
    if (!shop || !productName.trim() || !productPrice.trim()) {
      setError('Product name and price are required');
      return;
    }
    setSavingProduct(true);
    setError('');
    try {
      let imageUrl = editingProduct?.image_url || null;
      if (productImageUri) {
        const fileExt = productImageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `product-${Date.now()}.${fileExt}`;
        const response = await fetch(productImageUri);
        const blob = await response.blob();
        const { error: upErr } = await supabase.storage
          .from('shop-assets')
          .upload(fileName, blob, { contentType: blob.type || 'image/jpeg' });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('shop-assets').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      const payload = {
        shop_id: shop.id,
        name: productName.trim(),
        description: productDesc.trim() || null,
        image_url: imageUrl,
        price: parseFloat(productPrice) || 0,
        stock: parseInt(productStock) || 0,
        category: productCategory.trim() || null,
        is_available: productAvailable,
      };

      if (editingProduct) {
        const { error: err } = await supabase
          .from('shop_products')
          .update(payload)
          .eq('id', editingProduct.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('shop_products')
          .insert(payload);
        if (err) throw err;
      }

      setShowProductModal(false);
      await loadProducts(shop.id);
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSavingProduct(false);
    }
  };

  const toggleProductAvailability = async (p: ShopProduct) => {
    const next = p.is_available === false;
    const { error: err } = await supabase
      .from('shop_products')
      .update({ is_available: next })
      .eq('id', p.id);
    if (err) {
      setError(err.message);
      return;
    }
    if (shop) loadProducts(shop.id);
  };

  const deleteProduct = async (productId: string) => {
    const { error: err } = await supabase
      .from('shop_products')
      .delete()
      .eq('id', productId);
    if (err) {
      setError(err.message);
      return;
    }
    if (shop) loadProducts(shop.id);
  };

  const submitPayment = async () => {
    if (!shop) return;
    setPaynowLoading(true);
    setError('');
    try {
      const { startPaynowPayment, generateReference } = await import('@/lib/paynow-service');
      const ref = generateReference('shop_registration', shop.id);
      const result = await startPaynowPayment({
        paymentType: 'shop_registration',
        entityId: shop.id,
        amount: registrationFee,
        reference: ref,
        description: `UniLink Shop Registration - ${shop.name}`,
        metadata: { shop_id: shop.id, shop_name: shop.name },
      });
      if (!result.success) {
        setError(result.error || 'Failed to start Paynow payment');
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setPaynowLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonList count={5} lines={3} />
      </View>
    );
  }

  if (!shop) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: A.textSub }}>No shop found</Text>
      </View>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'delivered');
  const totalSales = completedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const canManageShop = shop.status === 'active';

  const renderStatusBanner = () => {
    const s = shop.status as ShopStatus;
    const banners: Record<string, { color: string; bg: string; text: string; icon: any }> = {
      pending_approval: { color: A.amber, bg: A.amberDim, text: 'Your shop is pending admin approval. You will be notified by email once reviewed.', icon: Clock },
      payment_required: { color: A.amber, bg: A.amberDim, text: `Registration fee of $${registrationFee.toFixed(2)} is required to activate your shop.`, icon: DollarSign },
      payment_submitted: { color: A.cyan, bg: A.cyanDim, text: 'Payment submitted. Waiting for admin verification.', icon: Clock },
      suspended: { color: A.red, bg: A.redDim, text: 'Your shop has been suspended. Please contact admin.', icon: XCircle },
      rejected: { color: A.red, bg: A.redDim, text: shop.rejection_reason ? `Application rejected: ${shop.rejection_reason}` : 'Your application was rejected. Please contact admin.', icon: XCircle },
    };
    const banner = banners[s];
    if (!banner) return null;
    const Icon = banner.icon;
    return (
      <View style={[styles.statusBanner, { backgroundColor: banner.bg, borderColor: banner.color }]}>
        <Icon size={18} color={banner.color} />
        <Text style={[styles.statusBannerText, { color: banner.color }]}>{banner.text}</Text>
      </View>
    );
  };

  const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: 'orders', label: 'Orders', icon: ShoppingBag },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'history', label: 'History', icon: Clock },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    { key: 'messages', label: 'Messages', icon: MessageSquare },
    { key: 'profile', label: 'Profile', icon: Store },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogoBox}>
            <Store size={20} color={A.cyan} />
          </View>
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>{shop.name}</Text>
            <Text style={styles.headerSub}>{STATUS_LABELS[shop.status] || shop.status}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => router.push('/shop/merchant-policy')}>
            <ShieldCheck size={16} color={A.cyan} />
            <Text style={[styles.logoutText, { color: A.cyan }]}>Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={16} color={A.red} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {renderStatusBanner()}

        {newOrderBanner && (
          <Animated.View
            style={[
              styles.newOrderBanner,
              {
                opacity: bannerAnim,
                transform: [
                  {
                    translateY: bannerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-40, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Bell size={16} color="#000" />
            <Text style={styles.newOrderText}>{newOrderBanner}</Text>
          </Animated.View>
        )}

        {shop.status === 'payment_required' && (
          <View style={styles.paymentCard}>
            <DollarSign size={24} color={A.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>Registration Fee: ${registrationFee.toFixed(2)}</Text>
              <Text style={styles.paymentSub}>Pay via Paynow (EcoCash, OneMoney, Card, Bank Transfer)</Text>
            </View>
            <TouchableOpacity style={[styles.payBtn, { opacity: paynowLoading ? 0.6 : 1 }]} onPress={submitPayment} disabled={paynowLoading}>
              {paynowLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.payBtnText}>Pay via Paynow</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {canManageShop && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <ShoppingBag size={18} color={A.cyan} />
              <Text style={styles.statValue}>{pendingOrders.length}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Truck size={18} color={A.orange} />
              <Text style={styles.statValue}>{activeOrders.length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statCard}>
              <TrendingUp size={18} color={A.green} />
              <Text style={styles.statValue}>${totalSales.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Sales</Text>
            </View>
            <View style={styles.statCard}>
              <Package size={18} color={A.blue} />
              <Text style={styles.statValue}>{products.length}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
          </View>
        )}

        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && { borderBottomColor: A.cyan, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Icon size={15} color={active ? A.cyan : A.textSub} />
                <Text style={[styles.tabText, { color: active ? A.cyan : A.textSub }]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? (
          <View style={styles.errorBar}>
            <AlertCircle size={14} color={A.red} />
            <Text style={{ color: A.red, fontSize: 12, flex: 1 }}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')}>
              <X size={14} color={A.red} />
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={A.cyan} />}
        >
          {activeTab === 'orders' && (
            <View style={{ gap: 10 }}>
              {orders.length === 0 ? (
                <View style={styles.emptyState}>
                  <ShoppingBag size={40} color={A.textMuted} />
                  <Text style={styles.emptyText}>No orders yet</Text>
                </View>
              ) : (
                orders.map((order) => {
                  const statusColor = STATUS_COLORS[order.status] || A.textSub;
                  return (
                    <TouchableOpacity
                      key={order.id}
                      style={styles.orderCard}
                      onPress={() => canManageShop && openOrderDetail(order)}
                      disabled={!canManageShop}
                    >
                      <View style={styles.orderHeader}>
                        <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
                        <View style={[styles.orderStatusBadge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
                          <Text style={[styles.orderStatusText, { color: statusColor }]}>
                            {STATUS_LABELS[order.status] || order.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.orderCustomer}>{order.customer_name || 'Customer'}</Text>
                      <Text style={styles.orderItems}>
                        {Array.isArray(order.products) ? `${order.products.length} item(s)` : '—'}
                      </Text>
                      <View style={styles.orderFooter}>
                        <Text style={styles.orderTotal}>${Number(order.total_amount).toFixed(2)}</Text>
                        <Text style={styles.orderTime}>
                          {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {activeTab === 'products' && (
            <View style={{ gap: 10 }}>
              {canManageShop && (
                <TouchableOpacity style={styles.addProductBtn} onPress={openAddProduct}>
                  <Plus size={18} color={A.cyan} />
                  <Text style={styles.addProductText}>Add Product</Text>
                </TouchableOpacity>
              )}
              {products.length === 0 ? (
                <View style={styles.emptyState}>
                  <Package size={40} color={A.textMuted} />
                  <Text style={styles.emptyText}>No products yet</Text>
                </View>
              ) : (
                products.map((p) => {
                  const outOfStock = p.stock <= 0;
                  const avail = p.is_available !== false;
                  return (
                    <View key={p.id} style={styles.productCard}>
                      {p.image_url ? (
                        Platform.OS === 'web' ? (
                          <img src={p.image_url} style={styles.productThumb} alt={p.name} />
                        ) : (
                          <RNImage source={{ uri: p.image_url }} style={styles.productThumbNative} />
                        )
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <View style={styles.productNameRow}>
                          <Text style={styles.productName}>{p.name}</Text>
                          {outOfStock && (
                            <View style={styles.oosBadge}>
                              <Ban size={9} color="#fff" />
                              <Text style={styles.oosText}>OUT OF STOCK</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.productPrice}>${Number(p.price).toFixed(2)}</Text>
                        <View style={styles.productMeta}>
                          <Text style={[styles.productStock, { color: outOfStock ? A.red : A.green }]}>
                            Stock: {p.stock}
                          </Text>
                          {p.category ? <Text style={styles.productCategory}>{p.category}</Text> : null}
                        </View>
                      </View>
                      {canManageShop && (
                        <View style={{ gap: 8, alignItems: 'flex-end' }}>
                          <TouchableOpacity
                            style={[styles.availToggleSmall, { backgroundColor: avail ? A.greenDim : A.inputBg, borderColor: avail ? A.green : A.border }]}
                            onPress={() => toggleProductAvailability(p)}
          >
                            <View style={[styles.availDotSmall, { backgroundColor: avail ? A.green : A.textMuted }]} />
                            <Text style={[styles.availToggleText, { color: avail ? A.green : A.textSub }]}>
                              {avail ? 'On' : 'Off'}
                            </Text>
                          </TouchableOpacity>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity style={styles.editBtn} onPress={() => openEditProduct(p)}>
                              <Text style={styles.editBtnText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProduct(p.id)}>
                              <Trash2 size={16} color={A.red} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {activeTab === 'history' && <HistoryTab orders={orders} />}

          {activeTab === 'analytics' && <AnalyticsTab orders={orders} products={products} />}

          {activeTab === 'messages' && (
            <TouchableOpacity style={styles.chatLinkCard} onPress={() => router.push('/shop/chat')} activeOpacity={0.8}>
              <View style={styles.chatLinkIcon}>
                <MessageSquare size={22} color={A.cyan} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatLinkTitle}>Customer Messages</Text>
                <Text style={styles.chatLinkSub}>Chat with customers about their orders</Text>
              </View>
              <ChevronRight size={18} color={A.textSub} />
            </TouchableOpacity>
          )}

          {activeTab === 'profile' && (
            <ProfileTab shop={shop} onLogout={handleLogout} onShopUpdated={(s) => setShop(s)} />
          )}
        </ScrollView>
      </Animated.View>

      <OrderDetailModal
        visible={showOrderModal}
        order={selectedOrder}
        drivers={availableDrivers}
        assigningDriver={assigningDriver}
        assignError={assignError}
        onClose={() => { setShowOrderModal(false); setSelectedOrder(null); }}
        onUpdateStatus={updateOrderStatus}
        onAssignDriver={assignMessenger}
        onChat={(o) => {
          setShowOrderModal(false);
          setSelectedOrder(null);
          router.push({ pathname: '/shop/chat', params: { customerId: o.customer_id!, orderId: o.id } });
        }}
      />

      {/* Product Modal */}
      <Modal visible={showProductModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add Product'}</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <X size={22} color={A.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={productName}
                  onChangeText={setProductName}
                  placeholder="e.g. Bread"
                  placeholderTextColor={A.textMuted}
                />
              </View>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Price *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={productPrice}
                    onChangeText={setProductPrice}
                    placeholder="0.00"
                    placeholderTextColor={A.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Stock</Text>
                  <TextInput
                    style={styles.textInput}
                    value={productStock}
                    onChangeText={setProductStock}
                    placeholder="0"
                    placeholderTextColor={A.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <TextInput
                  style={styles.textInput}
                  value={productCategory}
                  onChangeText={setProductCategory}
                  placeholder="e.g. Groceries"
                  placeholderTextColor={A.textMuted}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 60 }]}
                  value={productDesc}
                  onChangeText={setProductDesc}
                  placeholder="Product description"
                  placeholderTextColor={A.textMuted}
                  multiline
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Availability</Text>
                <TouchableOpacity
                  style={[styles.availRow, { backgroundColor: productAvailable ? A.greenDim : A.inputBg, borderColor: productAvailable ? A.green : A.border }]}
                  onPress={() => setProductAvailable((v) => !v)}
                >
                  <View style={[styles.availDotSmall, { backgroundColor: productAvailable ? A.green : A.textMuted }]} />
                  <Text style={[styles.availToggleText, { color: productAvailable ? A.green : A.textSub }]}>
                    {productAvailable ? 'Available for sale' : 'Hidden from customers'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Image</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickProductImage}>
                  {productImageUri ? (
                    Platform.OS === 'web' ? (
                      <img src={productImageUri} style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover' as any }} alt="Product" />
                    ) : (
                      <RNImage source={{ uri: productImageUri }} style={{ width: 80, height: 80, borderRadius: 10 }} />
                    )
                  ) : (
                    <>
                      <ImageIcon size={24} color={A.cyan} />
                      <Text style={styles.imagePickerText}>Choose Image</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { opacity: savingProduct ? 0.6 : 1 }]}
              onPress={saveProduct}
              disabled={savingProduct}
            >
              {savingProduct ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={styles.saveBtnText}>{editingProduct ? 'Update' : 'Add'} Product</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: A.bg },
  loadingContainer: { flex: 1, backgroundColor: A.bg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: A.surface,
    borderBottomWidth: 1, borderBottomColor: A.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerLogoBox: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: A.cyanDim,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: A.text },
  headerSub: { fontSize: 11, color: A.textSub, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: A.redDim, borderWidth: 1, borderColor: A.red,
  },
  logoutText: { color: A.red, fontSize: 12, fontWeight: '600' },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  statusBannerText: { fontSize: 12, flex: 1, lineHeight: 18 },
  newOrderBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: A.cyan, borderBottomWidth: 1, borderBottomColor: A.cyan,
  },
  newOrderText: { color: '#000', fontSize: 13, fontWeight: '700', flex: 1 },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, padding: 16, backgroundColor: A.card, borderRadius: 12,
    borderWidth: 1, borderColor: A.border,
  },
  paymentTitle: { fontSize: 15, fontWeight: '700', color: A.text },
  paymentSub: { fontSize: 12, color: A.textSub, marginTop: 2 },
  payBtn: {
    backgroundColor: A.amber, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10,
  },
  payBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  statCard: {
    flex: 1, backgroundColor: A.card, borderRadius: 10, padding: 12,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: A.border,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: A.text },
  statLabel: { fontSize: 10, color: A.textSub },
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: A.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 12,
  },
  tabText: { fontSize: 12, fontWeight: '600' },
  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: A.redDim,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: A.textSub, fontSize: 14 },
  orderCard: {
    backgroundColor: A.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: A.border,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 14, fontWeight: '700', color: A.text },
  orderStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  orderStatusText: { fontSize: 10, fontWeight: '600' },
  orderCustomer: { fontSize: 13, color: A.textSub, marginTop: 6 },
  orderItems: { fontSize: 12, color: A.textMuted, marginTop: 2 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  orderTotal: { fontSize: 15, fontWeight: '700', color: A.green },
  orderTime: { fontSize: 11, color: A.textMuted },
  addProductBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: A.cyanDim, borderRadius: 10, paddingVertical: 14,
    borderWidth: 1, borderColor: A.cyan, borderStyle: 'dashed' as any,
  },
  addProductText: { color: A.cyan, fontSize: 14, fontWeight: '600' },
  productCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: A.card,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: A.border, gap: 12,
  },
  productThumb: { width: 48, height: 48, borderRadius: 8, objectFit: 'cover' as any, flexShrink: 0 },
  productThumbNative: { width: 48, height: 48, borderRadius: 8, flexShrink: 0 },
  productNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: A.text, flexShrink: 1 },
  oosBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: A.red, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  oosText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  productPrice: { fontSize: 15, fontWeight: '700', color: A.green, marginTop: 4 },
  productMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  productStock: { fontSize: 11, fontWeight: '500' },
  productCategory: { fontSize: 11, color: A.textSub },
  availToggleSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
  },
  availDotSmall: { width: 7, height: 7, borderRadius: 4 },
  availToggleText: { fontSize: 10, fontWeight: '700' },
  editBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.cyan,
  },
  editBtnText: { color: A.cyan, fontSize: 12, fontWeight: '600' },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 6, backgroundColor: A.redDim,
    borderWidth: 1, borderColor: A.red, justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: A.overlay, justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: A.text },
  inputGroup: { marginBottom: 14 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: A.textSub, marginBottom: 6 },
  textInput: {
    backgroundColor: A.inputBg, borderRadius: 10, borderWidth: 1, borderColor: A.inputBorder,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: A.text,
  },
  availRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 10, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14,
  },
  imagePickerBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: A.inputBg, borderRadius: 10, borderWidth: 1.5, borderColor: A.inputBorder,
    paddingVertical: 24, borderStyle: 'dashed' as any,
  },
  imagePickerText: { color: A.cyan, fontSize: 13, fontWeight: '600' },
  saveBtn: {
    backgroundColor: A.cyan, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  chatLinkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18,
    backgroundColor: A.card, borderRadius: 14, borderWidth: 1, borderColor: A.border,
  },
  chatLinkIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: A.cyanDim,
    justifyContent: 'center', alignItems: 'center',
  },
  chatLinkTitle: { fontSize: 15, fontWeight: '700', color: A.text },
  chatLinkSub: { fontSize: 12, color: A.textSub, marginTop: 3 },
});
