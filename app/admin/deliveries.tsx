import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Package, User, Truck, ShoppingBag, Circle as XCircle, MapPin, Navigation } from 'lucide-react-native';
import { A } from '@/lib/admin-theme';
import { SkeletonList } from '@/components/Skeleton';
import { ConnectionBadge } from '@/components/ConnectionBadge';
import type { DeliveryRequestRow } from '@/lib/delivery-request-types';

type Delivery = {
  id: string;
  items: any[];
  total_amount: number;
  delivery_fee: number;
  payment_option: string;
  preferred_delivery_method: string;
  status: string;
  created_at: string;
  customers: {
    full_name: string;
    phone_number: string;
  };
  drivers: {
    full_name: string;
    phone_number: string;
  } | null;
};

type DeclinedDelivery = {
  id: string;
  original_delivery_id: string;
  items: any[];
  total_amount: number;
  delivery_fee: number;
  payment_option: string;
  preferred_delivery_method: string;
  declined_at: string;
  original_created_at: string;
  customers: {
    full_name: string;
    phone_number: string;
  };
  drivers: {
    full_name: string;
    phone_number: string;
  };
};

type ShopOrder = {
  id: string;
  shop_id: string;
  total_amount: number;
  delivery_fee: number;
  ecocash_fee_amount: number | null;
  delivery_location: string | null;
  payment_method: string | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_note: string | null;
  products: any[];
  created_at: string;
  confirmed_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  shops: { name: string } | { name: string }[] | null;
  drivers: { full_name: string; phone_number: string }[] | null;
};

