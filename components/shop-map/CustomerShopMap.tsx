import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ArrowRight, List, LocateFixed, Map, MapPin, RefreshCw, Search, Store, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { filterMapShops, normalizeMapShops, type Coordinates, type MapShop } from '@/lib/shop-map';
import ShopMapCanvas from './ShopMapCanvas';

export default function CustomerShopMap() {
  const { height } = useWindowDimensions();
  const { isDark } = useTheme();
  const router = useRouter();
  const [shops, setShops] = useState<MapShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapError, setMapError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [list, setList] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');
  const [mapVersion, setMapVersion] = useState(0);
  const c = { bg: isDark ? '#0d2038' : '#fff', text: isDark ? '#e5f1fc' : '#102139', muted: isDark ? '#a1bbd5' : '#5e7189', border: isDark ? '#245078' : '#dbe7f5', soft: isDark ? '#16314c' : '#edf5ff' };
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      let request = supabase.from('shops').select('id,name,status,latitude,longitude,address,category,logo_url,description,is_available')
        .eq('status', 'active').not('latitude', 'is', null).not('longitude', 'is', null).order('name');
      if (signal) request = request.abortSignal(signal);
      const { data, error: fetchError } = await request;
      if (signal?.aborted) return;
      if (fetchError) throw fetchError;
      setShops(normalizeMapShops(data || []));
    } catch { if (!signal?.aborted) setError('Could not load shop locations. Please try again.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const visible = useMemo(() => filterMapShops(shops, query, category), [shops, query, category]);
  const categories = useMemo(() => [...new Set(shops.map(shop => shop.category).filter((value): value is string => !!value))].sort(), [shops]);
  const selected = visible.find(shop => shop.id === selectedId);
  const onMapError = useCallback((message: string) => setMapError(message), []);
  const locate = async () => {
    setLocating(true); setNotice('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { setNotice('Location access is off. You can still browse all shops.'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch { setNotice('Could not find your location. You can still browse all shops.'); }
    finally { setLocating(false); }
  };
  return <View accessibilityLabel="Shop map section" style={[styles.panel, { height: Math.round(height * 0.5), backgroundColor: c.bg, borderColor: c.border }]}>
    <View style={styles.heading}>
      <View style={{ flex: 1 }}><Text style={[styles.title, { color: c.text }]}>Discover shops in town</Text><Text style={{ fontSize: 11, color: c.muted }}>Registered shops with GPS locations</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={list ? 'Show shop map' : 'Show shop list'} onPress={() => setList(!list)} style={[styles.icon, { backgroundColor: c.soft }]}>{list ? <Map size={19} color="#1a73e8" /> : <List size={19} color="#1a73e8" />}</TouchableOpacity>
    </View>
    <View style={[styles.search, { backgroundColor: c.soft }]}><Search size={16} color={c.muted} /><TextInput accessibilityLabel="Search mapped shops" placeholder="Search shops, areas or categories" placeholderTextColor={c.muted} value={query} onChangeText={setQuery} style={{ flex: 1, minWidth: 0, fontSize: 12, color: c.text, paddingVertical: 8 }} />{query ? <TouchableOpacity accessibilityLabel="Clear map search" onPress={() => setQuery('')}><X size={16} color={c.muted} /></TouchableOpacity> : null}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, maxHeight: 39 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 5, gap: 6 }}>
      {[null, ...categories].map(value => <TouchableOpacity key={value || 'all'} accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={[styles.pill, { backgroundColor: category === value ? '#1a73e8' : c.soft }]}><Text style={{ fontSize: 11, color: category === value ? '#fff' : c.text }}>{value || 'All shops'}</Text></TouchableOpacity>)}
    </ScrollView>
    {notice ? <Text accessibilityRole="alert" style={[styles.notice, { color: c.muted }]}>{notice}</Text> : null}
    <View style={styles.mapArea}>
      {loading ? <View style={styles.center}><ActivityIndicator color="#1a73e8" /><Text style={{ color: c.muted, marginTop: 8 }}>Loading shop locations…</Text></View> : error ? <View style={styles.center}><Text accessibilityRole="alert" style={{ color: c.text, textAlign: 'center' }}>{error}</Text><TouchableOpacity onPress={() => void load()} style={styles.retry}><RefreshCw size={15} color="#1a73e8" /><Text style={{ color: '#1a73e8' }}>Try again</Text></TouchableOpacity></View> : list ? <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
        {visible.map(shop => <TouchableOpacity key={shop.id} accessibilityRole="button" accessibilityLabel={`View ${shop.name}`} onPress={() => { setSelectedId(shop.id); setList(false); }} style={[styles.listRow, { borderColor: c.border }]}><Store size={20} color="#1a73e8" /><View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>{shop.name}</Text><Text style={{ color: c.muted, fontSize: 11 }}>{shop.address || shop.category || 'Registered shop'}</Text></View><ArrowRight size={17} color="#1a73e8" /></TouchableOpacity>)}
        {!visible.length && <Text style={{ color: c.muted }}>No shops match your search. Try another category or clear your search.</Text>}
      </ScrollView> : <>
        <ShopMapCanvas key={mapVersion} shops={visible} location={location} onSelect={setSelectedId} onError={onMapError} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Find shops near my location" disabled={locating} onPress={locate} style={[styles.locate, { backgroundColor: c.bg }]}>{locating ? <ActivityIndicator size="small" color="#1a73e8" /> : <LocateFixed size={19} color="#1a73e8" />}</TouchableOpacity>
        {mapError ? <View style={[styles.warning, { backgroundColor: c.bg }]}><Text style={{ color: c.text, fontSize: 11, flex: 1 }}>{mapError}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { setMapError(''); setMapVersion(v => v + 1); }}><Text style={{ color: '#1a73e8', fontSize: 11 }}>Retry</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => setList(true)}><Text style={{ color: '#1a73e8', fontSize: 11 }}>Shop list</Text></TouchableOpacity></View> : null}
        {selected ? <View style={[styles.card, { backgroundColor: c.bg, borderColor: c.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>{selected.logo_url ? <Image source={{ uri: selected.logo_url }} style={{ width: 38, height: 38, borderRadius: 9 }} /> : <View style={[styles.icon, { backgroundColor: c.soft }]}><Store size={22} color="#1a73e8" /></View>}<View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: c.text }}>{selected.name}</Text><Text numberOfLines={1} style={{ color: c.muted, fontSize: 11 }}>{selected.category || 'Registered shop'}{selected.is_available === false ? ' · Currently unavailable' : ''}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close selected shop" onPress={() => setSelectedId(null)}><X size={18} color={c.muted} /></TouchableOpacity></View>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 11, marginTop: 5 }}>{selected.address || 'GPS location provided by this shop'}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Visit ${selected.name}`} onPress={() => router.push({ pathname: '/customer/marketplace', params: { shopId: selected.id } })} style={styles.visit}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Visit shop</Text><ArrowRight size={16} color="#fff" /></TouchableOpacity>
        </View> : <View pointerEvents="none" style={[styles.hint, { backgroundColor: c.bg }]}><MapPin size={17} color="#1a73e8" /><Text style={{ color: c.text, fontSize: 11, flex: 1 }}>{visible.length ? `${visible.length} shops · Tap a pin to explore` : shops.length ? 'No matching shops. Clear your filters.' : 'No active shops have shared valid GPS coordinates yet.'}</Text></View>}
      </>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  panel: { marginHorizontal: 16, marginVertical: 10, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  heading: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 7 },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 2 }, icon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 12, paddingHorizontal: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  pill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20 }, mapArea: { flex: 1, minHeight: 0, position: 'relative' },
  center: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' }, retry: { flexDirection: 'row', gap: 7, marginTop: 10, padding: 8 },
  locate: { position: 'absolute', right: 10, top: 82, padding: 9, borderRadius: 10, elevation: 3 },
  hint: { position: 'absolute', left: 12, right: 54, bottom: 28, padding: 10, borderRadius: 12, flexDirection: 'row', gap: 7, alignItems: 'center' },
  card: { position: 'absolute', left: 10, right: 10, bottom: 25, borderRadius: 14, padding: 10, borderWidth: 1, elevation: 5 },
  visit: { backgroundColor: '#1a73e8', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  warning: { position: 'absolute', left: 8, top: 8, right: 54, padding: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  notice: { paddingHorizontal: 12, paddingBottom: 5, fontSize: 11 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
});
