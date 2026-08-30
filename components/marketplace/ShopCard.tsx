import { TouchableOpacity, View, Text, Platform, StyleSheet } from 'react-native';
import { Store, BadgeCheck, PackageCheck } from 'lucide-react-native';
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
          <Text style={[styles.badgeText, { color: open ? palette.success : palette.error }]}>{open ? 'Open' : 'Closed'}</Text>
        </View>
        {shop.location_verified ? (
          <View style={[styles.verifiedBadge, { backgroundColor: `${palette.primary}18` }]}>
            <BadgeCheck size={11} color={palette.primary} />
            <Text style={[styles.badgeText, { color: palette.primary }]}>Verified</Text>
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

      {shop.hours ? (
        <Text style={[styles.shopHours, { color: palette.textSecondary }]} numberOfLines={1}>{shop.hours}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shopCard: { width: 130, borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  shopLogo: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  shopName: { fontSize: 13, fontWeight: '600' },
  ordersRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ordersText: { fontSize: 10 },
  shopHours: { fontSize: 10 },
});
