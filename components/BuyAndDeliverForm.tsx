import React from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, Platform, Image, Linking,
} from 'react-native';
import { ShoppingBag, MapPin, DollarSign, FileText, Store, ChevronRight, User, Truck, Users, ChevronDown, Star, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import DeliveryLocationPicker from './DeliveryLocationPicker';
import type {
  BuyAndDeliverForm as Form, PaymentMethod, DeliveryMethod,
  DeliveryMode, Driver,
} from '@/lib/delivery-request-types';

interface Props {
  form: Form;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  deliveryMode: DeliveryMode;
  selectedDriver: Driver | null;
  offerFee: string;
  onFormChange: (updates: Partial<Form>) => void;
  onPaymentChange: (pm: PaymentMethod) => void;
  onDeliveryChange: (dm: DeliveryMethod) => void;
  onOpenDriverSelector: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}

export default function BuyAndDeliverForm({
  form, paymentMethod, deliveryMethod, deliveryMode, selectedDriver, offerFee,
  onFormChange, onPaymentChange, onDeliveryChange, onOpenDriverSelector,
  onSubmit, submitting, error,
}: Props) {
  const { colors, isDark } = useTheme();
  const P = isDark ? '#00e5ff' : '#1A73E8';
  const CARD = isDark ? '#0d1b2e' : '#ffffff';
  const CARD_B = isDark ? 'rgba(0,229,255,0.15)' : '#dde8ff';
  const TX = isDark ? '#e0eeff' : '#0a1628';
  const TX2 = isDark ? '#8296b0' : '#64748b';
  const TX3 = isDark ? '#3a5a7a' : '#94a3b8';
  const INPUT = isDark ? 'rgba(255,255,255,0.05)' : '#f8faff';
  const INPUT_B = isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1';

  const s = StyleSheet.create({
    scroll: { flex: 1 },
    section: {
      backgroundColor: CARD, marginHorizontal: 16, marginTop: 16,
      borderRadius: 20, borderWidth: 1, borderColor: CARD_B,
      shadowColor: P, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(0,229,255,0.08)' : '#eef2ff',
      backgroundColor: isDark ? 'rgba(0,229,255,0.04)' : 'rgba(26,115,232,0.03)',
    },
    sectionHeaderText: { fontSize: 12, fontWeight: '800', color: P, letterSpacing: 1.5, textTransform: 'uppercase' as any },
    sectionBody: { padding: 20, gap: 16 },
    fieldGroup: { gap: 7 },
    label: { fontSize: 11, fontWeight: '700', color: TX2, letterSpacing: 1.2, textTransform: 'uppercase' as any },
    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: INPUT, borderWidth: 1.5, borderColor: INPUT_B,
      borderRadius: 13, paddingHorizontal: 14, height: 50, gap: 10,
    },
    input: {
      flex: 1, fontSize: 15, color: TX,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    textareaRow: {
      backgroundColor: INPUT, borderWidth: 1.5, borderColor: INPUT_B,
      borderRadius: 13, padding: 14, minHeight: 80,
    },
    textarea: {
      fontSize: 14, color: TX, textAlignVertical: 'top',
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    qtyBtn: {
      width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
      borderWidth: 1.5, borderColor: P, backgroundColor: isDark ? 'rgba(0,229,255,0.1)' : '#eef5ff',
    },
    qtyBtnText: { fontSize: 20, fontWeight: '700', color: P, lineHeight: 22 },
    qtyValue: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: TX },
    toggleRow: { flexDirection: 'row', gap: 10 },
    toggleOpt: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 12, borderRadius: 14, borderWidth: 1.5,
      borderColor: INPUT_B, backgroundColor: INPUT,
    },
    toggleOptActive: { borderColor: P, backgroundColor: isDark ? 'rgba(0,229,255,0.1)' : '#eef5ff' },
    toggleOptText: { fontSize: 13, fontWeight: '700', color: TX2 },
    toggleOptTextActive: { color: P },
    budgetPrefix: { fontSize: 15, fontWeight: '700', color: TX2 },
    paynowOpt: {
      marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
      borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fafcff',
    },
    paynowOptActive: {
      borderColor: '#00a86b',
      backgroundColor: isDark ? 'rgba(0,168,107,0.1)' : 'rgba(0,168,107,0.06)',
    },
    paynowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    paynowBadge: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1',
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: 'transparent',
    },
    paynowBadgeActive: { borderColor: '#00a86b', backgroundColor: '#00a86b' },
    paynowBadgeText: { fontSize: 12, fontWeight: '900', color: '#fff' },
    paynowLabel: { fontSize: 13, fontWeight: '700', color: TX2 },
    paynowLabelActive: { color: '#00a86b' },
    paynowSub: { fontSize: 11, color: TX2, marginTop: 1, opacity: 0.7 },
    paynowLogo: { width: 100, height: 32 },
    paynowOpenBtn: {
      marginTop: 10, height: 42, borderRadius: 12,
      backgroundColor: '#00a86b',
      justifyContent: 'center', alignItems: 'center',
    },
    paynowOpenBtnText: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },

    // Driver card (mirrors dashboard driverSelectCard)
    driverCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, borderRadius: 16, borderWidth: 1.5,
    },
    driverCardOpen: {
      borderColor: '#10b981',
      backgroundColor: isDark ? 'rgba(16,185,129,0.07)' : '#f0fdf9',
    },
    driverCardSelected: {
      borderColor: P,
      backgroundColor: isDark ? 'rgba(0,229,255,0.06)' : '#eef5ff',
    },
    driverCardEmpty: {
      borderColor: INPUT_B, backgroundColor: INPUT,
      borderStyle: 'dashed' as any,
    },
    driverAvatar: {
      width: 46, height: 46, borderRadius: 14, overflow: 'hidden',
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(0,229,255,0.1)' : '#eef5ff',
    },
    driverInfo: { flex: 1 },
    driverName: { fontSize: 14, fontWeight: '800', color: TX },
    driverSub: { fontSize: 12, color: TX2, marginTop: 2 },
    driverRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    driverRatingText: { fontSize: 11, fontWeight: '700', color: '#f59e0b' },
    offerFeeTag: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
      backgroundColor: isDark ? 'rgba(0,255,136,0.12)' : '#d1fae5',
    },
    offerFeeTagText: { fontSize: 12, fontWeight: '800', color: '#10b981' },

    errorBanner: {
      marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,51,102,0.1)' : '#fff0f3',
      borderWidth: 1, borderColor: isDark ? 'rgba(255,51,102,0.3)' : '#ffb3c1',
    },
    errorText: { fontSize: 13, fontWeight: '600', color: '#ff3366' },
    submitBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      marginHorizontal: 16, marginTop: 20, marginBottom: 32, height: 56, borderRadius: 18,
      backgroundColor: P,
      shadowColor: P, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
    },
    submitBtnText: { fontSize: 16, fontWeight: '900', color: isDark ? '#050D1A' : '#fff', letterSpacing: 0.5 },
  });

  const renderDriverCard = () => {
    if (deliveryMode === 'open_request') {
      return (
        <TouchableOpacity style={[s.driverCard, s.driverCardOpen]} onPress={onOpenDriverSelector} activeOpacity={0.8}>
          <View style={[s.driverAvatar, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
            <Users size={22} color="#10b981" />
          </View>
          <View style={s.driverInfo}>
            <Text style={[s.driverName, { color: '#10b981' }]}>Open Request</Text>
            <Text style={s.driverSub}>Broadcast to all available messengers</Text>
          </View>
          <ChevronDown size={18} color="#10b981" />
        </TouchableOpacity>
      );
    }
    if (selectedDriver) {
      return (
        <TouchableOpacity style={[s.driverCard, s.driverCardSelected]} onPress={onOpenDriverSelector} activeOpacity={0.8}>
          <View style={s.driverAvatar}>
            {selectedDriver.profile_picture_url ? (
              <Image source={{ uri: selectedDriver.profile_picture_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <User size={22} color={P} />
            )}
          </View>
          <View style={s.driverInfo}>
            <Text style={s.driverName}>{selectedDriver.full_name}</Text>
            <View style={s.driverRatingRow}>
              {selectedDriver.total_ratings > 0 ? (
                <>
                  <Star size={11} color="#f59e0b" fill="#f59e0b" />
                  <Text style={s.driverRatingText}>{selectedDriver.average_rating.toFixed(1)}</Text>
                  <Text style={{ fontSize: 11, color: TX3 }}> · Direct</Text>
                </>
              ) : (
                <Text style={s.driverSub}>New Messenger · Direct</Text>
              )}
            </View>
            {selectedDriver.phone_number ? (
              <Text style={s.driverSub}>{selectedDriver.phone_number}</Text>
            ) : null}
          </View>
          {offerFee ? (
            <View style={s.offerFeeTag}>
              <Text style={s.offerFeeTagText}>${offerFee}</Text>
            </View>
          ) : (
            <ChevronDown size={18} color={P} />
          )}
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={[s.driverCard, s.driverCardEmpty]} onPress={onOpenDriverSelector} activeOpacity={0.8}>
        <View style={s.driverAvatar}>
          <Truck size={22} color={TX3} />
        </View>
        <View style={s.driverInfo}>
          <Text style={[s.driverName, { color: TX3 }]}>No messenger selected</Text>
          <Text style={s.driverSub}>Tap to choose or use open request</Text>
        </View>
        <ChevronRight size={18} color={TX3} />
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
      {/* Item Details */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <ShoppingBag size={14} color={P} />
          <Text style={s.sectionHeaderText}>Item Details</Text>
        </View>
        <View style={s.sectionBody}>
          <View style={s.fieldGroup}>
            <Text style={s.label}>Item Name</Text>
            <View style={s.inputRow}>
              <ShoppingBag size={16} color={TX2} />
              <TextInput
                style={s.input}
                value={form.itemName}
                onChangeText={v => onFormChange({ itemName: v })}
                placeholder="e.g., iPhone case, Textbook, Groceries..."
                placeholderTextColor={TX2}
              />
            </View>
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Quantity</Text>
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyBtn} onPress={() => onFormChange({ quantity: Math.max(1, form.quantity - 1) })}>
                <Text style={s.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.qtyValue}>{form.quantity}</Text>
              <TouchableOpacity style={s.qtyBtn} onPress={() => onFormChange({ quantity: form.quantity + 1 })}>
                <Text style={s.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Budget Estimate (USD)</Text>
            <View style={s.inputRow}>
              <Text style={s.budgetPrefix}>$</Text>
              <TextInput
                style={s.input}
                value={form.budgetEstimate}
                onChangeText={v => onFormChange({ budgetEstimate: v })}
                placeholder="0.00"
                placeholderTextColor={TX2}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
      </View>

      {/* Store Info */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Store size={14} color={P} />
          <Text style={s.sectionHeaderText}>Store / Shop</Text>
        </View>
        <View style={s.sectionBody}>
          <View style={s.fieldGroup}>
            <Text style={s.label}>Shop Name</Text>
            <View style={s.inputRow}>
              <Store size={16} color={TX2} />
              <TextInput
                style={s.input}
                value={form.shopName}
                onChangeText={v => onFormChange({ shopName: v })}
                placeholder="e.g., Pick n Pay, OK Zimbabwe..."
                placeholderTextColor={TX2}
              />
            </View>
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.label}>Shop Location</Text>
            <View style={s.inputRow}>
              <MapPin size={16} color={TX2} />
              <TextInput
                style={s.input}
                value={form.shopLocation}
                onChangeText={v => onFormChange({ shopLocation: v })}
                placeholder="e.g., Burnside, City centre..."
                placeholderTextColor={TX2}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Delivery Destination */}
      <View style={s.section}>
        <View style={[s.sectionHeader, { borderBottomColor: isDark ? 'rgba(0,255,136,0.1)' : '#d1fae5' }]}>
          <MapPin size={14} color="#00ff88" />
          <Text style={[s.sectionHeaderText, { color: '#00ff88' }]}>Delivery Destination</Text>
        </View>
        <View style={s.sectionBody}>
          <DeliveryLocationPicker
            label="Delivery Destination"
            value={form.destination}
            onChange={coords => onFormChange({ destination: coords })}
            pinColor="#00ff88"
          />
        </View>
      </View>

      {/* Instructions */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <FileText size={14} color={P} />
          <Text style={s.sectionHeaderText}>Additional Instructions</Text>
        </View>
        <View style={s.sectionBody}>
          <View style={s.textareaRow}>
            <TextInput
              style={s.textarea}
              value={form.instructions}
              onChangeText={v => onFormChange({ instructions: v })}
              placeholder="Any special instructions for the messenger..."
              placeholderTextColor={TX2}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
      </View>

      {/* Delivery Method */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Truck size={14} color={P} />
          <Text style={s.sectionHeaderText}>Delivery Method</Text>
        </View>
        <View style={s.sectionBody}>
          <View style={s.toggleRow}>
            <TouchableOpacity style={[s.toggleOpt, deliveryMethod === 'vehicle' && s.toggleOptActive]} onPress={() => onDeliveryChange('vehicle')}>
              <Text style={{ fontSize: 18 }}>🚗</Text>
              <Text style={[s.toggleOptText, deliveryMethod === 'vehicle' && s.toggleOptTextActive]}>Vehicle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.toggleOpt, deliveryMethod === 'walking' && s.toggleOptActive]} onPress={() => onDeliveryChange('walking')}>
              <Text style={{ fontSize: 18 }}>🚶</Text>
              <Text style={[s.toggleOptText, deliveryMethod === 'walking' && s.toggleOptTextActive]}>Walking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Payment */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <DollarSign size={14} color={P} />
          <Text style={s.sectionHeaderText}>Payment Method</Text>
        </View>
        <View style={s.sectionBody}>
          <View style={s.toggleRow}>
            <TouchableOpacity style={[s.toggleOpt, paymentMethod === 'pay_on_delivery' && s.toggleOptActive]} onPress={() => onPaymentChange('pay_on_delivery')}>
              <Text style={{ fontSize: 18 }}>💵</Text>
              <Text style={[s.toggleOptText, paymentMethod === 'pay_on_delivery' && s.toggleOptTextActive]}>Pay on Delivery</Text>
            </TouchableOpacity>
          </View>
          {/* Paynow — full-width branded button */}
          <TouchableOpacity
            style={[s.paynowOpt, paymentMethod === 'paynow' && s.paynowOptActive]}
            onPress={() => onPaymentChange('paynow')}
            activeOpacity={0.85}
          >
            <View style={s.paynowLeft}>
              <View style={[s.paynowBadge, paymentMethod === 'paynow' && s.paynowBadgeActive]}>
                <Text style={s.paynowBadgeText}>✓</Text>
              </View>
              <View>
                <Text style={[s.paynowLabel, paymentMethod === 'paynow' && s.paynowLabelActive]}>Pay via Paynow</Text>
                <Text style={s.paynowSub}>Secure online payment — link opens at checkout</Text>
              </View>
            </View>
            <Image
              source={{ uri: 'https://www.paynow.co.zw/Content/Buttons/Medium_buttons/button_pay-now_medium.png' }}
              style={s.paynowLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          {paymentMethod === 'paynow' && (
            <TouchableOpacity
              style={s.paynowOpenBtn}
              onPress={() => Linking.openURL('https://www.paynow.co.zw/Payment/Link/?q=c2VhcmNoPXNoZXBoZXJkbXV0ZXZlZHppJTQwZ21haWwuY29tJmFtb3VudD0wLjAwJnJlZmVyZW5jZT0mbD0w')}
              activeOpacity={0.85}
            >
              <Text style={s.paynowOpenBtnText}>Open Paynow Payment Page</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messenger / Driver Selection */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Users size={14} color={P} />
          <Text style={s.sectionHeaderText}>Messenger Selection</Text>
        </View>
        <View style={s.sectionBody}>
          {renderDriverCard()}
        </View>
      </View>

      {error && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={onSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        <ShoppingBag size={22} color={isDark ? '#050D1A' : '#fff'} />
        <Text style={s.submitBtnText}>{submitting ? 'Submitting...' : 'Request Buy & Deliver'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