export default function ViewDeliveries() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [declinedDeliveries, setDeclinedDeliveries] = useState<DeclinedDelivery[]>([]);
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequestRow[]>([]);
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'declined' | 'requests' | 'shop'>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connState, setConnState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadDeliveries();
    loadDeclinedDeliveries();
    loadDeliveryRequests();
    loadShopOrders();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    const channel = supabase
      .channel('admin-deliveries-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => loadDeliveries())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'declined_deliveries' }, () => loadDeclinedDeliveries())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requests' }, () => loadDeliveryRequests())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_orders' }, () => loadShopOrders())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnState('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setConnState('error'); setTimeout(() => { loadDeliveries(); loadDeclinedDeliveries(); loadDeliveryRequests(); loadShopOrders(); }, 2000); }
        else if (status === 'CLOSED') setConnState('disconnected');
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadDeliveries = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('deliveries')
        .select(`
          *,
          customers (
            full_name,
            phone_number
          ),
          drivers (
            full_name,
            phone_number
          )
        `)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setDeliveries(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  const loadDeclinedDeliveries = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('declined_deliveries')
        .select(`
          *,
          customers (
            full_name,
            phone_number
          ),
          drivers (
            full_name,
            phone_number
          )
        `)
        .order('declined_at', { ascending: false });

      if (dbError) throw dbError;
      setDeclinedDeliveries(data || []);
    } catch (err: any) {
      console.error('Failed to load declined deliveries:', err);
    }
  };

  const loadDeliveryRequests = async () => {
    try {
      const { data } = await supabase
        .from('delivery_requests')
        .select(`
          *,
          delivery_request_buy_details(*),
          delivery_request_pickup_details(*),
          customers(full_name, phone_number),
          drivers(full_name, phone_number)
        `)
        .order('created_at', { ascending: false });
      setDeliveryRequests((data as DeliveryRequestRow[]) ?? []);
    } catch {}
  };

  const loadShopOrders = async () => {
    try {
      const { data } = await supabase
        .from('shop_orders')
        .select(`
          id, shop_id, total_amount, delivery_fee, ecocash_fee_amount,
          delivery_location, payment_method, status,
          customer_name, customer_phone, order_note,
          products, created_at, confirmed_at, picked_up_at, delivered_at,
          shops!shop_orders_shop_id_fkey(name),
          drivers(full_name, phone_number)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      setShopOrders((data as unknown as ShopOrder[]) ?? []);
    } catch {}
  };

  const getShopOrderStatusMeta = (status: string) => {
    switch (status) {
      case 'pending': return { color: A.amber, dim: A.amberDim, label: 'Pending' };
      case 'confirmed': return { color: A.blue, dim: A.blueDim, label: 'Confirmed' };
      case 'picked_up': return { color: A.cyan, dim: A.cyanDim, label: 'Picked Up' };
      case 'out_for_delivery': return { color: A.cyan, dim: A.cyanDim, label: 'Out for Delivery' };
      case 'delivered': return { color: A.green, dim: A.greenDim, label: 'Delivered' };
      case 'cancelled': return { color: A.red, dim: A.redDim, label: 'Cancelled' };
      case 'declined': return { color: A.red, dim: A.redDim, label: 'Declined' };
      default: return { color: A.textSub, dim: A.surface, label: status };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return A.amber;
      case 'accepted':
        return A.blue;
      case 'in_progress':
        return A.cyan;
      case 'delivered':
        return A.green;
      case 'declined':
      case 'cancelled':
        return A.red;
      default:
        return A.textSub;
    }
  };

  const getStatusDim = (status: string) => {
    switch (status) {
      case 'pending': return A.amberDim;
      case 'accepted': return A.blueDim;
      case 'in_progress': return A.cyanDim;
      case 'delivered': return A.greenDim;
      case 'declined':
      case 'cancelled': return A.redDim;
      default: return A.surface;
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: A.bg }}>
        <View style={{ backgroundColor: A.surface, paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: A.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.cyan, justifyContent: 'center', alignItems: 'center' }}>
            <ArrowLeft size={18} color={A.cyan} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted }}>ORDER TRACKING</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: A.text }}>All Deliveries</Text>
          </View>
        </View>
        <SkeletonList count={6} lines={3} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: A.bg }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: A.surface,
          paddingTop: 60,
          paddingBottom: 16,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: A.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: A.cyanDim,
            borderWidth: 1,
            borderColor: A.cyan,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={18} color={A.cyan} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted }}>
            ORDER TRACKING
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: A.text }}>All Deliveries</Text>
        </View>
        <ConnectionBadge state={connState} />
        <View style={{ width: 36 }} />
      </View>

      {/* Error */}
      {error ? (
        <View style={{ marginHorizontal: 20, marginTop: 12, padding: 12, backgroundColor: A.redDim, borderRadius: 8, borderWidth: 1, borderColor: A.red }}>
          <Text style={{ color: A.red, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'active' ? A.cyan : 'transparent' }}
          onPress={() => setActiveTab('active')}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === 'active' ? A.cyan : A.textSub }}>
            Active <Text style={{ fontSize: 11 }}>({deliveries.length})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'declined' ? A.red : 'transparent' }}
          onPress={() => setActiveTab('declined')}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === 'declined' ? A.red : A.textSub }}>
            Declined <Text style={{ fontSize: 11 }}>({declinedDeliveries.length})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'requests' ? A.amber : 'transparent' }}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === 'requests' ? A.amber : A.textSub }}>
            Requests <Text style={{ fontSize: 11 }}>({deliveryRequests.length})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'shop' ? '#10b981' : 'transparent' }}
          onPress={() => setActiveTab('shop')}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === 'shop' ? '#10b981' : A.textSub }}>
            Shop <Text style={{ fontSize: 11 }}>({shopOrders.length})</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Section title */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted }}>
            {activeTab === 'active' ? `ACTIVE DELIVERIES — ${deliveries.length}` :
             activeTab === 'declined' ? `DECLINED DELIVERIES — ${declinedDeliveries.length}` :
             activeTab === 'requests' ? `DELIVERY REQUESTS — ${deliveryRequests.length}` :
             `SHOP ORDERS — ${shopOrders.length}`}
          </Text>
        </View>

        {activeTab === 'requests' ? (
          deliveryRequests.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Truck size={40} color={A.textMuted} />
              <Text style={{ fontSize: 15, color: A.textSub, marginTop: 12 }}>No delivery requests</Text>
            </View>
          ) : (
            <Animated.View style={{ padding: 16, paddingTop: 0, gap: 14, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              {deliveryRequests.map((req) => {
                const isBuy = req.service_type === 'buy_and_deliver';
                const buy = req.delivery_request_buy_details?.[0];
                const pickup = req.delivery_request_pickup_details?.[0];
                const customer = (req as any).customers;
                const driver = (req as any).drivers;
                const statusColor = getStatusColor(req.status);
                const accent = isBuy ? A.cyan : A.amber;
                return (
                  <View key={req.id} style={{ backgroundColor: A.card, borderRadius: 14, borderWidth: 1, borderColor: A.border, overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ width: 3, backgroundColor: accent }} />
                      <View style={{ flex: 1, padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: accent + '18', justifyContent: 'center', alignItems: 'center' }}>
                            {isBuy ? <ShoppingBag size={20} color={accent} /> : <Package size={20} color={accent} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: A.text }}>{isBuy ? 'Buy & Deliver' : 'Pickup & Deliver'} #{req.id.slice(0, 8)}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                              <View style={{ backgroundColor: statusColor + '20', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: statusColor }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor, letterSpacing: 1 }}>{req.status.replace('_', ' ').toUpperCase()}</Text>
                              </View>
                              <Text style={{ fontSize: 11, color: A.textMuted }}>{req.delivery_mode === 'open_request' ? 'Open' : 'Direct'}</Text>
                            </View>
                          </View>
                          {req.offer_fee && <Text style={{ fontSize: 16, fontWeight: '800', color: A.green }}>${req.offer_fee}</Text>}
                        </View>
                        <View style={{ height: 1, backgroundColor: A.border, marginBottom: 10 }} />
                        <View style={{ gap: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <User size={12} color={A.textMuted} />
                              <Text style={{ fontSize: 12, color: A.textSub }}>Customer</Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{customer?.full_name ?? '—'}</Text>
                          </View>
                          {driver && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Truck size={12} color={A.textMuted} />
                                <Text style={{ fontSize: 12, color: A.textSub }}>Driver</Text>
                              </View>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{driver.full_name}</Text>
                            </View>
                          )}
                          {isBuy && buy && (
                            <>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 12, color: A.textSub }}>Item</Text>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{buy.item_name} × {buy.quantity}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 12, color: A.textSub }}>Shop</Text>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{buy.shop_name}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 12, color: A.textSub }}>Budget</Text>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: A.cyan }}>${buy.budget_estimate}</Text>
                              </View>
                            </>
                          )}
                          {!isBuy && pickup && (
                            <>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 12, color: A.textSub }}>Pickup</Text>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: A.text, maxWidth: '60%', textAlign: 'right' }} numberOfLines={1}>{pickup.pickup_address}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 12, color: A.textSub }}>Deliver to</Text>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: A.text, maxWidth: '60%', textAlign: 'right' }} numberOfLines={1}>{pickup.destination_address}</Text>
                              </View>
                            </>
                          )}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Payment</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{req.payment_method === 'paynow' ? 'Paynow' : 'Pay on Delivery'}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Date</Text>
                            <Text style={{ fontSize: 12, color: A.textSub }}>{new Date(req.created_at).toLocaleString()}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          )
        ) : activeTab === 'active' ? (
          deliveries.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Package size={40} color={A.textMuted} />
              <Text style={{ fontSize: 15, color: A.textSub, marginTop: 12 }}>No active deliveries</Text>
            </View>
          ) : (
            <Animated.View
              style={{
                padding: 16,
                paddingTop: 0,
                gap: 14,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              {deliveries.map(delivery => {
                const statusColor = getStatusColor(delivery.status);
                const statusDim = getStatusDim(delivery.status);
                return (
                  <View
                    key={delivery.id}
                    style={{
                      backgroundColor: A.card,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: A.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ flexDirection: 'row' }}>
                      {/* Left accent bar - status colored */}
                      <View style={{ width: 3, backgroundColor: statusColor }} />

                      <View style={{ flex: 1, padding: 14 }}>
                        {/* Card header row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: A.cyanDim, justifyContent: 'center', alignItems: 'center' }}>
                            <Package size={20} color={A.cyan} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: A.text }}>
                              Order #{delivery.id.slice(0, 8)}
                            </Text>
                            {/* Status badge */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                              <View style={{ backgroundColor: statusDim, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: statusColor }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor, letterSpacing: 1 }}>
                                  {delivery.status.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                          </View>
                          {/* Total amount */}
                          <Text style={{ fontSize: 20, fontWeight: '800', color: A.green }}>
                            ${(delivery.total_amount + delivery.delivery_fee).toFixed(2)}
                          </Text>
                        </View>

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: A.border, marginBottom: 10 }} />

                        {/* Details */}
                        <View style={{ gap: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <User size={12} color={A.textMuted} />
                              <Text style={{ fontSize: 12, color: A.textSub }}>Customer</Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{delivery.customers.full_name}</Text>
                          </View>

                          {delivery.drivers && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Truck size={12} color={A.textMuted} />
                                <Text style={{ fontSize: 12, color: A.textSub }}>Driver</Text>
                              </View>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{delivery.drivers.full_name}</Text>
                            </View>
                          )}

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Items</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{delivery.items.length} items</Text>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Delivery Method</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>
                              {delivery.preferred_delivery_method === 'vehicle' ? 'Vehicle' : 'Walking'}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Payment</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>
                              {delivery.payment_option === 'paynow' ? 'Paynow' : 'Pay on Delivery'}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Delivery Fee</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.cyan }}>${delivery.delivery_fee.toFixed(2)}</Text>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Date</Text>
                            <Text style={{ fontSize: 12, color: A.textSub }}>{new Date(delivery.created_at).toLocaleString()}</Text>
                          </View>
                        </View>

                        {/* Items list */}
                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: A.border }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                            <ShoppingBag size={12} color={A.textMuted} />
                            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>ORDER ITEMS</Text>
                          </View>
                          {delivery.items.map((item: any, index: number) => (
                            <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                              <Text style={{ fontSize: 13, color: A.textSub }}>
                                {item.name} x{item.quantity}
                              </Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>
                                ${(item.price * item.quantity).toFixed(2)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          )
        ) : activeTab === 'declined' ? (
          declinedDeliveries.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <XCircle size={40} color={A.textMuted} />
              <Text style={{ fontSize: 15, color: A.textSub, marginTop: 12 }}>No declined deliveries</Text>
            </View>
          ) : (
            <Animated.View
              style={{
                padding: 16,
                paddingTop: 0,
                gap: 14,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              {declinedDeliveries.map(delivery => (
                <View
                  key={delivery.id}
                  style={{
                    backgroundColor: A.card,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: A.border,
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ flexDirection: 'row' }}>
                    {/* Left red accent bar */}
                    <View style={{ width: 3, backgroundColor: A.red }} />

                    <View style={{ flex: 1, padding: 14 }}>
                      {/* Card header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: A.redDim, justifyContent: 'center', alignItems: 'center' }}>
                          <Package size={20} color={A.red} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: A.text }}>
                            Order #{delivery.original_delivery_id.slice(0, 8)}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <View style={{ backgroundColor: A.redDim, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: A.red }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: A.red, letterSpacing: 1 }}>DECLINED</Text>
                            </View>
                          </View>
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: A.red }}>
                          ${(delivery.total_amount + delivery.delivery_fee).toFixed(2)}
                        </Text>
                      </View>

                      {/* Divider */}
                      <View style={{ height: 1, backgroundColor: A.border, marginBottom: 10 }} />

                      {/* Details */}
                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <User size={12} color={A.textMuted} />
                            <Text style={{ fontSize: 12, color: A.textSub }}>Customer</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{delivery.customers.full_name}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Truck size={12} color={A.textMuted} />
                            <Text style={{ fontSize: 12, color: A.textSub }}>Declined by Driver</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: A.red }}>{delivery.drivers.full_name}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: A.textSub }}>Items</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{delivery.items.length} items</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: A.textSub }}>Delivery Method</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>
                            {delivery.preferred_delivery_method === 'vehicle' ? 'Vehicle Delivery' : 'Walking Delivery'}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: A.textSub }}>Payment</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>
                            {delivery.payment_option === 'paynow' ? 'Paynow' : 'Pay on Delivery'}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: A.textSub }}>Delivery Fee</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: A.cyan }}>${delivery.delivery_fee.toFixed(2)}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: A.textSub }}>Order Date</Text>
                          <Text style={{ fontSize: 12, color: A.textSub }}>{new Date(delivery.original_created_at).toLocaleString()}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: A.textSub }}>Declined Date</Text>
                          <Text style={{ fontSize: 12, color: A.red }}>{new Date(delivery.declined_at).toLocaleString()}</Text>
                        </View>
                      </View>

                      {/* Items list */}
                      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: A.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                          <ShoppingBag size={12} color={A.textMuted} />
                          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>ORDER ITEMS</Text>
                        </View>
                        {delivery.items.map((item: any, index: number) => (
                          <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                            <Text style={{ fontSize: 13, color: A.textSub }}>
                              {item.name} x{item.quantity}
                            </Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>
                              ${(item.price * item.quantity).toFixed(2)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </Animated.View>
          )
        ) : activeTab === 'shop' ? (
          shopOrders.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ShoppingBag size={40} color={A.textMuted} />
              <Text style={{ fontSize: 15, color: A.textSub, marginTop: 12 }}>No shop orders yet</Text>
            </View>
          ) : (
            <Animated.View style={{ padding: 16, paddingTop: 0, gap: 14, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              {shopOrders.map(order => {
                const meta = getShopOrderStatusMeta(order.status);
                const shopName = Array.isArray(order.shops) ? order.shops[0]?.name : order.shops?.name || 'Unknown';
                const items = Array.isArray(order.products) ? order.products : [];
                const itemCount = items.reduce((sum: number, it: any) => sum + (it.qty || it.quantity || 1), 0);
                const deliveryFee = Number(order.delivery_fee || 0);
                const ecocashFee = Number(order.ecocash_fee_amount || 0);
                const grandTotal = Number(order.total_amount) + deliveryFee + ecocashFee;
                return (
                  <View key={order.id} style={{ backgroundColor: A.card, borderRadius: 14, borderWidth: 1, borderColor: A.border, overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ width: 3, backgroundColor: meta.color }} />
                      <View style={{ flex: 1, padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: meta.color + '18', justifyContent: 'center', alignItems: 'center' }}>
                            <ShoppingBag size={20} color={meta.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: A.text }}>Shop Order #{order.id.slice(0, 8)}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                              <View style={{ backgroundColor: meta.color + '20', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: meta.color }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: meta.color, letterSpacing: 1 }}>{meta.label.toUpperCase()}</Text>
                              </View>
                            </View>
                          </View>
                          <Text style={{ fontSize: 20, fontWeight: '800', color: A.green }}>${grandTotal.toFixed(2)}</Text>
                        </View>
                        <View style={{ height: 1, backgroundColor: A.border, marginBottom: 10 }} />
                        <View style={{ gap: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Shop</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }} numberOfLines={1}>{shopName}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <User size={12} color={A.textMuted} />
                              <Text style={{ fontSize: 12, color: A.textSub }}>Customer</Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{order.customer_name || '—'}</Text>
                          </View>
                          {order.drivers && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Truck size={12} color={A.textMuted} />
                                <Text style={{ fontSize: 12, color: A.textSub }}>Driver</Text>
                              </View>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{(order.drivers as any)?.[0]?.full_name}</Text>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Items</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Payment</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>{(order.payment_method || '—').replace(/_/g, ' ')}</Text>
                          </View>
                          {deliveryFee > 0 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: A.textSub }}>Delivery Fee</Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: A.cyan }}>${deliveryFee.toFixed(2)}</Text>
                            </View>
                          )}
                          {order.delivery_location && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: A.textSub }}>Delivery To</Text>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: A.text, maxWidth: '60%', textAlign: 'right' }} numberOfLines={1}>{order.delivery_location}</Text>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: A.textSub }}>Date</Text>
                            <Text style={{ fontSize: 12, color: A.textSub }}>{new Date(order.created_at).toLocaleString()}</Text>
                          </View>
                        </View>
                        {items.length > 0 && (
                          <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: A.border }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                              <ShoppingBag size={12} color={A.textMuted} />
                              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>ORDER ITEMS</Text>
                            </View>
                            {items.map((item: any, index: number) => (
                              <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                <Text style={{ fontSize: 13, color: A.textSub }}>{item.name} x{item.qty || item.quantity}</Text>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: A.text }}>${Number(item.price * (item.qty || item.quantity)).toFixed(2)}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}
