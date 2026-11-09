import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Award, BadgeCheck, ChevronRight, GraduationCap, MapPin, Store, Tag, Truck } from 'lucide-react-native';
import { Shop, ThemePalette, computeShopOpen } from './types';

type Props = { shop: Shop; palette: ThemePalette; isDark: boolean; onPress: () => void };

/** Shop-list presentation only. Selection, availability and checkout remain owned by the marketplace. */
export function MarketplaceShopCard({ shop, palette, isDark, onPress }: Props) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const open = shop.operating_hours ? computeShopOpen(shop) : true;
  const tierColor = shop.premium_badge === 'blue' ? '#529aff' : shop.premium_badge === 'green' ? (isDark ? '#62d18d' : '#187a3e') : (isDark ? '#c4cfdb' : '#546479');
  const statusColor = !shop.is_available || !open ? (isDark ? '#ff9292' : '#b42332') : (isDark ? '#62d18d' : '#187a3e');
  const studentColor = isDark ? '#62dfed' : '#087487';
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Browse ${shop.name}`} onPress={onPress} activeOpacity={0.8}
      style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
      <View style={styles.main}>
        <View style={styles.logo}>
          {shop.logo_url && failedLogo !== shop.logo_url ? (
            <Image source={{ uri: shop.logo_url }} resizeMode="contain" style={styles.logoImage} accessibilityLabel={`${shop.name} logo`} onError={() => setFailedLogo(shop.logo_url)} />
          ) : <Store size={30} color={palette.primary} />}
        </View>
        <View style={styles.details}>
          <Text style={[styles.name, { color: palette.textPrimary }]}>{shop.name}</Text>
          {shop.description ? <Text style={[styles.description, { color: palette.textSecondary }]} numberOfLines={2}>{shop.description}</Text> : null}
          <View style={styles.metadata}>
            {shop.category ? <View style={styles.metaItem}><Tag size={12} color={palette.textSecondary} /><Text style={[styles.metaText, { color: palette.textSecondary }]}>{shop.category}</Text></View> : null}
            {shop.location ? <View style={styles.metaItem}><MapPin size={12} color={palette.textSecondary} /><Text style={[styles.metaText, { color: palette.textSecondary }]}>{shop.location}</Text></View> : null}
          </View>
        </View>
      </View>
      <View style={styles.badges}>
        <View style={[styles.pill, { backgroundColor: `${statusColor}15` }]}><View style={[styles.dot, { backgroundColor: statusColor }]} /><Text style={[styles.pillText, { color: statusColor }]}>{!shop.is_available ? 'Unavailable' : open ? 'Open' : 'Closed'}</Text></View>
        {shop.premium_badge ? <View style={[styles.pill, { borderWidth: 1, borderColor: `${tierColor}66` }]}><Award size={12} color={tierColor} /><Text style={[styles.pillText, { color: tierColor }]}>{shop.premium_badge === 'platinum' ? 'Platinum' : shop.premium_badge === 'blue' ? 'Blue' : 'Green'}</Text></View> : null}
        {shop.location_verified ? <View style={styles.pill}><BadgeCheck size={13} color={palette.primary} /><Text style={[styles.pillText, { color: palette.textSecondary }]}>Location verified</Text></View> : null}
        {shop.offers_free_delivery ? <View style={styles.pill}><Truck size={13} color={statusColor} /><Text style={[styles.pillText, { color: palette.textSecondary }]}>Free delivery</Text></View> : null}
      </View>
      <View style={styles.footer}>
        {shop.is_student_owned ? <View style={[styles.student, { borderColor: `${studentColor}66`, backgroundColor: `${studentColor}0a` }]}><GraduationCap size={13} color={studentColor} /><Text style={[styles.pillText, { color: studentColor }]}>Student owned</Text></View> : <View />}
        <View style={[styles.browse, { backgroundColor: palette.primary }]}><Text style={styles.browseText}>Browse shop</Text><ChevronRight size={16} color="#fff" /></View>
      </View>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 14 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: 58, height: 58 },
  details: { flex: 1, minWidth: 0, gap: 5 },
  name: { fontSize: 17, fontWeight: '800', lineHeight: 22, letterSpacing: -0.3 },
  description: { fontSize: 12, lineHeight: 18 },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { fontSize: 11, flexShrink: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  pillText: { fontSize: 10, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  student: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, padding: 7 },
  browse: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, minHeight: 36, borderRadius: 10, marginLeft: 'auto' },
  browseText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
