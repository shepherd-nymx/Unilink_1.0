import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, DollarSign, MapPin, Clock, Package, TrendingUp, Users, ChevronRight } from 'lucide-react-native';

const CYAN = '#00e5ff';
const CYAN_DIM = 'rgba(0,229,255,0.1)';
const CYAN_BORDER = 'rgba(0,229,255,0.22)';
const GREEN = '#00ff88';
const GREEN_DIM = 'rgba(0,255,136,0.1)';
const AMBER = '#ffb300';
const AMBER_DIM = 'rgba(255,179,0,0.1)';
const BG = '#030810';
const CARD = '#070f1c';
const CARD2 = '#0b1628';
const TEXT = '#d0eaff';
const TEXT2 = '#4a7a9b';
const TEXT3 = '#1e3a5f';

type HistoryRecord = {
  id: string;
  delivery_id: string;
  customer_name: string;
  customer_phone: string;
  pickup_location: string | null;
  delivery_latitude: number;
  delivery_longitude: number;
  payment_method: string;
  total_amount: number;
  delivery_fee: number;
  driver_earnings: number;
  items: any[];
  payment_received_at: string | null;
  completed_at: string;
  status: string;
};

type CustomerSummary = {
  customer_name: string;
  customer_phone: string;
  total_deliveries: number;
  total_earnings: number;
  last_delivery: string;
};

