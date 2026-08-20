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
import { loadUserData } from '@/lib/storage-service';
import { A } from '@/lib/admin-theme';
import { ArrowLeft, Store, Search, ShoppingCart, Plus, Minus, X, Package, MapPin, CreditCard, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Truck, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type Shop = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  address: string | null;
  hours: string | null;
  slug: string;
};

type Product = {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  stock: number;
  category: string | null;
  status: string;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type CartByShop = {
  shopId: string;
  shopName: string;
  items: CartItem[];
  total: number;
};

export default function Marketplace() {
  const router = useRouter();
  const { isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [customerId, setCustomerId] = useState<string | undefined>();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<Array<{ id: string; full_name: string; phone_number: string; whatsapp_number?: string | null; rating?: number; vehicle_type?: string | null }>>([]);
  const [selectedDriver, setSelectedDriver] = useState<{ id: string; full_name: string; phone_number: string; whatsapp_number?: string | null } | null>(null);
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  useEffect(() => {
    const stored = loadUserData();
    if (stored?.type === 'customer') setCustomerId(stored.id);
    else {
      const stored2 = loadUserData();
      if (stored2?.type === 'customer') setCustomerId(stored2.id);
    }
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadAvailableDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, full_name, phone_number, whatsapp_number, rating, vehicle_type')
        .eq('approval_status', 'approved')
        .eq('is_available', true)
        .order('rating', { ascending: false });
      if (error) throw error;
      setAvailableDrivers(data || []);
    } catch {
      setAvailableDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const sendWhatsAppNotification = async (orderId: string, orderNumber: string, driver: { id: string; phone_number: string; whatsapp_number?: string | null }, shopCart: CartByShop, customerData: any, deliveryLocation: string, paymentMethod: string, deliveryFee: number) => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({
          orderId,
          orderNumber,
          driverId: driver.id,
          driverPhone: driver.phone_number,
          driverWhatsApp: driver.whatsapp_number,
          shopName: shopCart.shopName,
          shopAddress: 'See order details in app',
          customerName: customerData?.full_name || 'Customer',
          customerPhone: customerData?.phone_number || 'N/A',
          deliveryLocation,
          items: shopCart.items.map(i => ({ name: i.product.name, qty: i.quantity, price: Number(i.product.price) })),
          totalAmount: shopCart.total,
          deliveryFee,
          paymentMethod,
        }),
      });
    } catch {}
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: shopData, error: shopErr } = await supabase
        .from('shops')
        .select('id, name, logo_url, description, address, hours, slug')
        .eq('status', 'active')
        .order('name');
      if (shopErr) throw shopErr;
      setShops(shopData || []);

      const { data: prodData, error: prodErr } = await supabase
        .from('shop_products')
        .select('id, shop_id, name, description, image_url, price, stock, category, status')
        .eq('status', 'active')
        .order('name');
      if (prodErr) throw prodErr;
      setProducts(prodData || []);
      setFilteredProducts(prodData || []);

      const cats = Array.from(new Set((prodData || []).map((p: Product) => p.category).filter(Boolean))) as string[];
      setCategories(cats);
    } catch (err: any) {
      setError(err.message || 'Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (!searchQuery.trim() && !selectedCategory) {
      setFilteredProducts(products);
      return;
    }
    let filtered = products;
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false)
      );
    }
    setFilteredProducts(filtered);
  }, [searchQuery, selectedCategory, products]);

  const cartByShop: CartByShop[] = cart.length > 0
    ? Object.entries(
        cart.reduce((acc, item) => {
          if (!acc[item.product.shop_id]) {
            const shop = shops.find(s => s.id === item.product.shop_id);
            acc[item.product.shop_id] = {
              shopId: item.product.shop_id,
              shopName: shop?.name || 'Unknown Shop',
              items: [],
              total: 0,
            };
          }
          acc[item.product.shop_id].items.push(item);
          acc[item.product.shop_id].total += Number(item.product.price) * item.quantity;
          return acc;
        }, {} as Record<string, CartByShop>)
      ).map(([_, v]) => v)
    : [];

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(i =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === productId);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter(i => i.product.id !== productId);
      }
      return prev.map(i =>
        i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i
      );
    });
  };

  const getCartQty = (productId: string) => {
    return cart.find(i => i.product.id === productId)?.quantity || 0;
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

  const placeOrders = async (
    deliveryLocation: string,
    lat: number | null,
    lng: number | null,
    paymentMethod: string,
    deliveryFee: number
  ) => {
    if (!customerId) {
      setError('Please login to place an order');
      return;
    }
    setPlacingOrder(true);
    setError('');
    try {
      // Get customer info
      const { data: customer } = await supabase
        .from('customers')
        .select('id, email, full_name, phone_number')
        .eq('id', customerId)
        .maybeSingle();

      // Create separate order per shop
      for (const shopCart of cartByShop) {
        const orderProducts = shopCart.items.map(item => ({
          id: item.product.id,
          name: item.product.name,
          price: Number(item.product.price),
          qty: item.quantity,
        }));
        const orderTotal = shopCart.total + deliveryFee;

        const { data: order, error: orderErr } = await supabase
          .from('shop_orders')
          .insert({
            customer_id: customerId,
            shop_id: shopCart.shopId,
            products: orderProducts,
            total_amount: orderTotal,
            delivery_fee: deliveryFee,
            delivery_location: deliveryLocation,
            delivery_latitude: lat,
            delivery_longitude: lng,
            payment_method: paymentMethod,
            status: 'pending',
            customer_email: customer?.email || null,
            customer_name: customer?.full_name || null,
            customer_phone: customer?.phone_number || null,
          })
          .select()
          .maybeSingle();

        if (orderErr) throw orderErr;

        // Send WhatsApp notification to the selected driver
        if (selectedDriver) {
          sendWhatsAppNotification(
            order.id, order.id.slice(0, 8), selectedDriver,
            shopCart, customer, deliveryLocation, paymentMethod, deliveryFee
          );
        }

        // Notify shop owner
        const { data: shop } = await supabase
          .from('shops')
          .select('contact_email, name')
          .eq('id', shopCart.shopId)
          .maybeSingle();
        if (shop?.contact_email) {
          sendEmail('shop_new_order', shop.contact_email, {
            orderNumber: order?.id.slice(0, 8),
            customerName: customer?.full_name || 'A customer',
            items: orderProducts,
            total: orderTotal,
          }, order?.id);
        }

        // Notify customer
        if (customer?.email) {
          sendEmail('order_confirmation', customer.email, {
            orderNumber: order?.id.slice(0, 8),
            items: orderProducts,
            totalAmount: orderTotal,
            deliveryFee,
            address: deliveryLocation,
          }, order?.id);
        }
      }

      setCart([]);
      setShowCart(false);
      setShowCheckout(false);
      setOrderSuccess(true);
      setTimeout(() => {
        setOrderSuccess(false);
        router.push('/customer/marketplace/orders');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={A.cyan} />
        <Text style={{ color: A.textSub, marginTop: 12 }}>Loading marketplace...</Text>
      </View>
    );
  }

  if (orderSuccess) {
    return (
      <View style={styles.loadingContainer}>
        <View style={[styles.successIcon, { borderColor: A.green }]}>
          <CheckCircle size={48} color={A.green} />
        </View>
        <Text style={styles.successTitle}>Order Placed!</Text>
        <Text style={styles.successText}>Your order(s) have been placed successfully.</Text>
      </View>
    );
  }

  const bg = isDark ? '#050b16' : '#f0f4f8';
  const cardBg = isDark ? '#0a1220' : '#ffffff';
  const cardBorder = isDark ? '#1a2d4a' : '#e2e8f0';
  const textPrimary = isDark ? '#e0eeff' : '#0a1929';
  const textSecondary = isDark ? '#6a8fb0' : '#64748b';
  const inputBg = isDark ? '#0d1828' : '#f8fafc';
  const inputBorder = isDark ? '#1a2d4a' : '#cbd5e1';
  const placeholderColor = isDark ? '#3d5577' : '#94a3b8';
  const primary = '#0066ff';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: inputBg, borderColor: inputBorder }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={18} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: textPrimary }]} numberOfLines={1}>Shop Groceries</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>{shops.length} shops available</Text>
        </View>
        <TouchableOpacity
          style={[styles.cartBtn, { backgroundColor: cartCount > 0 ? primary : inputBg, borderColor: cartCount > 0 ? primary : inputBorder }]}
          onPress={() => setShowCart(true)}
        >
          <ShoppingCart size={18} color={cartCount > 0 ? '#fff' : textPrimary} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Search */}
        <View style={{ padding: 16, gap: 12 }}>
          <View style={[styles.searchBar, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <Search size={16} color={placeholderColor} />
            <TextInput
              style={[styles.searchInput, { color: textPrimary }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search products..."
              placeholderTextColor={placeholderColor}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={placeholderColor} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Categories */}
          {categories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.categoryChip, {
                  backgroundColor: !selectedCategory ? primary : inputBg,
                  borderColor: !selectedCategory ? primary : inputBorder,
                }]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={{ color: !selectedCategory ? '#fff' : textSecondary, fontSize: 12, fontWeight: '600' }}>All</Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, {
                    backgroundColor: selectedCategory === cat ? primary : inputBg,
                    borderColor: selectedCategory === cat ? primary : inputBorder,
                  }]}
                  onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                >
                  <Text style={{ color: selectedCategory === cat ? '#fff' : textSecondary, fontSize: 12, fontWeight: '600' }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fff5f5', borderColor: '#ef4444' }]}>
            <AlertCircle size={14} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 12, flex: 1 }}>{error}</Text>
          </View>
        ) : null}

        {/* Shops section */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        >
          {/* Shops list */}
          <Text style={[styles.sectionTitle, { color: textSecondary }]}>SHOPS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
            {shops.map(shop => (
              <TouchableOpacity
                key={shop.id}
                style={[styles.shopCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                onPress={() => { setSelectedShop(shop); setShowShopModal(true); }}
              >
                <View style={[styles.shopLogo, { backgroundColor: inputBg }]}>
                  {shop.logo_url && Platform.OS === 'web' ? (
                    <img src={shop.logo_url} style={{ width: 48, height: 48, borderRadius: 24, objectFit: 'cover' as any }} alt={shop.name} />
                  ) : (
                    <Store size={24} color={primary} />
                  )}
                </View>
                <Text style={[styles.shopName, { color: textPrimary }]} numberOfLines={1}>{shop.name}</Text>
                {shop.hours && <Text style={[styles.shopHours, { color: textSecondary }]} numberOfLines={1}>{shop.hours}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Products */}
          <Text style={[styles.sectionTitle, { color: textSecondary, marginTop: 8 }]}>PRODUCTS</Text>
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Package size={40} color={placeholderColor} />
              <Text style={{ color: textSecondary, fontSize: 14 }}>No products found</Text>
            </View>
          ) : (
            <View style={styles.productGrid}>
              {filteredProducts.map(product => {
                const qty = getCartQty(product.id);
                const shop = shops.find(s => s.id === product.shop_id);
                return (
                  <View key={product.id} style={[styles.productCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    {product.image_url && Platform.OS === 'web' ? (
                      <img src={product.image_url} style={{ width: '100%', height: 90, borderRadius: 8, objectFit: 'cover' as any }} alt={product.name} />
                    ) : (
                      <View style={[styles.productImagePlaceholder, { backgroundColor: inputBg }]}>
                        <Package size={24} color={placeholderColor} />
                      </View>
                    )}
                    <Text style={[styles.productName, { color: textPrimary }]} numberOfLines={2}>{product.name}</Text>
                    {shop && <Text style={[styles.productShop, { color: textSecondary }]} numberOfLines={1}>{shop.name}</Text>}
                    <View style={styles.productBottom}>
                      <Text style={[styles.productPrice, { color: primary }]}>${Number(product.price).toFixed(2)}</Text>
                      {product.stock > 0 ? (
                        qty > 0 ? (
                          <View style={styles.qtyControl}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(product.id)}>
                              <Minus size={14} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{qty}</Text>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => addToCart(product)}
                              disabled={qty >= product.stock}
                            >
                              <Plus size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.addBtn, { backgroundColor: primary }]}
                            onPress={() => addToCart(product)}
                          >
                            <Plus size={14} color="#fff" />
                            <Text style={styles.addBtnText}>Add</Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>Out of stock</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Cart Modal */}
      <Modal visible={showCart} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Your Cart ({cartCount})</Text>
              <TouchableOpacity onPress={() => setShowCart(false)}>
                <X size={22} color={textSecondary} />
              </TouchableOpacity>
            </View>

            {cart.length === 0 ? (
              <View style={styles.emptyState}>
                <ShoppingCart size={40} color={placeholderColor} />
                <Text style={{ color: textSecondary, fontSize: 14 }}>Cart is empty</Text>
              </View>
            ) : (
              <>
                <ScrollView style={{ flex: 1, maxHeight: 400 }}>
                  {cartByShop.map(shopCart => (
                    <View key={shopCart.shopId} style={{ marginBottom: 16 }}>
                      <View style={[styles.cartShopHeader, { borderBottomColor: cardBorder }]}>
                        <Store size={14} color={primary} />
                        <Text style={[styles.cartShopName, { color: textPrimary }]}>{shopCart.shopName}</Text>
                      </View>
                      {shopCart.items.map(item => (
                        <View key={item.product.id} style={styles.cartItemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cartItemName, { color: textPrimary }]} numberOfLines={1}>{item.product.name}</Text>
                            <Text style={[styles.cartItemPrice, { color: textSecondary }]}>${Number(item.product.price).toFixed(2)} each</Text>
                          </View>
                          <View style={styles.qtyControl}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.product.id)}>
                              <Minus size={12} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{item.quantity}</Text>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => addToCart(item.product)}
                              disabled={item.quantity >= item.product.stock}
                            >
                              <Plus size={12} color="#fff" />
                            </TouchableOpacity>
                          </View>
                          <Text style={[styles.cartItemTotal, { color: primary }]}>
                            ${(Number(item.product.price) * item.quantity).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                      <View style={[styles.cartShopTotal, { borderTopColor: cardBorder }]}>
                        <Text style={{ color: textSecondary, fontSize: 12 }}>Subtotal</Text>
                        <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '700' }}>${shopCart.total.toFixed(2)}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={[styles.cartFooter, { borderTopColor: cardBorder }]}>
                  <View>
                    <Text style={{ color: textSecondary, fontSize: 12 }}>Total (excl. delivery)</Text>
                    <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>${cartTotal.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.checkoutBtn, { backgroundColor: primary }]}
                    onPress={() => { setShowCart(false); setShowCheckout(true); }}
                  >
                    <CreditCard size={18} color="#fff" />
                    <Text style={styles.checkoutBtnText}>Checkout</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Shop Info Modal */}
      <Modal visible={showShopModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            {selectedShop && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: textPrimary }]}>{selectedShop.name}</Text>
                  <TouchableOpacity onPress={() => { setShowShopModal(false); setSelectedShop(null); }}>
                    <X size={22} color={textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 400 }}>
                  {selectedShop.logo_url && Platform.OS === 'web' && (
                    <img src={selectedShop.logo_url} style={{ width: '100%', height: 160, borderRadius: 12, objectFit: 'cover' as any, marginBottom: 16 }} alt={selectedShop.name} />
                  )}
                  {selectedShop.description && (
                    <Text style={{ color: textPrimary, fontSize: 14, lineHeight: 22, marginBottom: 12 }}>{selectedShop.description}</Text>
                  )}
                  {selectedShop.address && (
                    <View style={styles.shopInfoRow}>
                      <MapPin size={16} color={primary} />
                      <Text style={{ color: textSecondary, fontSize: 13 }}>{selectedShop.address}</Text>
                    </View>
                  )}
                  {selectedShop.hours && (
                    <View style={styles.shopInfoRow}>
                      <Store size={16} color={primary} />
                      <Text style={{ color: textSecondary, fontSize: 13 }}>{selectedShop.hours}</Text>
                    </View>
                  )}
                  <Text style={[styles.sectionTitle, { color: textSecondary, marginTop: 16 }]}>PRODUCTS</Text>
                  {filteredProducts.filter(p => p.shop_id === selectedShop.id).map(p => (
                    <View key={p.id} style={[styles.cartItemRow, { borderBottomColor: cardBorder }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textPrimary, fontSize: 14 }}>{p.name}</Text>
                        <Text style={{ color: primary, fontSize: 14, fontWeight: '700' }}>${Number(p.price).toFixed(2)}</Text>
                      </View>
                      {p.stock > 0 ? (
                        getCartQty(p.id) > 0 ? (
                          <View style={styles.qtyControl}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(p.id)}>
                              <Minus size={14} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{getCartQty(p.id)}</Text>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(p)}>
                              <Plus size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity style={[styles.addBtn, { backgroundColor: primary }]} onPress={() => addToCart(p)}>
                            <Plus size={14} color="#fff" />
                            <Text style={styles.addBtnText}>Add</Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        <Text style={{ color: '#ef4444', fontSize: 11 }}>Out of stock</Text>
                      )}
                    </View>
                  ))}
                  {filteredProducts.filter(p => p.shop_id === selectedShop.id).length === 0 && (
                    <Text style={{ color: textSecondary, fontSize: 13, paddingVertical: 16 }}>No products available</Text>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Checkout Modal */}
      <Modal visible={showCheckout} animationType="slide" transparent>
        <CheckoutModal
          cardBg={cardBg}
          cardBorder={cardBorder}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          inputBg={inputBg}
          inputBorder={inputBorder}
          placeholderColor={placeholderColor}
          primary={primary}
          cartByShop={cartByShop}
          cartTotal={cartTotal}
          placingOrder={placingOrder}
          error={error}
          onClose={() => setShowCheckout(false)}
          onPlaceOrder={placeOrders}
          customerId={customerId}
          selectedDriver={selectedDriver}
          availableDrivers={availableDrivers}
          loadingDrivers={loadingDrivers}
          onOpenDriverPicker={() => { loadAvailableDrivers(); setShowDriverPicker(true); }}
          onSelectDriver={(d: any) => { setSelectedDriver(d); setShowDriverPicker(false); }}
          showDriverPicker={showDriverPicker}
          onCloseDriverPicker={() => setShowDriverPicker(false)}
        />
      </Modal>
    </View>
  );
}

// Checkout modal component
function CheckoutModal({
  cardBg, cardBorder, textPrimary, textSecondary, inputBg, inputBorder,
  placeholderColor, primary, cartByShop, cartTotal, placingOrder, error, onClose, onPlaceOrder, customerId,
  selectedDriver, availableDrivers, loadingDrivers, onOpenDriverPicker, onSelectDriver,
  showDriverPicker, onCloseDriverPicker,
}: any) {
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pay_on_delivery');
  const [deliveryFee, setDeliveryFee] = useState('2.00');

  const handlePlace = () => {
    if (!deliveryLocation.trim()) return;
    if (!selectedDriver) return;
    onPlaceOrder(
      deliveryLocation.trim(),
      null, null,
      paymentMethod,
      parseFloat(deliveryFee) || 2
    );
  };

  const canPlace = deliveryLocation.trim() && selectedDriver && !placingOrder;

  return (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: textPrimary }]}>Checkout</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={22} color={textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 400 }}>
          <Text style={[styles.checkoutLabel, { color: textSecondary }]}>DELIVERY LOCATION *</Text>
          <TextInput
            style={[styles.checkoutInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
            value={deliveryLocation}
            onChangeText={setDeliveryLocation}
            placeholder="Enter delivery address"
            placeholderTextColor={placeholderColor}
            multiline
          />

          {/* DRIVER SELECTION - Required, prominently styled */}
          <Text style={[styles.checkoutLabel, { color: textSecondary, marginTop: 16 }]}>
            SELECT A DRIVER / MESSENGER *
          </Text>
          <TouchableOpacity
            style={[styles.driverSelectBtn, {
              backgroundColor: selectedDriver ? `${primary}15` : primary,
              borderColor: selectedDriver ? primary : 'transparent',
              borderWidth: selectedDriver ? 2 : 0,
            }]}
            onPress={onOpenDriverPicker}
            activeOpacity={0.85}
          >
            {selectedDriver ? (
              <>
                <View style={styles.driverSelectLeft}>
                  <View style={[styles.driverSelectAvatar, { backgroundColor: `${primary}25` }]}>
                    <Truck size={18} color={primary} />
                  </View>
                  <View>
                    <Text style={[styles.driverSelectName, { color: textPrimary }]}>{selectedDriver.full_name}</Text>
                    <Text style={[styles.driverSelectPhone, { color: textSecondary }]}>{selectedDriver.phone_number}</Text>
                  </View>
                </View>
                <View style={styles.driverSelectChange}>
                  <Text style={styles.driverSelectChangeText}>Change</Text>
                  <ChevronRight size={16} color={primary} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.driverSelectIconWrap}>
                  <Truck size={20} color="#fff" />
                </View>
                <Text style={styles.driverSelectBtnText}>Choose Your Driver</Text>
                <View style={styles.driverSelectArrow}>
                  <ChevronRight size={20} color="#fff" />
                </View>
              </>
            )}
          </TouchableOpacity>
          {!selectedDriver && (
            <Text style={styles.driverRequiredHint}>
              A driver must be selected before placing your order
            </Text>
          )}

          {/* Driver Picker Sheet */}
          {showDriverPicker && (
            <View style={[styles.driverPickerSheet, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <View style={styles.driverPickerHeader}>
                <Text style={[styles.driverPickerTitle, { color: textPrimary }]}>Available Drivers</Text>
                <TouchableOpacity onPress={onCloseDriverPicker}>
                  <X size={18} color={textSecondary} />
                </TouchableOpacity>
              </View>
              {loadingDrivers ? (
                <View style={styles.driverPickerLoading}>
                  <ActivityIndicator size="small" color={primary} />
                  <Text style={{ color: textSecondary, fontSize: 13, marginTop: 8 }}>Loading drivers...</Text>
                </View>
              ) : availableDrivers.length === 0 ? (
                <Text style={[styles.driverPickerEmpty, { color: textSecondary }]}>
                  No drivers available right now. Please check back shortly.
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 220 }}>
                  {availableDrivers.map((d: any) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[
                        styles.driverPickerItem,
                        { borderBottomColor: inputBorder },
                        selectedDriver?.id === d.id && { backgroundColor: `${primary}10` },
                      ]}
                      onPress={() => onSelectDriver(d)}
                    >
                      <View style={[styles.driverPickerAvatar, { backgroundColor: `${primary}15` }]}>
                        <Truck size={16} color={primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.driverPickerItemName, { color: textPrimary }]}>{d.full_name}</Text>
                        <Text style={[styles.driverPickerItemPhone, { color: textSecondary }]}>{d.phone_number}</Text>
                      </View>
                      {d.rating != null && (
                        <Text style={styles.driverPickerRating}>
                          {Number(d.rating).toFixed(1)}
                        </Text>
                      )}
                      {selectedDriver?.id === d.id && (
                        <CheckCircle size={18} color={primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          <Text style={[styles.checkoutLabel, { color: textSecondary, marginTop: 16 }]}>DELIVERY FEE</Text>
          <TextInput
            style={[styles.checkoutInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
            value={deliveryFee}
            onChangeText={setDeliveryFee}
            placeholder="2.00"
            placeholderTextColor={placeholderColor}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.checkoutLabel, { color: textSecondary, marginTop: 16 }]}>PAYMENT METHOD</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {[
              { key: 'pay_on_delivery', label: 'Pay on Delivery' },
              { key: 'ecocash', label: 'EcoCash' },
              { key: 'paynow', label: 'PayNow' },
            ].map(method => (
              <TouchableOpacity
                key={method.key}
                style={[styles.paymentMethod, {
                  backgroundColor: paymentMethod === method.key ? primary : inputBg,
                  borderColor: paymentMethod === method.key ? primary : inputBorder,
                }]}
                onPress={() => setPaymentMethod(method.key)}
              >
                <Text style={{ color: paymentMethod === method.key ? '#fff' : textSecondary, fontSize: 12, fontWeight: '600' }}>
                  {method.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.checkoutSummary, { borderTopColor: cardBorder, borderBottomColor: cardBorder }]}>
            <View style={styles.checkoutRow}>
              <Text style={{ color: textSecondary, fontSize: 13 }}>Items total</Text>
              <Text style={{ color: textPrimary, fontSize: 13 }}>${cartTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.checkoutRow}>
              <Text style={{ color: textSecondary, fontSize: 13 }}>Delivery fee</Text>
              <Text style={{ color: textPrimary, fontSize: 13 }}>${(parseFloat(deliveryFee) || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.checkoutRow}>
              <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '700' }}>Grand Total</Text>
              <Text style={{ color: primary, fontSize: 17, fontWeight: '800' }}>
                ${(cartTotal + (parseFloat(deliveryFee) || 0)).toFixed(2)}
              </Text>
            </View>
          </View>

          <Text style={{ color: textSecondary, fontSize: 11, marginTop: 8 }}>
            Note: {cartByShop.length} separate order(s) will be created, one per shop.
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: '#ef4444', marginTop: 12 }]}>
              <AlertCircle size={14} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 12, flex: 1 }}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <TouchableOpacity
          style={[styles.placeOrderBtn, {
            backgroundColor: canPlace ? primary : (isDarkPlaceholder(inputBorder) ? '#2a3a5c' : '#cbd5e1'),
            opacity: placingOrder ? 0.6 : 1,
          }]}
          onPress={handlePlace}
          disabled={!canPlace}
          activeOpacity={0.85}
        >
          {placingOrder ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.placeOrderBtnText}>
              {selectedDriver ? 'Place Order(s)' : 'Select a Driver to Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function isDarkPlaceholder(borderColor: string): boolean {
  return borderColor !== '#cbd5e1';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: A.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 2 },
  cartBtn: {
    width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, position: 'relative' as any,
  },
  cartBadge: {
    position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444',
    borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  shopCard: {
    width: 130, borderRadius: 12, borderWidth: 1, padding: 12, gap: 8,
  },
  shopLogo: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
  },
  shopName: { fontSize: 13, fontWeight: '600' },
  shopHours: { fontSize: 10 },
  productGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  productCard: {
    width: 160, borderRadius: 12, borderWidth: 1, padding: 10, gap: 6,
  },
  productImagePlaceholder: {
    width: '100%', height: 90, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  productName: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  productShop: { fontSize: 10 },
  productBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  productPrice: { fontSize: 14, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 24, height: 24, borderRadius: 6, backgroundColor: A.cyan,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyText: { color: '#fff', fontSize: 13, fontWeight: '700', minWidth: 16, textAlign: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginHorizontal: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  cartShopHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottomWidth: 1,
  },
  cartShopName: { fontSize: 14, fontWeight: '700' },
  cartItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cartItemName: { fontSize: 13, fontWeight: '500' },
  cartItemPrice: { fontSize: 11, marginTop: 2 },
  cartItemTotal: { fontSize: 14, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  cartShopTotal: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingTop: 8, borderTopWidth: 1,
  },
  cartFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 16, borderTopWidth: 1, marginTop: 12,
  },
  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 10px rgba(0,102,255,0.25)' } : { elevation: 4 }),
  },
  checkoutBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  shopInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkoutLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  checkoutInput: {
    borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 48,
  },
  paymentMethod: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5,
  },
  checkoutSummary: {
    marginTop: 20, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, gap: 8,
  },
  checkoutRow: { flexDirection: 'row', justifyContent: 'space-between' },
  driverSelectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, minHeight: 60,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0,102,255,0.25)' } : { elevation: 4 }),
  },
  driverSelectBtnText: {
    flex: 1, color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 12,
  },
  driverSelectIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  driverSelectArrow: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  driverSelectLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  driverSelectAvatar: {
    width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  driverSelectName: { fontSize: 15, fontWeight: '700' },
  driverSelectPhone: { fontSize: 12, marginTop: 2 },
  driverSelectChange: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  driverSelectChangeText: { fontSize: 13, fontWeight: '600', color: '#0066ff' },
  driverRequiredHint: {
    fontSize: 12, fontWeight: '600', color: '#f59e0b', marginTop: 8, textAlign: 'center',
  },
  driverPickerSheet: {
    marginTop: 8, borderRadius: 14, borderWidth: 1.5, overflow: 'hidden',
  },
  driverPickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  driverPickerTitle: { fontSize: 15, fontWeight: '700' },
  driverPickerLoading: { alignItems: 'center', paddingVertical: 24 },
  driverPickerEmpty: { fontSize: 13, padding: 20, textAlign: 'center', lineHeight: 19 },
  driverPickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 0.5,
  },
  driverPickerAvatar: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  driverPickerItemName: { fontSize: 14, fontWeight: '600' },
  driverPickerItemPhone: { fontSize: 12, marginTop: 2 },
  driverPickerRating: {
    fontSize: 13, fontWeight: '700', color: '#f59e0b', marginRight: 8,
  },
  placeOrderBtn: {
    borderRadius: 14, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginTop: 16,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 12px rgba(0,102,255,0.2)' } : { elevation: 3 }),
  },
  placeOrderBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  successIcon: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: '800', color: A.text, marginBottom: 8 },
  successText: { fontSize: 14, color: A.textSub, textAlign: 'center' },
});
