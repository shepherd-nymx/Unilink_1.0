import { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { X, MapPin, Store, CreditCard, Plus, Minus, BadgeCheck, Clock, PackageCheck, CircleAlert as AlertCircle, Star, Tag, GraduationCap, Truck } from 'lucide-react-native';
import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Shop, Product, ThemePalette, computeShopOpen, formatOperatingHours, formatPaymentMethod, getAcceptedMethods } from './types';

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  customer_name: string;
};

type Props = {
  shop: Shop | null;
  visible: boolean;
  onClose: () => void;
  products: Product[];
  cartQty: (id: string) => number;
  onAdd: (p: Product) => void;
  onRemove: (id: string) => void;
  palette: ThemePalette;
};

export function ShopProfileModal({ shop, visible, onClose, products, cartQty, onAdd, onRemove, palette }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const loadReviews = useCallback(async (shopId: string) => {
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shop_ratings')
        .select('id, rating, review_text, created_at, customers!shop_ratings_customer_id_fkey(full_name)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped: Review[] = (data || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        review_text: r.review_text,
        created_at: r.created_at,
        customer_name: r.customers?.full_name || 'Anonymous',
      }));
      setReviews(mapped);
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && shop) {
      setShowAllReviews(false);
      loadReviews(shop.id);
    }
  }, [visible, shop, loadReviews]);

  if (!shop) return null;
  const open = computeShopOpen(shop);
  const hoursRows = formatOperatingHours(shop.operating_hours);
  const acceptedMethods = getAcceptedMethods(shop);
  const hasCoords = shop.latitude != null && shop.longitude != null;
  const shopProducts = products.filter(p => p.shop_id === shop.id);
  const unavailable = !shop.is_available;
  const avgRating = shop.average_rating != null ? Number(shop.average_rating) : 0;
  const totalRatings = shop.total_ratings || 0;
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  const openMaps = () => {
    if (!hasCoords) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  const renderStars = (rating: number, size: number) => {
    return [1, 2, 3, 4, 5].map(n => (
      <Star
        key={n}
        size={size}
        color="#FFD700"
        fill={n <= rating ? '#FFD700' : 'transparent'}
      />
    ));
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: palette.cardBg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.textPrimary }]} numberOfLines={1}>{shop.name}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }}>
            {shop.logo_url && Platform.OS === 'web' ? (
              <img src={shop.logo_url} style={{ width: '100%', height: 160, borderRadius: 12, objectFit: 'cover' as any, marginBottom: 16 }} alt={shop.name} />
            ) : null}

            <View style={styles.statusRow}>
              <View style={[styles.statusPill, { backgroundColor: open ? `${palette.success}22` : `${palette.error}22` }]}>
                <View style={[styles.dot, { backgroundColor: open ? palette.success : palette.error }]} />
                <Text style={[styles.statusText, { color: open ? palette.success : palette.error }]}>{open ? 'Open now' : 'Closed'}</Text>
              </View>
              {shop.location_verified ? (
                <View style={[styles.verifiedPill, { backgroundColor: `${palette.primary}18` }]}>
                  <BadgeCheck size={13} color={palette.primary} />
                  <Text style={[styles.statusText, { color: palette.primary }]}>Verified Shop</Text>
                </View>
              ) : null}
              {shop.category ? (
                <View style={[styles.verifiedPill, { backgroundColor: `${palette.accent}18` }]}>
                  <Tag size={13} color={palette.accent} />
                  <Text style={[styles.statusText, { color: palette.accent }]}>{shop.category}</Text>
                </View>
              ) : null}
              {shop.offers_free_delivery ? (
                <View style={[styles.verifiedPill, { backgroundColor: `${palette.success}18`, borderColor: palette.success, borderWidth: 1 }]}>
                  <Truck size={13} color={palette.success} />
                  <Text style={[styles.statusText, { color: palette.success }]}>Free Delivery</Text>
                </View>
              ) : null}
              {shop.is_student_owned ? (
                <View style={[styles.verifiedPill, { backgroundColor: `${palette.accent}15`, borderColor: palette.accent, borderWidth: 1 }]}>
                  <GraduationCap size={13} color={palette.accent} />
                  <Text style={[styles.statusText, { color: palette.accent }]}>Student Owned</Text>
                </View>
              ) : null}
            </View>

            {unavailable ? (
              <View style={[styles.unavailBox, { backgroundColor: `${palette.error}15`, borderColor: `${palette.error}55` }]}>
                <AlertCircle size={14} color={palette.error} />
                <Text style={[styles.unavailBoxText, { color: palette.error }]}>This shop is currently unavailable for ordering.</Text>
              </View>
            ) : null}

            {shop.description ? (
              <Text style={[styles.description, { color: palette.textPrimary }]}>{shop.description}</Text>
            ) : null}

            {shop.address ? (
              <View style={styles.infoBlock}>
                <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>ADDRESS</Text>
                <Text style={[styles.addressText, { color: palette.textPrimary }]}>{shop.address}</Text>
                {shop.location ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <MapPin size={12} color={palette.primary} />
                    <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '600' }}>{shop.location}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.mapBtn, { backgroundColor: hasCoords ? palette.success : palette.inputBg, borderColor: hasCoords ? palette.success : palette.cardBorder }]}
              onPress={openMaps}
              disabled={!hasCoords}
              activeOpacity={0.85}
            >
              <MapPin size={16} color={hasCoords ? '#fff' : palette.placeholderColor} />
              <Text style={[styles.mapBtnText, { color: hasCoords ? '#fff' : palette.placeholderColor }]}>
                {hasCoords ? 'View Shop Location' : 'Location not available'}
              </Text>
            </TouchableOpacity>

            {hoursRows.length > 0 ? (
              <View style={styles.infoBlock}>
                <View style={styles.infoHeaderRow}>
                  <Clock size={14} color={palette.primary} />
                  <Text style={[styles.infoLabel, { color: palette.textSecondary, marginBottom: 0 }]}>OPERATING HOURS</Text>
                </View>
                {hoursRows.map(r => (
                  <View key={r.day} style={styles.hoursRow}>
                    <Text style={[styles.hoursDay, { color: palette.textPrimary }]}>{r.day}</Text>
                    <Text style={[styles.hoursLabel, { color: palette.textSecondary }]}>{r.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.infoBlock}>
              <View style={styles.infoHeaderRow}>
                <CreditCard size={14} color={palette.primary} />
                <Text style={[styles.infoLabel, { color: palette.textSecondary, marginBottom: 0 }]}>PAYMENT METHODS</Text>
              </View>
              <View style={styles.payRow}>
                {acceptedMethods.map(m => (
                  <View key={m} style={[styles.payBadge, { backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}40` }]}>
                    <Text style={[styles.payBadgeText, { color: palette.primary }]}>{formatPaymentMethod(m)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {shop.completed_orders_count != null && shop.completed_orders_count > 0 ? (
              <View style={[styles.ordersPill, { backgroundColor: `${palette.accent}15` }]}>
                <PackageCheck size={14} color={palette.accent} />
                <Text style={[styles.ordersPillText, { color: palette.accent }]}>{shop.completed_orders_count} completed orders</Text>
              </View>
            ) : null}

            {avgRating > 0 ? (
              <View style={[styles.ratingSummary, { backgroundColor: '#FFD70015', borderColor: '#FFD70040' }]}>
                <View style={styles.ratingSummaryLeft}>
                  <Text style={styles.ratingBigNumber}>{avgRating.toFixed(1)}</Text>
                  <View style={styles.ratingStarsRow}>
                    {renderStars(Math.round(avgRating), 14)}
                  </View>
                  <Text style={[styles.ratingCount, { color: palette.textSecondary }]}>{totalRatings} {totalRatings === 1 ? 'review' : 'reviews'}</Text>
                </View>
              </View>
            ) : null}

            {/* Reviews section */}
            <View style={[styles.reviewsSection, { borderTopColor: palette.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: palette.textSecondary, marginTop: 0 }]}>CUSTOMER REVIEWS</Text>

              {reviewsLoading ? (
                <View style={styles.reviewsLoading}>
                  <ActivityIndicator size="small" color={palette.primary} />
                </View>
              ) : displayedReviews.length === 0 ? (
                <Text style={[styles.noReviews, { color: palette.textSecondary }]}>
                  {avgRating > 0 ? 'No written reviews yet.' : 'No reviews yet. Be the first to review after placing an order!'}
                </Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {displayedReviews.map(review => (
                    <View key={review.id} style={[styles.reviewCard, { backgroundColor: palette.inputBg, borderColor: palette.cardBorder }]}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewAvatar}>
                          <Text style={styles.reviewAvatarText}>
                            {review.customer_name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.reviewName, { color: palette.textPrimary }]} numberOfLines={1}>{review.customer_name}</Text>
                          <Text style={[styles.reviewDate, { color: palette.textSecondary }]}>{formatDate(review.created_at)}</Text>
                        </View>
                      </View>
                      <View style={styles.reviewStars}>
                        {renderStars(review.rating, 13)}
                      </View>
                      {review.review_text ? (
                        <Text style={[styles.reviewText, { color: palette.textPrimary }]}>{review.review_text}</Text>
                      ) : null}
                    </View>
                  ))}

                  {reviews.length > 3 && !showAllReviews ? (
                    <TouchableOpacity
                      style={[styles.seeAllBtn, { borderColor: palette.primary }]}
                      onPress={() => setShowAllReviews(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.seeAllText, { color: palette.primary }]}>See all {reviews.length} reviews</Text>
                    </TouchableOpacity>
                  ) : null}

                  {showAllReviews && reviews.length > 3 ? (
                    <TouchableOpacity
                      style={[styles.seeAllBtn, { borderColor: palette.primary }]}
                      onPress={() => setShowAllReviews(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.seeAllText, { color: palette.primary }]}>Show less</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>

            <Text style={[styles.sectionTitle, { color: palette.textSecondary, marginTop: 16 }]}>PRODUCTS</Text>
            {shopProducts.length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 13, paddingVertical: 16 }}>No products available</Text>
            ) : (
              shopProducts.map(p => {
                const qty = cartQty(p.id);
                const pOutOfStock = p.stock <= 0;
                const pDisabled = pOutOfStock || unavailable;
                return (
                  <View key={p.id} style={[styles.productRow, { borderBottomColor: palette.cardBorder }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.textPrimary, fontSize: 14 }}>{p.name}</Text>
                      <Text style={{ color: palette.primary, fontSize: 14, fontWeight: '700' }}>${Number(p.price).toFixed(2)}</Text>
                      {pOutOfStock ? <Text style={{ color: palette.error, fontSize: 11, marginTop: 2 }}>Out of stock</Text> : null}
                    </View>
                    {pDisabled ? (
                      <Text style={{ color: palette.textSecondary, fontSize: 11 }}>{pOutOfStock ? 'Unavailable' : 'Shop closed'}</Text>
                    ) : qty > 0 ? (
                      <View style={styles.qtyControl}>
                        <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: palette.accent }]} onPress={() => onRemove(p.id)}>
                          <Minus size={14} color="#fff" />
                        </TouchableOpacity>
                        <Text style={[styles.qtyText, { color: palette.textPrimary }]}>{qty}</Text>
                        <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: palette.accent }]} onPress={() => onAdd(p)} disabled={qty >= p.stock}>
                          <Plus size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={[styles.addBtn, { backgroundColor: palette.primary }]} onPress={() => onAdd(p)}>
                        <Plus size={14} color="#fff" />
                        <Text style={styles.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  content: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  unavailBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  unavailBoxText: { fontSize: 12, fontWeight: '600', flex: 1 },
  description: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  infoBlock: { marginBottom: 14 },
  infoHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  infoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  addressText: { fontSize: 14, lineHeight: 20 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 14 },
  mapBtnText: { fontSize: 14, fontWeight: '700' },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.15)' },
  hoursDay: { fontSize: 13, fontWeight: '500' },
  hoursLabel: { fontSize: 13 },
  payRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  payBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  payBadgeText: { fontSize: 12, fontWeight: '600' },
  ordersPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start' },
  ordersPillText: { fontSize: 12, fontWeight: '700' },
  ratingSummary: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  ratingSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingBigNumber: { fontSize: 28, fontWeight: '800', color: '#FFD700' },
  ratingStarsRow: { flexDirection: 'row', gap: 2 },
  ratingCount: { fontSize: 12, fontWeight: '600' },
  reviewsSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginBottom: 8 },
  reviewsLoading: { paddingVertical: 20, alignItems: 'center' },
  noReviews: { fontSize: 13, paddingVertical: 12, fontStyle: 'italic' },
  reviewCard: { borderRadius: 10, borderWidth: 1, padding: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066ff', justifyContent: 'center', alignItems: 'center' },
  reviewAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  reviewName: { fontSize: 13, fontWeight: '700' },
  reviewDate: { fontSize: 11, marginTop: 1 },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 6 },
  reviewText: { fontSize: 13, lineHeight: 20 },
  seeAllBtn: { paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  seeAllText: { fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 26, height: 26, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 13, fontWeight: '700', minWidth: 16, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
