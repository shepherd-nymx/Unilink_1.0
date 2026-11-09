import PageSkeleton from '@/components/PageSkeleton';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { loadUserData, loadUserDataAsync } from '@/lib/storage-service';
import { ArrowLeft, Store, Truck, MessageSquare } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import ChatInterface from '@/components/ChatInterface';

type OrderData = {
  id: string;
  shop_id: string;
  messenger_id: string | null;
  shops: { name: string; contact_phone: string | null } | null;
  drivers: { id: string; full_name: string; phone_number: string; whatsapp_number: string | null; profile_picture_url: string | null } | null;
};

export default function MarketplaceChat() {
  const router = useRouter();
  const { isDark } = useTheme();
  const params = useLocalSearchParams<{ orderId: string }>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [customerName, setCustomerName] = useState<string | undefined>();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'shop' | 'driver'>('shop');

  useEffect(() => {
    (async () => {
      const stored = loadUserData() || (await loadUserDataAsync());
      if (stored?.type === 'customer') {
        setCustomerId(stored.id);
        setCustomerName(stored.name || undefined);
      }
    })();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (params.orderId) loadOrder();
  }, [params.orderId]);

  const loadOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select(`
          id, shop_id, messenger_id,
          shops!shop_orders_shop_id_fkey(name, contact_phone),
          drivers!shop_orders_messenger_id_fkey(id, full_name, phone_number, whatsapp_number, profile_picture_url)
        `)
        .eq('id', params.orderId)
        .maybeSingle();
      if (error) throw error;
      setOrder(data as any);
      if (data?.messenger_id) setActiveTab('driver');
    } catch (err) {
      console.error('Failed to load order:', err);
    } finally {
      setLoading(false);
    }
  };

  const bg = isDark ? '#050b16' : '#f0f4f8';
  const cardBg = isDark ? '#0a1220' : '#ffffff';
  const cardBorder = isDark ? '#1a2d4a' : '#e2e8f0';
  const textPrimary = isDark ? '#e0eeff' : '#0a1929';
  const textSecondary = isDark ? '#6a8fb0' : '#64748b';
  const primary = '#0066ff';

  if (loading) {
    return <PageSkeleton page="customer/marketplace/chat" onBack={() => router.back()}/>;
  }

  if (!order || !customerId) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: cardBorder }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={18} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Chat</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ color: textSecondary, fontSize: 14 }}>Order not found</Text>
        </View>
      </View>
    );
  }

  const hasDriver = !!order.messenger_id && !!order.drivers;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: cardBorder }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={18} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Order Chat</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tab selector */}
      <View style={[styles.tabBar, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'shop' && { backgroundColor: `${primary}15`, borderBottomColor: primary },
          ]}
          onPress={() => setActiveTab('shop')}
          activeOpacity={0.8}
        >
          <Store size={15} color={activeTab === 'shop' ? primary : textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'shop' ? primary : textSecondary }]}>
            {order.shops?.name || 'Shop'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'driver' && { backgroundColor: `${primary}15`, borderBottomColor: primary },
          ]}
          onPress={() => hasDriver && setActiveTab('driver')}
          disabled={!hasDriver}
          activeOpacity={0.8}
        >
          <Truck size={15} color={activeTab === 'driver' ? primary : (hasDriver ? textSecondary : '#3d5577')} />
          <Text style={[styles.tabText, { color: activeTab === 'driver' ? primary : (hasDriver ? textSecondary : '#3d5577') }]}>
            {hasDriver ? 'Messenger' : 'No messenger yet'}
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {activeTab === 'shop' ? (
          <ChatInterface
            conversationId={null}
            customerId={customerId}
            shopId={order.shop_id}
            orderId={order.id}
            currentUserType="customer"
            currentUserId={customerId}
            otherPartyName={order.shops?.name || 'Shop'}
            otherPartyPhone={order.shops?.contact_phone || undefined}
            otherPartyLabel="Shop"
          />
        ) : hasDriver ? (
          <ChatInterface
            conversationId={null}
            customerId={customerId}
            driverId={order.messenger_id!}
            orderId={order.id}
            currentUserType="customer"
            currentUserId={customerId}
            customerName={customerName}
            driverName={order.drivers?.full_name}
            driverPhone={order.drivers?.phone_number}
            driverProfilePicture={order.drivers?.profile_picture_url || undefined}
          />
        ) : (
          <View style={styles.noDriverState}>
            <MessageSquare size={40} color={textSecondary} />
            <Text style={{ color: textSecondary, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
              The shop hasn't assigned a messenger yet. You'll be able to chat with them once assigned.
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  noDriverState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 4 },
});
