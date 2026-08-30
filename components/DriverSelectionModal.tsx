import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Image,
  Animated,
} from 'react-native';
import { X, Search, Star, User, Truck, Users, CircleCheck as CheckCircle, ChevronRight, Zap, MessageCircle } from 'lucide-react-native';
import { Linking } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type Driver = {
  id: string;
  full_name: string;
  phone_number: string;
  delivery_type: string[];
  payment_methods: string[];
  is_available: boolean;
  location: string;
  fee_up_to_10: number;
  fee_up_to_20: number;
  fee_up_to_30: number;
  fee_up_to_40: number;
  fee_up_to_50: number;
  fee_up_to_100: number;
  fee_up_to_200: number;
  fee_up_to_300: number;
  fee_up_to_400: number;
  fee_up_to_500: number;
  average_rating: number;
  total_ratings: number;
  ecocash_code?: string;
  profile_picture_url?: string;
  availability_start_time?: string;
  availability_end_time?: string;
  availability_days?: string[];
  whatsapp_number?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  drivers: Driver[];
  deliveryMethod: 'walking' | 'vehicle';
  paymentOption: 'pay_on_delivery' | 'paynow';
  onSelectDirect: (driver: Driver) => void;
  onSelectOpenRequest: () => void;
  selectedDriverId: string | null;
  deliveryMode: 'direct' | 'open_request';
  onViewReviews: (driver: Driver) => void;
  orderTotal: number;
};

