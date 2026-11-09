import { Image, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { CircleHelp, Share2 } from 'lucide-react-native';

export function CustomerDashboardLightHeader({ name, desktop, copied, onShare, onTutorial }: {
  name: string; desktop: boolean; copied: boolean; onShare: () => void; onTutorial: () => void;
}) {
  return <View style={[lightDashboard.header, desktop && lightDashboard.headerDesktop]}>
    {!desktop && <Text style={lightDashboard.wordmark}>UniLink</Text>}
    <View style={lightDashboard.heading}>
      <View style={lightDashboard.greetingRow}>
        <Text style={[lightDashboard.greeting, !desktop && { fontSize: 22 }]} numberOfLines={1}>Hi, {name}</Text>
        <View style={lightDashboard.active}><View style={lightDashboard.activeDot}/><Text style={lightDashboard.activeText}>Active</Text></View>
      </View>
      <Text style={lightDashboard.subtitle}>What do you need today?</Text>
    </View>
    <View style={[lightDashboard.actions, !desktop && { marginTop: 8, gap: 6 }]}>
      <View style={[lightDashboard.secondaryActions, !desktop && { width: '100%' }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share UniLink with friends" onPress={onShare} style={[lightDashboard.secondaryButton, !desktop && { minHeight: 32, paddingHorizontal: 12 }]} hitSlop={6}>
          <Share2 size={18} color="#20314e"/><Text style={lightDashboard.secondaryLabel}>{copied ? 'Link copied!' : 'Share'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onTutorial} style={[lightDashboard.secondaryButton, !desktop && { minHeight: 32, paddingHorizontal: 12 }]} hitSlop={6}>
          <CircleHelp size={18} color="#20314e"/><Text style={lightDashboard.secondaryLabel}>How it works</Text>
        </TouchableOpacity>
      </View>

    </View>
  </View>;
}

export function CustomerGroceryBanner({ desktop }: { desktop: boolean }) {
  return <View style={[lightDashboard.banner, { height: desktop ? 200 : 138 }]}>
    <Image source={require('@/assets/images/customer-dashboard/grocery-banner.png')} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} resizeMode="cover" accessible={false}/>
    <View style={{ width: desktop ? '44%' : '56%', paddingLeft: 20 }}><Text style={[lightDashboard.bannerTitle, { fontSize: desktop ? 32 : 21 }]}>Your everyday essentials, delivered.</Text></View>
  </View>;
}

export const lightDashboard = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, backgroundColor: '#fff', width: '100%', minWidth: 0 },
  headerDesktop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20, paddingHorizontal: 36, paddingTop: 32, paddingBottom: 22, flexWrap: 'wrap' },
  wordmark: { fontSize: 18, fontWeight: '800', letterSpacing: -0.8, color: '#0057ff', marginBottom: 5 },
  heading: { flexShrink: 1, minWidth: 0 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { color: '#0d1830', fontSize: 32, fontWeight: '800', letterSpacing: -1, flexShrink: 1 },
  subtitle: { color: '#68768d', fontSize: 13, marginTop: 3 },
  active: { backgroundColor: '#d9fae7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0baa57' },
  activeText: { color: '#078844', fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 },
  secondaryActions: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, minHeight: 44, borderWidth: 1, borderColor: '#e3eaf5', borderRadius: 12 },
  secondaryLabel: { color: '#20314e', fontSize: 13, fontWeight: '600' },
  deliveryButton: { backgroundColor: '#0057ff', minHeight: 48, paddingHorizontal: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  deliveryLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  banner: { marginHorizontal: 20, marginTop: 18, marginBottom: 22, backgroundColor: '#e5f2ff', borderRadius: 20, overflow: 'hidden', justifyContent: 'center' },
  bannerTitle: { color: '#0d1830', fontWeight: '800', letterSpacing: -0.8, lineHeight: undefined },
  sectionTitle: { color: '#0d1830', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginHorizontal: 20, marginBottom: 14 },
  productArtwork: { height: 104, width: '100%', justifyContent: 'center', alignItems: 'center', flexShrink: 0, backgroundColor: '#fff', borderRadius: 12 },
  nearby: { marginHorizontal: 20, marginTop: 10, marginBottom: 18, padding: 16, borderWidth: 1, borderColor: '#dee7f5', borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f7faff' },
  nearbyIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#e6efff', alignItems: 'center', justifyContent: 'center' },
  nearbyLabel: { flex: 1, color: '#13223c', fontSize: 15, fontWeight: '700' },
  sidebarBrand: { color: '#0057ff', fontSize: 29, fontWeight: '800', letterSpacing: -1, paddingHorizontal: 14, marginTop: 14, marginBottom: 40 },
  home: { backgroundColor: '#e8f0ff', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 },
  homeLabel: { color: '#0057ff', fontSize: 14, fontWeight: '700' },
});

