import { useCallback, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, CheckCircle2, ChevronRight, Home, MapPin, ShoppingBag, ShoppingCart, Store, Truck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { shopServesLocation } from '@/lib/shop-location-visibility';
import { SkeletonBlock, SkeletonGroup } from '@/components/Skeleton';

type FeaturedShop = { id: string; name: string; logo_url: string | null; is_available: boolean; location_verified: boolean | null };
const slides = [
  { title: 'Anything from town,', accent: 'delivered.', detail: "Can't find it in nearby shops? List your items and we'll shop for you.", action: 'Create shopping list', target: 'list' },
  { title: 'Your shopping,', accent: 'your way.', detail: 'Add what you need, set your estimate, and talk to your messenger.', action: 'Add custom items', target: 'list' },
  { title: 'Find your next', accent: 'favourite shop.', detail: 'Browse the shops that serve your saved location, all in one place.', action: 'Explore nearby shops', target: 'shops' },
] as const;

type Props = {
  customerId?: string; messengerCount: number; onCreateList: () => void;
  onBrowseShops: () => void; onShop: (id: string) => void; onProfile: () => void;
};

export function NearbyShopsAction({ onPress }: { onPress: () => void }) {
  const { isDark } = useTheme();
  const ink = isDark ? '#032135' : '#fff';
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Nearby shops"
    accessibilityHint="Browse shops and products that serve your location" onPress={onPress} activeOpacity={0.85}
    style={{ marginHorizontal: isDark ? 16 : 20, marginTop: 12, marginBottom: 8, borderRadius: 18, overflow: 'hidden', shadowColor: isDark ? '#00d8ef' : '#0066ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 4 }}>
    <LinearGradient colors={isDark ? ['#00e2ee', '#00b6ee'] : ['#0066ff', '#0052d4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ minHeight: 76, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: isDark ? 'rgba(3,33,53,0.12)' : 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' }}><ShoppingBag size={25} color={ink}/></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: ink, fontSize: 17, fontWeight: '800' }}>Nearby shops</Text><Text style={{ color: isDark ? '#164058' : '#e0ecff', fontSize: 12, marginTop: 4 }}>Find your next favourite shop</Text></View>
      <ChevronRight size={23} color={ink}/>
    </LinearGradient>
  </TouchableOpacity>;
}

export default function CustomerHomeSections({ customerId, messengerCount, onCreateList, onBrowseShops, onShop, onProfile }: Props) {
  const { isDark } = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const carousel = useRef<ScrollView>(null);
  const [bannerWidth, setBannerWidth] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [shops, setShops] = useState<FeaturedShop[]>([]);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const accent = isDark ? '#00d8ef' : '#0066ff';
  const text = isDark ? '#e5f1fc' : '#13223a';
  const muted = isDark ? '#9cb3c9' : '#64748b';
  const panel = { backgroundColor: isDark ? '#071727' : '#fff', borderColor: isDark ? '#123b52' : '#dfe7f3' };

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true); setError(false);
    void (async () => {
      try {
        if (!customerId) { if (!cancelled) { setShops([]); setLocationName(''); } return; }
        const [customerResult, shopResult] = await Promise.all([
          supabase.from('customers').select('university_id').eq('id', customerId).maybeSingle(),
          supabase.from('shops').select('id,name,logo_url,is_available,location_verified').eq('status', 'active').order('name'),
        ]);
        if (customerResult.error) throw customerResult.error;
        if (shopResult.error) throw shopResult.error;
        const availableShops = (shopResult.data || []) as FeaturedShop[];
        const universityId = customerResult.data?.university_id;
        if (!universityId) { if (!cancelled) { setShops([]); setLocationName(''); } return; }
        const [locationResult, serviceResult] = await Promise.all([
          supabase.from('universities').select('name').eq('id', universityId).maybeSingle(),
          availableShops.length ? supabase.from('shop_service_locations').select('shop_id,location_name').in('shop_id', availableShops.map(shop => shop.id)) : Promise.resolve({ data: [], error: null }),
        ]);
        if (locationResult.error) throw locationResult.error;
        if (serviceResult.error) throw serviceResult.error;
        const name = locationResult.data?.name || '';
        const services: Record<string, { location_name: string }[]> = {};
        for (const service of serviceResult.data || []) (services[service.shop_id] ||= []).push(service);
        const visible = availableShops.filter(shop => shopServesLocation(services[shop.id], name))
          .sort((a, b) => Number(b.is_available) - Number(a.is_available)).slice(0, 3);
        if (!cancelled) { setShops(visible); setLocationName(name); setFailedLogos(new Set()); }
      } catch { if (!cancelled) { setError(true); setShops([]); setLocationName(''); } }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [customerId, retry]));

  return <View testID="customer-home-sections" style={[s.sections, { marginHorizontal: isDark ? 16 : 20 }]}>
    <View style={{ minHeight: (viewportWidth >= 1000 ? 208 : 170) + 21 }} onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0 && next !== bannerWidth) { setBannerWidth(next); setActiveSlide(0); carousel.current?.scrollTo({ x: 0, animated: false }); } }}>
      {bannerWidth > 0 && <ScrollView ref={carousel} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={event => setActiveSlide(Math.max(0, Math.min(slides.length - 1, Math.round(event.nativeEvent.contentOffset.x / bannerWidth))))}
        style={s.bannerFrame}>
        {slides.map((slide, index) => <View key={slide.title} style={[s.banner, { width: bannerWidth, height: viewportWidth >= 1000 ? 208 : 170 }]}>
          <Image source={require('@/assets/images/customer-dashboard/grocery-banner.png')} style={s.bannerImage} resizeMode="cover" accessible={false}/>
          <LinearGradient colors={isDark ? ['rgba(43,28,94,0.98)', 'rgba(5,37,81,0.85)', 'rgba(0,65,100,0)'] : ['rgba(228,240,255,1)', 'rgba(228,240,255,0.95)', 'rgba(228,240,255,0)']} locations={[0,0.48,1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill}/>
          <View style={s.bannerCopy}>
            <Text style={[s.bannerTitle, { color: isDark ? '#fff' : '#112b4e', fontSize: viewportWidth >= 1000 ? 28 : viewportWidth < 360 ? 17 : 19 }]}>{slide.title}{'\n'}<Text style={{ color: isDark ? '#00efff' : '#0066ff' }}>{slide.accent}</Text></Text>
            <Text style={[s.bannerDetail, { color: isDark ? '#d0d9f2' : '#385779' }]} numberOfLines={2}>{slide.detail}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={slide.action} hitSlop={6} onPress={slide.target === 'list' ? onCreateList : onBrowseShops} style={[s.bannerButton, { backgroundColor: isDark ? '#00d8ef' : '#0066ff' }]}>
              <Text style={[s.bannerButtonText, { color: isDark ? '#032135' : '#fff' }]}>{slide.action}</Text><ArrowRight size={13} color={isDark ? '#032135' : '#fff'}/>
            </TouchableOpacity>
          </View>
        </View>)}
      </ScrollView>}
      <View style={s.dots}>{slides.map((slide, index) => <TouchableOpacity key={slide.title} accessibilityRole="button" accessibilityLabel={`Show banner ${index + 1}`} accessibilityState={{ selected: activeSlide === index }} hitSlop={8}
        onPress={() => { setActiveSlide(index); carousel.current?.scrollTo({ x: index * bannerWidth, animated: false }); }} style={s.dotButton}><View style={[s.dot, { backgroundColor: index === activeSlide ? accent : isDark ? '#45607f' : '#c8d5e6' }]}/></TouchableOpacity>)}</View>
    </View>

    <View style={[s.panel, panel]}>
      <Text style={[s.title, { color: text }]}>Your shopping, simplified</Text>
      <View style={s.steps}>{[{ label: '1. Order', Icon: ShoppingCart }, { label: '2. We shop', Icon: Store }, { label: '3. Delivered', Icon: Home }].map(({ label, Icon }, index) => <View key={label} style={s.stepGroup}>
        {index > 0 && <ArrowRight size={12} color={muted}/>}
        <View style={[s.step, { backgroundColor: isDark ? '#082235' : '#f0f6ff', borderColor: isDark ? '#11506a' : '#dce8ff' }]}><Icon size={16} color={accent}/><Text style={[s.stepText, { color: text }]}>{label}</Text></View>
      </View>)}</View>
      <Text style={[s.tagline, { color: muted }]}>You request it. We find it. We deliver it.</Text>
    </View>

    <View style={[s.panel, s.delivery, panel]}>
      <View style={[s.deliveryIcon, { backgroundColor: isDark ? '#073555' : '#eaf2ff' }]}><Truck size={24} color={accent}/></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={[s.title, { color: text }]}>Today's deliveries</Text>
        <Text style={[s.deliveryDetail, { color: muted }]}>{messengerCount > 0 ? `${messengerCount} messenger${messengerCount === 1 ? '' : 's'} listed for your area` : 'Choose your service and messenger'}</Text>
        {!!locationName && <View style={s.location}><MapPin size={11} color={accent}/><Text style={[s.locationText, { color: muted }]} numberOfLines={1}>{locationName}</Text></View>}
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delivery options unavailable" accessibilityState={{ disabled: true }} disabled style={[s.deliveryButton, { backgroundColor: isDark ? '#254158' : '#d9e1eb', opacity: 0.45 }]}><Text style={[s.deliveryButtonText, { color: muted }]}>Delivery{'\n'}options</Text></TouchableOpacity>
    </View>

    <View style={[s.panel, panel]}>
      <View style={s.sectionHeader}><View style={s.heading}><Store size={17} color={accent}/><Text style={[s.title, { color: text }]}>Featured shops</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="View all shops" onPress={onBrowseShops} hitSlop={8}><Text style={[s.viewAll, { color: accent }]}>View all <Text>→</Text></Text></TouchableOpacity>
      </View>
      {loading ? <View accessibilityRole="progressbar" accessibilityLabel="Loading featured shops" accessibilityState={{ busy: true }}><SkeletonGroup color={isDark ? '#1a344b' : '#e3ebf5'}><View style={s.shopSkeletons}>{[0,1,2,3].map(i => <SkeletonBlock key={i} height={74} borderRadius={12} style={{ flex: 1 }}/>)}</View></SkeletonGroup></View>
        : error ? <View style={s.empty}><Text style={[s.emptyText, { color: muted }]}>Shops couldn't be loaded.</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={[s.viewAll, { color: accent }]}>Retry</Text></TouchableOpacity></View>
        : shops.length === 0 ? <View style={s.empty}><Text style={[s.emptyText, { color: muted }]}>{locationName ? 'No shops are listed for your location yet.' : 'Add your service location in Profile to find shops.'}</Text>{!locationName && <TouchableOpacity accessibilityRole="button" onPress={onProfile}><Text style={[s.viewAll, { color: accent }]}>Update location</Text></TouchableOpacity>}</View>
        : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shopStrip}>
          {shops.map(shop => <TouchableOpacity key={shop.id} accessibilityRole="button" accessibilityLabel={`Browse ${shop.name}`} onPress={() => onShop(shop.id)} style={[s.shop, { width: viewportWidth >= 1000 ? 150 : 76, borderColor: isDark ? '#b7c8da' : '#dce5f0' }]}>
            {shop.logo_url && !failedLogos.has(shop.id) ? <Image source={{ uri: shop.logo_url }} style={s.shopLogo} resizeMode="contain" accessible={false} onError={() => setFailedLogos(previous => new Set(previous).add(shop.id))}/>
              : <View style={s.logoFallback}><Store size={23} color="#0066ff"/></View>}
            <View style={s.shopNameRow}><Text style={s.shopName} numberOfLines={2}>{shop.name}</Text>{shop.location_verified && <CheckCircle2 size={11} color="#00a853" accessibilityLabel="Shop location verified"/>}</View>
          </TouchableOpacity>)}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="More shops" onPress={onBrowseShops} style={[s.shop, { width: viewportWidth >= 1000 ? 150 : 76, backgroundColor: isDark ? '#09243a' : '#f0f6ff', borderColor: isDark ? '#1b4b66' : '#dce5f0' }]}><ShoppingBag size={25} color={accent}/><View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={[s.shopName, { color: text }]} numberOfLines={1}>More shops</Text><ChevronRight size={10} color={accent}/></View></TouchableOpacity>
        </ScrollView>}
    </View>
    <View style={{ alignItems: 'center', gap: 6 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Request delivery" accessibilityState={{ disabled: true }} disabled
        style={[s.nearby, { backgroundColor: isDark ? '#254158' : '#dfe6ee', opacity: 0.45 }]}>
        <Truck size={19} color={muted}/><Text style={[s.nearbyText, { color: muted }]}>Request delivery</Text>
      </TouchableOpacity>
      <Text style={{ color: muted, fontSize: 11 }}>Unavailable for now</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  sections: { gap: 12, marginTop: 8, marginBottom: 16 },
  panel: { padding: 12, borderRadius: 16, borderWidth: 1 },
  bannerFrame: { borderRadius: 16, overflow: 'hidden' }, banner: { justifyContent: 'center', overflow: 'hidden', borderRadius: 16, backgroundColor: '#ddebff' },
  bannerImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  bannerCopy: { width: '64%', padding: 14, gap: 6 }, bannerTitle: { fontWeight: '800', fontStyle: 'italic', letterSpacing: -0.4 },
  bannerDetail: { fontSize: 11, lineHeight: 14 }, bannerButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, minHeight: 32, borderRadius: 18 }, bannerButtonText: { fontSize: 10, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 2, paddingTop: 3 }, dotButton: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }, dot: { width: 6, height: 6, borderRadius: 3 },
  title: { fontSize: 14, fontWeight: '700' }, steps: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }, stepGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }, step: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 9, minHeight: 36, paddingHorizontal: 3 }, stepText: { fontSize: 10, fontWeight: '600', flexShrink: 1, lineHeight: 12 }, tagline: { fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
  delivery: { flexDirection: 'row', alignItems: 'center', gap: 9 }, deliveryIcon: { width: 38, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, deliveryDetail: { fontSize: 10, lineHeight: 14, marginTop: 4 }, location: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }, locationText: { flexShrink: 1, fontSize: 10 }, deliveryButton: { paddingHorizontal: 9, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 10 }, deliveryButtonText: { color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 6 }, viewAll: { fontSize: 11, fontWeight: '700' }, shopStrip: { gap: 8 }, shop: { minHeight: 82, padding: 7, borderRadius: 11, borderWidth: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 5 }, shopLogo: { width: '100%', height: 38 }, logoFallback: { height: 38, alignItems: 'center', justifyContent: 'center' }, shopNameRow: { flexDirection: 'row', alignItems: 'center', gap: 2 }, shopName: { flexShrink: 1, color: '#17263c', fontSize: 10, fontWeight: '700', textAlign: 'center' }, shopSkeletons: { flexDirection: 'row', gap: 8 }, empty: { gap: 8, paddingVertical: 12 }, emptyText: { fontSize: 12, lineHeight: 18 }, nearby: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 22, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 }, nearbyText: { fontSize: 14, fontWeight: '800' },
});
