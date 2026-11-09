import { View, ScrollView, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SkeletonBlock as Block, SkeletonGroup } from '@/components/Skeleton';

export type SkeletonLayout = 'home' | 'dashboard' | 'marketplace' | 'orders' | 'form' | 'chat' | 'conversations' | 'document' | 'receipt' | 'records';

// Mirrors each route's content structure; it never invents a minimum loading time.
export function skeletonLayoutForPage(page: string): SkeletonLayout {
  if (page === 'customer/dashboard') return 'home';
  if (page.endsWith('/dashboard')) return 'dashboard';
  if (page === 'customer/marketplace') return 'marketplace';
  if (page === 'driver/chat' || page === 'shop/chat') return 'conversations';
  if (page.endsWith('/chat') || page === 'chat/messages') return 'chat';
  if (/\/(receipt|ticket)$/.test(page)) return 'receipt';
  if (/\/(terms|merchant-policy)$/.test(page) || page === 'policies') return 'document';
  if (/\/(profile|settings|register|identity-callback|privacy-centre|compliance)$/.test(page)) return 'form';
  if (/\/(orders|deliveries|shop-deliveries|delivery-requests)$/.test(page)) return 'orders';
  return 'records';
}

export default function PageSkeleton({ page, layout = skeletonLayoutForPage(page), embedded = false, onBack, fill = false }: {
  page: string; layout?: SkeletonLayout; embedded?: boolean; onBack?: () => void; fill?: boolean;
}) {
  const { isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const desktop = width >= 1000;
  // Admin and several messenger/chat screens deliberately use their own dark palette.
  const fixedDark = page.startsWith('admin/') || ['driver/dashboard','driver/chat','driver/settings','driver/customers','driver/shop-deliveries','customer/chat','chat/messages','driver/locations'].includes(page);
  const dark = fixedDark || isDark;
  const bg = dark ? (fixedDark && !page.startsWith('admin/') ? '#030810' : '#050b16') : layout === 'home' ? '#fff' : '#f0f4f8';
  const surface = dark ? '#0d1b2e' : '#fff';
  const border = dark ? '#21384f' : '#e1e9f4';
  const card = [s.card, { backgroundColor: surface, borderColor: border }];
  const lines = (count = 3) => <View style={s.lines}>{Array.from({ length: count }, (_, i) => <Block key={i} height={12} width={i === count - 1 ? '67%' : '100%'}/>)}</View>;
  const row = (avatar = true, actions = false) => <View style={s.row}>
    {avatar && <Block width={44} height={44} borderRadius={12}/>}
    <View style={{ flex: 1, gap: 9 }}><Block width="61%" height={15}/><Block width="83%" height={11}/></View>
    {actions && <Block width={62} height={26} borderRadius={20}/>}
  </View>;
  const filters = <View style={s.row}>{[0,1,2].map(i => <Block key={i} height={36} style={{ flex: 1 }} borderRadius={12}/>)}</View>;
  const records = (count = 4) => <View style={s.lines}>{Array.from({ length: count }, (_, i) => <View key={i} style={card}>{row(true, true)}<View style={{ marginTop: 16 }}>{lines(layout === 'orders' ? 3 : 2)}</View>{layout === 'orders' && <View style={[s.row, { marginTop: 16, justifyContent: 'space-between' }]}><Block width={85} height={13}/><Block width={98} height={34} borderRadius={10}/></View>}</View>)}</View>;
  const body = <>
        {layout === 'home' && <>
          <View style={[s.row, { justifyContent: 'center' }]}><Block width={86} height={32}/><Block width={120} height={32}/></View>
          <Block height={desktop ? 200 : 138} borderRadius={20} style={{ marginTop: 22, marginBottom: 28 }}/>
          {[0,1].map(i => <View key={i} style={[card, { marginBottom: 14 }]}>{row(true, false)}</View>)}
          <View style={card}><View style={[s.row, { justifyContent: 'space-between', marginBottom: 16 }]}><Block width="40%" height={18}/><Block width={96} height={36} borderRadius={10}/></View>{lines(2)}</View>
        </>}
        {layout === 'dashboard' && <>
          <View style={card}>{row()}<Block height={42} borderRadius={12} style={{ marginTop: 20 }}/></View>
          <View style={[s.grid, { marginVertical: 16 }]}>{[0,1,2,3].map(i => <View key={i} style={[card, { width: desktop ? '23.5%' : '47.5%', minHeight: 104 }]}><Block width="65%" height={12}/><Block width={54} height={28} style={{ marginTop: 18 }}/></View>)}</View>
          <Block width="45%" height={18} style={{ marginBottom: 14 }}/>{records(3)}
        </>}
        {layout === 'marketplace' && <>
          <Block height={48} borderRadius={14}/><View style={{ marginVertical: 16 }}>{filters}</View>
          <View style={s.grid}>{[0,1,2,3].map(i => <View key={i} style={[card, { width: desktop ? '23.5%' : '47.5%', padding: 10 }]}><Block height={120} borderRadius={12}/><View style={{ marginTop: 14 }}>{lines(2)}</View><Block width="38%" height={20} style={{ marginTop: 14 }}/></View>)}</View>
        </>}
        {(layout === 'orders' || layout === 'records' || layout === 'conversations') && <>
          {!embedded && <>{['admin/emails', 'admin/reviews', 'admin/audit-logs'].includes(page) && <Block height={46} borderRadius={12}/>}<View style={{ marginBottom: 16 }}>{filters}</View></>}{records(layout === 'conversations' ? 5 : 4)}
        </>}
        {layout === 'form' && <View style={[s.lines, { maxWidth: 760, width: '100%', alignSelf: 'center' }]}>
          <View style={card}>{row()}<View style={{ marginTop: 20 }}>{[0,1,2,3].map(i => <View key={i} style={{ gap: 9, marginBottom: 18 }}><Block width="28%" height={11}/><Block height={48} borderRadius={12}/></View>)}</View></View>
          <View style={card}>{lines(2)}<Block height={48} borderRadius={12} style={{ marginTop: 20 }}/></View>
        </View>}
        {layout === 'chat' && <View style={{ flex: 1, gap: 24, paddingTop: 12, justifyContent: 'space-between' }}>
          <View style={{ gap: 20 }}>{Array.from({ length: 4 }, (_, i) => <View key={i} style={[card, { width: i % 2 ? '62%' : '76%', alignSelf: i % 2 ? 'flex-end' : 'flex-start', borderRadius: 18 }]}>{lines(2)}</View>)}</View>
          <Block height={48} borderRadius={24}/>
        </View>}
        {layout === 'document' && <View style={[card, { gap: 26 }]}>{Array.from({ length: 4 }, (_, i) => <View key={i}><Block width="49%" height={18} style={{ marginBottom: 18 }}/>{lines(6)}</View>)}<View style={s.row}><Block width={22} height={22}/><Block width="70%" height={12}/></View><Block height={48} borderRadius={12}/></View>}
        {layout === 'receipt' && <View style={[card, { width: '100%', maxWidth: 620, alignSelf: 'center', gap: 22 }]}>
          <Block width={80} height={40} style={{ alignSelf: 'center' }}/><Block width="56%" height={22} style={{ alignSelf: 'center' }}/>{lines(3)}
          <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: border, paddingVertical: 20, gap: 18 }}>{[0,1,2].map(i => <View key={i} style={[s.row, { justifyContent: 'space-between' }]}><Block width="58%" height={13}/><Block width="22%" height={13}/></View>)}</View>
          <View style={[s.row, { justifyContent: 'space-between' }]}><Block width="28%" height={18}/><Block width="24%" height={22}/></View><Block width={94} height={94} style={{ alignSelf: 'center' }}/><Block height={44} borderRadius={12}/>
        </View>}
  </>;
  const label = `Loading ${page.split('/').at(-1)?.replaceAll('-', ' ')}`;
  return <View testID={`page-skeleton-${page.replaceAll('/', '-')}`} style={[s.root, { backgroundColor: bg }, embedded && !fill ? { flexShrink: 0, height: Math.min(page === 'driver/locations' ? 240 : 480, height * 0.65) } : { flex: 1 }, layout === 'home' && desktop && { paddingLeft: 216 }]}>
    <SkeletonGroup color={dark ? '#24364d' : '#e2e9f3'}>
      {!embedded && <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        {layout === 'home' ? <View style={{ gap: 8, marginBottom: 18 }}>
          {!desktop && <Block width={72} height={18}/>}
          <View style={s.row}><Block width={170} height={24}/><Block width={56} height={20} borderRadius={16}/></View><Block width={160} height={12}/>
        </View> : <View style={[s.row, { marginBottom: 24 }]}>
          {onBack ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}><ArrowLeft size={22} color={dark ? '#bdd6ef' : '#52627c'}/></TouchableOpacity> : <Block width={38} height={38} borderRadius={10}/>}
          <View style={{ flex: 1, gap: 9 }}><Block width="62%" height={24}/><Block width="42%" height={11}/></View><Block width={34} height={34} borderRadius={17}/>
        </View>}
      </View>}
      <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} style={{ flex: 1, minHeight: 0 }}>
        <ScrollView scrollEnabled={false} contentContainerStyle={[s.content, { paddingTop: embedded ? 12 : 0 }, layout === 'chat' && { flexGrow: 1 }]} importantForAccessibility="no-hide-descendants" pointerEvents="none">{body}</ScrollView>
      </View>
      {layout === 'home' && <View importantForAccessibility="no-hide-descendants" pointerEvents="none" style={desktop ? { position: 'absolute', left: 0, top: 0, bottom: 0, width: 216, backgroundColor: surface, borderRightWidth: 1, borderColor: border, padding: 24, gap: 28 } : { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderColor: border, padding: 12, backgroundColor: surface }}>
        {desktop && <Block width={100} height={28} style={{ marginBottom: 25 }}/>}
        {[0,1,2,3,4].map(i => <View key={i} style={{ flexDirection: desktop ? 'row' : 'column', alignItems: 'center', gap: 8 }}><Block width={24} height={24}/><Block width={desktop ? 70 : 34} height={10}/></View>)}
      </View>}
    </SkeletonGroup>
  </View>;
}
const s = StyleSheet.create({ root: { minHeight: 0, width: '100%' }, content: { padding: 20, paddingTop: 28, paddingBottom: 28 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, lines: { gap: 12 }, card: { borderWidth: 1, borderRadius: 16, padding: 16 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } });
