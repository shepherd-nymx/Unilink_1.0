import PageSkeleton from '@/components/PageSkeleton';
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
import { A } from '@/lib/admin-theme';
import { ArrowLeft, Store, CircleCheck as CheckCircle, Circle as XCircle, DollarSign, Clock, Ban, Eye, X, CircleAlert as AlertCircle, ShoppingBag, Settings, MapPin, Calendar, Smartphone, Award, Users, Truck, GraduationCap } from 'lucide-react-native';
import { ConnectionBadge } from '@/components/ConnectionBadge';

type Shop = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  address: string | null;
  contact_phone: string;
  contact_email: string;
  hours: string | null;
  ecocash_number: string | null;
  status: string;
  location: string | null;
  created_at: string;
  rejection_reason: string | null;
  payment_verified_at: string | null;
  approved_at: string | null;
  premium_badge: string | null;
  driver_assignment_mode?: string;
  is_student_owned?: boolean;
};

type ShopOrder = {
  id: string;
  shop_id: string;
  total_amount: number;
  status: string;
  customer_name: string | null;
  created_at: string;
  shops: { name: string } | { name: string }[] | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending Approval',
  payment_required: 'Payment Required',
  payment_submitted: 'Payment Submitted',
  active: 'Active',
  suspended: 'Suspended',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<string, string> = {
  pending_approval: A.amber,
  payment_required: A.amber,
  payment_submitted: A.cyan,
  active: A.green,
  suspended: A.red,
  rejected: A.red,
};

export default function AdminShops() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [shops, setShops] = useState<Shop[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'shops' | 'orders' | 'settings' | 'commission'>('shops');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [shopToReject, setShopToReject] = useState<Shop | null>(null);
  const [registrationFee, setRegistrationFee] = useState('10.00');
  const [savingFee, setSavingFee] = useState(false);
  const [feeSaved, setFeeSaved] = useState(false);
  const [commissionRate, setCommissionRate] = useState('5');
  const [savingCommission, setSavingCommission] = useState(false);
  const [commissionSaved, setCommissionSaved] = useState(false);
  const [commissionData, setCommissionData] = useState<{ shopId: string; shopName: string; confirmedRevenue: number; commissionOwed: number; commissionPaid: number; deadline: string | null }[]>([]);
  const [deadlineShop, setDeadlineShop] = useState<string | null>(null);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [paymentShop, setPaymentShop] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [ecocashNumber, setEcocashNumber] = useState('');
  const [ecocashName, setEcocashName] = useState('');
  const [savingEcocash, setSavingEcocash] = useState(false);
  const [ecocashSaved, setEcocashSaved] = useState(false);
  const [error, setError] = useState('');
  const [connState, setConnState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [savingBadge, setSavingBadge] = useState(false);
  const [shopCustomerCounts, setShopCustomerCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    const channel = supabase
      .channel('admin-shops-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_orders' }, () => loadData())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnState('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setConnState('error'); setTimeout(() => loadData(), 2000); }
        else if (status === 'CLOSED') setConnState('disconnected');
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: shopData, error: shopErr } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });
      if (shopErr) throw shopErr;
      setShops(shopData || []);

      const { data: orderData } = await supabase
        .from('shop_orders')
        .select('id, shop_id, total_amount, status, customer_name, created_at, shops!shop_orders_shop_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      setOrders(orderData || []);

      const { data: custOrderData } = await supabase
        .from('shop_orders')
        .select('shop_id, customer_id');
      const counts: Record<string, Set<string>> = {};
      (custOrderData || []).forEach((o: any) => {
        if (!o.shop_id || !o.customer_id) return;
        if (!counts[o.shop_id]) counts[o.shop_id] = new Set();
        counts[o.shop_id].add(o.customer_id);
      });
      const countMap: Record<string, number> = {};
      Object.keys(counts).forEach(k => { countMap[k] = counts[k].size; });
      setShopCustomerCounts(countMap);

      const { data: settings } = await supabase
        .from('shop_settings')
        .select('registration_fee, commission_rate, payment_ecocash_number, payment_ecocash_name')
        .maybeSingle();
      if (settings) {
        setRegistrationFee(Number(settings.registration_fee).toFixed(2));
        if (settings.commission_rate != null) setCommissionRate(String(settings.commission_rate));
        if (settings.payment_ecocash_number) setEcocashNumber(settings.payment_ecocash_number);
        if (settings.payment_ecocash_name) setEcocashName(settings.payment_ecocash_name);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCommissionData = async (activeShops: Shop[], rate: number) => {
    if (activeShops.length === 0) { setCommissionData([]); return; }
    const shopIds = activeShops.map(s => s.id);
    const { data: orderData } = await supabase
      .from('shop_orders')
      .select('shop_id, total_amount, status')
      .in('shop_id', shopIds)
      .in('status', ['confirmed', 'picked_up', 'out_for_delivery', 'delivered']);
    const revenueByShop: Record<string, number> = {};
    (orderData || []).forEach((o: any) => {
      revenueByShop[o.shop_id] = (revenueByShop[o.shop_id] || 0) + Number(o.total_amount);
    });
    const rows = activeShops.map(s => ({
      shopId: s.id,
      shopName: s.name,
      confirmedRevenue: revenueByShop[s.id] || 0,
      commissionOwed: (revenueByShop[s.id] || 0) * (rate / 100),
      commissionPaid: Number((s as any).commission_paid) || 0,
      deadline: (s as any).commission_deadline || null,
    }));
    setCommissionData(rows.sort((a, b) => b.commissionOwed - a.commissionOwed));
  };

  useEffect(() => {
    if (activeTab === 'commission' && shops.length > 0) {
      loadCommissionData(shops.filter(s => s.status === 'active'), parseFloat(commissionRate) || 5);
    }
  }, [activeTab, shops]);

  const saveCommissionRate = async () => {
    setSavingCommission(true);
    const rate = parseFloat(commissionRate) || 5;
    const { data: settings } = await supabase
      .from('shop_settings')
      .select('id')
      .maybeSingle();
    if (settings) {
      await supabase.from('shop_settings').update({ commission_rate: rate }).eq('id', settings.id);
    } else {
      await supabase.from('shop_settings').insert({ commission_rate: rate });
    }
    setSavingCommission(false);
    setCommissionSaved(true);
    setTimeout(() => setCommissionSaved(false), 2000);
    loadCommissionData(shops.filter(s => s.status === 'active'), rate);
  };

  const saveDeadline = async (shopId: string) => {
    if (!deadlineDate.trim()) return;
    setSavingDeadline(true);
    const dateObj = new Date(deadlineDate);
    if (isNaN(dateObj.getTime())) { setSavingDeadline(false); return; }
    await supabase.from('shops').update({ commission_deadline: dateObj.toISOString() }).eq('id', shopId);
    setSavingDeadline(false);
    setDeadlineShop(null);
    setDeadlineDate('');
    loadData();
  };

  const recordPayment = async (shopId: string) => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) return;
    setSavingPayment(true);
    const shop = shops.find(s => s.id === shopId);
    const currentPaid = Number((shop as any)?.commission_paid) || 0;
    const { error: err } = await supabase
      .from('shops')
      .update({ commission_paid: currentPaid + amount })
      .eq('id', shopId);
    if (err) { setError(err.message); setSavingPayment(false); return; }
    setSavingPayment(false);
    setPaymentShop(null);
    setPaymentAmount('');
    loadData();
  };

  const saveEcocash = async () => {
    setSavingEcocash(true);
    const { data: settings } = await supabase
      .from('shop_settings')
      .select('id')
      .maybeSingle();
    if (settings) {
      await supabase.from('shop_settings')
        .update({ payment_ecocash_number: ecocashNumber.trim() || null, payment_ecocash_name: ecocashName.trim() || null })
        .eq('id', settings.id);
    } else {
      await supabase.from('shop_settings')
        .insert({ payment_ecocash_number: ecocashNumber.trim() || null, payment_ecocash_name: ecocashName.trim() || null });
    }
    setSavingEcocash(false);
    setEcocashSaved(true);
    setTimeout(() => setEcocashSaved(false), 2000);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const updateShopStatus = async (shopId: string, newStatus: string, extra?: Record<string, any>) => {
    const updates: Record<string, any> = { status: newStatus, ...extra };
    if (newStatus === 'active') {
      updates.payment_verified_at = new Date().toISOString();
      if (!updates.approved_at) updates.approved_at = new Date().toISOString();
    }
    if (newStatus === 'suspended') updates.suspended_at = new Date().toISOString();

    const { error: err } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', shopId);
    if (err) { setError(err.message); return; }

    // Send email notification
    const shop = shops.find(s => s.id === shopId);
    if (shop?.contact_email) {
      const emailType = newStatus === 'active' ? 'shop_activated' :
        newStatus === 'rejected' ? 'shop_notification' : '';
      if (emailType) {
        try {
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
          const emailData: Record<string, any> = { shopName: shop.name };
          if (newStatus === 'rejected') {
            emailData.action = 'rejected';
            emailData.rejectionReason = extra?.rejection_reason || '';
          }
          await fetch(`${supabaseUrl}/functions/v1/resend-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: anonKey! },
            body: JSON.stringify({
              type: emailType,
              to: shop.contact_email,
              userType: 'shop',
              data: emailData,
            }),
          });
        } catch {}
      }
    }

    loadData();
  };

  const toggleAssignmentMode = async (shop: Shop) => {
    const current = shop.driver_assignment_mode === 'customer_assigned' ? 'customer_assigned' : 'shop_assigned';
    const next = current === 'customer_assigned' ? 'shop_assigned' : 'customer_assigned';
    const { error: err } = await supabase
      .from('shops')
      .update({ driver_assignment_mode: next })
      .eq('id', shop.id);
    if (err) { setError(err.message); return; }
    setShops(prev => prev.map(s => s.id === shop.id ? { ...s, driver_assignment_mode: next } : s));
  };

  const rejectShop = async () => {
    if (!shopToReject || !rejectionReason.trim()) return;
    await updateShopStatus(shopToReject.id, 'rejected', { rejection_reason: rejectionReason.trim() });
    setShowRejectModal(false);
    setShopToReject(null);
    setRejectionReason('');
  };

  const saveFee = async () => {
    setSavingFee(true);
    const { data: settings } = await supabase
      .from('shop_settings')
      .select('id')
      .maybeSingle();
    if (settings) {
      await supabase
        .from('shop_settings')
        .update({ registration_fee: parseFloat(registrationFee) || 10 })
        .eq('id', settings.id);
    } else {
      await supabase
        .from('shop_settings')
        .insert({ registration_fee: parseFloat(registrationFee) || 10 });
    }
    setSavingFee(false);
    setFeeSaved(true);
    setTimeout(() => setFeeSaved(false), 2000);
  };

  if (loading) {
    return <PageSkeleton page="admin/shops" onBack={() => router.back()}/>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={18} color={A.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Shop Management</Text>
          <Text style={styles.headerSub}>{shops.length} shops registered</Text>
        </View>
        <ConnectionBadge state={connState} />
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.tabBar}>
          {([
            { key: 'shops', label: 'Shops', icon: Store },
            { key: 'orders', label: 'Orders', icon: ShoppingBag },
            { key: 'commission', label: 'Commission', icon: DollarSign },
            { key: 'settings', label: 'Settings', icon: Settings },
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
          </View>
        ) : null}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={A.cyan} />}
        >
          {activeTab === 'shops' && (
            <View style={{ gap: 10 }}>
              {shops.length === 0 ? (
                <View style={styles.emptyState}>
                  <Store size={40} color={A.textMuted} />
                  <Text style={styles.emptyText}>No shops registered</Text>
                </View>
              ) : (
                shops.map(shop => {
                  const statusColor = STATUS_COLORS[shop.status] || A.textSub;
                  return (
                    <View key={shop.id} style={styles.shopCard}>
                      <View style={styles.shopCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
                          <Text style={styles.shopContact} numberOfLines={1}>{shop.contact_email} | {shop.contact_phone}</Text>
                          {shop.address && <Text style={styles.shopAddress}>{shop.address}</Text>}
                          {shop.location && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <MapPin size={10} color={A.cyan} />
                              <Text style={[styles.shopAddress, { color: A.cyan }]}>{shop.location}</Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
                          <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
                            {STATUS_LABELS[shop.status] || shop.status}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' as any }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Users size={13} color={A.cyan} />
                          <Text style={styles.shopDetailText}>{shopCustomerCounts[shop.id] ?? 0} customers</Text>
                        </View>
                        {shop.is_student_owned && (
                          <View style={[styles.studentOwnedBadge, { backgroundColor: `${A.green}18`, borderColor: A.green }]}>
                            <GraduationCap size={11} color={A.green} />
                            <Text style={[styles.studentOwnedBadgeText, { color: A.green }]}>Student Owned</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={[styles.assignmentToggle, { borderColor: shop.driver_assignment_mode === 'customer_assigned' ? A.amber : A.cyan }]}
                          onPress={() => toggleAssignmentMode(shop)}
                          activeOpacity={0.8}
                        >
                          <Truck size={13} color={shop.driver_assignment_mode === 'customer_assigned' ? A.amber : A.cyan} />
                          <Text style={[styles.assignmentToggleText, { color: shop.driver_assignment_mode === 'customer_assigned' ? A.amber : A.cyan }]}>
                            {shop.driver_assignment_mode === 'customer_assigned' ? 'Customer picks driver' : 'Shop assigns driver'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.shopActions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: A.cyanDim, borderColor: A.cyan }]}
                          onPress={() => { setSelectedShop(shop); setShowShopModal(true); }}
                        >
                          <Eye size={14} color={A.cyan} />
                          <Text style={[styles.actionBtnText, { color: A.cyan }]}>View</Text>
                        </TouchableOpacity>

                        {shop.status === 'pending_approval' && (
                          <>
                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: A.greenDim, borderColor: A.green }]}
                              onPress={() => updateShopStatus(shop.id, 'active', { approved_at: new Date().toISOString() })}
                            >
                              <CheckCircle size={14} color={A.green} />
                              <Text style={[styles.actionBtnText, { color: A.green }]}>Approve & Activate</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: A.redDim, borderColor: A.red }]}
                              onPress={() => { setShopToReject(shop); setShowRejectModal(true); }}
                            >
                              <XCircle size={14} color={A.red} />
                              <Text style={[styles.actionBtnText, { color: A.red }]}>Reject</Text>
                            </TouchableOpacity>
                          </>
                        )}

                        {shop.status === 'payment_submitted' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: A.greenDim, borderColor: A.green }]}
                            onPress={() => updateShopStatus(shop.id, 'active')}
                          >
                            <CheckCircle size={14} color={A.green} />
                            <Text style={[styles.actionBtnText, { color: A.green }]}>Verify Payment</Text>
                          </TouchableOpacity>
                        )}

                        {shop.status === 'active' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: A.redDim, borderColor: A.red }]}
                            onPress={() => updateShopStatus(shop.id, 'suspended')}
                          >
                            <Ban size={14} color={A.red} />
                            <Text style={[styles.actionBtnText, { color: A.red }]}>Suspend</Text>
                          </TouchableOpacity>
                        )}

                        {shop.status === 'suspended' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: A.greenDim, borderColor: A.green }]}
                            onPress={() => updateShopStatus(shop.id, 'active', { suspended_at: null })}
                          >
                            <CheckCircle size={14} color={A.green} />
                            <Text style={[styles.actionBtnText, { color: A.green }]}>Reactivate</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {shop.rejection_reason && (
                        <Text style={styles.rejectionReason}>Rejected: {shop.rejection_reason}</Text>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {activeTab === 'orders' && (
            <View style={{ gap: 10 }}>
              {orders.length === 0 ? (
                <View style={styles.emptyState}>
                  <ShoppingBag size={40} color={A.textMuted} />
                  <Text style={styles.emptyText}>No shop orders yet</Text>
                </View>
              ) : (
                orders.map(order => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${A.cyan}20`, borderColor: A.cyan }]}>
                        <Text style={[styles.statusText, { color: A.cyan }]}>{order.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.orderShop} numberOfLines={1}>{Array.isArray(order.shops) ? order.shops[0]?.name : order.shops?.name || 'Unknown'}</Text>
                    <Text style={styles.orderCustomer}>{order.customer_name || 'Customer'}</Text>
                    <View style={styles.orderFooter}>
                      <Text style={styles.orderTotal}>${Number(order.total_amount).toFixed(2)}</Text>
                      <Text style={styles.orderTime}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'commission' && (
            <View style={{ gap: 14 }}>
              <View style={[styles.settingsCard, { borderColor: `${A.amber}40` }]}>
                <Text style={styles.settingsTitle}>Platform Commission Rate</Text>
                <Text style={styles.settingsDesc}>Percentage of each shop's confirmed-order revenue owed to UniLink Delivery.</Text>
                <View style={styles.feeInputRow}>
                  <DollarSign size={20} color={A.amber} />
                  <TextInput
                    style={styles.feeInput}
                    value={commissionRate}
                    onChangeText={setCommissionRate}
                    keyboardType="decimal-pad"
                    placeholderTextColor={A.textMuted}
                  />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: A.textSub }}>%</Text>
                </View>
                <TouchableOpacity
                  style={[styles.saveFeeBtn, { opacity: savingCommission ? 0.6 : 1 }]}
                  onPress={saveCommissionRate}
                  disabled={savingCommission}
                >
                  {savingCommission ? <ActivityIndicator size="small" color="#000" /> : (
                    <Text style={styles.saveFeeBtnText}>{commissionSaved ? 'Saved!' : 'Save Rate'}</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.settingsCard, { borderColor: `${A.green}40` }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Smartphone size={18} color={A.green} />
                  <Text style={styles.settingsTitle}>Ecocash Payment Details</Text>
                </View>
                <Text style={styles.settingsDesc}>Shops will see this as where to send commission payments.</Text>
                <Text style={[styles.modalLabel, { marginTop: 8 }]}>ECOCASH NUMBER</Text>
                <TextInput
                  style={[styles.rejectInput, { minHeight: 44, marginBottom: 10 }]}
                  value={ecocashNumber}
                  onChangeText={setEcocashNumber}
                  placeholder="e.g. 0772 123 456"
                  placeholderTextColor={A.textMuted}
                  keyboardType="phone-pad"
                />
                <Text style={styles.modalLabel}>ACCOUNT NAME</Text>
                <TextInput
                  style={[styles.rejectInput, { minHeight: 44, marginBottom: 12 }]}
                  value={ecocashName}
                  onChangeText={setEcocashName}
                  placeholder="e.g. UniLink Delivery"
                  placeholderTextColor={A.textMuted}
                />
                <TouchableOpacity
                  style={[styles.saveFeeBtn, { opacity: savingEcocash ? 0.6 : 1 }]}
                  onPress={saveEcocash}
                  disabled={savingEcocash}
                >
                  {savingEcocash ? <ActivityIndicator size="small" color="#000" /> : (
                    <Text style={styles.saveFeeBtnText}>{ecocashSaved ? 'Saved!' : 'Save Details'}</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 11, fontWeight: '700', color: A.textSub, letterSpacing: 1.5, textTransform: 'uppercase' as any }}>
                Shop Commission Breakdown
              </Text>
              {commissionData.length === 0 ? (
                <View style={styles.emptyState}>
                  <DollarSign size={40} color={A.textMuted} />
                  <Text style={styles.emptyText}>No active shops with revenue yet</Text>
                </View>
              ) : (
                commissionData.map(row => {
                  const now = new Date();
                  const dl = row.deadline ? new Date(row.deadline) : null;
                  const isOverdue = dl && dl < now;
                  const isDueSoon = dl && dl >= now && dl.getTime() - now.getTime() < 3 * 86400000;
                  const dlColor = isOverdue ? A.red : isDueSoon ? A.amber : A.green;
                  const balance = row.commissionOwed - row.commissionPaid;
                  const fullyPaid = balance <= 0 && row.commissionOwed > 0;
                  return (
                    <View key={row.shopId} style={[styles.shopCard, { borderColor: fullyPaid ? A.green : isOverdue ? A.red : A.border }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.shopName} numberOfLines={1}>{row.shopName}</Text>
                          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' as any }}>
                            <View>
                              <Text style={{ fontSize: 10, color: A.textSub, fontWeight: '600' }}>REVENUE</Text>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: A.text }}>${row.confirmedRevenue.toFixed(2)}</Text>
                            </View>
                            <View>
                              <Text style={{ fontSize: 10, color: A.textSub, fontWeight: '600' }}>OWED ({(parseFloat(commissionRate) || 5).toFixed(0)}%)</Text>
                              <Text style={{ fontSize: 14, fontWeight: '800', color: A.amber }}>${row.commissionOwed.toFixed(2)}</Text>
                            </View>
                            <View>
                              <Text style={{ fontSize: 10, color: A.textSub, fontWeight: '600' }}>PAID</Text>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: A.green }}>${row.commissionPaid.toFixed(2)}</Text>
                            </View>
                            <View>
                              <Text style={{ fontSize: 10, color: A.textSub, fontWeight: '600' }}>BALANCE</Text>
                              <Text style={{ fontSize: 14, fontWeight: '800', color: fullyPaid ? A.green : A.red }}>${balance.toFixed(2)}</Text>
                            </View>
                          </View>
                        </View>
                        {dl ? (
                          <View style={{ alignItems: 'flex-end' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Calendar size={11} color={dlColor} />
                              <Text style={{ fontSize: 10, color: dlColor, fontWeight: '700' }}>
                                {isOverdue ? 'OVERDUE' : 'DUE'}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 11, color: A.textSub, marginTop: 2 }}>
                              {dl.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                        ) : (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 10, color: A.textMuted }}>No deadline</Text>
                          </View>
                        )}
                      </View>
                      {fullyPaid && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          <CheckCircle size={13} color={A.green} />
                          <Text style={{ fontSize: 11, color: A.green, fontWeight: '600' }}>Commission fully paid</Text>
                        </View>
                      )}
                      {paymentShop === row.shopId ? (
                        <View style={{ marginTop: 10, gap: 8 }}>
                          <Text style={{ fontSize: 11, color: A.textSub }}>Enter amount paid by this shop:</Text>
                          <View style={styles.feeInputRow}>
                            <DollarSign size={18} color={A.green} />
                            <TextInput
                              style={styles.feeInput}
                              value={paymentAmount}
                              onChangeText={setPaymentAmount}
                              placeholder="0.00"
                              placeholderTextColor={A.textMuted}
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={[styles.actionBtn, { flex: 1, justifyContent: 'center', backgroundColor: A.card, borderColor: A.border }]}
                              onPress={() => { setPaymentShop(null); setPaymentAmount(''); }}
                            >
                              <Text style={{ color: A.textSub, fontSize: 12 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, { flex: 1, justifyContent: 'center', backgroundColor: A.greenDim, borderColor: A.green }]}
                              onPress={() => recordPayment(row.shopId)}
                              disabled={savingPayment || !paymentAmount.trim()}
                            >
                              {savingPayment ? <ActivityIndicator size="small" color={A.green} /> : (
                                <Text style={{ color: A.green, fontSize: 12, fontWeight: '600' }}>Record Payment</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                          {!fullyPaid && (
                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: A.greenDim, borderColor: A.green }]}
                              onPress={() => { setPaymentShop(row.shopId); setPaymentAmount(''); }}
                            >
                              <DollarSign size={12} color={A.green} />
                              <Text style={[styles.actionBtnText, { color: A.green }]}>Record Payment</Text>
                            </TouchableOpacity>
                          )}
                          {deadlineShop === row.shopId ? (
                            <View style={{ flex: 1, gap: 8 }}>
                              <TextInput
                                style={styles.rejectInput}
                                value={deadlineDate}
                                onChangeText={setDeadlineDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={A.textMuted}
                                keyboardType="numeric"
                              />
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                  style={[styles.actionBtn, { flex: 1, justifyContent: 'center', backgroundColor: A.card, borderColor: A.border }]}
                                  onPress={() => { setDeadlineShop(null); setDeadlineDate(''); }}
                                >
                                  <Text style={{ color: A.textSub, fontSize: 12 }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.actionBtn, { flex: 1, justifyContent: 'center', backgroundColor: A.cyanDim, borderColor: A.cyan }]}
                                  onPress={() => saveDeadline(row.shopId)}
                                  disabled={savingDeadline || !deadlineDate.trim()}
                                >
                                  {savingDeadline ? <ActivityIndicator size="small" color={A.cyan} /> : (
                                    <Text style={{ color: A.cyan, fontSize: 12, fontWeight: '600' }}>Set</Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: A.cyanDim, borderColor: A.cyan }]}
                              onPress={() => { setDeadlineShop(row.shopId); setDeadlineDate(''); }}
                            >
                              <Calendar size={12} color={A.cyan} />
                              <Text style={[styles.actionBtnText, { color: A.cyan }]}>{row.deadline ? 'Change Deadline' : 'Set Deadline'}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {activeTab === 'settings' && (
            <View style={styles.settingsCard}>
              <Text style={styles.settingsTitle}>Registration Fee</Text>
              <Text style={styles.settingsDesc}>The fee shops must pay after approval before becoming active.</Text>
              <View style={styles.feeInputRow}>
                <DollarSign size={20} color={A.amber} />
                <TextInput
                  style={styles.feeInput}
                  value={registrationFee}
                  onChangeText={setRegistrationFee}
                  keyboardType="decimal-pad"
                  placeholderTextColor={A.textMuted}
                />
              </View>
              <TouchableOpacity
                style={[styles.saveFeeBtn, { opacity: savingFee ? 0.6 : 1 }]}
                onPress={saveFee}
                disabled={savingFee}
              >
                {savingFee ? <ActivityIndicator size="small" color="#000" /> : (
                  <Text style={styles.saveFeeBtnText}>{feeSaved ? 'Saved!' : 'Save Fee'}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Shop detail modal */}
      <Modal visible={showShopModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedShop && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedShop.name}</Text>
                  <TouchableOpacity onPress={() => { setShowShopModal(false); setSelectedShop(null); }}>
                    <X size={22} color={A.textSub} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 400 }}>
                  {selectedShop.logo_url && Platform.OS === 'web' && (
                    <img src={selectedShop.logo_url} style={{ width: '100%', height: 160, borderRadius: 12, objectFit: 'cover' as any, marginBottom: 16 }} alt="Shop Logo" />
                  )}
                  <Text style={styles.modalLabel}>STATUS</Text>
                  <Text style={styles.modalValue}>{STATUS_LABELS[selectedShop.status] || selectedShop.status}</Text>
                  <Text style={styles.modalLabel}>EMAIL</Text>
                  <Text style={styles.modalValue}>{selectedShop.contact_email}</Text>
                  <Text style={styles.modalLabel}>PHONE</Text>
                  <Text style={styles.modalValue}>{selectedShop.contact_phone}</Text>
                  {selectedShop.address && (
                    <>
                      <Text style={styles.modalLabel}>ADDRESS</Text>
                      <Text style={styles.modalValue}>{selectedShop.address}</Text>
                    </>
                  )}
                  {selectedShop.location && (
                    <>
                      <Text style={styles.modalLabel}>AREA</Text>
                      <Text style={styles.modalValue}>{selectedShop.location}</Text>
                    </>
                  )}
                  {selectedShop.hours && (
                    <>
                      <Text style={styles.modalLabel}>HOURS</Text>
                      <Text style={styles.modalValue}>{selectedShop.hours}</Text>
                    </>
                  )}
                  {selectedShop.description && (
                    <>
                      <Text style={styles.modalLabel}>DESCRIPTION</Text>
                      <Text style={styles.modalValue}>{selectedShop.description}</Text>
                    </>
                  )}
                  <Text style={styles.modalLabel}>REGISTERED</Text>
                  <Text style={styles.modalValue}>{new Date(selectedShop.created_at).toLocaleString()}</Text>

                  <Text style={[styles.modalLabel, { marginTop: 20 }]}>PREMIUM BADGE</Text>
                  <Text style={{ fontSize: 12, color: A.textSub, marginTop: 4, marginBottom: 10 }}>Assign a premium badge to highlight this shop to customers.</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' as any }}>
                    {[
                      { key: null, label: 'None', color: A.textSub },
                      { key: 'blue', label: 'Blue', color: '#3b82f6' },
                      { key: 'green', label: 'Green', color: '#22c55e' },
                      { key: 'platinum', label: 'Platinum', color: '#e5e4e2' },
                    ].map(b => {
                      const active = (selectedShop as any).premium_badge === b.key;
                      return (
                        <TouchableOpacity
                          key={b.label}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5,
                            backgroundColor: active ? `${b.color}20` : A.card,
                            borderColor: active ? b.color : A.border,
                            opacity: savingBadge ? 0.5 : 1,
                          }}
                          onPress={async () => {
                            setSavingBadge(true);
                            await supabase.from('shops').update({ premium_badge: b.key }).eq('id', selectedShop.id);
                            setSavingBadge(false);
                            setShops(prev => prev.map(s => s.id === selectedShop.id ? { ...s, premium_badge: b.key } as Shop : s));
                            setSelectedShop({ ...selectedShop, premium_badge: b.key } as Shop);
                          }}
                          disabled={savingBadge}
                        >
                          {b.key !== null && <Award size={12} color={b.color} />}
                          <Text style={{ fontSize: 12, fontWeight: '700', color: active ? b.color : A.textSub }}>{b.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.modalLabel, { marginTop: 20 }]}>STUDENT OWNED</Text>
                  <Text style={{ fontSize: 12, color: A.textSub, marginTop: 4, marginBottom: 10 }}>Mark this shop as student-owned. A label will be shown to customers when viewing this shop.</Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5,
                      backgroundColor: selectedShop.is_student_owned ? `${A.green}20` : A.card,
                      borderColor: selectedShop.is_student_owned ? A.green : A.border,
                      opacity: savingBadge ? 0.5 : 1,
                    }}
                    onPress={async () => {
                      setSavingBadge(true);
                      const next = !selectedShop.is_student_owned;
                      await supabase.from('shops').update({ is_student_owned: next }).eq('id', selectedShop.id);
                      setSavingBadge(false);
                      setShops(prev => prev.map(s => s.id === selectedShop.id ? { ...s, is_student_owned: next } as Shop : s));
                      setSelectedShop({ ...selectedShop, is_student_owned: next } as Shop);
                    }}
                    disabled={savingBadge}
                  >
                    <GraduationCap size={14} color={selectedShop.is_student_owned ? A.green : A.textSub} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: selectedShop.is_student_owned ? A.green : A.textSub }}>
                      {selectedShop.is_student_owned ? 'Student Owned' : 'Mark as Student Owned'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Reject modal */}
      <Modal visible={showRejectModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Shop</Text>
            <Text style={{ color: A.textSub, fontSize: 13, marginBottom: 12 }}>
              Provide a reason for rejecting {shopToReject?.name}:
            </Text>
            <TextInput
              style={styles.rejectInput}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Reason for rejection..."
              placeholderTextColor={A.textMuted}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, justifyContent: 'center', backgroundColor: A.card, borderColor: A.border }]}
                onPress={() => { setShowRejectModal(false); setShopToReject(null); setRejectionReason(''); }}
              >
                <Text style={{ color: A.textSub, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, justifyContent: 'center', backgroundColor: A.redDim, borderColor: A.red }]}
                onPress={rejectShop}
                disabled={!rejectionReason.trim()}
              >
                <Text style={{ color: A.red, fontSize: 14, fontWeight: '600' }}>Confirm Reject</Text>
              </TouchableOpacity>
            </View>
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
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border, gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: A.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: A.border },
  headerTitle: { fontSize: 16, fontWeight: '700', color: A.text },
  headerSub: { fontSize: 11, color: A.textSub, marginTop: 2 },
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
  shopCard: {
    backgroundColor: A.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: A.border,
  },
  shopCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  shopName: { fontSize: 15, fontWeight: '700', color: A.text, flexShrink: 1 },
  shopContact: { fontSize: 11, color: A.textSub, marginTop: 4 },
  shopAddress: { fontSize: 11, color: A.textMuted, marginTop: 2 },
  shopDetailText: { fontSize: 12, color: A.textSub, fontWeight: '600' },
  assignmentToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  assignmentToggleText: { fontSize: 11, fontWeight: '700' },
  studentOwnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  studentOwnedBadgeText: { fontSize: 10, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: '600', flexShrink: 1 },
  shopActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' as any },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  rejectionReason: { fontSize: 11, color: A.red, marginTop: 8, fontStyle: 'italic' as any },
  orderCard: { backgroundColor: A.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: A.border },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 14, fontWeight: '700', color: A.text },
  orderShop: { fontSize: 12, color: A.textSub, marginTop: 4 },
  orderCustomer: { fontSize: 11, color: A.textMuted, marginTop: 2 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  orderTotal: { fontSize: 15, fontWeight: '700', color: A.green },
  orderTime: { fontSize: 11, color: A.textMuted },
  settingsCard: { backgroundColor: A.card, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: A.border },
  settingsTitle: { fontSize: 15, fontWeight: '700', color: A.text },
  settingsDesc: { fontSize: 12, color: A.textSub, marginTop: 4, marginBottom: 16 },
  feeInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: A.inputBg, borderRadius: 10, borderWidth: 1, borderColor: A.inputBorder,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  feeInput: { flex: 1, fontSize: 18, fontWeight: '700', color: A.text, paddingVertical: 12 },
  saveFeeBtn: {
    backgroundColor: A.cyan, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  saveFeeBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: A.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: A.text },
  modalLabel: { fontSize: 11, fontWeight: '700', color: A.textSub, textTransform: 'uppercase' as any, letterSpacing: 0.5, marginTop: 12 },
  modalValue: { fontSize: 14, color: A.text, marginTop: 4 },
  rejectInput: {
    backgroundColor: A.inputBg, borderRadius: 10, borderWidth: 1, borderColor: A.inputBorder,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: A.text, minHeight: 80,
  },
});
