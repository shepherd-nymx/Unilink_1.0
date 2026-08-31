import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  TextInput, Image, Platform, ActivityIndicator,
} from 'react-native';
import { X, Search, Star, User, Truck, Users, ChevronRight, Zap, CircleCheck as CheckCircle, DollarSign, Phone, MapPin, Radio, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Linking } from 'react-native';
import type { Driver, DeliveryMode, PaymentMethod, DeliveryMethod } from '@/lib/delivery-request-types';

interface Props {
  visible: boolean;
  onClose: () => void;
  drivers: Driver[];
  deliveryMode: DeliveryMode;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  selectedDriverId: string | null;
  offerFee: string;
  onSelectDirect: (driver: Driver) => void;
  onSelectOpenRequest: () => void;
  onOfferFeeChange: (fee: string) => void;
}

function getDriverFeeRange(driver: Driver): string {
  const fees = [
    driver.fee_up_to_10, driver.fee_up_to_20, driver.fee_up_to_30,
    driver.fee_up_to_40, driver.fee_up_to_50,
  ].filter(f => f > 0);
  if (!fees.length) return 'Fee varies';
  const min = Math.min(...fees);
  const max = Math.max(...fees);
  return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)}–$${max.toFixed(2)}`;
}

function isWithinAvailableWindow(driver: Driver): boolean {
  if (!driver.availability_days?.length && !driver.availability_start_time) return true;
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[now.getDay()];
  if (driver.availability_days?.length && !driver.availability_days.includes(today)) return false;
  if (driver.availability_start_time && driver.availability_end_time) {
    const [sh, sm] = driver.availability_start_time.split(':').map(Number);
    const [eh, em] = driver.availability_end_time.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    if (nowMins < startMins || nowMins > endMins) return false;
  }
  return true;
}

export default function DeliveryDriverSelector({
  visible, onClose, drivers, deliveryMode, deliveryMethod, paymentMethod,
  selectedDriverId, offerFee, onSelectDirect, onSelectOpenRequest, onOfferFeeChange,
}: Props) {
  const { colors, isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [pendingDriver, setPendingDriver] = useState<Driver | null>(null);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'direct' | 'open'>(
    deliveryMode === 'open_request' ? 'open' : 'direct'
  );

  const P = isDark ? '#00e5ff' : '#1A73E8';
  const BG = isDark ? '#070f1c' : '#f0f4f8';
  const CARD = isDark ? '#0d1b2e' : '#ffffff';
  const CARD_B = isDark ? 'rgba(0,229,255,0.15)' : '#dde8ff';
  const TX = isDark ? '#e0eeff' : '#0a1628';
  const TX2 = isDark ? '#8296b0' : '#64748b';
  const TX3 = isDark ? '#3a5a7a' : '#94a3b8';
  const INPUT = isDark ? 'rgba(255,255,255,0.05)' : '#f8faff';
  const INPUT_B = isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1';

  const filteredDrivers = drivers.filter(d => {
    if (!d.delivery_type?.includes(deliveryMethod)) return false;
    if (!d.payment_methods?.includes(paymentMethod)) return false;
    if (search.trim() && !d.full_name.toLowerCase().includes(search.toLowerCase()) &&
        !d.location.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSelectDriver = (driver: Driver) => {
    if (pendingDriver?.id === driver.id) {
      onSelectDirect(driver);
      setPendingDriver(null);
    } else {
      setPendingDriver(driver);
      setWhatsappSent(false);
    }
  };

  const handleClose = () => {
    setPendingDriver(null);
    setWhatsappSent(false);
    onClose();
  };

  const openWhatsApp = (driver: Driver) => {
    const num = (driver.whatsapp_number || '').replace(/[^0-9]/g, '');
    if (!num) return;
    const msg = encodeURIComponent(
      `Hi ${driver.full_name}, I'd like to request a delivery through UniLink. Are you available?`
    );
    Linking.openURL(`https://wa.me/${num}?text=${msg}`).then(() => setWhatsappSent(true)).catch(() => {});
  };

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: CARD,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      borderTopWidth: 1, borderColor: CARD_B,
      maxHeight: '90%',
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: isDark ? 'rgba(0,229,255,0.3)' : '#cbd5e1',
      alignSelf: 'center', marginTop: 12, marginBottom: 4,
    },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f4f8',
    },
    sheetIconWrap: {
      width: 42, height: 42, borderRadius: 13,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(0,229,255,0.12)' : '#eef5ff',
    },
    sheetTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: TX },
    sheetClose: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f0f4f8',
      justifyContent: 'center', alignItems: 'center',
    },

    tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, marginBottom: 4, gap: 8 },
    tab: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, borderRadius: 14, borderWidth: 1.5,
      borderColor: INPUT_B, backgroundColor: INPUT,
    },
    tabActive: { borderColor: P, backgroundColor: isDark ? 'rgba(0,229,255,0.1)' : '#eef5ff' },
    tabText: { fontSize: 13, fontWeight: '700', color: TX3 },
    tabTextActive: { color: P },

    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, marginTop: 12, marginBottom: 4,
      backgroundColor: INPUT, borderWidth: 1.5, borderColor: INPUT_B,
      borderRadius: 14, paddingHorizontal: 14, height: 48,
    },
    searchInput: {
      flex: 1, fontSize: 14, color: TX,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },

    driverList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 },
    driverCard: {
      borderRadius: 18, borderWidth: 1.5,
      overflow: 'hidden',
    },
    driverCardSelected: { borderColor: P },
    driverCardPending: { borderColor: isDark ? '#00ff88' : '#10b981' },
    driverCardDefault: { borderColor: CARD_B },
    driverCardInner: { padding: 16 },
    driverTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    driverAvatar: {
      width: 50, height: 50, borderRadius: 16,
      backgroundColor: isDark ? 'rgba(0,229,255,0.1)' : '#eef5ff',
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    driverInfo: { flex: 1 },
    driverName: { fontSize: 15, fontWeight: '800', color: TX },
    driverMeta: { fontSize: 12, color: TX2, marginTop: 2 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    ratingText: { fontSize: 12, fontWeight: '700', color: '#f59e0b' },
    ratingCount: { fontSize: 11, color: TX3 },
    newBadge: {
      paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
      backgroundColor: isDark ? 'rgba(0,229,255,0.12)' : '#eef5ff',
    },
    newBadgeText: { fontSize: 10, fontWeight: '700', color: P },

    feeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    feeBadge: {
      flex: 1, alignItems: 'center', gap: 3,
      paddingVertical: 10, borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8faff',
      borderWidth: 1, borderColor: INPUT_B,
    },
    feeBadgeLabel: { fontSize: 10, fontWeight: '600', color: TX3, textTransform: 'uppercase' as any, letterSpacing: 0.8 },
    feeBadgeValue: { fontSize: 14, fontWeight: '800', color: TX },
    feeBadgeValueHighlight: { color: P },

    driverPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
      backgroundColor: isDark ? 'rgba(0,229,255,0.08)' : '#f0f8ff',
      borderWidth: 1, borderColor: isDark ? 'rgba(0,229,255,0.18)' : '#dde8ff',
    },
    pillText: { fontSize: 11, fontWeight: '600', color: TX2 },

    selectBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 44, borderRadius: 14,
    },
    selectBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
    confirmBox: {
      marginTop: 2, padding: 14, borderRadius: 14,
      backgroundColor: isDark ? 'rgba(0,255,136,0.07)' : '#f0fdf9',
      borderWidth: 1, borderColor: isDark ? 'rgba(0,255,136,0.2)' : '#a7f3d0',
      gap: 10,
    },
    confirmBoxText: { fontSize: 13, color: isDark ? '#00ff88' : '#059669', fontWeight: '600', lineHeight: 18 },
    offerFeeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    offerFeePrefix: { fontSize: 15, fontWeight: '800', color: isDark ? '#00ff88' : '#059669' },
    offerFeeInput: {
      flex: 1, height: 40, borderRadius: 10,
      backgroundColor: isDark ? 'rgba(0,255,136,0.08)' : '#fff',
      borderWidth: 1.5, borderColor: isDark ? 'rgba(0,255,136,0.3)' : '#a7f3d0',
      paddingHorizontal: 12, fontSize: 15, fontWeight: '700',
      color: isDark ? '#00ff88' : '#059669',
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    confirmBtnRow: { flexDirection: 'row', gap: 8 },
    confirmBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: 42, borderRadius: 12, backgroundColor: isDark ? '#00ff88' : '#10b981',
    },
    confirmBtnText: { fontSize: 13, fontWeight: '800', color: '#051a0a' },
    cancelConfirmBtn: {
      height: 42, borderRadius: 12, paddingHorizontal: 16,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f0f4f8',
    },
    cancelConfirmBtnText: { fontSize: 13, fontWeight: '700', color: TX2 },

    emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    emptyIcon: {
      width: 60, height: 60, borderRadius: 18,
      backgroundColor: isDark ? 'rgba(0,229,255,0.07)' : '#eef2ff',
      justifyContent: 'center', alignItems: 'center',
    },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: TX },
    emptyText: { fontSize: 13, color: TX2, textAlign: 'center' as any, lineHeight: 19 },

    openCard: {
      borderRadius: 20, borderWidth: 1.5, padding: 20,
      borderColor: deliveryMode === 'open_request' ? '#10b981' : INPUT_B,
      backgroundColor: deliveryMode === 'open_request'
        ? (isDark ? 'rgba(16,185,129,0.07)' : '#f0fdf9')
        : CARD,
    },
    openCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    openIconWrap: {
      width: 48, height: 48, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#d1fae5',
    },
    openCardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: TX },
    openCardDesc: { fontSize: 13, color: TX2, lineHeight: 20, marginBottom: 16 },
    openSteps: { gap: 8, marginBottom: 16 },
    openStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    openStepNum: {
      width: 22, height: 22, borderRadius: 11,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#d1fae5',
    },
    openStepNumText: { fontSize: 11, fontWeight: '800', color: '#10b981' },
    openStepText: { flex: 1, fontSize: 13, color: TX2, lineHeight: 18, marginTop: 2 },
    openBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 48, borderRadius: 14,
      backgroundColor: deliveryMode === 'open_request' ? '#10b981' : INPUT,
      borderWidth: 1.5,
      borderColor: deliveryMode === 'open_request' ? '#10b981' : INPUT_B,
    },
    openBtnText: {
      fontSize: 14, fontWeight: '800',
      color: deliveryMode === 'open_request' ? '#fff' : TX2,
    },
  });

  const renderDirectTab = () => (
    <>
      <View style={s.searchRow}>
        <Search size={16} color={TX3} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search driver by name or location..."
          placeholderTextColor={TX3}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={14} color={TX3} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.driverList}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filteredDrivers.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Truck size={28} color={isDark ? '#00e5ff' : '#94a3b8'} />
            </View>
            <Text style={s.emptyTitle}>No drivers available</Text>
            <Text style={s.emptyText}>
              Try the Open Request option to broadcast to all available drivers.
            </Text>
          </View>
        ) : (
          filteredDrivers.map(driver => {
            const isSelected = selectedDriverId === driver.id && deliveryMode === 'direct';
            const isPending = pendingDriver?.id === driver.id;
            const inWindow = isWithinAvailableWindow(driver);

            return (
              <View
                key={driver.id}
                style={[
                  s.driverCard,
                  { backgroundColor: CARD },
                  isSelected ? s.driverCardSelected : isPending ? s.driverCardPending : s.driverCardDefault,
                ]}
              >
                <View style={s.driverCardInner}>
                  {/* Top row */}
                  <View style={s.driverTopRow}>
                    <View style={s.driverAvatar}>
                      {driver.profile_picture_url ? (
                        <Image
                          source={{ uri: driver.profile_picture_url }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <User size={22} color={P} />
                      )}
                    </View>
                    <View style={s.driverInfo}>
                      <Text style={s.driverName}>{driver.full_name}</Text>
                      {driver.location ? (
                        <Text style={s.driverMeta}>{driver.location}</Text>
                      ) : null}
                      <View style={s.ratingRow}>
                        {driver.total_ratings > 0 ? (
                          <>
                            <Star size={12} color="#f59e0b" fill="#f59e0b" />
                            <Text style={s.ratingText}>{driver.average_rating.toFixed(1)}</Text>
                            <Text style={s.ratingCount}>({driver.total_ratings})</Text>
                          </>
                        ) : (
                          <View style={s.newBadge}>
                            <Text style={s.newBadgeText}>New Driver</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {isSelected && <CheckCircle size={22} color={P} />}
                  </View>

                  {/* Fee range */}
                  <View style={s.feeRow}>
                    <View style={s.feeBadge}>
                      <Text style={s.feeBadgeLabel}>Fee range</Text>
                      <Text style={[s.feeBadgeValue, s.feeBadgeValueHighlight]}>
                        {getDriverFeeRange(driver)}
                      </Text>
                    </View>
                    <View style={s.feeBadge}>
                      <Text style={s.feeBadgeLabel}>Type</Text>
                      <Text style={s.feeBadgeValue}>
                        {driver.delivery_type?.includes('vehicle') ? '🚗 Vehicle' : '🚶 Walking'}
                      </Text>
                    </View>
                    {driver.availability_start_time && (
                      <View style={s.feeBadge}>
                        <Text style={s.feeBadgeLabel}>Available</Text>
                        <Text style={[s.feeBadgeValue, { fontSize: 12, color: inWindow ? '#10b981' : '#f59e0b' }]}>
                          {inWindow ? 'Now' : driver.availability_start_time.slice(0, 5)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Pills */}
                  <View style={s.driverPills}>
                    {driver.payment_methods?.map(pm => (
                      <View key={pm} style={s.pill}>
                        <Text style={s.pillText}>{pm === 'paynow' ? '🌐 Paynow' : '💵 Pay on delivery'}</Text>
                      </View>
                    ))}
                    {driver.phone_number && (
                      <View style={s.pill}>
                        <Phone size={10} color={TX2} />
                        <Text style={s.pillText}>{driver.phone_number}</Text>
                      </View>
                    )}
                  </View>

                  {/* Select button or confirmation box */}
                  {isPending ? (
                    <View style={s.confirmBox}>
                      <Text style={s.confirmBoxText}>
                        Set a fee offer for {driver.full_name}. They will see your offer and accept or negotiate.
                      </Text>
                      <View style={s.offerFeeRow}>
                        <Text style={s.offerFeePrefix}>$</Text>
                        <TextInput
                          style={s.offerFeeInput}
                          value={offerFee}
                          onChangeText={onOfferFeeChange}
                          placeholder="0.00"
                          keyboardType="decimal-pad"
                          placeholderTextColor={isDark ? 'rgba(0,255,136,0.4)' : '#6ee7b7'}
                        />
                      </View>

                      {driver.whatsapp_number ? (
                        <View style={{ gap: 8 }}>
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
                              You must send a WhatsApp message to this messenger before confirming your order.
                            </Text>
                          )}
                        </View>
                      ) : null}

                      <View style={s.confirmBtnRow}>
                        <TouchableOpacity
                          style={s.cancelConfirmBtn}
                          onPress={() => { setPendingDriver(null); setWhatsappSent(false); }}
                        >
                          <Text style={s.cancelConfirmBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            s.confirmBtn,
                            driver.whatsapp_number && !whatsappSent && {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
                            },
                          ]}
                          onPress={() => { onSelectDirect(driver); setPendingDriver(null); setWhatsappSent(false); }}
                          activeOpacity={0.85}
                          disabled={!!driver.whatsapp_number && !whatsappSent}
                        >
                          <CheckCircle size={16} color={driver.whatsapp_number && !whatsappSent ? (isDark ? '#666' : '#9ca3af') : '#051a0a'} />
                          <Text style={[
                            s.confirmBtnText,
                            driver.whatsapp_number && !whatsappSent && { color: isDark ? '#666' : '#9ca3af' },
                          ]}>
                            {driver.whatsapp_number && !whatsappSent ? 'Send WhatsApp First' : 'Confirm Driver'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[s.selectBtn, {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(0,229,255,0.1)' : '#eef5ff')
                          : P,
                        borderWidth: isSelected ? 1.5 : 0,
                        borderColor: isSelected ? P : 'transparent',
                      }]}
                      onPress={() => handleSelectDriver(driver)}
                      activeOpacity={0.85}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle size={16} color={P} />
                          <Text style={[s.selectBtnText, { color: P }]}>Selected</Text>
                        </>
                      ) : (
                        <>
                          <Text style={s.selectBtnText}>Select Driver</Text>
                          <ChevronRight size={16} color="#fff" />
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  );

  const renderOpenTab = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.openCard}>
        <View style={s.openCardHeader}>
          <View style={s.openIconWrap}>
            <Radio size={24} color="#10b981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.openCardTitle}>Open Request</Text>
            <Text style={{ fontSize: 12, color: '#10b981', fontWeight: '600' }}>
              {deliveryMode === 'open_request' ? 'Active' : 'Broadcast to all drivers'}
            </Text>
          </View>
          {deliveryMode === 'open_request' && <CheckCircle size={22} color="#10b981" />}
        </View>

        <Text style={s.openCardDesc}>
          Your request is broadcast to all available drivers. Drivers who want the job
          will accept it — you then pick the one you want based on their profile and offered fee.
        </Text>

        <View style={s.openSteps}>
          {[
            'Your request is sent to all available messengers',
            'Interested drivers accept and you see their profiles',
            'Compare drivers and choose the best fit',
            'Your chosen driver gets the job instantly',
          ].map((step, i) => (
            <View key={i} style={s.openStep}>
              <View style={s.openStepNum}>
                <Text style={s.openStepNumText}>{i + 1}</Text>
              </View>
              <Text style={s.openStepText}>{step}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={s.openBtn}
          onPress={() => { onSelectOpenRequest(); handleClose(); }}
          activeOpacity={0.85}
        >
          {deliveryMode === 'open_request' ? (
            <>
              <CheckCircle size={18} color="#fff" />
              <Text style={s.openBtnText}>Open Request Active</Text>
            </>
          ) : (
            <>
              <Zap size={18} color={TX2} />
              <Text style={s.openBtnText}>Use Open Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>
          <View style={s.handle} />

          <View style={s.sheetHeader}>
            <View style={s.sheetIconWrap}>
              <Truck size={20} color={P} />
            </View>
            <Text style={s.sheetTitle}>Select a Messenger</Text>
            <TouchableOpacity style={s.sheetClose} onPress={handleClose}>
              <X size={16} color={TX2} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={s.tabs}>
            <TouchableOpacity
              style={[s.tab, activeTab === 'direct' && s.tabActive]}
              onPress={() => setActiveTab('direct')}
            >
              <User size={14} color={activeTab === 'direct' ? P : TX3} />
              <Text style={[s.tabText, activeTab === 'direct' && s.tabTextActive]}>Choose Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, activeTab === 'open' && s.tabActive]}
              onPress={() => setActiveTab('open')}
            >
              <Users size={14} color={activeTab === 'open' ? P : TX3} />
              <Text style={[s.tabText, activeTab === 'open' && s.tabTextActive]}>Open Request</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'direct' ? renderDirectTab() : renderOpenTab()}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
