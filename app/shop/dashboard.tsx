import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { loadShopSession, clearShopSession, type ShopSessionData } from '@/lib/shop-session-service';
import { A } from '@/lib/admin-theme';
import { SkeletonList } from '@/components/Skeleton';
import { Store, Package, ShoppingBag, LogOut, Plus, Trash2, CircleCheck as CheckCircle, Circle as XCircle, Clock, Truck, DollarSign, TrendingUp, X, Image as ImageIcon, CircleAlert as AlertCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

type ShopStatus = 'pending_approval' | 'payment_required' | 'payment_submitted' | 'active' | 'suspended' | 'rejected';

type ShopOrder = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  products: any[];
  total_amount: number;
  delivery_fee: number;
  delivery_location: string | null;
  payment_method: string;
  status: string;
  messenger_id: string | null;
  created_at: string;
};

type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  stock: number;
  category: string | null;
  status: string;
};

type Driver = {
  id: string;
  full_name: string;
  phone_number: string;
  approval_status: string;
  is_available: boolean;
};

const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
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

export default function ShopDashboard() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [session, setSession] = useState<ShopSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<any>(null);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [registrationFee, setRegistrationFee] = useState(10);
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'profile'>('orders');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Product modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productImageUri, setProductImageUri] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Order detail modal
  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [assigningDriver, setAssigningDriver] = useState(false);

  useEffect(() => {
    initDashboard();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // Realtime subscription for new orders and products
  useEffect(() => {
    if (!shop) return;
    const channel = supabase
      .channel('shop-orders-realtime')
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'shop_orders', filter: `shop_id=eq.${shop.id}` } as any,
        () => loadOrders(shop.id)
      )
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'shop_products', filter: `shop_id=eq.${shop.id}` } as any,
        () => loadProducts(shop.id)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shop]);

  const initDashboard = async () => {
    const sess = await loadShopSession();
    if (!sess) {
      router.replace('/shop/login');
      return;
    }
    setSession(sess);
    await Promise.all([loadShop(sess.shopId), loadSettings()]);
    setLoading(false);
  };

  const loadShop = async (shopId: string) => {
    const { data, error: err } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .maybeSingle();
    if (err) { setError(err.message); return; }
    if (!data) { router.replace('/shop/login'); return; }
    setShop(data);
    await Promise.all([loadOrders(shopId), loadProducts(shopId)]);
  };

  const loadOrders = async (shopId: string) => {
    const { data, error: err } = await supabase
      .from('shop_orders')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); return; }
    setOrders(data || []);
  };

  const loadProducts = async (shopId: string) => {
    const { data, error: err } = await supabase
      .from('shop_products')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); return; }
    setProducts(data || []);
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
    if (err) { setError(err.message); return; }

    // Send status update email to customer
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
    // Load available drivers
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, full_name, phone_number, approval_status, is_available')
      .eq('approval_status', 'approved')
      .eq('is_available', true);
    setAvailableDrivers(drivers || []);
  };

  const assignMessenger = async (driverId: string, driverName: string) => {
    if (!selectedOrder || !shop) return;
    setAssigningDriver(true);
    const { error: err } = await supabase
      .from('shop_orders')
      .update({
        messenger_id: driverId,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', selectedOrder.id);
    if (err) { setError(err.message); setAssigningDriver(false); return; }

    // Notify messenger via email if they have one
    const { data: driver } = await supabase
      .from('drivers')
      .select('email')
      .eq('id', driverId)
      .maybeSingle();
    if (driver?.email) {
      sendEmail('shop_messenger_assigned', driver.email, {
        orderNumber: selectedOrder.id.slice(0, 8),
        messengerName: driverName,
        pickup: shop.address || shop.name,
        delivery: selectedOrder.delivery_location || 'See app',
      }, selectedOrder.id);
    }

    setAssigningDriver(false);
    setSelectedOrder(null);
    setShowOrderModal(false);
    loadOrders(shop.id);
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductName(''); setProductPrice(''); setProductStock('');
    setProductCategory(''); setProductDesc(''); setProductImageUri(null);
    setShowProductModal(true);
  };

  const openEditProduct = (p: ShopProduct) => {
    setEditingProduct(p);
    setProductName(p.name); setProductPrice(String(p.price));
    setProductStock(String(p.stock)); setProductCategory(p.category || '');
    setProductDesc(p.description || ''); setProductImageUri(null);
    setShowProductModal(true);
  };

  const pickProductImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Permission required'); return; }
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

  const deleteProduct = async (productId: string) => {
    const { error: err } = await supabase
      .from('shop_products')
      .delete()
      .eq('id', productId);
    if (err) { setError(err.message); return; }
    if (shop) loadProducts(shop.id);
  };

  const submitPayment = async () => {
    if (!shop) return;
    const { error: err } = await supabase
      .from('shops')
      .update({ status: 'payment_submitted', payment_proof: 'manual_submission' })
      .eq('id', shop.id);
    if (err) { setError(err.message); return; }
    await loadShop(shop.id);
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

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'delivered');
  const totalSales = completedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

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

  const canManageShop = shop.status === 'active';

  return (
    <View style={styles.container}>
      {/* Header */}
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
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <LogOut size={16} color={A.red} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {renderStatusBanner()}

        {/* Payment action */}
        {shop.status === 'payment_required' && (
          <View style={styles.paymentCard}>
            <DollarSign size={24} color={A.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>Registration Fee: ${registrationFee.toFixed(2)}</Text>
              <Text style={styles.paymentSub}>Pay via EcoCash to activate your shop</Text>
            </View>
            <TouchableOpacity style={styles.payBtn} onPress={submitPayment}>
              <Text style={styles.payBtnText}>Submit Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats */}
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

        {/* Tabs */}
        <View style={styles.tabBar}>
          {([
            { key: 'orders', label: 'Orders', icon: ShoppingBag },
            { key: 'products', label: 'Products', icon: Package },
            { key: 'profile', label: 'Profile', icon: Store },
          ] as const).map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && { borderBottomColor: A.cyan, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Icon size={16} color={active ? A.cyan : A.textSub} />
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
                orders.map(order => {
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
                products.map(p => (
                  <View key={p.id} style={styles.productCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{p.name}</Text>
                      <Text style={styles.productPrice}>${Number(p.price).toFixed(2)}</Text>
                      <View style={styles.productMeta}>
                        <Text style={[styles.productStock, { color: p.stock > 0 ? A.green : A.red }]}>
                          Stock: {p.stock}
                        </Text>
                        {p.category && <Text style={styles.productCategory}>{p.category}</Text>}
                      </View>
                    </View>
                    {canManageShop && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => openEditProduct(p)}>
                          <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProduct(p.id)}>
                          <Trash2 size={16} color={A.red} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'profile' && (
            <View style={{ gap: 16 }}>
              <View style={styles.profileCard}>
                <Text style={styles.profileSectionTitle}>Shop Information</Text>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Name</Text>
                  <Text style={styles.profileValue}>{shop.name}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Email</Text>
                  <Text style={styles.profileValue}>{shop.contact_email}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Phone</Text>
                  <Text style={styles.profileValue}>{shop.contact_phone}</Text>
                </View>
                {shop.address && (
                  <View style={styles.profileRow}>
                    <Text style={styles.profileLabel}>Address</Text>
                    <Text style={styles.profileValue}>{shop.address}</Text>
                  </View>
                )}
                {shop.hours && (
                  <View style={styles.profileRow}>
                    <Text style={styles.profileLabel}>Hours</Text>
                    <Text style={styles.profileValue}>{shop.hours}</Text>
                  </View>
                )}
                {shop.ecocash_number && (
                  <View style={styles.profileRow}>
                    <Text style={styles.profileLabel}>EcoCash</Text>
                    <Text style={styles.profileValue}>{shop.ecocash_number}</Text>
                  </View>
                )}
                {shop.description && (
                  <View style={styles.profileRow}>
                    <Text style={styles.profileLabel}>Description</Text>
                    <Text style={styles.profileValue}>{shop.description}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
                <LogOut size={18} color={A.red} />
                <Text style={{ color: A.red, fontSize: 15, fontWeight: '600' }}>Logout</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Order Detail Modal */}
      <Modal visible={showOrderModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOrder && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Order #{selectedOrder.id.slice(0, 8)}</Text>
                  <TouchableOpacity onPress={() => { setShowOrderModal(false); setSelectedOrder(null); }}>
                    <X size={22} color={A.textSub} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 400 }}>
                  <Text style={styles.modalSectionLabel}>Customer</Text>
                  <Text style={styles.modalText}>{selectedOrder.customer_name || '—'}</Text>
                  {selectedOrder.customer_phone && <Text style={styles.modalText}>{selectedOrder.customer_phone}</Text>}

                  <Text style={styles.modalSectionLabel}>Delivery Location</Text>
                  <Text style={styles.modalText}>{selectedOrder.delivery_location || '—'}</Text>

                  <Text style={styles.modalSectionLabel}>Items</Text>
                  {(Array.isArray(selectedOrder.products) ? selectedOrder.products : []).map((item: any, i: number) => (
                    <View key={i} style={styles.modalItemRow}>
                      <Text style={styles.modalItemName}>{item.name} ×{item.qty || 1}</Text>
                      <Text style={styles.modalItemPrice}>${Number(item.price || 0).toFixed(2)}</Text>
                    </View>
                  ))}

                  <View style={styles.modalTotalRow}>
                    <Text style={styles.modalTotalLabel}>Total</Text>
                    <Text style={styles.modalTotalValue}>${Number(selectedOrder.total_amount).toFixed(2)}</Text>
                  </View>

                  <Text style={styles.modalSectionLabel}>Payment Method</Text>
                  <Text style={styles.modalText}>{selectedOrder.payment_method}</Text>
                </ScrollView>

                {/* Action buttons based on status */}
                <View style={styles.modalActions}>
                  {selectedOrder.status === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: A.green }] }
                        onPress={() => updateOrderStatus(selectedOrder, 'confirmed')}
                      >
                        <CheckCircle size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: A.red }]}
                        onPress={() => updateOrderStatus(selectedOrder, 'cancelled')}
                      >
                        <XCircle size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {selectedOrder.status === 'confirmed' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: A.blue }]}
                      onPress={() => updateOrderStatus(selectedOrder, 'preparing')}
                    >
                      <Text style={styles.actionBtnText}>Start Preparing</Text>
                    </TouchableOpacity>
                  )}
                  {selectedOrder.status === 'preparing' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: A.cyan }]}
                      onPress={() => updateOrderStatus(selectedOrder, 'ready')}
                    >
                      <Text style={styles.actionBtnText}>Mark Ready</Text>
                    </TouchableOpacity>
                  )}
                  {selectedOrder.status === 'ready' && (
                    <View style={{ width: '100%' }}>
                      <Text style={styles.assignLabel}>Assign a Messenger:</Text>
                      {availableDrivers.length === 0 ? (
                        <Text style={styles.noDriversText}>No available messengers. Please check back later.</Text>
                      ) : (
                        <ScrollView style={{ maxHeight: 200 }}>
                          {availableDrivers.map(d => (
                            <TouchableOpacity
                              key={d.id}
                              style={styles.driverRow}
                              onPress={() => assignMessenger(d.id, d.full_name)}
                              disabled={assigningDriver}
                            >
                              <View>
                                <Text style={styles.driverName}>{d.full_name}</Text>
                                <Text style={styles.driverPhone}>{d.phone_number}</Text>
                              </View>
                              <Truck size={18} color={A.cyan} />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  )}
                  {selectedOrder.status === 'picked_up' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: A.orange }]}
                      onPress={() => updateOrderStatus(selectedOrder, 'out_for_delivery')}
                    >
                      <Text style={styles.actionBtnText}>Out for Delivery</Text>
                    </TouchableOpacity>
                  )}
                  {selectedOrder.status === 'out_for_delivery' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: A.green }]}
                      onPress={() => updateOrderStatus(selectedOrder, 'delivered')}
                    >
                      <CheckCircle size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Mark Delivered</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

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

            <ScrollView style={{ maxHeight: 400 }}>
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
                <Text style={styles.inputLabel}>Product Image</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickProductImage}>
                  {productImageUri ? (
                    Platform.OS === 'web' ? (
                      <img src={productImageUri} style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover' as any }} alt="Product" />
                    ) : (
                      <ImageIcon size={24} color={A.cyan} />
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
    flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: A.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12,
  },
  tabText: { fontSize: 13, fontWeight: '600' },
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
  productName: { fontSize: 14, fontWeight: '600', color: A.text },
  productPrice: { fontSize: 15, fontWeight: '700', color: A.green, marginTop: 4 },
  productMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  productStock: { fontSize: 11, fontWeight: '500' },
  productCategory: { fontSize: 11, color: A.textSub },
  editBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.cyan,
  },
  editBtnText: { color: A.cyan, fontSize: 12, fontWeight: '600' },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 6, backgroundColor: A.redDim,
    borderWidth: 1, borderColor: A.red, justifyContent: 'center', alignItems: 'center',
  },
  profileCard: { backgroundColor: A.card, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: A.border },
  profileSectionTitle: { fontSize: 15, fontWeight: '700', color: A.text, marginBottom: 12 },
  profileRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  profileLabel: { fontSize: 11, color: A.textSub, fontWeight: '600', textTransform: 'uppercase' as any, letterSpacing: 0.5 },
  profileValue: { fontSize: 14, color: A.text, marginTop: 4 },
  logoutCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: A.redDim, borderRadius: 12, paddingVertical: 16,
    borderWidth: 1, borderColor: A.red,
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
  modalSectionLabel: { fontSize: 11, fontWeight: '700', color: A.textSub, textTransform: 'uppercase' as any, letterSpacing: 0.5, marginTop: 14, marginBottom: 4 },
  modalText: { fontSize: 14, color: A.text, lineHeight: 20 },
  modalItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  modalItemName: { fontSize: 13, color: A.text, flex: 1 },
  modalItemPrice: { fontSize: 13, color: A.green, fontWeight: '600' },
  modalTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: A.border, marginTop: 8,
  },
  modalTotalLabel: { fontSize: 15, fontWeight: '700', color: A.text },
  modalTotalValue: { fontSize: 17, fontWeight: '800', color: A.green },
  modalActions: {
    flexDirection: 'row', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: A.border, marginTop: 10,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 10, paddingVertical: 14,
  },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  assignLabel: { fontSize: 13, fontWeight: '600', color: A.text, marginBottom: 8 },
  noDriversText: { fontSize: 13, color: A.textSub, paddingVertical: 12 },
  driverRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14, backgroundColor: A.card,
    borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: A.border,
  },
  driverName: { fontSize: 14, fontWeight: '600', color: A.text },
  driverPhone: { fontSize: 12, color: A.textSub, marginTop: 2 },
  inputGroup: { marginBottom: 14 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: A.textSub, marginBottom: 6 },
  textInput: {
    backgroundColor: A.inputBg, borderRadius: 10, borderWidth: 1, borderColor: A.inputBorder,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: A.text,
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
});
