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
import { validateUpload } from '@/lib/upload-validation';
import { loadShopSession, clearShopSession } from '@/lib/shop-session-service';
import { useHardwareBackExit } from '@/hooks/useHardwareBackExit';
import { S } from '@/lib/shop-theme';
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
  Star,
  RefreshCw,
  Menu,
  Share2,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppShareButton } from '@/components/AppShareButton';

type TabKey = 'orders' | 'products' | 'history' | 'analytics' | 'messages' | 'profile';

export default function ShopDashboard() {
  const router = useRouter();
  useHardwareBackExit();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<ShopData | null>(null);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [registrationFee, setRegistrationFee] = useState(10);
  const [commissionRate, setCommissionRate] = useState<number | undefined>(undefined);
  const [ecocashNumber, setEcocashNumber] = useState<string | null>(null);
  const [ecocashName, setEcocashName] = useState<string | null>(null);
  const [commissionPaid, setCommissionPaid] = useState(0);
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
  const [showQuickMenu, setShowQuickMenu] = useState(false);

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
        () => {
          loadOrders(shop.id);
          // Reload again after a short delay to catch laggy DB replication
          setTimeout(() => loadOrders(shop.id), 500);
          setTimeout(() => loadOrders(shop.id), 1200);
        },
      )
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'shop_products', filter: `shop_id=eq.${shop.id}` } as any,
        () => {
          loadProducts(shop.id);
          setTimeout(() => loadProducts(shop.id), 500);
          setTimeout(() => loadProducts(shop.id), 1200);
        },
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

    // Check merchant terms acceptance
    const { data: currentPolicy } = await supabase
      .from('merchant_policies')
      .select('version')
      .eq('is_active', true)
      .maybeSingle();
    const shopData = data as any;
    if (!shopData.terms_accepted || (currentPolicy && shopData.terms_version !== currentPolicy.version)) {
      router.replace({ pathname: '/shop/terms', params: { shopId } });
      return;
    }

    setShop(shopData as ShopData);
    setCommissionPaid(Number(shopData.commission_paid) || 0);
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
      .select('registration_fee, commission_rate, payment_ecocash_number, payment_ecocash_name')
      .maybeSingle();
    if (data) {
      setRegistrationFee(Number(data.registration_fee));
      if (data.commission_rate != null) setCommissionRate(Number(data.commission_rate));
      setEcocashNumber(data.payment_ecocash_number || null);
      setEcocashName(data.payment_ecocash_name || null);
    }
  };

  const onRefresh = async () => {
    if (!shop) return;
    setRefreshing(true);
    await Promise.all([loadOrders(shop.id), loadProducts(shop.id), loadShop(shop.id)]);
    // Double-tap: reload again after a short delay to catch any laggy DB writes
    await new Promise((r) => setTimeout(r, 400));
    await Promise.all([loadOrders(shop.id), loadProducts(shop.id)]);
    setRefreshing(false);
  };

  const quickRefresh = async () => {
    setShowQuickMenu(false);
    if (!shop) return;
    setRefreshing(true);
    await Promise.all([loadOrders(shop.id), loadProducts(shop.id), loadShop(shop.id)]);
    await new Promise((r) => setTimeout(r, 300));
    await Promise.all([loadOrders(shop.id), loadProducts(shop.id)]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await clearShopSession();
    router.replace('/');
  };

  const sendEmail = async (type: string, to: string, data: Record<string, any>, orderId?: string, userType: string = 'shop') => {
    try {
      const { SUPABASE_URL } = { SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL };
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(`${SUPABASE_URL}/functions/v1/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ type, to, data, orderId, userType }),
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
      // Send email notification to the driver about the shop order assignment
      try {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('notification_email, email, full_name')
          .eq('id', driverId)
          .maybeSingle();
        const driverEmail = driverData?.notification_email || driverData?.email;
        if (driverEmail && driverEmail.includes('@')) {
          sendEmail('shop_messenger_assigned', driverEmail, {
            orderNumber: selectedOrder.id.slice(0, 8),
            orderId: selectedOrder.id,
            messengerName: driverData?.full_name || 'Driver',
            shopName: shop.name,
            pickup: shop.address || shop.name,
            delivery: selectedOrder.delivery_location || 'See app',
          }, selectedOrder.id, 'driver');
        }
      } catch {}
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
      const trimmedName = productName.trim();

      // Block duplicate product names within the same shop
      const { data: existing } = await supabase
        .from('shop_products')
        .select('id, name')
        .eq('shop_id', shop.id)
        .ilike('name', trimmedName);
      const duplicate = (existing || []).find((p: any) =>
        p.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        (!editingProduct || p.id !== editingProduct.id)
      );
      if (duplicate) {
        setError(`A product named "${trimmedName}" already exists in your shop. Use a different name.`);
        setSavingProduct(false);
        return;
      }

      let imageUrl = editingProduct?.image_url || null;
      if (productImageUri) {
        const fileExt = productImageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `product-${Date.now()}.${fileExt}`;
        const response = await fetch(productImageUri);
        const blob = await response.blob();
        const check = await validateUpload({ blob, fileNameOrUri: productImageUri });
        if (!check.ok) throw new Error(check.reason);
        const { error: upErr } = await supabase.storage
          .from('shop-assets')
          .upload(fileName, blob, { contentType: blob.type || 'image/jpeg' });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('shop-assets').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      const payload = {
        shop_id: shop.id,
        name: trimmedName,
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
        <Text style={{ color: S.textSub }}>No shop found</Text>
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
      pending_approval: { color: S.amber, bg: S.amberDim, text: 'Your shop is pending admin approval. You will be notified by email once reviewed.', icon: Clock },
      payment_required: { color: S.amber, bg: S.amberDim, text: `Registration fee of $${registrationFee.toFixed(2)} is required to activate your shop.`, icon: DollarSign },
      payment_submitted: { color: S.cyan, bg: S.cyanDim, text: 'Payment submitted. Waiting for admin verification.', icon: Clock },
      suspended: { color: S.red, bg: S.redDim, text: 'Your shop has been suspended. Please contact admin.', icon: XCircle },
      rejected: { color: S.red, bg: S.redDim, text: shop.rejection_reason ? `Application rejected: ${shop.rejection_reason}` : 'Your application was rejected. Please contact admin.', icon: XCircle },
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
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowQuickMenu(true)}
          activeOpacity={0.8}
          accessibilityLabel="Open shop menu"
        >
          <Menu size={22} color={S.blue} />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogoBox}>
            <ShoppingBag size={20} color={S.blue} />
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>UniLink</Text>
            <Text style={styles.headerSub} numberOfLines={1}>Shop Portal · {shop.name}</Text>
          </View>
        </View>
        <View style={styles.headerRightIcons}>
          <Bell size={21} color={S.blue} />
          <Store size={21} color={S.blue} />
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
            <DollarSign size={24} color={S.amber} />
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
              <ShoppingBag size={18} color={S.cyan} />
              <Text style={styles.statValue}>{pendingOrders.length}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Truck size={18} color={S.orange} />
              <Text style={styles.statValue}>{activeOrders.length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statCard}>
              <TrendingUp size={18} color={S.green} />
              <Text style={styles.statValue}>${totalSales.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Sales</Text>
            </View>
            <View style={styles.statCard}>
              <Package size={18} color={S.blue} />
              <Text style={styles.statValue}>{products.length}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
            {shop.average_rating != null && Number(shop.average_rating) > 0 ? (
              <View style={styles.statCard}>
                <Star size={18} color="#FFD700" fill="#FFD700" />
                <Text style={styles.statValue}>{Number(shop.average_rating).toFixed(1)}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            ) : null}
          </View>
        )}

        {error ? (
          <View style={styles.errorBar}>
            <AlertCircle size={14} color={S.red} />
            <Text style={{ color: S.red, fontSize: 12, flex: 1 }}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')}>
              <X size={14} color={S.red} />
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={S.cyan} />}
        >
          {activeTab === 'orders' && (
            <View style={{ gap: 10 }}>
              {orders.length === 0 ? (
                <View style={styles.emptyState}>
                  <ShoppingBag size={40} color={S.textMuted} />
                  <Text style={styles.emptyText}>No orders yet</Text>
                </View>
              ) : (
                orders.map((order) => {
                  const statusColor = STATUS_COLORS[order.status] || S.textSub;
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.orderTime}>
                            {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>
                      {canManageShop && order.status !== 'cancelled' && (
                        <TouchableOpacity
                          style={[styles.trackBtn, { backgroundColor: S.cyanDim, borderColor: S.cyan }]}
                          onPress={(e) => { e.stopPropagation?.(); openOrderDetail(order); }}
                          activeOpacity={0.8}
                        >
                          <Truck size={13} color={S.cyan} />
                          <Text style={[styles.trackBtnText, { color: S.cyan }]}>Track Order</Text>
                        </TouchableOpacity>
                      )}
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
                  <Plus size={18} color={S.cyan} />
                  <Text style={styles.addProductText}>Add Product</Text>
                </TouchableOpacity>
              )}
              {products.length === 0 ? (
                <View style={styles.emptyState}>
                  <Package size={40} color={S.textMuted} />
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
                          <Text style={[styles.productStock, { color: outOfStock ? S.red : S.green }]}>
                            Stock: {p.stock}
                          </Text>
                          {p.category ? <Text style={styles.productCategory}>{p.category}</Text> : null}
                        </View>
                      </View>
                      {canManageShop && (
                        <View style={{ gap: 8, alignItems: 'flex-end' }}>
                          <TouchableOpacity
                            style={[styles.availToggleSmall, { backgroundColor: avail ? S.greenDim : S.inputBg, borderColor: avail ? S.green : S.border }]}
                            onPress={() => toggleProductAvailability(p)}
          >
                            <View style={[styles.availDotSmall, { backgroundColor: avail ? S.green : S.textMuted }]} />
                            <Text style={[styles.availToggleText, { color: avail ? S.green : S.textSub }]}>
                              {avail ? 'On' : 'Off'}
                            </Text>
                          </TouchableOpacity>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity style={styles.editBtn} onPress={() => openEditProduct(p)}>
                              <Text style={styles.editBtnText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProduct(p.id)}>
                              <Trash2 size={16} color={S.red} />
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

          {activeTab === 'analytics' && <AnalyticsTab orders={orders} products={products} commissionRate={commissionRate} commissionDeadline={shop?.commission_deadline} commissionPaid={commissionPaid} ecocashNumber={ecocashNumber} ecocashName={ecocashName} />}

          {activeTab === 'messages' && (
            <TouchableOpacity style={styles.chatLinkCard} onPress={() => router.push('/shop/chat')} activeOpacity={0.8}>
              <View style={styles.chatLinkIcon}>
                <MessageSquare size={22} color={S.cyan} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatLinkTitle}>Customer Messages</Text>
                <Text style={styles.chatLinkSub}>Chat with customers about their orders</Text>
              </View>
              <ChevronRight size={18} color={S.textSub} />
            </TouchableOpacity>
          )}

          {activeTab === 'profile' && (
            <ProfileTab shop={shop} onLogout={handleLogout} onShopUpdated={(s) => setShop(s)} />
          )}
        </ScrollView>
      </Animated.View>

      <View style={styles.bottomNav}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.bottomTab}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Icon size={18} color={active ? S.blue : S.textMuted} />
              <Text style={[styles.bottomTabText, { color: active ? S.blue : S.textMuted }]}>{tab.label}</Text>
              {active && <View style={styles.bottomTabActive} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={showQuickMenu} transparent animationType="fade" onRequestClose={() => setShowQuickMenu(false)}>
        <View style={styles.quickMenuOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowQuickMenu(false)} />
          <View style={styles.quickMenuCard}>
            <View style={styles.quickMenuHeader}>
              <View>
                <Text style={styles.quickMenuTitle}>Shop tools</Text>
                <Text style={styles.quickMenuSub}>Quick actions for your portal</Text>
              </View>
              <TouchableOpacity onPress={() => setShowQuickMenu(false)}>
                <X size={20} color={S.textSub} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.quickMenuItem} onPress={quickRefresh} disabled={refreshing}>
              {refreshing ? <ActivityIndicator size={18} color={S.blue} /> : <RefreshCw size={18} color={S.blue} />}
              <Text style={styles.quickMenuItemText}>Refresh dashboard</Text>
              <ChevronRight size={16} color={S.textMuted} />
            </TouchableOpacity>
            <View style={styles.quickMenuItem}>
              <Share2 size={18} color={S.blue} />
              <View style={{ flex: 1 }}><AppShareButton accent={S.blue} /></View>
            </View>
            <TouchableOpacity style={styles.quickMenuItem} onPress={() => { setShowQuickMenu(false); router.push('/shop/merchant-policy'); }}>
              <ShieldCheck size={18} color={S.blue} />
              <Text style={styles.quickMenuItemText}>Merchant policy</Text>
              <ChevronRight size={16} color={S.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                <X size={22} color={S.textSub} />
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
                  placeholderTextColor={S.textMuted}
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
                    placeholderTextColor={S.textMuted}
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
                    placeholderTextColor={S.textMuted}
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
                  placeholderTextColor={S.textMuted}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 60 }]}
                  value={productDesc}
                  onChangeText={setProductDesc}
                  placeholder="Product description"
                  placeholderTextColor={S.textMuted}
                  multiline
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Availability</Text>
                <TouchableOpacity
                  style={[styles.availRow, { backgroundColor: productAvailable ? S.greenDim : S.inputBg, borderColor: productAvailable ? S.green : S.border }]}
                  onPress={() => setProductAvailable((v) => !v)}
                >
                  <View style={[styles.availDotSmall, { backgroundColor: productAvailable ? S.green : S.textMuted }]} />
                  <Text style={[styles.availToggleText, { color: productAvailable ? S.green : S.textSub }]}>
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
                      <ImageIcon size={24} color={S.cyan} />
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
  container: { flex: 1, backgroundColor: S.bg },
  loadingContainer: { flex: 1, backgroundColor: S.bg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#D9EAF8',
  },
  menuButton: {
    width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#EEF8FF',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  headerLogoBox: {
    width: 38, height: 38, borderRadius: 11, backgroundColor: '#E6F5FF',
    justifyContent: 'center', alignItems: 'center',
  },
  headerRightIcons: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 3 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#113B75' },
  headerSub: { fontSize: 11, color: '#4D83B6', marginTop: 1 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: S.redDim, borderWidth: 1, borderColor: S.red,
  },
  logoutText: { color: S.red, fontSize: 12, fontWeight: '600' },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  statusBannerText: { fontSize: 12, flex: 1, lineHeight: 18 },
  newOrderBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: S.cyan, borderBottomWidth: 1, borderBottomColor: S.cyan,
  },
  newOrderText: { color: '#000', fontSize: 13, fontWeight: '700', flex: 1 },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, padding: 16, backgroundColor: S.card, borderRadius: 12,
    borderWidth: 1, borderColor: S.border,
  },
  paymentTitle: { fontSize: 15, fontWeight: '700', color: S.text },
  paymentSub: { fontSize: 12, color: S.textSub, marginTop: 2 },
  payBtn: {
    backgroundColor: S.amber, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10,
  },
  payBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  statCard: {
    flex: 1, backgroundColor: S.card, borderRadius: 10, padding: 12,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: S.border,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: S.text },
  statLabel: { fontSize: 10, color: S.textSub },
  bottomNav: {
    flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-around',
    paddingHorizontal: 4, paddingTop: 8, paddingBottom: Platform.OS === 'web' ? 8 : 22,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#D9EAF8',
    shadowColor: '#0A5FB4', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  bottomTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 54, position: 'relative' },
  bottomTabText: { fontSize: 10, fontWeight: '700' },
  bottomTabActive: { position: 'absolute', top: -8, width: 28, height: 3, borderRadius: 2, backgroundColor: S.blue },
  quickMenuOverlay: { flex: 1, backgroundColor: 'rgba(7, 35, 70, 0.28)' },
  quickMenuCard: {
    position: 'absolute', top: 62, left: 12, width: 250, backgroundColor: '#FFFFFF',
    borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#CDE7FA',
    shadowColor: '#0A5FB4', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  quickMenuHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E5F0F8' },
  quickMenuTitle: { fontSize: 16, fontWeight: '800', color: '#113B75' },
  quickMenuSub: { fontSize: 11, color: '#6B93B6', marginTop: 2 },
  quickMenuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF5FA' },
  quickMenuItemText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1B4D7A' },

  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: S.redDim,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: S.textSub, fontSize: 14 },
  orderCard: {
    backgroundColor: S.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: S.border,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 14, fontWeight: '700', color: S.text },
  orderStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  orderStatusText: { fontSize: 10, fontWeight: '600' },
  orderCustomer: { fontSize: 13, color: S.textSub, marginTop: 6 },
  orderItems: { fontSize: 12, color: S.textMuted, marginTop: 2 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  orderTotal: { fontSize: 15, fontWeight: '700', color: S.green },
  orderTime: { fontSize: 11, color: S.textMuted },
  trackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginTop: 10 },
  trackBtnText: { fontSize: 12, fontWeight: '700' },
  addProductBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: S.cyanDim, borderRadius: 10, paddingVertical: 14,
    borderWidth: 1, borderColor: S.cyan, borderStyle: 'dashed' as any,
  },
  addProductText: { color: S.cyan, fontSize: 14, fontWeight: '600' },
  productCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: S.card,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: S.border, gap: 12,
  },
  productThumb: { width: 48, height: 48, borderRadius: 8, objectFit: 'cover' as any, flexShrink: 0 },
  productThumbNative: { width: 48, height: 48, borderRadius: 8, flexShrink: 0 },
  productNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: S.text, flexShrink: 1 },
  oosBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: S.red, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  oosText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  productPrice: { fontSize: 15, fontWeight: '700', color: S.green, marginTop: 4 },
  productMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  productStock: { fontSize: 11, fontWeight: '500' },
  productCategory: { fontSize: 11, color: S.textSub },
  availToggleSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
  },
  availDotSmall: { width: 7, height: 7, borderRadius: 4 },
  availToggleText: { fontSize: 10, fontWeight: '700' },
  editBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: S.cyanDim, borderWidth: 1, borderColor: S.cyan,
  },
  editBtnText: { color: S.cyan, fontSize: 12, fontWeight: '600' },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 6, backgroundColor: S.redDim,
    borderWidth: 1, borderColor: S.red, justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: S.overlay, justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: S.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: S.text },
  inputGroup: { marginBottom: 14 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: S.textSub, marginBottom: 6 },
  textInput: {
    backgroundColor: S.inputBg, borderRadius: 10, borderWidth: 1, borderColor: S.inputBorder,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: S.text,
  },
  availRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 10, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14,
  },
  imagePickerBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: S.inputBg, borderRadius: 10, borderWidth: 1.5, borderColor: S.inputBorder,
    paddingVertical: 24, borderStyle: 'dashed' as any,
  },
  imagePickerText: { color: S.cyan, fontSize: 13, fontWeight: '600' },
  saveBtn: {
    backgroundColor: S.cyan, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  chatLinkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18,
    backgroundColor: S.card, borderRadius: 14, borderWidth: 1, borderColor: S.border,
  },
  chatLinkIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: S.cyanDim,
    justifyContent: 'center', alignItems: 'center',
  },
  chatLinkTitle: { fontSize: 15, fontWeight: '700', color: S.text },
  chatLinkSub: { fontSize: 12, color: S.textSub, marginTop: 3 },

});
