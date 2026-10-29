import { TouchableOpacity, View, Text, Platform, StyleSheet, Linking } from 'react-native';
import { Store, BadgeCheck, PackageCheck, MapPin, Star, Award, GraduationCap, Truck } from 'lucide-react-native';
import { Shop, ThemePalette, computeShopOpen } from './types';

type Props = {
  shop: Shop;
  palette: ThemePalette;
  onPress: () => void;
};

export function ShopCard({ shop, palette, onPress }: Props) {
  const open = computeShopOpen(shop);
  const unavailable = !shop.is_available;
  const orders = shop.completed_orders_count ?? 0;
  const hasCoords = shop.latitude != null && shop.longitude != null;

  const openInMaps = (e: any) => {
    e.stopPropagation?.();
    if (!hasCoords) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`).catch(() => {});
  };

  return (
    <TouchableOpacity
      style={[styles.shopCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }, unavailable && { opacity: 0.5 }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.shopLogo, { backgroundColor: palette.inputBg }]}>
        {shop.logo_url && Platform.OS === 'web' ? (
          <img src={shop.logo_url} style={{ width: 48, height: 48, borderRadius: 24, objectFit: 'cover' as any }} alt={shop.name} />
        ) : (
          <Store size={24} color={palette.primary} />
        )}
      </View>

      <View style={styles.badgeRow}>
        <View style={[styles.availBadge, { backgroundColor: open ? `${palette.success}22` : `${palette.error}22` }]}>
          <View style={[styles.dot, { backgroundColor: open ? palette.success : palette.error }]} />
          <Text style={[styles.badgeText, { color: open ? palette.success : palette.error }]} numberOfLines={1}>{open ? 'Open' : 'Closed'}</Text>
        </View>
        {shop.location_verified ? (
          <View style={[styles.verifiedBadge, { backgroundColor: `${palette.primary}18` }]}>
            <BadgeCheck size={11} color={palette.primary} />
            <Text style={[styles.badgeText, { color: palette.primary }]} numberOfLines={1}>Verified</Text>
          </View>
        ) : null}
        {shop.offers_free_delivery ? (
          <View style={[styles.freeDeliveryBadge, { backgroundColor: `${palette.success}18`, borderColor: palette.success }]}>
            <Truck size={11} color={palette.success} />
            <Text style={[styles.badgeText, { color: palette.success }]} numberOfLines={1}>Free Delivery</Text>
          </View>
        ) : null}
        {shop.is_student_owned ? (
          <View style={[styles.studentOwnedBadge, { backgroundColor: `${palette.accent}18`, borderColor: palette.accent }]}>
            <GraduationCap size={11} color={palette.accent} />
            <Text style={[styles.badgeText, { color: palette.accent }]} numberOfLines={1}>Student Owned</Text>
          </View>
        ) : null}
        {shop.premium_badge ? (
          <View style={[styles.premiumBadge, {
            backgroundColor: shop.premium_badge === 'platinum' ? 'rgba(229,228,226,0.18)' :
              shop.premium_badge === 'blue' ? 'rgba(59,130,246,0.18)' :
              'rgba(34,197,94,0.18)',
            borderColor: shop.premium_badge === 'platinum' ? '#e5e4e2' :
              shop.premium_badge === 'blue' ? '#3b82f6' : '#22c55e',
          }]}>
            <Award size={11} color={
              shop.premium_badge === 'platinum' ? '#e5e4e2' :
              shop.premium_badge === 'blue' ? '#3b82f6' : '#22c55e'
            } />
            <Text style={[styles.badgeText, {
              color: shop.premium_badge === 'platinum' ? '#e5e4e2' :
                shop.premium_badge === 'blue' ? '#3b82f6' : '#22c55e',
            }]} numberOfLines={1}>{shop.premium_badge === 'platinum' ? 'Platinum' : shop.premium_badge === 'blue' ? 'Blue' : 'Green'}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.shopName, { color: palette.textPrimary }]} numberOfLines={1}>{shop.name}</Text>

      {orders > 0 ? (
        <View style={styles.ordersRow}>
          <PackageCheck size={11} color={palette.textSecondary} />
          <Text style={[styles.ordersText, { color: palette.textSecondary }]}>{orders} orders</Text>
        </View>
      ) : null}

      {shop.average_rating != null && Number(shop.average_rating) > 0 ? (
        <View style={styles.ordersRow}>
          <Star size={11} color="#FFD700" fill="#FFD700" />
          <Text style={[styles.ordersText, { color: palette.textSecondary }]}>
            {Number(shop.average_rating).toFixed(1)} ({shop.total_ratings || 0})
          </Text>
        </View>
      ) : null}

      {shop.hours ? (
        <Text style={[styles.shopHours, { color: palette.textSecondary }]} numberOfLines={1}>{shop.hours}</Text>
      ) : null}

      {hasCoords ? (
        <TouchableOpacity
          style={[styles.locationBtn, { backgroundColor: `${palette.primary}12`, borderColor: `${palette.primary}30` }]}
          onPress={openInMaps}
          activeOpacity={0.7}
        >
          <MapPin size={11} color={palette.primary} />
          <Text style={[styles.locationBtnText, { color: palette.primary }]}>View Location</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shopCard: { width: 130, borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  shopLogo: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', overflow: 'hidden' as any },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, flexShrink: 1, maxWidth: '100%' as any },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 9, fontWeight: '700', flexShrink: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, flexShrink: 1 },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1, flexShrink: 1 },
  freeDeliveryBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1, flexShrink: 1 },
  studentOwnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1, flexShrink: 1 },
  shopName: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  ordersRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ordersText: { fontSize: 10 },
  shopHours: { fontSize: 10 },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, marginTop: 2 },
  locationBtnText: { fontSize: 9, fontWeight: '700' },
});
