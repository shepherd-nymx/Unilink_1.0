import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, FileText, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Star, User, Car, Clock, DollarSign, CreditCard, Package, MessageSquare, Trash2 } from 'lucide-react-native';

type OrderDetails = {
  id: string;
  items: any[];
  total_amount: number;
  delivery_fee: number;
  payment_option: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  payment_received: boolean;
  driver_id: string | null;
  customer_id: string;
  drivers: {
    full_name: string;
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
  } | null;
  customers: {
    full_name: string;
    phone_number: string;
  } | null;
};

function GlowRatingButton({ onPress, label, icon, color, dim }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const onIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Animated.View style={{
        borderRadius: 12, shadowColor: color,
        shadowOffset: { width: 0, height: 0 }, shadowOpacity, shadowRadius: 16, elevation: 10,
      }}>
        <TouchableOpacity
          style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 12 }, { backgroundColor: dim, borderColor: color + '55' }]}
          onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={0.85}
        >
          {icon}
          <Text style={{ fontSize: 14, fontWeight: '800', letterSpacing: 0.4, color }}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

export default function Receipt() {
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams();
  const { colors, isDark } = useTheme();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [deletingRating, setDeletingRating] = useState(false);

  const headerGlow = useRef(new Animated.Value(0)).current;
  const iconPulse = useRef(new Animated.Value(0.6)).current;

  const ACCENT = colors.primary;
  const ACCENT_DIM = isDark ? 'rgba(0,229,255,0.1)' : 'rgba(0,102,255,0.08)';
  const ACCENT_BORDER = isDark ? 'rgba(0,229,255,0.22)' : 'rgba(0,102,255,0.18)';
  const GREEN = colors.success;
  const GREEN_DIM = colors.successLight;
  const AMBER = colors.warning;
  const AMBER_DIM = colors.warningLight;
  const RED = colors.error;
  const RED_DIM = colors.errorLight;

  useEffect(() => {
    const hLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlow, { toValue: 1, duration: 2800, useNativeDriver: false }),
        Animated.timing(headerGlow, { toValue: 0, duration: 2800, useNativeDriver: false }),
      ])
    );
    const iLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, { toValue: 1, duration: 1600, useNativeDriver: false }),
        Animated.timing(iconPulse, { toValue: 0.6, duration: 1600, useNativeDriver: false }),
      ])
    );
    hLoop.start();
    iLoop.start();
    loadOrderDetails();
    return () => { hLoop.stop(); iLoop.stop(); };
  }, []);

  const loadOrderDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          drivers (
            full_name,
            fee_up_to_10, fee_up_to_20, fee_up_to_30, fee_up_to_40, fee_up_to_50,
            fee_up_to_100, fee_up_to_200, fee_up_to_300, fee_up_to_400, fee_up_to_500
          ),
          customers (full_name, phone_number)
        `)
        .eq('id', deliveryId as string)
        .maybeSingle();

      if (error) throw error;
      setOrder(data);
      if (data?.status === 'delivered') await checkIfRated(data.customer_id, data.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkIfRated = async (customerId: string, deliveryId: string) => {
    try {
      const { data, error } = await supabase
        .from('driver_ratings').select('id')
        .eq('customer_id', customerId).eq('delivery_id', deliveryId).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setHasRated(!!data);
      setRatingId(data?.id ?? null);
    } catch (err) { console.error('Error checking rating:', err); }
  };

  const deleteRating = async () => {
    if (!ratingId) return;
    setDeletingRating(true);
    try {
      const { error } = await supabase.from('driver_ratings').delete().eq('id', ratingId);
      if (error) throw error;
      setHasRated(false);
      setRatingId(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting rating:', err);
    } finally {
      setDeletingRating(false);
    }
  };

  const submitRating = async () => {
    if (!order || !order.driver_id || rating === 0) return;
    setSubmittingRating(true);
    try {
      const { error } = await supabase.from('driver_ratings').insert({
        driver_id: order.driver_id,
        customer_id: order.customer_id,
        delivery_id: order.id,
        rating,
        review_text: reviewText.trim() || null,
      });
      if (error) throw error;
      setHasRated(true);
      setShowRatingModal(false);
      setRating(0);
      setReviewText('');
    } catch (err) {
      console.error('Error submitting rating:', err);
    } finally {
      setSubmittingRating(false);
    }
  };

  const getCommissionTier = (total: number) => {
    if (total <= 10) return 'Up to $10';
    if (total <= 20) return '$10–$20';
    if (total <= 30) return '$20–$30';
    if (total <= 40) return '$30–$40';
    if (total <= 50) return '$40–$50';
    if (total <= 100) return '$50–$100';
    if (total <= 200) return '$100–$200';
    if (total <= 300) return '$200–$300';
    if (total <= 400) return '$300–$400';
    if (total <= 500) return '$400–$500';
    return 'Over $500';
  };

  const goBack = () => {
    if (order) {
      router.push({ pathname: '/customer/orders', params: { customerId: order.customer_id } });
    } else {
      router.back();
    }
  };

  const isDelivered = order?.status === 'delivered';
  const iconShadow = iconPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] });

  if (loading) {
    return (
      <View style={[r.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[r.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 16 }}>Order not found</Text>
        <TouchableOpacity
          style={[r.fallbackBtn, { backgroundColor: ACCENT_DIM, borderColor: ACCENT_BORDER }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const grandTotal = order.total_amount + order.delivery_fee;

  return (
    <View style={[r.container, { backgroundColor: colors.background }]}>
      <View style={[r.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[r.backBtn, { backgroundColor: colors.card, borderColor: ACCENT_BORDER }]}
          onPress={goBack}
        >
          <ArrowLeft size={20} color={ACCENT} />
        </TouchableOpacity>
        <Text style={[r.headerTitle, { color: colors.text }]}>Receipt</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        <View style={r.heroSection}>
          <Animated.View style={[r.heroIconWrap, {
            backgroundColor: colors.card,
            borderColor: ACCENT_BORDER,
            shadowColor: isDelivered ? GREEN : ACCENT,
            shadowOpacity: iconShadow, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
          }]}>
            <FileText size={34} color={isDelivered ? GREEN : ACCENT} />
          </Animated.View>
          <Text style={[r.heroTitle, { color: colors.text }]}>Order Receipt</Text>
          <View style={[r.statusBadge, {
            backgroundColor: isDelivered ? GREEN_DIM : ACCENT_DIM,
            borderColor: isDelivered ? GREEN + '55' : ACCENT + '55',
          }]}>
            {isDelivered
              ? <CheckCircle size={12} color={GREEN} />
              : <Clock size={12} color={ACCENT} />}
            <Text style={[r.statusBadgeText, { color: isDelivered ? GREEN : ACCENT }]}>
              {isDelivered ? 'Delivered' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Text>
          </View>
        </View>

        {order.payment_option === 'ecocash' && !order.payment_received && (
          <View style={[r.alertBox, { backgroundColor: AMBER_DIM, borderColor: AMBER + '44' }]}>
            <AlertCircle size={16} color={AMBER} />
            <Text style={[r.alertText, { color: AMBER }]}>Awaiting payment confirmation from driver</Text>
          </View>
        )}

        {order.payment_option === 'ecocash' && order.payment_received && (
          <View style={[r.successBox, { backgroundColor: GREEN_DIM, borderColor: GREEN + '44' }]}>
            <CheckCircle size={16} color={GREEN} />
            <Text style={[r.successText, { color: GREEN }]}>Payment received and confirmed</Text>
          </View>
        )}

        <View style={[r.card, { backgroundColor: colors.card, borderColor: ACCENT_BORDER, shadowColor: ACCENT }]}>
          <View style={[r.cardTopLine, { backgroundColor: ACCENT }]} />

          <View style={r.cardSection}>
            <View style={r.sectionHeadRow}>
              <Clock size={14} color={ACCENT} />
              <Text style={[r.sectionHead, { color: ACCENT }]}>Order Info</Text>
            </View>
            <View style={r.infoRow}>
              <Text style={[r.infoLabel, { color: colors.textTertiary }]}>Order ID</Text>
              <Text style={[r.infoVal, { color: colors.text }]} numberOfLines={1}>{order.id.slice(0, 14)}…</Text>
            </View>
            <View style={r.infoRow}>
              <Text style={[r.infoLabel, { color: colors.textTertiary }]}>Placed</Text>
              <Text style={[r.infoVal, { color: colors.text }]}>{new Date(order.created_at).toLocaleString()}</Text>
            </View>
            {order.accepted_at && (
              <View style={r.infoRow}>
                <Text style={[r.infoLabel, { color: colors.textTertiary }]}>Accepted</Text>
                <Text style={[r.infoVal, { color: colors.text }]}>{new Date(order.accepted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            )}
            {order.delivered_at && (
              <View style={r.infoRow}>
                <Text style={[r.infoLabel, { color: colors.textTertiary }]}>Delivered</Text>
                <Text style={[r.infoVal, { color: colors.text }]}>{new Date(order.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            )}
          </View>

          <View style={[r.divider, { backgroundColor: colors.divider }]} />

          <View style={r.cardSection}>
            <View style={r.sectionHeadRow}>
              <User size={14} color={ACCENT} />
              <Text style={[r.sectionHead, { color: ACCENT }]}>Customer</Text>
            </View>
            {order.customers && (
              <>
                <View style={r.infoRow}>
                  <Text style={[r.infoLabel, { color: colors.textTertiary }]}>Name</Text>
                  <Text style={[r.infoVal, { color: colors.text }]}>{order.customers.full_name}</Text>
                </View>
                <View style={r.infoRow}>
                  <Text style={[r.infoLabel, { color: colors.textTertiary }]}>Phone</Text>
                  <Text style={[r.infoVal, { color: colors.text }]}>{order.customers.phone_number}</Text>
                </View>
              </>
            )}
          </View>

          <View style={[r.divider, { backgroundColor: colors.divider }]} />

          <View style={r.cardSection}>
            <View style={r.sectionHeadRow}>
              <Car size={14} color={ACCENT} />
              <Text style={[r.sectionHead, { color: ACCENT }]}>Driver</Text>
            </View>
            {order.drivers ? (
              <>
                <View style={r.infoRow}>
                  <Text style={[r.infoLabel, { color: colors.textTertiary }]}>Name</Text>
                  <Text style={[r.infoVal, { color: colors.text }]}>{order.drivers.full_name}</Text>
                </View>
                <View style={[r.chatTip, { backgroundColor: ACCENT_DIM, borderColor: ACCENT_BORDER }]}>
                  <MessageSquare size={12} color={ACCENT} />
                  <Text style={[r.chatTipText, { color: colors.textSecondary }]}>Use the chat to communicate about delivery details or instructions.</Text>
                </View>
              </>
            ) : (
              <Text style={[r.unassignedText, { color: colors.textTertiary }]}>Not yet assigned</Text>
            )}
          </View>

          <View style={[r.divider, { backgroundColor: colors.divider }]} />

          <View style={r.cardSection}>
            <View style={r.sectionHeadRow}>
              <Package size={14} color={ACCENT} />
              <Text style={[r.sectionHead, { color: ACCENT }]}>Items</Text>
            </View>
            {order.items.map((item: any, i: number) => (
              <View key={i} style={r.itemRow}>
                <View style={[r.itemDot, { backgroundColor: ACCENT }]} />
                <Text style={[r.itemName, { color: colors.text }]} numberOfLines={2}>{item.name} ×{item.quantity}</Text>
                <Text style={[r.itemAmt, { color: colors.textSecondary }]}>${(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
          </View>

          <View style={[r.divider, { backgroundColor: colors.divider }]} />

          <View style={r.cardSection}>
            <View style={r.sectionHeadRow}>
              <DollarSign size={14} color={ACCENT} />
              <Text style={[r.sectionHead, { color: ACCENT }]}>Summary</Text>
            </View>
            <View style={r.infoRow}>
              <Text style={[r.infoLabel, { color: colors.textTertiary }]}>Subtotal</Text>
              <Text style={[r.infoVal, { color: colors.text }]}>${order.total_amount.toFixed(2)}</Text>
            </View>
            <View style={r.infoRow}>
              <Text style={[r.infoLabel, { color: colors.textTertiary }]}>Delivery Fee ({getCommissionTier(order.total_amount)})</Text>
              <Text style={[r.infoVal, { color: colors.text }]}>${order.delivery_fee.toFixed(2)}</Text>
            </View>
            <View style={[r.totalRow, { borderTopColor: colors.divider }]}>
              <Text style={[r.totalLabel, { color: colors.text }]}>Total</Text>
              <Text style={[r.totalValue, { color: ACCENT }]}>${grandTotal.toFixed(2)}</Text>
            </View>
          </View>

          <View style={[r.divider, { backgroundColor: colors.divider }]} />

          <View style={r.cardSection}>
            <View style={r.sectionHeadRow}>
              <CreditCard size={14} color={ACCENT} />
              <Text style={[r.sectionHead, { color: ACCENT }]}>Payment</Text>
            </View>
            <View style={r.infoRow}>
              <Text style={[r.infoLabel, { color: colors.textTertiary }]}>Method</Text>
              <View style={[r.payMethodBadge, {
                backgroundColor: order.payment_option === 'ecocash' ? AMBER_DIM : GREEN_DIM,
                borderColor: order.payment_option === 'ecocash' ? AMBER + '55' : GREEN + '55',
              }]}>
                <Text style={[r.payMethodText, { color: order.payment_option === 'ecocash' ? AMBER : GREEN }]}>
                  {order.payment_option === 'pay_on_delivery' ? 'Cash on Delivery' : 'EcoCash'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {isDelivered && order.driver_id && !hasRated && (
          <GlowRatingButton
            onPress={() => setShowRatingModal(true)}
            label="Rate Your Driver"
            icon={<Star size={16} color={GREEN} />}
            color={GREEN}
            dim={GREEN_DIM}
          />
        )}

        {isDelivered && hasRated && (
          <View style={[r.ratedBox, { backgroundColor: GREEN_DIM, borderColor: GREEN + '44' }]}>
            <CheckCircle size={16} color={GREEN} />
            <Text style={[r.ratedText, { flex: 1, color: GREEN }]}>Thank you for your feedback!</Text>
            <TouchableOpacity
              style={[r.deleteReviewBtn, { backgroundColor: RED_DIM, borderColor: RED + '44' }]}
              onPress={() => setShowDeleteConfirm(true)}
              activeOpacity={0.8}
            >
              <Trash2 size={14} color={RED} />
              <Text style={[r.deleteReviewText, { color: RED }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={showRatingModal} transparent animationType="fade" onRequestClose={() => setShowRatingModal(false)}>
        <View style={[r.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)' }]}>
          <View style={[r.modalBox, { backgroundColor: colors.card, borderColor: ACCENT_BORDER, shadowColor: ACCENT }]}>
            <View style={[r.modalTopLine, { backgroundColor: ACCENT }]} />
            <Text style={[r.modalTitle, { color: colors.text }]}>Rate Your Driver</Text>
            <Text style={[r.modalSubtitle, { color: colors.textSecondary }]}>{order?.drivers?.full_name || 'Your driver'}</Text>

            <View style={r.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} style={{ padding: 4 }}>
                  <Star
                    size={36}
                    color={star <= rating ? '#FFD700' : colors.textTertiary}
                    fill={star <= rating ? '#FFD700' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[r.reviewInput, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Share your experience (optional)"
              placeholderTextColor={colors.placeholder}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
            />

            <View style={r.modalBtns}>
              <TouchableOpacity
                style={[r.modalCancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => { setShowRatingModal(false); setRating(0); setReviewText(''); }}
              >
                <Text style={[r.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[r.modalSubmitBtn, { backgroundColor: GREEN_DIM, borderColor: GREEN + '55', opacity: rating === 0 || submittingRating ? 0.5 : 1 }]}
                onPress={submitRating}
                disabled={rating === 0 || submittingRating}
              >
                {submittingRating
                  ? <ActivityIndicator size="small" color={GREEN} />
                  : <Text style={[r.modalSubmitText, { color: GREEN }]}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={[r.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)' }]}>
          <View style={[r.modalBox, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: RED }]}>
            <View style={[r.modalTopLine, { backgroundColor: RED }]} />
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: RED_DIM, borderWidth: 1, borderColor: RED + '44', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Trash2 size={26} color={RED} />
              </View>
              <Text style={[r.modalTitle, { color: colors.text }]}>Remove Review?</Text>
              <Text style={[r.modalSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>This will permanently delete your review. You can rate the driver again after removing it.</Text>
            </View>
            <View style={r.modalBtns}>
              <TouchableOpacity
                style={[r.modalCancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={[r.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[r.modalSubmitBtn, { backgroundColor: RED_DIM, borderColor: RED + '55', opacity: deletingRating ? 0.5 : 1 }]}
                onPress={deleteRating}
                disabled={deletingRating}
              >
                {deletingRating
                  ? <ActivityIndicator size="small" color={RED} />
                  : <Text style={[r.modalSubmitText, { color: RED }]}>Remove</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const r = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 0.4 },

  fallbackBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1,
  },

  heroSection: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  heroIconWrap: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: 0.4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  alertBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, marginBottom: 12, borderRadius: 10,
    borderWidth: 1,
  },
  alertText: { flex: 1, fontSize: 12, fontWeight: '600' },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, marginBottom: 12, borderRadius: 10,
    borderWidth: 1,
  },
  successText: { flex: 1, fontSize: 12, fontWeight: '600' },

  card: {
    borderRadius: 16, borderWidth: 1,
    overflow: 'hidden', marginBottom: 16,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  cardTopLine: { height: 2, opacity: 0.35 },
  cardSection: { padding: 16, gap: 10 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sectionHead: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  divider: { height: 1, marginHorizontal: 16 },

  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  infoLabel: { fontSize: 12, flex: 1 },
  infoVal: { fontSize: 12, fontWeight: '600', flex: 1.5, textAlign: 'right' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemDot: { width: 4, height: 4, borderRadius: 2, flexShrink: 0 },
  itemName: { flex: 1, fontSize: 12 },
  itemAmt: { fontSize: 12, fontWeight: '600' },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, marginTop: 4, borderTopWidth: 1,
  },
  totalLabel: { fontSize: 14, fontWeight: '800' },
  totalValue: { fontSize: 18, fontWeight: '800' },

  payMethodBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  payMethodText: { fontSize: 11, fontWeight: '700' },

  chatTip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 10, borderRadius: 8,
    borderWidth: 1,
  },
  chatTipText: { flex: 1, fontSize: 11, lineHeight: 16 },
  unassignedText: { fontSize: 12, fontStyle: 'italic' },

  ratedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, marginBottom: 12,
    borderWidth: 1,
  },
  ratedText: { fontSize: 14, fontWeight: '700' },
  deleteReviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1,
  },
  deleteReviewText: { fontSize: 11, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalBox: {
    borderRadius: 20, borderWidth: 1,
    padding: 24, width: '100%', maxWidth: 400, overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  modalTopLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.45 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 20 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  reviewInput: {
    borderRadius: 10, padding: 12,
    fontSize: 13, minHeight: 90, textAlignVertical: 'top',
    borderWidth: 1, marginBottom: 20,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalSubmitBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, alignItems: 'center',
  },
  modalSubmitText: { fontSize: 14, fontWeight: '800' },
});
