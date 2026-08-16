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
import { ArrowLeft, Store, CircleCheck as CheckCircle, Circle as XCircle, DollarSign, Clock, Ban, Eye, X, CircleAlert as AlertCircle, ShoppingBag, Settings } from 'lucide-react-native';

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
  created_at: string;
  rejection_reason: string | null;
  payment_verified_at: string | null;
  approved_at: string | null;
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
  const [activeTab, setActiveTab] = useState<'shops' | 'orders' | 'settings'>('shops');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [shopToReject, setShopToReject] = useState<Shop | null>(null);
  const [registrationFee, setRegistrationFee] = useState('10.00');
  const [savingFee, setSavingFee] = useState(false);
  const [feeSaved, setFeeSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
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

      const { data: settings } = await supabase
        .from('shop_settings')
        .select('registration_fee')
        .maybeSingle();
      if (settings) setRegistrationFee(Number(settings.registration_fee).toFixed(2));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const updateShopStatus = async (shopId: string, newStatus: string, extra?: Record<string, any>) => {
    const updates: Record<string, any> = { status: newStatus, ...extra };
    if (newStatus === 'payment_required') updates.approved_at = new Date().toISOString();
    if (newStatus === 'active') updates.payment_verified_at = new Date().toISOString();
    if (newStatus === 'suspended') updates.suspended_at = new Date().toISOString();

    const { error: err } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', shopId);
    if (err) { setError(err.message); return; }

    // Send email notification
    const shop = shops.find(s => s.id === shopId);
    if (shop?.contact_email) {
      const emailType = newStatus === 'payment_required' ? 'shop_approval' :
        newStatus === 'active' ? 'shop_activated' : '';
      if (emailType) {
        try {
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
          const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
          await fetch(`${supabaseUrl}/functions/v1/resend-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
            body: JSON.stringify({
              type: emailType,
              to: shop.contact_email,
              data: { shopName: shop.name },
            }),
          });
        } catch {}
      }
    }

    loadData();
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
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={A.cyan} />
      </View>
    );
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
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.tabBar}>
          {([
            { key: 'shops', label: 'Shops', icon: Store },
            { key: 'orders', label: 'Orders', icon: ShoppingBag },
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
                          <Text style={styles.shopName}>{shop.name}</Text>
                          <Text style={styles.shopContact}>{shop.contact_email} | {shop.contact_phone}</Text>
                          {shop.address && <Text style={styles.shopAddress}>{shop.address}</Text>}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
                          <Text style={[styles.statusText, { color: statusColor }]}>
                            {STATUS_LABELS[shop.status] || shop.status}
                          </Text>
                        </View>
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
                              onPress={() => updateShopStatus(shop.id, 'payment_required')}
                            >
                              <CheckCircle size={14} color={A.green} />
                              <Text style={[styles.actionBtnText, { color: A.green }]}>Approve</Text>
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
                    <Text style={styles.orderShop}>{Array.isArray(order.shops) ? order.shops[0]?.name : order.shops?.name || 'Unknown'}</Text>
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
                  {selectedShop.hours && (
                    <>
                      <Text style={styles.modalLabel}>HOURS</Text>
                      <Text style={styles.modalValue}>{selectedShop.hours}</Text>
                    </>
                  )}
                  {selectedShop.ecocash_number && (
                    <>
                      <Text style={styles.modalLabel}>ECOCASH</Text>
                      <Text style={styles.modalValue}>{selectedShop.ecocash_number}</Text>
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
  shopCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  shopName: { fontSize: 15, fontWeight: '700', color: A.text },
  shopContact: { fontSize: 11, color: A.textSub, marginTop: 4 },
  shopAddress: { fontSize: 11, color: A.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '600' },
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
