import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { Home, Package, User, CircleHelp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { loadUserData } from '@/lib/storage-service';
import { loadSession } from '@/lib/session-service';
import AnimatedChatIcon from '@/components/AnimatedChatIcon';

type Props = {
  customerId?: string; customerName?: string; dashboard?: boolean; desktopSidebar?: boolean;
  notice?: 'yellow' | 'green' | null; shopUpdatesBaseline?: number;
  onOrdersPress?: () => void; onHomePress?: () => void;
};

export default function CustomerNavigation({ customerId, customerName, dashboard = false, desktopSidebar = false, notice, shopUpdatesBaseline = 0, onOrdersPress, onHomePress }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ customerId?: string; customerName?: string }>();
  const { isDark } = useTheme();
  const { unreadMessageCount, shopOrderUpdatesCount } = useNotifications();
  const [identity, setIdentity] = useState(() => loadUserData());
  const [seenUpdates, setSeenUpdates] = useState(0);
  useEffect(() => {
    let current = true;
    setIdentity(loadUserData());
    void loadSession().then(session => {
      if (current) setIdentity(session ? { id: session.id, type: session.type, name: session.name } : null);
    });
    return () => { current = false; };
  }, [pathname]);

  const authScreen = /^\/customer\/(login|register|identity-callback|terms)$/.test(pathname);
  const customerScreen = pathname.startsWith('/customer/');
  const sharedScreen = pathname === '/support' || pathname === '/policies';
  const id = customerId || (customerScreen ? params.customerId : undefined) || (identity?.type === 'customer' ? identity.id : undefined);
  if (!id || (dashboard && pathname !== '/customer/dashboard') || authScreen || (!dashboard && pathname === '/customer/dashboard') || (!customerScreen && !(sharedScreen && identity?.type === 'customer'))) return null;

  const name = customerName || params.customerName || (identity?.type === 'customer' ? identity.name : undefined) || '';
  const active = pathname.includes('/chat') ? 'Chat'
    : /\/(orders|receipt|ticket)(\/|$)/.test(pathname) ? 'Orders'
    : /\/(profile|privacy-centre)$/.test(pathname) ? 'Profile'
    : sharedScreen ? 'Support' : 'Home';
  const primary = isDark ? '#38bdf8' : '#0057ff';
  const muted = isDark ? '#a5bdd4' : '#52627c';
  const hasOrderUpdate = !!notice || shopOrderUpdatesCount > Math.max(shopUpdatesBaseline, seenUpdates);
  const tabs = [
    { label: 'Home', route: '/customer/dashboard' as const, Icon: Home },
    { label: 'Orders', route: '/customer/orders' as const, Icon: Package },
    { label: 'Chat', route: '/customer/chat' as const, Icon: null },
    { label: 'Profile', route: '/customer/profile' as const, Icon: User },
    { label: 'Support', route: '/support' as const, Icon: CircleHelp },
  ];
  return <View accessibilityLabel="Customer navigation" style={[
    styles.bar, { backgroundColor: isDark ? '#0d192a' : '#fff', borderColor: isDark ? '#23415c' : '#e8eef7' },
    desktopSidebar && styles.sidebar,
  ]}>
    {desktopSidebar && <Text style={[styles.brand, { color: primary }]}>UniLink</Text>}
    {tabs.map(({ label, route, Icon }) => {
      const selected = active === label;
      const color = label === 'Chat' && unreadMessageCount > 0 ? '#ef4444' : selected ? primary : muted;
      return <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label}
        accessibilityState={{ selected }} activeOpacity={0.7}
        style={[styles.tab, desktopSidebar && styles.sideTab, selected && { backgroundColor: isDark ? '#16314c' : '#eaf1ff' }]}
        onPress={() => {
          if (label === 'Orders') { setSeenUpdates(shopOrderUpdatesCount); onOrdersPress?.(); }
          if (pathname === route) { if (label === 'Home') onHomePress?.(); return; }
          const target = { pathname: route, params: { customerId: id, customerName: name } };
          if (label === 'Home') router.dismissTo(target);
          else router.navigate(target);
        }}>
        <View style={styles.icon}>
          {Icon ? <Icon size={21} color={color} strokeWidth={2}/> : <AnimatedChatIcon unreadCount={unreadMessageCount} iconColor={color} badgeColor="#ef4444" size={21}/>}
          {label === 'Orders' && hasOrderUpdate && !selected && <View accessibilityLabel="New order update" style={[styles.dot, { backgroundColor: notice === 'green' ? '#10b981' : '#f59e0b' }]}/>}
        </View>
        <Text style={[styles.label, desktopSidebar && styles.sideLabel, { color }]}>{label}</Text>
      </TouchableOpacity>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexShrink: 0, width: '100%', borderTopWidth: 1, paddingHorizontal: 8, paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 22 : 8, gap: 4 },
  tab: { flex: 1, minHeight: 50, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12 },
  icon: { width: 32, height: 25, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  label: { fontSize: 10, fontWeight: '600' },
  dot: { position: 'absolute', top: 0, right: 1, width: 7, height: 7, borderRadius: 4 },
  sidebar: { position: 'absolute', alignSelf: 'stretch', height: '100%', left: 0, top: 0, bottom: 0, width: 216, borderTopWidth: 0, borderRightWidth: 1, flexDirection: 'column', padding: 16, paddingTop: 36, gap: 10 },
  sideTab: { flex: 0, flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 12, gap: 12, minHeight: 52 },
  sideLabel: { fontSize: 15 },
  brand: { fontSize: 29, fontWeight: '800', letterSpacing: -1, paddingHorizontal: 14, marginBottom: 40 },
});
