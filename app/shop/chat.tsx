import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { loadShopSession } from '@/lib/shop-session-service';
import { A } from '@/lib/admin-theme';
import { ArrowLeft, MessageSquare, X, User, Phone } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import ChatInterface from '@/components/ChatInterface';

type Conversation = {
  id: string;
  customer_id: string;
  shop_id: string | null;
  order_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count_shop: number;
  customers: { full_name: string | null; phone_number: string | null }[] | { full_name: string | null; phone_number: string | null } | null;
};

export default function ShopChat() {
  const router = useRouter();
  const { isDark } = useTheme();
  const params = useLocalSearchParams<{ customerId: string; orderId: string }>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [shopId, setShopId] = useState<string | undefined>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);

  useEffect(() => {
    (async () => {
      const sess = await loadShopSession();
      if (sess?.shopId) setShopId(sess.shopId);
    })();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (shopId) loadConversations();
  }, [shopId]);

  useEffect(() => {
    if (shopId && params.customerId && params.orderId) {
      openConversationForCustomer(params.customerId, params.orderId);
    }
  }, [shopId, params.customerId, params.orderId]);

  useEffect(() => {
    if (!shopId) return;
    const channel = supabase
      .channel('shop-chat-convos')
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'chat_conversations', filter: `shop_id=eq.${shopId}` } as any,
        () => loadConversations()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId]);

  const loadConversations = async () => {
    if (!shopId) return;
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select(`
          id, customer_id, shop_id, order_id, last_message, last_message_at, unread_count_shop,
          customers!chat_conversations_customer_id_fkey(full_name, phone_number)
        `)
        .eq('shop_id', shopId)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openConversationForCustomer = async (custId: string, ordId: string) => {
    try {
      const { data } = await supabase
        .from('chat_conversations')
        .select(`
          id, customer_id, shop_id, order_id, last_message, last_message_at, unread_count_shop,
          customers!chat_conversations_customer_id_fkey(full_name, phone_number)
        `)
        .eq('shop_id', shopId!)
        .eq('customer_id', custId)
        .eq('order_id', ordId)
        .maybeSingle();
      if (data) setActiveConv(data as any);
    } catch (err) {
      console.error('Failed to open conversation:', err);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const getCustomer = (c: Conversation | null): { full_name: string | null; phone_number: string | null } | null => {
    if (!c || !c.customers) return null;
    if (Array.isArray(c.customers)) return c.customers[0] || null;
    return c.customers;
  };

  const bg = isDark ? '#050b16' : '#f0f4f8';
  const cardBg = isDark ? '#0a1220' : '#ffffff';
  const cardBorder = isDark ? '#1a2d4a' : '#e2e8f0';
  const textPrimary = isDark ? '#e0eeff' : '#0a1929';
  const textSecondary = isDark ? '#6a8fb0' : '#64748b';
  const primary = '#0066ff';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: cardBorder }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={18} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Messages</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: cardBorder }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={18} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Messages</Text>
        <View style={{ width: 38 }} />
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
        >
          {conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <MessageSquare size={48} color={textSecondary} />
              <Text style={{ color: textSecondary, fontSize: 15, marginTop: 12 }}>No conversations yet</Text>
              <Text style={{ color: textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                Customers who place orders will appear here
              </Text>
            </View>
          ) : (
            conversations.map((conv) => (
              <TouchableOpacity
                key={conv.id}
                style={[styles.convCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                onPress={() => setActiveConv(conv)}
                activeOpacity={0.8}
              >
                <View style={styles.convAvatar}>
                  <User size={20} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.convHeader}>
                    <Text style={[styles.convName, { color: textPrimary }]} numberOfLines={1}>
                      {getCustomer(conv)?.full_name || 'Customer'}
                    </Text>
                    {conv.unread_count_shop > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{conv.unread_count_shop}</Text>
                      </View>
                    )}
                  </View>
                  {conv.last_message ? (
                    <Text style={[styles.convPreview, { color: textSecondary }]} numberOfLines={1}>
                      {conv.last_message}
                    </Text>
                  ) : (
                    <Text style={[styles.convPreview, { color: textSecondary, fontStyle: 'italic' }]}>
                      No messages yet
                    </Text>
                  )}
                  {conv.last_message_at && (
                    <Text style={[styles.convTime, { color: textSecondary }]}>
                      {new Date(conv.last_message_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Animated.View>

      {/* Chat modal */}
      <Modal
        visible={!!activeConv}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveConv(null)}
      >
        {activeConv && shopId && (
          <View style={{ flex: 1, backgroundColor: '#030810' }}>
            <View style={styles.chatModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.convAvatar}>
                  <User size={20} color={primary} />
                </View>
                <View>
                  <Text style={styles.chatModalName}>
                    {getCustomer(activeConv)?.full_name || 'Customer'}
                  </Text>
                  {getCustomer(activeConv)?.phone_number ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Phone size={10} color="#00ff88" />
                      <Text style={styles.chatModalPhone}>{getCustomer(activeConv)!.phone_number}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity style={styles.closeChatBtn} onPress={() => setActiveConv(null)}>
                <X size={20} color="#ff4466" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <ChatInterface
                conversationId={activeConv.id}
                customerId={activeConv.customer_id}
                shopId={shopId}
                orderId={activeConv.order_id || undefined}
                currentUserType="shop"
                currentUserId={shopId}
                customerName={getCustomer(activeConv)?.full_name || undefined}
                customerPhone={getCustomer(activeConv)?.phone_number || undefined}
              />
            </View>
          </View>
        )}
      </Modal>
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
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 4 },
  convCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1,
    padding: 14, marginBottom: 10,
  },
  convAvatar: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,102,255,0.1)', borderWidth: 1, borderColor: 'rgba(0,102,255,0.3)',
  },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: 15, fontWeight: '700', flex: 1 },
  convPreview: { fontSize: 13, marginTop: 3 },
  convTime: { fontSize: 11, marginTop: 4 },
  unreadBadge: {
    backgroundColor: '#0066ff', borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  chatModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, paddingTop: 18,
    backgroundColor: '#060f1e', borderBottomWidth: 1, borderBottomColor: '#0e2240',
  },
  chatModalName: { fontSize: 16, fontWeight: '700', color: '#d0eaff' },
  chatModalPhone: { fontSize: 12, color: '#00ff88', fontWeight: '600' },
  closeChatBtn: {
    width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,51,102,0.1)', borderWidth: 1, borderColor: 'rgba(255,51,102,0.3)',
  },
});
