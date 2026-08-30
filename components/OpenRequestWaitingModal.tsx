import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Animated,
  Linking,
} from 'react-native';
import { X, Star, User, CircleCheck as CheckCircle, Zap, Clock, Users, MessageCircle, Phone, DollarSign, CreditCard } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

type AcceptedDriverRow = {
  id: string;
  driver_id: string;
  status: string;
  created_at: string;
  drivers: {
    id: string;
    full_name: string;
    phone_number: string;
    average_rating: number;
    total_ratings: number;
    profile_picture_url?: string;
    delivery_type: string[];
    address?: string;
    ecocash_code?: string;
  };
};

type Props = {
  visible: boolean;
  deliveryId: string | null;
  onDriverSelected: (driverId: string, driverName: string, deliveryData: any) => void;
  onCancel: () => void;
  onOpenChat?: (deliveryId: string) => void;
};

export default function OpenRequestWaitingModal({
  visible,
  deliveryId,
  onDriverSelected,
  onCancel,
  onOpenChat,
}: Props) {
  const { isDark } = useTheme();
  const [acceptedDrivers, setAcceptedDrivers] = useState<AcceptedDriverRow[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [confirmedDriver, setConfirmedDriver] = useState<AcceptedDriverRow | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const TEAL = '#00b894';
  const P = '#1A73E8';
  const CARD = isDark ? '#0D1B2E' : '#FFFFFF';
  const CARD_B = isDark ? '#1A3A5C' : '#DDE8FF';
  const TX = isDark ? '#E8F4FF' : '#0A1628';
  const TX2 = isDark ? '#7AA3CC' : '#5A7A9A';
  const TX3 = isDark ? '#3A6A8A' : '#9AB0CC';
  const INPUT = isDark ? '#0A1828' : '#F5F8FF';
  const INPUT_B = isDark ? '#1E3A5C' : '#C8D8F0';
  const SUCCESS = '#10B981';

  useEffect(() => {
    if (!visible || !deliveryId) return;

    setElapsed(0);
    setAcceptedDrivers([]);
    setSelecting(null);
    setSelectedDelivery(null);
    setConfirmedDriver(null);

    loadAcceptedDrivers();

    const timer = setInterval(() => setElapsed(e => e + 1), 1000);

    const channel = supabase
      .channel(`open-req-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_requests',
          filter: `delivery_id=eq.${deliveryId}`,
        },
        () => loadAcceptedDrivers()
      )
      .subscribe();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
      pulse.stop();
    };
  }, [visible, deliveryId]);

  const loadAcceptedDrivers = async () => {
    if (!deliveryId) return;
    const { data } = await supabase
      .from('driver_requests')
      .select(`
        id,
        driver_id,
        status,
        created_at,
        drivers (
          id,
          full_name,
          phone_number,
          average_rating,
          total_ratings,
          profile_picture_url,
          delivery_type,
          address,
          ecocash_code
        )
      `)
      .eq('delivery_id', deliveryId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: true });

    if (data) setAcceptedDrivers(data as any);
  };

  const handleSelect = async (row: AcceptedDriverRow) => {
    if (!deliveryId || selecting) return;
    setSelecting(row.driver_id);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          driver_id: row.driver_id,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', deliveryId);

      if (error) throw error;

      await supabase
        .from('driver_requests')
        .update({ status: 'cancelled' })
        .eq('delivery_id', deliveryId)
        .neq('driver_id', row.driver_id);

      await supabase
        .from('driver_requests')
        .update({ status: 'selected' })
        .eq('delivery_id', deliveryId)
        .eq('driver_id', row.driver_id);

      const { data: deliveryData } = await supabase
        .from('deliveries')
        .select('*, drivers(full_name, phone_number, ecocash_code)')
        .eq('id', deliveryId)
        .maybeSingle();

      setSelectedDelivery(deliveryData);
      setConfirmedDriver(row);
    } catch {
      setSelecting(null);
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: CARD, borderColor: CARD_B }]}>
          <View style={[styles.handle, { backgroundColor: INPUT_B }]} />

          <View style={[styles.header, { borderBottomColor: CARD_B }]}>
            <View>
              <Text style={[styles.headerTitle, { color: TX }]}>Finding Drivers</Text>
              <Text style={[styles.headerSub, { color: TX2 }]}>Open request sent — waiting for responses</Text>
            </View>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: INPUT }]} onPress={onCancel}>
              <X size={18} color={TX2} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
            {confirmedDriver ? (
              <View style={styles.confirmedPanel}>
                <View style={[styles.confirmedBadge, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5', borderColor: SUCCESS }]}>
                  <CheckCircle size={20} color={SUCCESS} />
                  <Text style={[styles.confirmedBadgeText, { color: SUCCESS }]}>Driver Secured!</Text>
                </View>

                <View style={[styles.confirmedDriverCard, { backgroundColor: INPUT, borderColor: INPUT_B }]}>
                  <View style={[styles.avatar, { backgroundColor: INPUT_B }]}>
                    {confirmedDriver.drivers?.profile_picture_url ? (
                      <Image source={{ uri: confirmedDriver.drivers.profile_picture_url }} style={styles.avatarImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <User size={26} color={TX2} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.confirmedDriverName, { color: TX }]}>{confirmedDriver.drivers?.full_name}</Text>
                    {confirmedDriver.drivers?.total_ratings > 0 && (
                      <View style={styles.nameRow}>
                        <Star size={11} color={confirmedDriver.drivers.average_rating >= 4.5 ? '#22c55e' : '#fbbf24'} fill={confirmedDriver.drivers.average_rating >= 4.5 ? '#22c55e' : '#fbbf24'} />
                        <Text style={[styles.driverMeta, { color: TX2 }]}>{confirmedDriver.drivers.average_rating.toFixed(1)} ({confirmedDriver.drivers.total_ratings} reviews)</Text>
                      </View>
                    )}
                    <Text style={[styles.driverMeta, { color: TX2 }]}>{confirmedDriver.drivers?.delivery_type?.join(', ')}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.contactRow, { backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF9', borderColor: SUCCESS }]}
                  onPress={() => Linking.openURL(`tel:${confirmedDriver.drivers?.phone_number}`)}
                  activeOpacity={0.75}
                >
                  <Phone size={16} color={SUCCESS} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.contactLabel, { color: TX2 }]}>Driver Phone</Text>
                    <Text style={[styles.contactValue, { color: TX }]}>{confirmedDriver.drivers?.phone_number}</Text>
                  </View>
                  <Text style={[styles.contactCta, { color: SUCCESS }]}>Tap to call</Text>
                </TouchableOpacity>

                {selectedDelivery?.payment_option === 'paynow' && confirmedDriver.drivers?.ecocash_code && (
                  <View style={[styles.paymentBox, { backgroundColor: isDark ? 'rgba(26,115,232,0.08)' : '#EBF3FF', borderColor: P }]}>
                    <CreditCard size={16} color={P} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.contactLabel, { color: TX2 }]}>Send Paynow Payment To</Text>
                      <Text style={[styles.paymentCode, { color: TX }]}>{confirmedDriver.drivers.ecocash_code}</Text>
                    </View>
                  </View>
                )}

                {selectedDelivery && (
                  <View style={[styles.amountBox, { backgroundColor: isDark ? 'rgba(16,185,129,0.06)' : '#F0FDF9', borderColor: isDark ? 'rgba(16,185,129,0.2)' : '#A7F3D0' }]}>
                    <DollarSign size={14} color={SUCCESS} />
                    <Text style={[styles.amountLabel, { color: TX2 }]}>Total to Pay</Text>
                    <Text style={[styles.amountValue, { color: TX }]}>
                      ${(selectedDelivery.total_amount + selectedDelivery.delivery_fee).toFixed(2)}
                    </Text>
                    <Text style={[styles.amountBreakdown, { color: TX2 }]}>
                      (order ${selectedDelivery.total_amount?.toFixed(2)} + delivery ${selectedDelivery.delivery_fee?.toFixed(2)})
                    </Text>
                  </View>
                )}

                {selectedDelivery?.payment_option === 'pay_on_delivery' && (
                  <View style={[styles.cashNote, { backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : '#FFFBEB', borderColor: '#F59E0B' }]}>
                    <Text style={[styles.cashNoteText, { color: '#D97706' }]}>
                      Prepare exact cash for the driver when your order arrives.
                    </Text>
                  </View>
                )}

                <View style={styles.confirmedActions}>
                  {onOpenChat && deliveryId && (
                    <TouchableOpacity
                      style={[styles.chatBtn, { backgroundColor: P }]}
                      onPress={() => { onOpenChat(deliveryId); onDriverSelected(confirmedDriver.driver_id, confirmedDriver.drivers?.full_name || 'Driver', selectedDelivery); }}
                    >
                      <MessageCircle size={16} color="#fff" />
                      <Text style={styles.chatBtnText}>Chat with Driver</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.doneBtn, { backgroundColor: SUCCESS }]}
                    onPress={() => onDriverSelected(confirmedDriver.driver_id, confirmedDriver.drivers?.full_name || 'Driver', selectedDelivery)}
                  >
                    <CheckCircle size={16} color="#fff" />
                    <Text style={styles.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : acceptedDrivers.length === 0 ? (
              <View style={styles.waiting}>
                <Animated.View style={[styles.pulseRing, { borderColor: TEAL, transform: [{ scale: pulseAnim }] }]}>
                  <View style={[styles.pulseInner, { backgroundColor: isDark ? 'rgba(0,184,148,0.15)' : 'rgba(0,184,148,0.1)' }]}>
                    <Zap size={28} color={TEAL} />
                  </View>
                </Animated.View>
                <Text style={[styles.waitTitle, { color: TX }]}>Waiting for drivers...</Text>
                <Text style={[styles.waitDesc, { color: TX2 }]}>
                  Your request has been broadcast to all available drivers. Accept responses appear here in real time.
                </Text>
                <View style={[styles.timerRow, { backgroundColor: INPUT, borderColor: INPUT_B }]}>
                  <Clock size={14} color={TX2} />
                  <Text style={[styles.timerText, { color: TX2 }]}>Waiting for {fmt(elapsed)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.driversSection}>
                <View style={styles.sectionHeader}>
                  <Users size={18} color={TEAL} />
                  <Text style={[styles.sectionTitle, { color: TX }]}>Drivers available</Text>
                  <View style={[styles.countBadge, { backgroundColor: TEAL }]}>
                    <Text style={styles.countText}>{acceptedDrivers.length}</Text>
                  </View>
                </View>

                <View style={[styles.selectHint, { backgroundColor: isDark ? 'rgba(0,184,148,0.08)' : '#F0FDF9', borderColor: isDark ? 'rgba(0,184,148,0.25)' : '#A7F3D0' }]}>
                  <CheckCircle size={14} color={TEAL} />
                  <Text style={[styles.selectHintText, { color: TEAL }]}>
                    Choose a driver below. They will be notified and the others released.
                  </Text>
                </View>

                {acceptedDrivers.map(row => {
                  const d = row.drivers;
                  const isTop = d.average_rating >= 4.5;
                  const isThisSelecting = selecting === row.driver_id;
                  return (
                    <View
                      key={row.id}
                      style={[
                        styles.driverCard,
                        {
                          borderColor: isDark ? 'rgba(0,184,148,0.3)' : 'rgba(0,184,148,0.2)',
                          backgroundColor: isDark ? 'rgba(0,184,148,0.06)' : 'rgba(0,184,148,0.04)',
                        },
                      ]}
                    >
                      <View style={[styles.avatar, { backgroundColor: INPUT_B }]}>
                        {d.profile_picture_url ? (
                          <Image
                            source={{ uri: d.profile_picture_url }}
                            style={styles.avatarImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <User size={22} color={TX2} />
                          </View>
                        )}
                      </View>

                      <View style={styles.driverInfo}>
                        <View style={styles.nameRow}>
                          <Text style={[styles.driverName, { color: TX }]} numberOfLines={1}>
                            {d.full_name}
                          </Text>
                          {d.total_ratings > 0 && (
                            <View style={[styles.ratingBadge, { backgroundColor: isTop ? '#DCFCE7' : '#FEF3C7' }]}>
                              <Star
                                size={10}
                                color={isTop ? '#22c55e' : '#fbbf24'}
                                fill={isTop ? '#22c55e' : '#fbbf24'}
                              />
                              <Text style={[styles.ratingText, { color: isTop ? '#166534' : '#854D0E' }]}>
                                {d.average_rating.toFixed(1)} ({d.total_ratings})
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.driverMeta, { color: TX2 }]}>
                          {d.delivery_type?.join(', ')}
                          {d.address ? `  ·  📍 ${d.address}` : ''}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.selectBtn, { backgroundColor: isThisSelecting ? INPUT_B : TEAL, borderColor: TEAL }]}
                        onPress={() => handleSelect(row)}
                        disabled={!!selecting}
                      >
                        {isThisSelecting ? (
                          <ActivityIndicator size="small" color={TEAL} />
                        ) : (
                          <CheckCircle size={14} color="#fff" />
                        )}
                        <Text style={[styles.selectBtnText, { color: isThisSelecting ? TEAL : '#fff' }]}>
                          {isThisSelecting ? 'Selecting...' : 'Select'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {!confirmedDriver && (
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: INPUT, borderColor: INPUT_B }]}
                onPress={onCancel}
              >
                <Text style={[styles.cancelBtnText, { color: TX2 }]}>Cancel & Go Back</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { flex: 1 },

  waiting: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  pulseRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  pulseInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  waitDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  timerText: { fontSize: 13, fontWeight: '700' },

  driversSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  selectHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  selectHintText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },

  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
    marginBottom: 10,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfo: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  driverName: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: { fontSize: 11, fontWeight: '800' },
  driverMeta: { fontSize: 11, lineHeight: 17 },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    minWidth: 90,
    justifyContent: 'center',
  },
  selectBtnText: { fontSize: 13, fontWeight: '800' },

  cancelBtn: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700' },

  confirmedPanel: {
    padding: 16,
    gap: 12,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  confirmedBadgeText: { fontSize: 15, fontWeight: '800' },
  confirmedDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  confirmedDriverName: { fontSize: 15, fontWeight: '800' },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  contactLabel: { fontSize: 11 },
  contactValue: { fontSize: 15, fontWeight: '800' },
  contactCta: { fontSize: 12, fontWeight: '700' },
  paymentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  paymentCode: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    flexWrap: 'wrap',
  },
  amountLabel: { fontSize: 12 },
  amountValue: { fontSize: 18, fontWeight: '800' },
  amountBreakdown: { fontSize: 11 },
  cashNote: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  cashNoteText: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  confirmedActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  chatBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  doneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  doneBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