export default function DriverSelectionModal({
  visible,
  onClose,
  drivers,
  deliveryMethod,
  paymentOption,
  onSelectDirect,
  onSelectOpenRequest,
  selectedDriverId,
  deliveryMode,
  onViewReviews,
  orderTotal,
}: Props) {
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'direct' | 'open'>('direct');
  const [pendingDriver, setPendingDriver] = useState<Driver | null>(null);
  const [whatsappSent, setWhatsappSent] = useState(false);

  const P = '#1A73E8';
  const TEAL = '#00b894';
  const CARD = isDark ? '#0D1B2E' : '#FFFFFF';
  const CARD_B = isDark ? '#1A3A5C' : '#DDE8FF';
  const TX = isDark ? '#E8F4FF' : '#0A1628';
  const TX2 = isDark ? '#7AA3CC' : '#5A7A9A';
  const TX3 = isDark ? '#3A6A8A' : '#9AB0CC';
  const INPUT = isDark ? '#0A1828' : '#F5F8FF';
  const INPUT_B = isDark ? '#1E3A5C' : '#C8D8F0';
  const SUCCESS = '#10B981';

  useEffect(() => {
    if (visible) {
      setActiveTab(deliveryMode === 'open_request' ? 'open' : 'direct');
      setSearchQuery('');
      setPendingDriver(null);
      setWhatsappSent(false);
    }
  }, [visible, deliveryMode]);

  const getDeliveryFee = (driver: Driver): number => {
    const total = orderTotal;
    if (total <= 10) return driver.fee_up_to_10;
    if (total <= 20) return driver.fee_up_to_20;
    if (total <= 30) return driver.fee_up_to_30;
    if (total <= 40) return driver.fee_up_to_40;
    if (total <= 50) return driver.fee_up_to_50;
    if (total <= 100) return driver.fee_up_to_100;
    if (total <= 200) return driver.fee_up_to_200;
    if (total <= 300) return driver.fee_up_to_300;
    if (total <= 400) return driver.fee_up_to_400;
    return driver.fee_up_to_500;
  };

  const isWithinAvailableWindow = (d: Driver): boolean => {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()];

    if (d.availability_days && d.availability_days.length > 0) {
      if (!d.availability_days.includes(todayName)) return false;
    }

    if (d.availability_start_time && d.availability_end_time) {
      const [startH, startM] = d.availability_start_time.split(':').map(Number);
      const [endH, endM] = d.availability_end_time.split(':').map(Number);
      const nowMins = now.getHours() * 60 + now.getMinutes();
      if (nowMins < startH * 60 + startM || nowMins > endH * 60 + endM) return false;
    } else if (d.availability_start_time) {
      const [startH, startM] = d.availability_start_time.split(':').map(Number);
      if (now.getHours() * 60 + now.getMinutes() < startH * 60 + startM) return false;
    } else if (d.availability_end_time) {
      const [endH, endM] = d.availability_end_time.split(':').map(Number);
      if (now.getHours() * 60 + now.getMinutes() > endH * 60 + endM) return false;
    }

    return true;
  };

  const filteredDrivers = drivers.filter(d => {
    const matchesMethod = d.delivery_type?.includes(deliveryMethod);
    const matchesPayment = d.payment_methods?.includes(paymentOption);
    const matchesSearch =
      !searchQuery.trim() ||
      d.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.location || '').toLowerCase().includes(searchQuery.toLowerCase());
    const withinWindow = isWithinAvailableWindow(d);
    return matchesMethod && matchesPayment && matchesSearch && withinWindow;
  });

  const openWhatsApp = (driver: Driver) => {
    const num = (driver.whatsapp_number || '').replace(/[^0-9]/g, '');
    if (!num) return;
    const msg = encodeURIComponent(
      `Hi ${driver.full_name}, I'd like to request a delivery through UniLink. Are you available?`
    );
    Linking.openURL(`https://wa.me/${num}?text=${msg}`).then(() => setWhatsappSent(true)).catch(() => {});
  };

  const handleSelectDirect = (driver: Driver) => {
    if (pendingDriver?.id === driver.id) {
      onSelectDirect(driver);
      onClose();
    } else {
      setPendingDriver(driver);
      setWhatsappSent(false);
    }
  };

  const handleSelectOpen = () => {
    onSelectOpenRequest();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: CARD, borderColor: CARD_B }]}>
          <View style={[styles.handle, { backgroundColor: INPUT_B }]} />

          <View style={[styles.header, { borderBottomColor: CARD_B }]}>
            <View>
              <Text style={[styles.headerTitle, { color: TX }]}>Choose Your Driver</Text>
              <Text style={[styles.headerSub, { color: TX2 }]}>Select how you want delivery handled</Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: INPUT }]}
              onPress={onClose}
            >
              <X size={18} color={TX2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.tabs, { backgroundColor: INPUT }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'direct' && [styles.tabActive, { backgroundColor: CARD }]]}
              onPress={() => setActiveTab('direct')}
            >
              <User size={16} color={activeTab === 'direct' ? P : TX2} />
              <Text style={[styles.tabLabel, { color: activeTab === 'direct' ? P : TX2 }]}>My Driver</Text>
              <Text style={[styles.tabSub, { color: activeTab === 'direct' ? P : TX3, opacity: activeTab === 'direct' ? 0.7 : 1 }]}>Known driver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'open' && [styles.tabActive, { backgroundColor: CARD }]]}
              onPress={() => setActiveTab('open')}
            >
              <Users size={16} color={activeTab === 'open' ? P : TX2} />
              <Text style={[styles.tabLabel, { color: activeTab === 'open' ? P : TX2 }]}>Find Drivers</Text>
              <Text style={[styles.tabSub, { color: activeTab === 'open' ? P : TX3, opacity: activeTab === 'open' ? 0.7 : 1 }]}>Open request</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
            {activeTab === 'open' ? (
              <View style={[
                styles.openCard,
                { backgroundColor: INPUT, borderColor: deliveryMode === 'open_request' ? TEAL : INPUT_B },
                deliveryMode === 'open_request' && { backgroundColor: isDark ? 'rgba(0,184,148,0.08)' : '#F0FDF9' },
              ]}>
                <View style={[styles.openIcon, { backgroundColor: isDark ? 'rgba(0,184,148,0.15)' : 'rgba(0,184,148,0.1)' }]}>
                  <Zap size={28} color={TEAL} />
                </View>
                <Text style={[styles.openTitle, { color: TX }]}>Open Delivery Request</Text>
                <Text style={[styles.openDesc, { color: TX2 }]}>
                  Broadcast your order to all available drivers. See who accepts, then pick the one you trust most.
                </Text>

                <View style={styles.openSteps}>
                  {[
                    'Your order is sent to all online drivers',
                    'Drivers who accept appear in your list',
                    'Review their profile & rating, then choose',
                    'Others are automatically notified it\'s taken',
                  ].map((step, i) => (
                    <View key={i} style={styles.openStep}>
                      <View style={[styles.stepDot, { backgroundColor: isDark ? 'rgba(0,184,148,0.2)' : 'rgba(0,184,148,0.12)' }]}>
                        <Text style={[styles.stepNum, { color: TEAL }]}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.stepText, { color: TX2 }]}>{step}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.openBtn,
                    { backgroundColor: TEAL },
                    deliveryMode === 'open_request' && {
                      backgroundColor: 'transparent',
                      borderWidth: 1.5,
                      borderColor: TEAL,
                    },
                  ]}
                  onPress={handleSelectOpen}
                >
                  {deliveryMode === 'open_request'
                    ? <CheckCircle size={18} color={TEAL} />
                    : <Users size={18} color="#fff" />
                  }
                  <Text style={[
                    styles.openBtnText,
                    { color: deliveryMode === 'open_request' ? TEAL : '#fff' },
                  ]}>
                    {deliveryMode === 'open_request' ? 'Selected — Open Request' : 'Use Open Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[styles.searchWrap, { backgroundColor: INPUT, borderColor: INPUT_B }]}>
                  <Search size={18} color={TX2} />
                  <TextInput
                    style={[styles.searchInput, { color: TX }]}
                    placeholder="Search by name or location..."
                    placeholderTextColor={TX3}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={16} color={TX2} />
                    </TouchableOpacity>
                  )}
                </View>

                {filteredDrivers.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB', borderColor: '#F59E0B' }]}>
                    <Truck size={28} color="#F59E0B" />
                    <Text style={styles.emptyText}>
                      {searchQuery.trim()
                        ? 'No drivers match your search'
                        : 'No drivers available for your chosen delivery method and payment option'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.driverList}>
                    {filteredDrivers.map(driver => {
                      const isSelected = selectedDriverId === driver.id && deliveryMode === 'direct';
                      const isPending = pendingDriver?.id === driver.id;
                      const isTop = driver.average_rating >= 4.5;
                      const fee = getDeliveryFee(driver);
                      return (
                        <View key={driver.id}>
                          <TouchableOpacity
                            style={[
                              styles.driverCard,
                              {
                                backgroundColor: isPending
                                  ? (isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF9')
                                  : isSelected
                                    ? (isDark ? 'rgba(26,115,232,0.1)' : '#EBF3FF')
                                    : INPUT,
                                borderColor: isPending ? SUCCESS : isSelected ? P : INPUT_B,
                              },
                            ]}
                            onPress={() => handleSelectDirect(driver)}
                            activeOpacity={0.8}
                          >
                            <View style={[styles.avatar, { backgroundColor: INPUT_B }]}>
                              {driver.profile_picture_url ? (
                                <Image
                                  source={{ uri: driver.profile_picture_url }}
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
                                <View style={[styles.onlineDot, { backgroundColor: SUCCESS }]} />
                                <Text style={[styles.driverName, { color: TX }]} numberOfLines={1}>
                                  {driver.full_name}
                                </Text>
                                {driver.total_ratings > 0 && (
                                  <TouchableOpacity
                                    style={[
                                      styles.ratingBadge,
                                      { backgroundColor: isTop ? '#DCFCE7' : '#FEF3C7' },
                                    ]}
                                    onPress={e => { e.stopPropagation(); onViewReviews(driver); }}
                                  >
                                    <Star
                                      size={10}
                                      color={isTop ? '#22c55e' : '#fbbf24'}
                                      fill={isTop ? '#22c55e' : '#fbbf24'}
                                    />
                                    <Text style={[styles.ratingText, { color: isTop ? '#166534' : '#854D0E' }]}>
                                      {driver.average_rating.toFixed(1)} ({driver.total_ratings})
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                              <Text style={[styles.driverMeta, { color: TX2 }]} numberOfLines={1}>
                                📍 {driver.location}
                              </Text>
                              <Text style={[styles.driverMeta, { color: TX2 }]}>
                                {driver.delivery_type?.join(', ')}
                                {driver.availability_start_time && driver.availability_end_time
                                  ? `  ·  🕒 ${driver.availability_start_time.substring(0, 5)}–${driver.availability_end_time.substring(0, 5)}`
                                  : ''}
                              </Text>
                              <View style={[styles.feeBadge, { backgroundColor: isDark ? 'rgba(26,115,232,0.15)' : '#EBF3FF' }]}>
                                <Text style={[styles.feeLabel, { color: TX2 }]}>Delivery fee</Text>
                                <Text style={[styles.feeAmount, { color: P }]}>${fee.toFixed(2)}</Text>
                              </View>
                            </View>

                            <View style={[styles.radioBtn, { borderColor: isPending ? SUCCESS : P }]}>
                              {(isSelected || isPending) && <View style={[styles.radioDot, { backgroundColor: isPending ? SUCCESS : P }]} />}
                            </View>
                          </TouchableOpacity>

                          {isPending && (
                            <View style={[styles.confirmBanner, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5', borderColor: SUCCESS }]}>
                              <View style={styles.confirmBannerContent}>
                                <Text style={[styles.confirmBannerTitle, { color: SUCCESS }]}>Confirm Driver Selection</Text>
                                <Text style={[styles.confirmBannerText, { color: TX2 }]}>
                                  You will pay an additional{' '}
                                  <Text style={[styles.confirmBannerFee, { color: TX }]}>${fee.toFixed(2)}</Text>
                                  {' '}delivery fee on top of your order total of{' '}
                                  <Text style={[styles.confirmBannerFee, { color: TX }]}>${orderTotal.toFixed(2)}</Text>.
                                </Text>
                              </View>

                              {driver.whatsapp_number ? (
                                <View style={{ gap: 6 }}>
                                  <TouchableOpacity
                                    style={{
                                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                                      paddingVertical: 12, borderRadius: 12,
                                      backgroundColor: whatsappSent
                                        ? (isDark ? 'rgba(37,211,102,0.15)' : '#dcfce7')
                                        : '#25D366',
                                      borderWidth: whatsappSent ? 1.5 : 0,
                                      borderColor: '#25D366',
                                    }}
                                    onPress={() => openWhatsApp(driver)}
                                    activeOpacity={0.8}
                                  >
                                    <MessageCircle size={16} color={whatsappSent ? '#25D366' : '#fff'} />
                                    <Text style={{
                                      fontSize: 13, fontWeight: '800',
                                      color: whatsappSent ? '#25D366' : '#fff',
                                    }}>
                                      {whatsappSent ? 'WhatsApp Sent ✓' : 'Send WhatsApp Message (Required)'}
                                    </Text>
                                  </TouchableOpacity>
                                  {!whatsappSent && (
                                    <Text style={{
                                      fontSize: 11, color: isDark ? '#f59e0b' : '#d97706',
                                      textAlign: 'center', lineHeight: 16,
                                    }}>
                                      You must message this messenger on WhatsApp before confirming.
                                    </Text>
                                  )}
                                </View>
                              ) : null}

                              <View style={styles.confirmActions}>
                                <TouchableOpacity
                                  style={[styles.confirmCancelBtn, { borderColor: INPUT_B }]}
                                  onPress={() => { setPendingDriver(null); setWhatsappSent(false); }}
                                >
                                  <Text style={[styles.confirmCancelText, { color: TX2 }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.confirmBtn,
                                    { backgroundColor: driver.whatsapp_number && !whatsappSent
                                      ? (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb')
                                      : SUCCESS },
                                  ]}
                                  onPress={() => { onSelectDirect(driver); onClose(); }}
                                  disabled={!!driver.whatsapp_number && !whatsappSent}
                                >
                                  <Text style={[
                                    styles.confirmBtnText,
                                    driver.whatsapp_number && !whatsappSent && { color: isDark ? '#666' : '#9ca3af' },
                                  ]}>
                                    {driver.whatsapp_number && !whatsappSent ? 'Send WhatsApp First' : `Confirm — ${fee.toFixed(2)} fee`}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}

                          {driver.total_ratings > 0 && !isPending && (
                            <TouchableOpacity
                              style={[styles.viewReviewsBtn, { backgroundColor: INPUT, borderColor: P }]}
                              onPress={() => onViewReviews(driver)}
                            >
                              <Text style={[styles.viewReviewsText, { color: P }]}>View Reviews</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
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
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 3,
  },
  tabActive: {
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  tabLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  tabSub: { fontSize: 10 },
  body: { flex: 1 },

  openCard: {
    margin: 16,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
  },
  openIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  openTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  openDesc: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  openSteps: { gap: 10, marginBottom: 20 },
  openStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  stepNum: { fontSize: 11, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19 },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  openBtnText: { fontSize: 14, fontWeight: '800' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  searchInput: { flex: 1, padding: 11, fontSize: 14 },

  emptyBox: {
    margin: 16,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13, color: '#F59E0B', textAlign: 'center', lineHeight: 20 },

  driverList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
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
    gap: 5,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
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
  radioBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  viewReviewsBtn: {
    marginTop: -4,
    marginBottom: 4,
    marginHorizontal: 0,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewReviewsText: { fontSize: 12, fontWeight: '700' },
  feeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  feeLabel: { fontSize: 10 },
  feeAmount: { fontSize: 12, fontWeight: '800' },
  confirmBanner: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: -4,
  },
  confirmBannerContent: { gap: 4 },
  confirmBannerTitle: { fontSize: 13, fontWeight: '800' },
  confirmBannerText: { fontSize: 12, lineHeight: 18 },
  confirmBannerFee: { fontWeight: '800' },
  confirmActions: { flexDirection: 'row', gap: 8 },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  confirmCancelText: { fontSize: 13, fontWeight: '700' },
  confirmBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