export function customerLightOverrides(width: number): Record<string, ViewStyle | object> {
  const desktop = width >= 1000;
  return {
    container: { backgroundColor: '#fff', paddingLeft: desktop ? 216 : 0 },
    content: { backgroundColor: '#fff', marginHorizontal: desktop ? 16 : 0 },
    searchContainer: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 0 },
    searchInputWrapper: { height: 52, backgroundColor: '#fbfcff', borderWidth: 1, borderColor: '#cfdbec', borderRadius: 14 },
    searchInput: { color: '#192a43', fontSize: 15 },
    itemsList: { paddingHorizontal: 20, gap: desktop ? 16 : 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
    categorySection: { width: desktop ? '48.5%' : '47.5%', backgroundColor: '#fff', borderWidth: 0, shadowOpacity: 0, elevation: 0, overflow: 'visible' },
    categoryHeader: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: '#edf3ff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, minHeight: 44, gap: 14, borderBottomWidth: 0, marginBottom: 12 },
    categoryHeaderLeft: { flex: 1, minWidth: 0, gap: 6 },
    categoryEmoji: { fontSize: 18 },
    categoryName: { fontSize: desktop ? 13 : 11, flexShrink: 1, fontWeight: '700', color: '#1b2a43' },
    categoryItems: { padding: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    itemCard: { width: '100%', minHeight: desktop ? 166 : 222, flexDirection: desktop ? 'row' : 'column', alignItems: 'stretch', justifyContent: 'space-between', padding: 12, borderColor: '#dfe7f3', backgroundColor: '#fff', borderRadius: 16, gap: 12 },
    itemInfo: { flex: 1, justifyContent: 'center', paddingBottom: desktop ? 38 : 0 },
    itemName: { fontSize: 14, fontWeight: '700', color: '#13213a', lineHeight: 20 },
    itemPrice: { fontSize: 17, fontWeight: '800', color: '#0057ff', marginTop: 5 },
    quantityControls: { gap: 3, justifyContent: 'space-between', alignSelf: desktop ? 'flex-end' : 'stretch', ...(desktop ? { position: 'absolute', bottom: 12, right: 12 } : {}) },
    quantityButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#0057ff', shadowOpacity: 0, elevation: 0 },
    quantityText: { fontSize: 14, minWidth: 22 },
    bottomNav: desktop ? { position: 'absolute', alignSelf: 'stretch', height: '100%', left: 0, top: 0, bottom: 0, width: 216, maxWidth: 216, marginTop: 0, marginBottom: 0, flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, borderRadius: 0, borderWidth: 0, borderRightWidth: 1, borderColor: '#e8eef7', shadowOpacity: 0, elevation: 0, gap: 10 }
      : { width: '100%', maxWidth: undefined, borderRadius: 0, marginTop: 0, marginBottom: 0, borderWidth: 0, borderTopWidth: 1, borderColor: '#e8eef7', paddingVertical: 8, paddingBottom: 12, shadowOpacity: 0, elevation: 0 },
    bottomNavItem: desktop ? { flex: 0, flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 12, gap: 12, minHeight: 52 } : { paddingVertical: 4, gap: 4 },
    bottomNavLabel: { fontSize: desktop ? 15 : 10, fontWeight: '600', letterSpacing: 0 },
    bottomNavIconWrap: { width: desktop ? 30 : 38, height: 32, borderRadius: 10 },
    customItemsSection: { marginHorizontal: 20, shadowOpacity: 0, elevation: 0, borderColor: '#e1e9f4', borderRadius: 18 },
    orderSummary: { marginHorizontal: 20, shadowOpacity: 0, elevation: 0, borderColor: '#e1e9f4', borderRadius: 18 },
    shareModalCard: { backgroundColor: '#fff', borderColor: '#dce6f5', shadowColor: '#19375f', shadowOpacity: 0.12 },
    shareModalTitle: { color: '#16263e' }, shareOptionText: { color: '#445773' },
    copyLinkRow: { backgroundColor: '#f1f6ff', borderColor: '#dce6f5' }, copyLinkText: { color: '#273c59' }, copyLinkAction: { color: '#0057ff' },
  };
}
