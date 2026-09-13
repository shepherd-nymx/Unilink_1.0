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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { loadUserData } from '@/lib/storage-service';
import { A } from '@/lib/admin-theme';
import { ArrowLeft, Store, Search, ShoppingCart, Plus, Minus, X, Package, CreditCard, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Info, ChevronLeft, ChevronRight, MapPin, Lock, Award } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Shop, Product, CartItem, CartByShop, ThemePalette, computeShopOpen, DeliveryFeeTier, computeTierDeliveryFee } from '@/components/marketplace/types';
import { ShopCard } from '@/components/marketplace/ShopCard';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { ShopProfileModal } from '@/components/marketplace/ShopProfileModal';
import { CheckoutModal } from '@/components/marketplace/CheckoutModal';

type ServiceLocationMap = Record<string, { location_name: string; location_type: string }[]>;

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
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [customerUniversityId, setCustomerUniversityId] = useState<string | null>(null);
  const [customerUniversityName, setCustomerUniversityName] = useState<string | null>(null);
  const [shopServiceLocations, setShopServiceLocations] = useState<ServiceLocationMap>({});
  const [deliveryFeeTiers, setDeliveryFeeTiers] = useState<Record<string, DeliveryFeeTier[]>>({});

  const selectedShopData = selectedShopId ? shops.find(s => s.id === selectedShopId) || null : null;
  const [showCheckout, setShowCheckout] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const palette: ThemePalette = {
    bg: isDark ? '#050b16' : '#f0f4f8',
    cardBg: isDark ? '#0a1220' : '#ffffff',
    cardBorder: isDark ? '#1a2d4a' : '#e2e8f0',
    textPrimary: isDark ? '#e0eeff' : '#0a1929',
    textSecondary: isDark ? '#6a8fb0' : '#64748b',
    inputBg: isDark ? '#0d1828' : '#f8fafc',
    inputBorder: isDark ? '#1a2d4a' : '#cbd5e1',
    placeholderColor: isDark ? '#3d5577' : '#94a3b8',
    primary: '#0066ff',
    accent: '#00e5ff',
    success: '#00c853',
    warning: '#ffa726',
    error: '#ef4444',
  };

  useEffect(() => {
    const stored = loadUserData();
    if (stored?.type === 'customer') setCustomerId(stored.id);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedShopId) {
      const shopCats = Array.from(new Set(products.filter(p => p.shop_id === selectedShopId).map(p => p.category).filter(Boolean))) as string[];
      setCategories(shopCats);
      setSelectedCategory(null);
    } else {
      const allCats = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
      setCategories(allCats);
      setSelectedCategory(null);
    }
  }, [selectedShopId, products]);

  const sendWhatsAppNotification = async (
    orderId: string,
    orderNumber: string,
    shopCart: CartByShop,
    customerData: any,
    deliveryLocation: string,
    paymentMethod: string,
    deliveryFee: number
  ) => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const shop = shops.find(s => s.id === shopCart.shopId);
      await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({
          orderId,
          orderNumber,
          shopName: shopCart.shopName,
          shopAddress: 'See order details in app',
          shopWhatsApp: shop?.whatsapp_number || null,
          recipientType: 'shop',
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
      // Load customer's university for location filtering
      if (customerId) {
        const { data: customer } = await supabase
          .from('customers')
          .select('university_id')
          .eq('id', customerId)
          .maybeSingle();
        if (customer?.university_id) {
          setCustomerUniversityId(customer.university_id);
          const { data: uni } = await supabase
            .from('universities')
            .select('name')
            .eq('id', customer.university_id)
            .maybeSingle();
          if (uni?.name) setCustomerUniversityName(uni.name);
        }
      }

      const { data: shopData, error: shopErr } = await supabase
        .from('shops')
        .select('id, name, logo_url, description, address, hours, slug, latitude, longitude, is_available, operating_hours, accepted_payment_methods, location_verified, completed_orders_count, location, ecocash_fee, delivery_fee, whatsapp_number, average_rating, total_ratings, premium_badge')
        .eq('status', 'active')
        .order('name');
      if (shopErr) throw shopErr;
      const allShops = (shopData || []) as Shop[];
      setShops(allShops);

      // Load service locations for all active shops
      if (allShops.length > 0) {
        const { data: slData } = await supabase
          .from('shop_service_locations')
          .select('shop_id, location_name, location_type')
          .in('shop_id', allShops.map(s => s.id));
        const slMap: ServiceLocationMap = {};
        (slData || []).forEach((sl: any) => {
          if (!slMap[sl.shop_id]) slMap[sl.shop_id] = [];
          slMap[sl.shop_id].push({ location_name: sl.location_name, location_type: sl.location_type });
        });
        setShopServiceLocations(slMap);

        // Load delivery fee tiers for all shops
        const { data: tierData } = await supabase
          .from('shop_delivery_fee_tiers')
          .select('id, shop_id, min_amount, max_amount, fee, label, sort_order')
          .in('shop_id', allShops.map(s => s.id));
        const tierMap: Record<string, DeliveryFeeTier[]> = {};
        (tierData || []).forEach((t: any) => {
          if (!tierMap[t.shop_id]) tierMap[t.shop_id] = [];
          tierMap[t.shop_id].push(t);
        });
        setDeliveryFeeTiers(tierMap);
      }

      const { data: prodData, error: prodErr } = await supabase
        .from('shop_products')
        .select('id, shop_id, name, description, image_url, price, stock, category, status')
        .eq('status', 'active')
        .order('name');
      if (prodErr) throw prodErr;
      setProducts((prodData || []) as Product[]);

      const { data: areaData } = await supabase
        .from('shop_areas')
        .select('name')
        .order('sort_order', { ascending: true });
      setAreas((areaData || []).map((a: any) => a.name));
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
    let filtered = products;
    if (selectedShopId) {
      filtered = filtered.filter(p => p.shop_id === selectedShopId);
    }
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
  }, [searchQuery, selectedCategory, products, selectedShopId]);

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

  const shopServesCustomer = (shopId: string): boolean => {
    const sls = shopServiceLocations[shopId];
    if (!sls || sls.length === 0) return true; // No restriction = visible to all
    if (!customerUniversityName) return true; // Can't filter if we don't know customer's location
    return sls.some(sl => sl.location_name.toLowerCase() === customerUniversityName.toLowerCase());
  };

  const anyCartBlocked = cartByShop.some(sc => {
    const s = shops.find(sh => sh.id === sc.shopId);
    if (!s) return false;
    if (!s.is_available) return true;
    if (s.operating_hours && !computeShopOpen(s)) return true;
    return false;
  });

  const addToCart = (product: Product) => {
    const shop = shops.find(s => s.id === product.shop_id);
    if (shop && !shop.is_available) return;
    if (shop && shop.operating_hours && !computeShopOpen(shop)) return;
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
    deliveryFee: number,
    ecocashFeeAmount: number
  ) => {
    if (!customerId) {
      setError('Please login to place an order');
      return;
    }
    setPlacingOrder(true);
    setError('');
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, email, full_name, phone_number')
        .eq('id', customerId)
        .maybeSingle();

      for (const shopCart of cartByShop) {
        const shop = shops.find(s => s.id === shopCart.shopId);
        if (shop && !shop.is_available) {
          throw new Error(`${shop.name} is currently unavailable. Please remove its items from your cart.`);
        }

        // Check if customer is blacklisted by this shop
        const { data: blacklisted } = await supabase
          .from('shop_customer_blacklist')
          .select('id, reason')
          .eq('shop_id', shopCart.shopId)
          .eq('customer_id', customerId)
          .maybeSingle();
        if (blacklisted) {
          throw new Error(`${shop?.name || 'This shop'} is unable to accept orders from your account at this time. Reason: ${blacklisted.reason || 'No reason provided.'}`);
        }

        const { data: openCheck, error: openErr } = await supabase.rpc('validate_shop_order', {
          p_shop_id: shopCart.shopId,
        });
        if (openErr) throw openErr;
        const openResult = openCheck as { allowed?: boolean; reason?: string } | null;
        if (openResult && openResult.allowed === false) {
          throw new Error(`${shop?.name || 'This shop'} is currently closed. ${openResult.reason || ''}`);
        }

        const { data: paymentOk, error: payErr } = await supabase.rpc('validate_shop_payment', {
          p_shop_id: shopCart.shopId,
          p_payment_method: paymentMethod,
        });
        if (payErr) throw payErr;
        if (!paymentOk) {
          throw new Error(`${shop?.name || 'This shop'} does not accept the selected payment method (${paymentMethod}).`);
        }

        const orderProducts = shopCart.items.map(item => ({
          id: item.product.id,
          name: item.product.name,
          price: Number(item.product.price),
          qty: item.quantity,
        }));
        const shopDeliveryFee = computeTierDeliveryFee(shopCart.total, deliveryFeeTiers[shopCart.shopId] || [], Number(shop?.delivery_fee || 0));
        const orderTotal = shopCart.total + shopDeliveryFee + ecocashFeeAmount;

        const { data: order, error: orderErr } = await supabase
          .from('shop_orders')
          .insert({
            customer_id: customerId,
            shop_id: shopCart.shopId,
            products: orderProducts,
            total_amount: orderTotal,
            delivery_fee: shopDeliveryFee,
            ecocash_fee_amount: ecocashFeeAmount,
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

        const { data: shopInfo } = await supabase
          .from('shops')
          .select('contact_email, name')
          .eq('id', shopCart.shopId)
          .maybeSingle();
        if (shopInfo?.contact_email) {
          sendEmail('shop_new_order', shopInfo.contact_email, {
            orderNumber: order?.id.slice(0, 8),
            customerName: customer?.full_name || 'A customer',
            items: orderProducts,
            total: orderTotal,
          }, order?.id);
        }

        if (customer?.email) {
          sendEmail('order_confirmation', customer.email, {
            orderNumber: order?.id.slice(0, 8),
            items: orderProducts,
            totalAmount: orderTotal,
            deliveryFee: shopDeliveryFee,
            address: deliveryLocation,
          }, order?.id);
        }

        sendWhatsAppNotification(
          order?.id || '', order?.id?.slice(0, 8) || '', shopCart,
          customer, deliveryLocation, paymentMethod, shopDeliveryFee
        );
      }

      setCart([]);
      setShowCart(false);
      setShowCheckout(false);

      if (paymentMethod === 'paynow') {
        const { startPaynowPayment, generateReference } = await import('@/lib/paynow-service');
        const grandTotal = cartByShop.reduce((sum, sc) => sum + sc.total, 0) + deliveryFee + ecocashFeeAmount;
        const ref = generateReference('marketplace_order', customerId);
        const result = await startPaynowPayment({
          paymentType: 'marketplace_order',
          entityId: customerId,
          amount: grandTotal,
          reference: ref,
          description: `UniLink Marketplace Order - ${cartByShop.length} shop(s)`,
          authEmail: customer?.email,
          metadata: { cart_summary: cartByShop.map(sc => ({ shopId: sc.shopId, shopName: sc.shopName, total: sc.total })) },
        });
        if (!result.success) {
          setError(`Order placed but Paynow payment failed to start: ${result.error}. You can retry payment from your orders page.`);
          setOrderSuccess(true);
          setTimeout(() => {
            setOrderSuccess(false);
            router.push('/customer/marketplace/orders');
          }, 2000);
          return;
        }
      }

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

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { backgroundColor: palette.cardBg, borderBottomColor: palette.cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={18} color={palette.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: palette.textPrimary }]} numberOfLines={1}>Shop Groceries</Text>
          <Text style={[styles.headerSub, { color: palette.textSecondary }]}>
            {shops.filter(s => shopServesCustomer(s.id)).length} shops{customerUniversityName ? ` near ${customerUniversityName}` : ''} available
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.cartBtn, { backgroundColor: cartCount > 0 ? palette.primary : palette.inputBg, borderColor: cartCount > 0 ? palette.primary : palette.inputBorder }]}
          onPress={() => setShowCart(true)}
        >
          <ShoppingCart size={18} color={cartCount > 0 ? '#fff' : palette.textPrimary} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Shop selection view — shown when no shop is selected */}
        {!selectedShopId ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
          >
            <View style={[styles.searchBar, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, marginBottom: 16 }]}>
              <Search size={16} color={palette.placeholderColor} />
              <TextInput
                style={[styles.searchInput, { color: palette.textPrimary }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search shops..."
                placeholderTextColor={palette.placeholderColor}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color={palette.placeholderColor} />
                </TouchableOpacity>
              ) : null}
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fff5f5', borderColor: '#ef4444', marginHorizontal: 0 }]}>
                <AlertCircle size={14} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 12, flex: 1 }}>{error}</Text>
              </View>
            ) : null}

            {/* Area filter chips */}
            {areas.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionTitle, { color: palette.textSecondary, marginBottom: 8 }]}>FILTER BY AREA</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                  <TouchableOpacity
                    style={[styles.areaChip, { backgroundColor: !selectedArea ? palette.primary : palette.inputBg, borderColor: !selectedArea ? palette.primary : palette.inputBorder }]}
                    onPress={() => setSelectedArea(null)}
                  >
                    <MapPin size={12} color={!selectedArea ? '#fff' : palette.textSecondary} />
                    <Text style={{ color: !selectedArea ? '#fff' : palette.textSecondary, fontSize: 12, fontWeight: '600' }}>All Areas</Text>
                  </TouchableOpacity>
                  {areas.map(a => (
                    <TouchableOpacity
                      key={a}
                      style={[styles.areaChip, { backgroundColor: selectedArea === a ? palette.primary : palette.inputBg, borderColor: selectedArea === a ? palette.primary : palette.inputBorder }]}
                      onPress={() => setSelectedArea(selectedArea === a ? null : a)}
                    >
                      <MapPin size={12} color={selectedArea === a ? '#fff' : palette.textSecondary} />
                      <Text style={{ color: selectedArea === a ? '#fff' : palette.textSecondary, fontSize: 12, fontWeight: '600' }}>{a}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>SELECT A SHOP TO BROWSE</Text>
            {shops.length === 0 ? (
              <View style={styles.emptyState}>
                <Store size={40} color={palette.placeholderColor} />
                <Text style={{ color: palette.textSecondary, fontSize: 14 }}>No shops available</Text>
              </View>
            ) : (
              <View style={styles.shopList}>
                {shops
                  .filter(shop => !searchQuery.trim() || shop.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .filter(shop => !selectedArea || shop.location === selectedArea)
                  .filter(shop => shopServesCustomer(shop.id))
                  .map(shop => {
                    const open = shop.operating_hours ? computeShopOpen(shop) : true;
                    return (
                      <TouchableOpacity
                        key={shop.id}
                        style={[styles.shopSelectCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder, opacity: !shop.is_available ? 0.6 : 1 }]}
                        onPress={() => { setSelectedShopId(shop.id); setSearchQuery(''); }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.shopSelectLogo, { backgroundColor: palette.inputBg }]}>
                          {shop.logo_url && Platform.OS === 'web' ? (
                            <img src={shop.logo_url} style={{ width: 52, height: 52, borderRadius: 26, objectFit: 'cover' as any }} alt={shop.name} />
                          ) : (
                            <Store size={24} color={palette.primary} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.shopSelectName, { color: palette.textPrimary }]} numberOfLines={1}>{shop.name}</Text>
                          {shop.description ? (
                            <Text style={[styles.shopSelectDesc, { color: palette.textSecondary }]} numberOfLines={2}>{shop.description}</Text>
                          ) : null}
                          <View style={styles.shopSelectMeta}>
                            {shop.location ? (
                              <View style={[styles.shopSelectBadge, { backgroundColor: `${palette.primary}15` }]}>
                                <MapPin size={9} color={palette.primary} />
                                <Text style={[styles.shopSelectBadgeText, { color: palette.primary }]}>{shop.location}</Text>
                              </View>
                            ) : null}
                            <View style={[styles.shopSelectBadge, { backgroundColor: open ? `${palette.success}22` : `${palette.error}22` }]}>
                              <View style={[styles.shopSelectDot, { backgroundColor: open ? palette.success : palette.error }]} />
                              <Text style={[styles.shopSelectBadgeText, { color: open ? palette.success : palette.error }]}>{open ? 'Open' : 'Closed'}</Text>
                            </View>
                            {!shop.is_available ? (
                              <View style={[styles.shopSelectBadge, { backgroundColor: `${palette.error}22` }]}>
                                <Text style={[styles.shopSelectBadgeText, { color: palette.error }]}>Unavailable</Text>
                              </View>
                            ) : null}
                            {shop.premium_badge ? (
                              <View style={[styles.shopSelectBadge, {
                                backgroundColor: shop.premium_badge === 'platinum' ? 'rgba(229,228,226,0.18)' :
                                  shop.premium_badge === 'blue' ? 'rgba(59,130,246,0.18)' :
                                  'rgba(34,197,94,0.18)',
                                borderColor: shop.premium_badge === 'platinum' ? '#e5e4e2' :
                                  shop.premium_badge === 'blue' ? '#3b82f6' : '#22c55e',
                                borderWidth: 1,
                              }]}>
                                <Award size={9} color={
                                  shop.premium_badge === 'platinum' ? '#e5e4e2' :
                                  shop.premium_badge === 'blue' ? '#3b82f6' : '#22c55e'
                                } />
                                <Text style={[styles.shopSelectBadgeText, {
                                  color: shop.premium_badge === 'platinum' ? '#e5e4e2' :
                                    shop.premium_badge === 'blue' ? '#3b82f6' : '#22c55e',
                                }]}>{shop.premium_badge === 'platinum' ? 'Platinum' : shop.premium_badge === 'blue' ? 'Blue' : 'Green'}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <ChevronRight size={20} color={palette.placeholderColor} />
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}
          </ScrollView>
        ) : (
          /* Catalogue view — shown when a shop is selected */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 80 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
          >
            {/* Selected shop banner */}
            <View style={[styles.selectedShopBanner, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <TouchableOpacity
                style={[styles.backToShopsBtn, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}
                onPress={() => { setSelectedShopId(null); setSearchQuery(''); setSelectedCategory(null); }}
              >
                <ChevronLeft size={16} color={palette.textPrimary} />
                <Text style={[styles.backToShopsText, { color: palette.textPrimary }]}>Shops</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.selectedShopLogo, { backgroundColor: palette.inputBg }]}>
                  {selectedShopData?.logo_url && Platform.OS === 'web' ? (
                    <img src={selectedShopData.logo_url} style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover' as any }} alt={selectedShopData.name} />
                  ) : (
                    <Store size={18} color={palette.primary} />
                  )}
                </View>
                <Text style={[styles.selectedShopName, { color: palette.textPrimary }]} numberOfLines={1}>{selectedShopData?.name}</Text>
              </View>
              <TouchableOpacity
                style={[styles.shopInfoBtn, { backgroundColor: `${palette.primary}12`, borderColor: `${palette.primary}30` }]}
                onPress={() => { setSelectedShop(selectedShopData); setShowShopModal(true); }}
              >
                <Info size={16} color={palette.primary} />
              </TouchableOpacity>
            </View>

            {/* Search and categories */}
            <View style={{ marginTop: 12, gap: 12 }}>
              <View style={[styles.searchBar, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
                <Search size={16} color={palette.placeholderColor} />
                <TextInput
                  style={[styles.searchInput, { color: palette.textPrimary }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search products..."
                  placeholderTextColor={palette.placeholderColor}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={palette.placeholderColor} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {categories.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.categoryChip, { backgroundColor: !selectedCategory ? palette.primary : palette.inputBg, borderColor: !selectedCategory ? palette.primary : palette.inputBorder }]}
                    onPress={() => setSelectedCategory(null)}
                  >
                    <Text style={{ color: !selectedCategory ? '#fff' : palette.textSecondary, fontSize: 12, fontWeight: '600' }}>All</Text>
                  </TouchableOpacity>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, { backgroundColor: selectedCategory === cat ? palette.primary : palette.inputBg, borderColor: selectedCategory === cat ? palette.primary : palette.inputBorder }]}
                      onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    >
                      <Text style={{ color: selectedCategory === cat ? '#fff' : palette.textSecondary, fontSize: 12, fontWeight: '600' }}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fff5f5', borderColor: '#ef4444', marginHorizontal: 0, marginTop: 12 }]}>
                <AlertCircle size={14} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 12, flex: 1 }}>{error}</Text>
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: palette.textSecondary, marginTop: 16 }]}>PRODUCTS</Text>
            {filteredProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={40} color={palette.placeholderColor} />
                <Text style={{ color: palette.textSecondary, fontSize: 14 }}>No products found</Text>
              </View>
            ) : (
              <View style={styles.productGrid}>
                {filteredProducts.map(product => {
                  const qty = getCartQty(product.id);
                  const shop = shops.find(s => s.id === product.shop_id);
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      shop={shop}
                      qty={qty}
                      onAdd={addToCart}
                      onRemove={removeFromCart}
                      palette={palette}
                    />
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>

      <Modal visible={showCart} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>Your Cart ({cartCount})</Text>
              <TouchableOpacity onPress={() => setShowCart(false)}>
                <X size={22} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>

            {cart.length === 0 ? (
              <View style={styles.emptyState}>
                <ShoppingCart size={40} color={palette.placeholderColor} />
                <Text style={{ color: palette.textSecondary, fontSize: 14 }}>Cart is empty</Text>
              </View>
            ) : (
              <>
                <ScrollView style={{ flex: 1, maxHeight: 400 }}>
                  {cartByShop.map(shopCart => {
                    const shop = shops.find(s => s.id === shopCart.shopId);
                    const shopUnavailable = shop ? !shop.is_available : false;
                    return (
                      <View key={shopCart.shopId} style={{ marginBottom: 16 }}>
                        <View style={[styles.cartShopHeader, { borderBottomColor: palette.cardBorder }]}>
                          <Store size={14} color={palette.primary} />
                          <Text style={[styles.cartShopName, { color: palette.textPrimary }]}>{shopCart.shopName}</Text>
                          {shopUnavailable ? (
                            <View style={[styles.cartUnavailPill, { backgroundColor: `${palette.error}22` }]}>
                              <Text style={[styles.cartUnavailText, { color: palette.error }]}>Unavailable</Text>
                            </View>
                          ) : null}
                          {!shopUnavailable && shop && shop.operating_hours && !computeShopOpen(shop) ? (
                            <View style={[styles.cartUnavailPill, { backgroundColor: `${palette.warning}22` }]}>
                              <Lock size={9} color={palette.warning} />
                              <Text style={[styles.cartUnavailText, { color: palette.warning }]}>Closed</Text>
                            </View>
                          ) : null}
                        </View>
                        {shopCart.items.map(item => (
                          <View key={item.product.id} style={styles.cartItemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.cartItemName, { color: palette.textPrimary }]} numberOfLines={1}>{item.product.name}</Text>
                              <Text style={[styles.cartItemPrice, { color: palette.textSecondary }]}>${Number(item.product.price).toFixed(2)} each</Text>
                            </View>
                            <View style={styles.qtyControl}>
                              <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: palette.accent }]} onPress={() => removeFromCart(item.product.id)}>
                                <Minus size={12} color="#fff" />
                              </TouchableOpacity>
                              <Text style={[styles.qtyText, { color: palette.textPrimary }]}>{item.quantity}</Text>
                              <TouchableOpacity
                                style={[styles.qtyBtn, { backgroundColor: palette.accent }]}
                                onPress={() => addToCart(item.product)}
                                disabled={item.quantity >= item.product.stock || shopUnavailable || (shop != null && shop.operating_hours != null && !computeShopOpen(shop))}
                              >
                                <Plus size={12} color="#fff" />
                              </TouchableOpacity>
                            </View>
                            <Text style={[styles.cartItemTotal, { color: palette.primary }]}>
                              ${(Number(item.product.price) * item.quantity).toFixed(2)}
                            </Text>
                          </View>
                        ))}
                        <View style={[styles.cartShopTotal, { borderTopColor: palette.cardBorder }]}>
                          <Text style={{ color: palette.textSecondary, fontSize: 12 }}>Subtotal</Text>
                          <Text style={{ color: palette.textPrimary, fontSize: 14, fontWeight: '700' }}>${shopCart.total.toFixed(2)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={[styles.cartFooter, { borderTopColor: palette.cardBorder }]}>
                  <View>
                    <Text style={{ color: palette.textSecondary, fontSize: 12 }}>Total (excl. delivery)</Text>
                    <Text style={{ color: palette.textPrimary, fontSize: 20, fontWeight: '800' }}>${cartTotal.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.checkoutBtn, { backgroundColor: anyCartBlocked ? (isDark ? '#2a3a5c' : '#cbd5e1') : palette.primary }]}
                    onPress={() => { setShowCart(false); setShowCheckout(true); }}
                    disabled={anyCartBlocked}
                  >
                    <CreditCard size={18} color="#fff" />
                    <Text style={styles.checkoutBtnText}>{anyCartBlocked ? 'Shop Closed' : 'Checkout'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <ShopProfileModal
        shop={selectedShop}
        visible={showShopModal}
        onClose={() => { setShowShopModal(false); setSelectedShop(null); }}
        products={products}
        cartQty={getCartQty}
        onAdd={addToCart}
        onRemove={removeFromCart}
        palette={palette}
      />

      <Modal visible={showCheckout} animationType="slide" transparent>
        <CheckoutModal
          visible={showCheckout}
          palette={palette}
          cartByShop={cartByShop}
          shops={shops}
          cartTotal={cartTotal}
          placingOrder={placingOrder}
          error={error}
          onClose={() => setShowCheckout(false)}
          onPlaceOrder={placeOrders}
          customerId={customerId}
          deliveryFeeTiers={deliveryFeeTiers}
        />
      </Modal>
    </View>
  );
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
  productGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
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
  cartShopName: { fontSize: 14, fontWeight: '700', flex: 1 },
  cartUnavailPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cartUnavailText: { fontSize: 10, fontWeight: '700' },
  cartItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(128,128,128,0.1)',
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
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 13, fontWeight: '700', minWidth: 16, textAlign: 'center' },
  successIcon: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: '800', color: A.text, marginBottom: 8 },
  successText: { fontSize: 14, color: A.textSub, textAlign: 'center' },
  shopList: { gap: 12, marginTop: 4 },
  shopSelectCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  shopSelectLogo: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  shopSelectName: { fontSize: 16, fontWeight: '700' },
  shopSelectDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  shopSelectMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  shopSelectBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  areaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  shopSelectDot: { width: 6, height: 6, borderRadius: 3 },
  shopSelectBadgeText: { fontSize: 10, fontWeight: '700' },
  selectedShopBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 10,
  },
  backToShopsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  backToShopsText: { fontSize: 13, fontWeight: '700' },
  selectedShopLogo: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  selectedShopName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  shopInfoBtn: {
    width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
});