function StatCard({ label, value, color = CYAN, icon }: { label: string; value: string; color?: string; icon: any }) {
  const glow = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.8, duration: 2000, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.3, duration: 2000, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const borderColor = glow.interpolate({ inputRange: [0, 1], outputRange: [TEXT3, color + '55'] });

  return (
    <Animated.View style={[cs.statCard, { borderColor }]}>
      <View style={[cs.statIcon, { backgroundColor: color + '14' }]}>{icon}</View>
      <Text style={[cs.statValue, { color }]}>{value}</Text>
      <Text style={cs.statLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function DriverCustomers() {
  const router = useRouter();
  const { driverId, driverName } = useLocalSearchParams();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [customerSummaries, setCustomerSummaries] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const headerGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlow, { toValue: 1, duration: 2800, useNativeDriver: false }),
        Animated.timing(headerGlow, { toValue: 0, duration: 2800, useNativeDriver: false }),
      ])
    );
    loop.start();
    loadHistory();
    return () => loop.stop();
  }, []);

  const loadHistory = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('driver_delivery_history')
        .select('*')
        .eq('driver_id', driverId as string)
        .order('completed_at', { ascending: false });
      if (dbError) throw dbError;
      setHistory(data || []);
      setCustomerSummaries(aggregateCustomerData(data || []));
    } catch (err: any) { setError(err.message || 'Failed to load history'); }
    finally { setLoading(false); }
  };

  const aggregateCustomerData = (records: HistoryRecord[]): CustomerSummary[] => {
    const map = new Map<string, CustomerSummary>();
    records.forEach(r => {
      const key = r.customer_phone;
      if (!map.has(key)) map.set(key, { customer_name: r.customer_name, customer_phone: r.customer_phone, total_deliveries: 0, total_earnings: 0, last_delivery: r.completed_at });
      const s = map.get(key)!;
      s.total_deliveries += 1;
      s.total_earnings += r.driver_earnings;
      if (new Date(r.completed_at) > new Date(s.last_delivery)) s.last_delivery = r.completed_at;
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.last_delivery).getTime() - new Date(a.last_delivery).getTime());
  };

  const getCustomerHistory = (phone: string) => history.filter(r => r.customer_phone === phone);

  const headerBorder = headerGlow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,229,255,0.06)', 'rgba(0,229,255,0.28)'] });

  if (loading) {
    return (
      <View style={cs.centered}>
        <ActivityIndicator size="large" color={CYAN} />
      </View>
    );
  }

  const totalEarnings = history.reduce((s, r) => s + r.driver_earnings, 0);

  return (
    <View style={cs.container}>
      <Animated.View style={[cs.header, { borderBottomColor: headerBorder }]}>
        <TouchableOpacity style={cs.backBtn} onPress={selectedCustomer ? () => setSelectedCustomer(null) : () => router.back()}>
          <ArrowLeft size={20} color={CYAN} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={cs.headerTitle}>{selectedCustomer ? 'Delivery Records' : 'History'}</Text>
          {driverName ? <Text style={cs.headerSubtitle}>{driverName as string}</Text> : null}
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      {error ? (
        <View style={cs.errorBox}>
          <Text style={cs.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {history.length === 0 ? (
          <View style={cs.emptyState}>
            <Package size={40} color={TEXT3} />
            <Text style={cs.emptyTitle}>No Delivery History</Text>
            <Text style={cs.emptyBody}>Completed deliveries will appear here</Text>
          </View>
        ) : (
          <>
            <View style={cs.statsRow}>
              <StatCard label="Customers" value={customerSummaries.length.toString()} color={CYAN} icon={<Users size={16} color={CYAN} />} />
              <StatCard label="Deliveries" value={history.length.toString()} color={AMBER} icon={<Package size={16} color={AMBER} />} />
              <StatCard label="Earned" value={`$${totalEarnings.toFixed(2)}`} color={GREEN} icon={<TrendingUp size={16} color={GREEN} />} />
            </View>

            {!selectedCustomer ? (
              <>
                <View style={cs.sectionHeader}>
                  <View style={cs.sectionDot} />
                  <Text style={cs.sectionTitle}>Customer History</Text>
                  <View style={cs.countPill}>
                    <Text style={cs.countText}>{customerSummaries.length}</Text>
                  </View>
                </View>

                <View style={{ paddingHorizontal: 14, gap: 8 }}>
                  {customerSummaries.map((customer, i) => (
                    <TouchableOpacity
                      key={i}
                      style={cs.customerCard}
                      onPress={() => setSelectedCustomer(customer.customer_phone)}
                      activeOpacity={0.82}
                    >
                      <View style={cs.customerAvatar}>
                        <Text style={cs.customerAvatarText}>{customer.customer_name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={cs.customerName}>{customer.customer_name}</Text>
                        <Text style={cs.customerPhone}>{customer.customer_phone}</Text>
                        <View style={cs.customerMeta}>
                          <View style={cs.metaChip}>
                            <Package size={10} color={TEXT2} />
                            <Text style={cs.metaText}>{customer.total_deliveries}</Text>
                          </View>
                          <View style={[cs.metaChip, { borderColor: GREEN + '44', backgroundColor: GREEN_DIM }]}>
                            <DollarSign size={10} color={GREEN} />
                            <Text style={[cs.metaText, { color: GREEN }]}>${customer.total_earnings.toFixed(2)}</Text>
                          </View>
                          <View style={cs.metaChip}>
                            <Clock size={10} color={TEXT2} />
                            <Text style={cs.metaText}>{new Date(customer.last_delivery).toLocaleDateString()}</Text>
                          </View>
                        </View>
                      </View>
                      <ChevronRight size={16} color={TEXT3} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                {(() => {
                  const cHistory = getCustomerHistory(selectedCustomer);
                  const customer = customerSummaries.find(c => c.customer_phone === selectedCustomer);
                  return (
                    <>
                      <View style={cs.customerBanner}>
                        <View style={cs.customerBannerAvatar}>
                          <Text style={cs.customerBannerAvatarText}>{customer?.customer_name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={cs.customerBannerName}>{customer?.customer_name}</Text>
                          <Text style={cs.customerBannerPhone}>{customer?.customer_phone}</Text>
                          <Text style={cs.customerBannerStats}>
                            {customer?.total_deliveries} deliveries  ·  <Text style={{ color: GREEN }}>${customer?.total_earnings.toFixed(2)} earned</Text>
                          </Text>
                        </View>
                      </View>

                      <View style={cs.sectionHeader}>
                        <View style={[cs.sectionDot, { backgroundColor: AMBER }]} />
                        <Text style={cs.sectionTitle}>Delivery Records</Text>
                        <View style={[cs.countPill, { backgroundColor: AMBER_DIM, borderColor: AMBER + '44' }]}>
                          <Text style={[cs.countText, { color: AMBER }]}>{cHistory.length}</Text>
                        </View>
                      </View>

                      <View style={{ paddingHorizontal: 14, gap: 8 }}>
                        {cHistory.map(record => (
                          <View key={record.id} style={cs.historyCard}>
                            <View style={cs.historyTop}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <Clock size={11} color={TEXT2} />
                                <Text style={cs.historyDate} numberOfLines={1}>
                                  {new Date(record.completed_at).toLocaleDateString()} · {new Date(record.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                              </View>
                              <View style={cs.earningsPill}>
                                <Text style={cs.earningsText}>+${record.driver_earnings.toFixed(2)}</Text>
                              </View>
                            </View>

                            {record.pickup_location && (
                              <View style={cs.locationChip}>
                                <MapPin size={11} color={GREEN} />
                                <Text style={cs.locationText} numberOfLines={1}>{record.pickup_location}</Text>
                              </View>
                            )}

                            <View style={cs.recordMeta}>
                              <View style={cs.recordMetaItem}>
                                <DollarSign size={11} color={TEXT2} />
                                <Text style={cs.recordMetaText}>Total ${record.total_amount.toFixed(2)}</Text>
                              </View>
                              <View style={cs.recordMetaItem}>
                                <Package size={11} color={TEXT2} />
                                <Text style={cs.recordMetaText}>Fee ${record.delivery_fee.toFixed(2)}</Text>
                              </View>
                              <View style={[cs.recordMetaItem, { backgroundColor: record.payment_method === 'ecocash' ? AMBER_DIM : record.payment_method === 'paynow' ? 'rgba(0,168,107,0.1)' : GREEN_DIM, borderColor: record.payment_method === 'ecocash' ? AMBER + '44' : record.payment_method === 'paynow' ? '#00a86b44' : GREEN + '44' }]}>
                                <Text style={[cs.recordMetaText, { color: record.payment_method === 'ecocash' ? AMBER : record.payment_method === 'paynow' ? '#00a86b' : GREEN }]}>
                                  {record.payment_method === 'paynow' ? 'Paynow' : record.payment_method === 'ecocash' ? 'EcoCash' : 'Cash'}
                                </Text>
                              </View>
                            </View>

                            {record.items?.length > 0 && (
                              <View style={cs.itemsList}>
                                {record.items.slice(0, 3).map((item: any, i: number) => (
                                  <View key={i} style={cs.itemRow}>
                                    <Text style={cs.itemDot}>▸</Text>
                                    <Text style={cs.itemText} numberOfLines={1}>{item.name} ×{item.quantity}</Text>
                                  </View>
                                ))}
                                {record.items.length > 3 && <Text style={cs.moreItems}>+{record.items.length - 3} more</Text>}
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    </>
                  );
                })()}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14,
    backgroundColor: CARD, borderBottomWidth: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: CARD2,
    borderWidth: 1, borderColor: CYAN_BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: TEXT, letterSpacing: 0.3 },
  headerSubtitle: { fontSize: 11, color: TEXT2 },

  errorBox: {
    margin: 16, padding: 10, borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { color: '#ff6b6b', fontSize: 12, textAlign: 'center' },

  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: TEXT2 },
  emptyBody: { fontSize: 13, color: TEXT3 },

  statsRow: { flexDirection: 'row', padding: 16, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, padding: 12, alignItems: 'center', gap: 6,
  },
  statIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, color: TEXT2, textAlign: 'center', fontWeight: '600', letterSpacing: 0.3 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: CYAN },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: TEXT, letterSpacing: 0.8, textTransform: 'uppercase' },
  countPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    backgroundColor: CYAN_DIM, borderWidth: 1, borderColor: CYAN_BORDER,
  },
  countText: { fontSize: 11, fontWeight: '800', color: CYAN },

  customerCard: {
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: TEXT3,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  customerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CYAN_DIM, borderWidth: 1, borderColor: CYAN_BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  customerAvatarText: { fontSize: 14, fontWeight: '800', color: CYAN },
  customerName: { fontSize: 13, fontWeight: '700', color: TEXT },
  customerPhone: { fontSize: 11, color: TEXT2 },
  customerMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
  },
  metaText: { fontSize: 10, color: TEXT2, fontWeight: '600' },

  customerBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 14, marginTop: 8, marginBottom: 4,
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: CYAN_BORDER,
    padding: 14,
  },
  customerBannerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: CYAN_DIM, borderWidth: 2, borderColor: CYAN_BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  customerBannerAvatarText: { fontSize: 18, fontWeight: '800', color: CYAN },
  customerBannerName: { fontSize: 15, fontWeight: '800', color: TEXT },
  customerBannerPhone: { fontSize: 12, color: TEXT2 },
  customerBannerStats: { fontSize: 12, color: TEXT2, marginTop: 2 },

  historyCard: {
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: TEXT3,
    padding: 12, gap: 8,
  },
  historyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyDate: { fontSize: 11, color: TEXT2, flex: 1 },
  earningsPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: GREEN_DIM, borderRadius: 8, borderWidth: 1, borderColor: GREEN + '44',
  },
  earningsText: { fontSize: 12, fontWeight: '800', color: GREEN },

  locationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: 'rgba(0,255,136,0.06)', borderRadius: 8, borderWidth: 1, borderColor: GREEN + '33',
  },
  locationText: { flex: 1, fontSize: 11, color: GREEN },

  recordMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  recordMetaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6,
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
  },
  recordMetaText: { fontSize: 10, color: TEXT2, fontWeight: '600' },

  itemsList: { gap: 3 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  itemDot: { fontSize: 8, color: CYAN },
  itemText: { flex: 1, fontSize: 11, color: TEXT2 },
  moreItems: { fontSize: 10, color: TEXT3, fontStyle: 'italic' },
});
