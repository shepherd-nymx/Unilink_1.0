import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ArrowLeft, ShoppingBag, Package, ChevronRight, CircleCheck as CheckCircle,
  Clock, Truck, X,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useDeliveryRequest } from '@/hooks/useDeliveryRequest';
import BuyAndDeliverForm from '@/components/BuyAndDeliverForm';
import PickupAndDeliverForm from '@/components/PickupAndDeliverForm';
import DeliveryDriverSelector from '@/components/DeliveryDriverSelector';
import type {
  ServiceType, BuyAndDeliverForm as BuyForm, PickupAndDeliverForm as PickupForm,
  PaymentMethod, DeliveryMethod, DeliveryMode, Driver,
} from '@/lib/delivery-request-types';

const INITIAL_BUY: BuyForm = {
  itemName: '', quantity: 1, shopName: '', shopLocation: '',
  budgetEstimate: '', destination: null, instructions: '',
};

const INITIAL_PICKUP: PickupForm = {
  pickup: null, pickupContactName: '', pickupContactPhone: '',
  pickupLandmark: '', pickupNotes: '',
  destination: null, receiverName: '', receiverPhone: '', destinationNotes: '',
};

export default function DeliveryRequestPage() {
  const router = useRouter();
  const { customerId, customerName } = useLocalSearchParams<{ customerId: string; customerName: string }>();
  const { colors, isDark } = useTheme();

  // Service selection
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);

  // Form state
  const [buyForm, setBuyForm] = useState<BuyForm>(INITIAL_BUY);
  const [pickupForm, setPickupForm] = useState<PickupForm>(INITIAL_PICKUP);

  // Payment / delivery prefs
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pay_on_delivery');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('vehicle');

  // Driver selection state
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('open_request');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [offerFee, setOfferFee] = useState('');
  const [showDriverSelector, setShowDriverSelector] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  // Submission
  const [successModal, setSuccessModal] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const { submitting, error, setError, submitBuyAndDeliver, submitPickupAndDeliver } = useDeliveryRequest();

  const P = isDark ? '#00e5ff' : '#1A73E8';
  const BG = isDark ? '#070f1c' : '#f0f4f8';
  const CARD = isDark ? '#0d1b2e' : '#ffffff';
  const CARD_B = isDark ? 'rgba(0,229,255,0.15)' : '#dde8ff';
  const TX = isDark ? '#e0eeff' : '#0a1628';
  const TX2 = isDark ? '#8296b0' : '#64748b';
  const TX3 = isDark ? '#3a5a7a' : '#94a3b8';

  // Load available drivers when a service is selected
  const loadDrivers = useCallback(async () => {
    if (!customerId) return;
    setLoadingDrivers(true);
    try {
      // Get customer's university for filtering
      const { data: cust } = await supabase
        .from('customers')
        .select('university_id')
        .eq('id', customerId)
        .maybeSingle();

      let query = supabase
        .from('drivers')
        .select(`
          id, full_name, phone_number, delivery_type, payment_methods,
          is_available, address, fee_up_to_10, fee_up_to_20, fee_up_to_30,
          fee_up_to_40, fee_up_to_50, fee_up_to_100, fee_up_to_200,
          fee_up_to_300, fee_up_to_400, fee_up_to_500, average_rating,
          total_ratings, profile_picture_url,
          availability_start_time, availability_end_time, availability_days,
          university_id, active_university_id, whatsapp_number
        `)
        .eq('is_available', true)
        .eq('approval_status', 'approved')
        .order('average_rating', { ascending: false });

      if (cust?.university_id) {
        query = query.or(
          `university_id.eq.${cust.university_id},active_university_id.eq.${cust.university_id}`
        );
      }

      const { data } = await query;
      setDrivers(
        (data ?? []).map((d: any) => ({ ...d, location: d.address ?? '' }))
      );
    } catch {}
    setLoadingDrivers(false);
  }, [customerId]);

  // Load drivers as soon as a service is chosen
  useEffect(() => {
    if (selectedService) loadDrivers();
  }, [selectedService, loadDrivers]);

  const handleSelectDirect = (driver: Driver) => {
    setSelectedDriver(driver);
    setDeliveryMode('direct');
    setShowDriverSelector(false);
  };

  const handleSelectOpenRequest = () => {
    setSelectedDriver(null);
    setDeliveryMode('open_request');
    setOfferFee('');
  };

  const validateAndSubmitBuy = async () => {
    setError(null);
    if (!buyForm.itemName.trim()) { setError('Please enter the item name'); return; }
    if (!buyForm.shopName.trim()) { setError('Please enter the shop name'); return; }
    if (!buyForm.destination) { setError('Please set the delivery destination'); return; }
    const id = await submitBuyAndDeliver({
      customerId, form: buyForm, paymentMethod, deliveryMethod,
      deliveryMode, driverId: selectedDriver?.id ?? null, offerFee,
    });
    if (id) { setSubmittedId(id); setSuccessModal(true); }
  };

  const validateAndSubmitPickup = async () => {
    setError(null);
    if (!pickupForm.pickup) { setError('Please set the pickup location'); return; }
    if (!pickupForm.pickupContactName.trim()) { setError('Please enter the contact person at pickup'); return; }
    if (!pickupForm.pickupContactPhone.trim()) { setError('Please enter the contact phone number'); return; }
    if (!pickupForm.destination) { setError('Please set the delivery destination'); return; }
    if (!pickupForm.receiverName.trim()) { setError('Please enter the receiver name'); return; }
    const id = await submitPickupAndDeliver({
      customerId, form: pickupForm, paymentMethod, deliveryMethod,
      deliveryMode, driverId: selectedDriver?.id ?? null, offerFee,
    });
    if (id) { setSubmittedId(id); setSuccessModal(true); }
  };

  const handleSuccess = () => {
    setSuccessModal(false);
    setBuyForm(INITIAL_BUY);
    setPickupForm(INITIAL_PICKUP);
    setSelectedService(null);
    setSelectedDriver(null);
    setDeliveryMode('open_request');
    setOfferFee('');
    router.back();
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 56 : (Platform.OS === 'web' ? 20 : 44),
      paddingBottom: 16,
      backgroundColor: isDark ? '#070f1c' : '#fff',
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(0,229,255,0.12)' : '#e2e8f0',
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f0f4f8',
      borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    },
    headerTextWrap: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: TX, letterSpacing: 0.2 },
    headerSub: { fontSize: 12, color: P, marginTop: 2, fontWeight: '600' },

    selectionScroll: { flex: 1 },
    heroBanner: {
      marginHorizontal: 16, marginTop: 20, padding: 24, borderRadius: 22,
      backgroundColor: CARD, borderWidth: 1, borderColor: CARD_B,
      shadowColor: P, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
      borderTopWidth: 3, borderTopColor: P,
    },
    heroTitle: { fontSize: 22, fontWeight: '900', color: TX, marginBottom: 6, letterSpacing: 0.3 },
    heroSub: { fontSize: 14, color: TX2, lineHeight: 21 },
    heroBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' as any },
    heroBadge: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
      backgroundColor: isDark ? 'rgba(0,229,255,0.1)' : 'rgba(26,115,232,0.07)',
      borderWidth: 1, borderColor: isDark ? 'rgba(0,229,255,0.2)' : 'rgba(26,115,232,0.15)',
    },
    heroBadgeText: { fontSize: 11, fontWeight: '700', color: P },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: TX3,
      letterSpacing: 2.5, textTransform: 'uppercase' as any,
      marginHorizontal: 20, marginTop: 28, marginBottom: 14,
    },
    serviceCard: {
      marginHorizontal: 16, marginBottom: 14, borderRadius: 22, borderWidth: 1.5,
      overflow: 'hidden',
      shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 8,
    },
    serviceCardInner: { padding: 24, borderTopWidth: 3 },
    serviceCardIconWrap: {
      width: 64, height: 64, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    serviceCardTitle: { fontSize: 20, fontWeight: '900', marginBottom: 6, letterSpacing: 0.2 },
    serviceCardDesc: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
    serviceCardFeatures: { gap: 8, marginBottom: 20 },
    serviceCardFeature: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    serviceCardFeatureText: { fontSize: 13, fontWeight: '500' },
    serviceCardCta: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 48, borderRadius: 14,
    },
    serviceCardCtaText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

    stepHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(0,229,255,0.08)' : '#eef2ff',
    },
    stepBackBtn: {
      width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f0f4f8',
    },
    stepTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: TX },
    stepBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    stepBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

    successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    successCard: {
      width: '100%', borderRadius: 28, padding: 32, alignItems: 'center',
      backgroundColor: CARD,
      borderWidth: 1, borderColor: isDark ? 'rgba(0,255,136,0.3)' : '#a7f3d0',
      shadowColor: '#00ff88', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 20,
    },
    successIconWrap: {
      width: 80, height: 80, borderRadius: 24, marginBottom: 20,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(0,255,136,0.1)' : '#f0fdf9',
      borderWidth: 2, borderColor: isDark ? 'rgba(0,255,136,0.3)' : '#a7f3d0',
    },
    successTitle: { fontSize: 24, fontWeight: '900', color: TX, textAlign: 'center', marginBottom: 8 },
    successSub: { fontSize: 14, color: TX2, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
    successId: { fontSize: 11, color: TX3, fontFamily: 'monospace', marginBottom: 24 },
    successInfoRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      padding: 14, borderRadius: 14, width: '100%', marginBottom: 24,
      backgroundColor: isDark ? 'rgba(0,229,255,0.06)' : '#f0f9ff',
      borderWidth: 1, borderColor: isDark ? 'rgba(0,229,255,0.15)' : '#bae6fd',
    },
    successInfoText: { flex: 1, fontSize: 13, color: TX2, lineHeight: 19 },
    successBtn: {
      width: '100%', height: 52, borderRadius: 16,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: '#00ff88',
      shadowColor: '#00ff88', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    successBtnText: { fontSize: 16, fontWeight: '900', color: '#051a0a', letterSpacing: 0.3 },
  });

  const serviceCards = [
    {
      type: 'buy_and_deliver' as ServiceType,
      title: 'Buy & Deliver',
      desc: 'Tell us what to buy and where to deliver it. Your messenger purchases the item and brings it straight to you.',
      icon: ShoppingBag,
      glow: P,
      ctaBg: P,
      cardBg: CARD,
      cardBorder: CARD_B,
      iconBg: isDark ? 'rgba(0,229,255,0.12)' : '#e8f0ff',
      iconColor: P,
      titleColor: TX,
      descColor: TX2,
      shadow: P,
      features: ['Set item name & quantity', 'Budget estimate', 'Choose your shop', 'Pin delivery location'],
      featureColor: P,
    },
    {
      type: 'pickup_and_deliver' as ServiceType,
      title: 'Pickup & Deliver',
      desc: "Have an item collected from one location and delivered to another. Perfect for parcels, documents, and errands.",
      icon: Package,
      glow: '#f59e0b',
      ctaBg: '#f59e0b',
      cardBg: CARD,
      cardBorder: isDark ? 'rgba(245,158,11,0.25)' : '#fde68a',
      iconBg: isDark ? 'rgba(245,158,11,0.12)' : '#fef3c7',
      iconColor: '#f59e0b',
      titleColor: TX,
      descColor: TX2,
      shadow: '#f59e0b',
      features: ['Set pickup & drop-off pins', 'Contact details for both ends', 'Choose your messenger', 'Live tracking'],
      featureColor: '#f59e0b',
    },
  ];

  if (!selectedService) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={18} color={TX} />
          </TouchableOpacity>
          <View style={s.headerTextWrap}>
            <Text style={s.headerTitle}>Request a Delivery</Text>
            <Text style={s.headerSub}>Campus Logistics, Fast & Reliable</Text>
          </View>
        </View>

        <ScrollView style={s.selectionScroll} showsVerticalScrollIndicator={false}>
          <View style={s.heroBanner}>
            <Text style={s.heroTitle}>What do you need delivered?</Text>
            <Text style={s.heroSub}>
              UniLink messengers are ready to run your campus errands — fast, safe, and tracked.
            </Text>
            <View style={s.heroBadgeRow}>
              {['Fast Delivery', 'Live Tracking', 'Trusted Messengers', 'Campus-Wide'].map(b => (
                <View key={b} style={s.heroBadge}>
                  <Text style={s.heroBadgeText}>{b}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={s.sectionLabel}>Select a Service</Text>

          {serviceCards.map(card => {
            const Icon = card.icon;
            return (
              <TouchableOpacity
                key={card.type}
                style={[s.serviceCard, { backgroundColor: card.cardBg, borderColor: card.cardBorder, shadowColor: card.shadow, shadowOpacity: 0.18 }]}
                onPress={() => setSelectedService(card.type)}
                activeOpacity={0.85}
              >
                <View style={[s.serviceCardInner, { borderTopColor: card.glow }]}>
                  <View style={[s.serviceCardIconWrap, { backgroundColor: card.iconBg }]}>
                    <Icon size={30} color={card.iconColor} />
                  </View>
                  <Text style={[s.serviceCardTitle, { color: card.titleColor }]}>{card.title}</Text>
                  <Text style={[s.serviceCardDesc, { color: card.descColor }]}>{card.desc}</Text>
                  <View style={s.serviceCardFeatures}>
                    {card.features.map(f => (
                      <View key={f} style={s.serviceCardFeature}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: card.featureColor }} />
                        <Text style={[s.serviceCardFeatureText, { color: TX2 }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[s.serviceCardCta, { backgroundColor: card.ctaBg }]}
                    onPress={() => setSelectedService(card.type)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.serviceCardCtaText}>Get Started</Text>
                    <ChevronRight size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  const isBuy = selectedService === 'buy_and_deliver';
  const accentColor = isBuy ? P : '#f59e0b';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={18} color={TX} />
        </TouchableOpacity>
        <View style={s.headerTextWrap}>
          <Text style={s.headerTitle}>Request a Delivery</Text>
          <Text style={s.headerSub}>Campus Logistics, Fast & Reliable</Text>
        </View>
      </View>

      <View style={s.stepHeader}>
        <TouchableOpacity style={s.stepBackBtn} onPress={() => { setSelectedService(null); setError(null); }} activeOpacity={0.7}>
          <X size={16} color={TX2} />
        </TouchableOpacity>
        <Text style={s.stepTitle}>{isBuy ? 'Buy & Deliver' : 'Pickup & Deliver'}</Text>
        <View style={[s.stepBadge, { backgroundColor: accentColor }]}>
          <Text style={s.stepBadgeText}>{isBuy ? '🛒' : '📦'} Active</Text>
        </View>
      </View>

      {isBuy ? (
        <BuyAndDeliverForm
          form={buyForm}
          paymentMethod={paymentMethod}
          deliveryMethod={deliveryMethod}
          deliveryMode={deliveryMode}
          selectedDriver={selectedDriver}
          offerFee={offerFee}
          onFormChange={u => setBuyForm(prev => ({ ...prev, ...u }))}
          onPaymentChange={setPaymentMethod}
          onDeliveryChange={setDeliveryMethod}
          onOpenDriverSelector={() => setShowDriverSelector(true)}
          onSubmit={validateAndSubmitBuy}
          submitting={submitting}
          error={error}
        />
      ) : (
        <PickupAndDeliverForm
          form={pickupForm}
          paymentMethod={paymentMethod}
          deliveryMethod={deliveryMethod}
          deliveryMode={deliveryMode}
          selectedDriver={selectedDriver}
          offerFee={offerFee}
          onFormChange={u => setPickupForm(prev => ({ ...prev, ...u }))}
          onPaymentChange={setPaymentMethod}
          onDeliveryChange={setDeliveryMethod}
          onOpenDriverSelector={() => setShowDriverSelector(true)}
          onSubmit={validateAndSubmitPickup}
          submitting={submitting}
          error={error}
        />
      )}

      {/* Driver Selector Sheet */}
      <DeliveryDriverSelector
        visible={showDriverSelector}
        onClose={() => setShowDriverSelector(false)}
        drivers={drivers}
        deliveryMode={deliveryMode}
        deliveryMethod={deliveryMethod}
        paymentMethod={paymentMethod}
        selectedDriverId={selectedDriver?.id ?? null}
        offerFee={offerFee}
        onSelectDirect={handleSelectDirect}
        onSelectOpenRequest={handleSelectOpenRequest}
        onOfferFeeChange={setOfferFee}
      />

      {/* Success Modal */}
      <Modal visible={successModal} transparent animationType="fade" onRequestClose={handleSuccess}>
        <View style={s.successOverlay}>
          <View style={s.successCard}>
            <View style={s.successIconWrap}>
              <CheckCircle size={40} color="#00ff88" />
            </View>
            <Text style={s.successTitle}>Request Sent!</Text>
            <Text style={s.successSub}>
              Your {isBuy ? 'Buy & Deliver' : 'Pickup & Deliver'} request is live.{' '}
              {deliveryMode === 'open_request'
                ? 'Available messengers will see it now.'
                : `${selectedDriver?.full_name} will be notified.`}
            </Text>
            {submittedId && (
              <Text style={s.successId}>ID: {submittedId.slice(0, 8).toUpperCase()}</Text>
            )}
            <View style={s.successInfoRow}>
              <Clock size={16} color={P} />
              <Text style={s.successInfoText}>
                {deliveryMode === 'open_request'
                  ? 'Expires in 10 minutes if not accepted. You can track this in My Orders.'
                  : `Your offer fee: $${offerFee || '—'}. The messenger will be notified directly.`}
              </Text>
            </View>
            <TouchableOpacity style={s.successBtn} onPress={handleSuccess} activeOpacity={0.85}>
              <Text style={s.successBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
