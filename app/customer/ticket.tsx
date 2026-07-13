import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { CircleCheck as CheckCircle, Hop as Home, CircleAlert as AlertCircle, ArrowLeft, Package, CreditCard, Truck, User, Clock, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function OrderTicket() {
  const router = useRouter();
  const { deliveryId, customerName, total, deliveryFee, paymentOption } = useLocalSearchParams();
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const P = '#1A73E8';
  const PL = '#4A9EFF';
  const BG = isDark ? '#050D1A' : '#F0F4FF';
  const CARD = isDark ? '#0D1B2E' : '#FFFFFF';
  const CARD_B = isDark ? '#1A3A5C' : '#DDE8FF';
  const TX = isDark ? '#E8F4FF' : '#0A1628';
  const TX2 = isDark ? '#7AA3CC' : '#5A7A9A';
  const TX3 = isDark ? '#3A6A8A' : '#9AB0CC';
  const SUCCESS = '#10B981';
  const WARN = '#F59E0B';
  const ERR = '#EF4444';
  const GLOW = isDark ? 'rgba(26,115,232,0.18)' : 'rgba(26,115,232,0.08)';

  useEffect(() => {
    loadOrderDetails();

    const subscription = supabase
      .channel('delivery-changes')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`,
        },
        () => {
          setOrderDetails(null);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadOrderDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          drivers (
            full_name,
            phone_number,
            fee_up_to_10,
            fee_up_to_20,
            fee_up_to_30,
            fee_up_to_40,
            fee_up_to_50,
            fee_up_to_100,
            fee_up_to_200,
            fee_up_to_300,
            fee_up_to_400,
            fee_up_to_500
          )
        `)
        .eq('id', deliveryId as string)
        .maybeSingle();

      if (error) throw error;
      setOrderDetails(data);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCommissionTier = (total: number) => {
    if (total <= 10) return 'Up to $10';
    if (total <= 20) return '$10 - $20';
    if (total <= 30) return '$20 - $30';
    if (total <= 40) return '$30 - $40';
    if (total <= 50) return '$40 - $50';
    if (total <= 100) return '$50 - $100';
    if (total <= 200) return '$100 - $200';
    if (total <= 300) return '$200 - $300';
    if (total <= 400) return '$300 - $400';
    if (total <= 500) return '$400 - $500';
    return 'Over $500';
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 56,
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: CARD,
      borderBottomWidth: 1,
      borderBottomColor: CARD_B,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: CARD_B,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: BG,
      marginRight: 14,
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: TX, letterSpacing: 0.3 },
    content: { flex: 1 },
    successSection: {
      alignItems: 'center',
      paddingTop: 36,
      paddingBottom: 24,
      paddingHorizontal: 20,
    },
    checkRingOuter: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 2,
      borderColor: SUCCESS,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)',
      shadowColor: SUCCESS,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 8,
    },
    successTitle: { fontSize: 26, fontWeight: '800', color: TX, marginBottom: 6, textAlign: 'center', letterSpacing: 0.2 },
    successSubtitle: { fontSize: 14, color: TX2, textAlign: 'center', letterSpacing: 0.3 },
    card: {
      backgroundColor: CARD,
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: CARD_B,
      overflow: 'hidden',
      shadowColor: P,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: CARD_B,
      backgroundColor: isDark ? 'rgba(26,115,232,0.06)' : 'rgba(26,115,232,0.03)',
    },
    cardHeaderText: { fontSize: 12, fontWeight: '800', color: P, letterSpacing: 1.5, textTransform: 'uppercase' as any },
    cardBody: { padding: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    rowLabel: { fontSize: 13, color: TX3, letterSpacing: 0.2 },
    rowValue: { fontSize: 14, fontWeight: '600', color: TX, textAlign: 'right', flex: 1, marginLeft: 16 },
    rowValueAccent: { fontSize: 14, fontWeight: '700', color: P, textAlign: 'right', flex: 1, marginLeft: 16 },
    statusPill: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
      borderWidth: 1,
      borderColor: WARN,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 3,
    },
    statusPillText: { fontSize: 12, fontWeight: '700', color: WARN, letterSpacing: 0.5 },
    divider: { height: 1, backgroundColor: CARD_B, marginVertical: 14 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    itemName: { fontSize: 14, color: TX, flex: 1 },
    itemPrice: { fontSize: 14, fontWeight: '700', color: P },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 14,
      borderTopWidth: 2,
      borderTopColor: CARD_B,
      marginTop: 4,
    },
    totalLabel: { fontSize: 17, fontWeight: '800', color: TX },
    totalValue: { fontSize: 18, fontWeight: '800', color: P },
    ecocashNotice: {
      borderWidth: 1.5,
      borderColor: ERR,
      borderRadius: 12,
      padding: 16,
      backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)',
    },
    ecocashNoticeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    ecocashNoticeTitle: { fontSize: 14, fontWeight: '800', color: ERR, flex: 1 },
    ecocashNoticeText: { fontSize: 13, color: ERR, lineHeight: 20 },
    paymentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-end',
      backgroundColor: isDark ? 'rgba(26,115,232,0.12)' : 'rgba(26,115,232,0.08)',
      borderWidth: 1,
      borderColor: CARD_B,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    paymentBadgeText: { fontSize: 12, fontWeight: '600', color: PL },
    chatNotice: {
      marginTop: 4,
      padding: 12,
      backgroundColor: isDark ? 'rgba(26,115,232,0.08)' : 'rgba(26,115,232,0.05)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: CARD_B,
    },
    chatNoticeText: { fontSize: 12, color: TX2, lineHeight: 18 },
    homeButton: {
      flexDirection: 'row',
      backgroundColor: P,
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 40,
      padding: 16,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      shadowColor: P,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    homeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
    btnShine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%' as any,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
    },
    declinedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    declinedRing: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 2,
      borderColor: WARN,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)',
    },
    declinedTitle: { fontSize: 24, fontWeight: '800', color: WARN, marginBottom: 12, textAlign: 'center' },
    declinedMessage: { fontSize: 15, color: TX2, textAlign: 'center', lineHeight: 24, marginBottom: 28 },
    placeNewOrderButton: {
      backgroundColor: P,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
      shadowColor: P,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
    },
    placeNewOrderButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    bgCircle: {
      position: 'absolute',
      width: 320,
      height: 320,
      borderRadius: 160,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(26,115,232,0.07)' : 'rgba(26,115,232,0.05)',
      top: -120,
      right: -100,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={P} />
      </View>
    );
  }

  if (!orderDetails) {
    return (
      <View style={styles.container}>
        <View style={styles.bgCircle} />
        <View style={styles.declinedContainer}>
          <View style={styles.declinedRing}>
            <AlertCircle size={48} color={WARN} />
          </View>
          <Text style={styles.declinedTitle}>Order Expired</Text>
          <Text style={styles.declinedMessage}>
            Your order was not accepted within 10 minutes and has expired. Please place a new order and try selecting a different driver.
          </Text>
          <TouchableOpacity style={styles.placeNewOrderButton} onPress={() => router.back()}>
            <Text style={styles.placeNewOrderButtonText}>Place New Order</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.bgCircle} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={18} color={TX2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Confirmation</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.successSection}>
            <Animated.View style={[styles.checkRingOuter, { transform: [{ scale: scaleAnim }] }]}>
              <CheckCircle size={52} color={SUCCESS} />
            </Animated.View>
            <Text style={styles.successTitle}>Order Placed!</Text>
            <Text style={styles.successSubtitle}>Your order has been received and is pending pickup</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Package size={14} color={P} />
              <Text style={styles.cardHeaderText}>Order Details</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Order ID</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{(deliveryId as string)?.slice(0, 16)}...</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Customer</Text>
                <Text style={styles.rowValue}>{customerName}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Status</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>PENDING</Text>
                </View>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Order Time</Text>
                <Text style={styles.rowValue}>{new Date(orderDetails?.created_at).toLocaleString()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Truck size={14} color={P} />
              <Text style={styles.cardHeaderText}>Items Ordered</Text>
            </View>
            <View style={styles.cardBody}>
              {orderDetails?.items?.map((item: any, index: number) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name} ×{item.quantity}</Text>
                  <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Subtotal</Text>
                <Text style={styles.rowValue}>${total}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Delivery Fee ({getCommissionTier(parseFloat(total as string))})</Text>
                <Text style={styles.rowValue}>${deliveryFee}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  ${(parseFloat(total as string) + parseFloat(deliveryFee as string)).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <CreditCard size={14} color={P} />
              <Text style={styles.cardHeaderText}>Payment & Delivery</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Delivery Method</Text>
                <Text style={styles.rowValue}>
                  {orderDetails?.preferred_delivery_method === 'vehicle' ? 'Vehicle Delivery' : 'Walking Delivery'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Payment</Text>
                <View style={styles.paymentBadge}>
                  <Text style={styles.paymentBadgeText}>
                    {paymentOption === 'paynow' ? 'Paynow' : paymentOption === 'ecocash' ? 'EcoCash' : 'Pay on Delivery'}
                  </Text>
                </View>
              </View>

              {paymentOption === 'ecocash' && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.ecocashNotice}>
                    <View style={styles.ecocashNoticeHeader}>
                      <AlertCircle size={20} color={ERR} />
                      <Text style={styles.ecocashNoticeTitle}>Important Payment Notice</Text>
                    </View>
                    <Text style={styles.ecocashNoticeText}>
                      Once your order is accepted by the driver, you must send the full payment amount immediately via EcoCash. The groceries will be purchased only after your payment is received.
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {orderDetails?.drivers && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <User size={14} color={P} />
                <Text style={styles.cardHeaderText}>Driver Information</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Driver</Text>
                  <Text style={styles.rowValue}>{orderDetails.drivers.full_name}</Text>
                </View>
                <View style={styles.chatNotice}>
                  <Text style={styles.chatNoticeText}>
                    Use the chat feature to communicate with your driver about order details or delivery instructions.
                  </Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/')} activeOpacity={0.85}>
            <Home size={20} color="#fff" />
            <Text style={styles.homeButtonText}>Back to Home</Text>
            <View style={styles.btnShine} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
