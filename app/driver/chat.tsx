import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, MessageCircle, Send, CircleAlert as AlertCircle, Zap, X, Radio } from 'lucide-react-native';
import ChatInterface from '@/components/ChatInterface';

const BG = '#030810';
const SURFACE = '#060f1e';
const CARD = '#091526';
const CARD2 = '#0c1830';
const BORDER = '#0e2240';
const BORDER_BRIGHT = '#143260';
const CYAN = '#00e5ff';
const CYAN_DIM = 'rgba(0,229,255,0.1)';
const GREEN = '#00ff88';
const RED = '#ff3366';
const RED_DIM = 'rgba(255,51,102,0.1)';
const AMBER = '#ffaa00';
const TEXT = '#d0eaff';
const TEXT_SUB = '#4a7a9b';
const TEXT_MUTED = '#1a3a55';

type Conversation = {
  id: string;
  driver_id: string;
  customer_id: string;
  delivery_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count_driver: number;
  customers: {
    id: string;
    full_name: string;
    phone_number: string;
  };
};

type Customer = {
  id: string;
  full_name: string;
  phone_number: string;
};

function ConversationItem({ conversation, onPress, formatTime }: {
  conversation: Conversation;
  onPress: () => void;
  formatTime: (t: string | null) => string;
}) {
  const pressAnim = useRef(new Animated.Value(1)).current;
  const slideIn = useRef(new Animated.Value(-20)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slideIn, { toValue: 0, tension: 85, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressAnim, { toValue: 0.97, useNativeDriver: true, tension: 220 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, tension: 220 }).start();
  };

  const initials = conversation.customers.full_name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const hasUnread = conversation.unread_count_driver > 0;

  return (
    <Animated.View style={{ opacity: fadeIn, transform: [{ translateX: slideIn }, { scale: pressAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={{
          flexDirection: 'row',
          padding: 14,
          backgroundColor: hasUnread ? CARD2 : CARD,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
          gap: 14,
          alignItems: 'center',
        }}
      >
        {hasUnread && (
          <View style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: 3,
            backgroundColor: CYAN,
          }} />
        )}

        <View style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: hasUnread ? CYAN_DIM : 'rgba(14,34,64,0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: hasUnread ? 1.5 : 1,
          borderColor: hasUnread ? CYAN : BORDER,
          shadowColor: hasUnread ? CYAN : 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: hasUnread ? 0.5 : 0,
          shadowRadius: 8,
          elevation: hasUnread ? 4 : 0,
        }}>
          <Text style={{
            color: hasUnread ? CYAN : TEXT_SUB,
            fontSize: 17,
            fontWeight: '700',
            letterSpacing: 0.5,
          }}>{initials}</Text>
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{
              fontSize: 15,
              fontWeight: hasUnread ? '700' : '600',
              color: hasUnread ? TEXT : TEXT_SUB,
              letterSpacing: 0.2,
            }}>
              {conversation.customers.full_name}
            </Text>
            {conversation.last_message_at && (
              <Text style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: 0.3 }}>
                {formatTime(conversation.last_message_at)}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 13,
                color: hasUnread ? TEXT_SUB : TEXT_MUTED,
                fontWeight: hasUnread ? '500' : '400',
                marginRight: 8,
              }}
            >
              {conversation.last_message || 'No messages yet'}
            </Text>
            {hasUnread && (
              <View style={{
                backgroundColor: CYAN,
                borderRadius: 12,
                minWidth: 22,
                height: 22,
                paddingHorizontal: 6,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: CYAN,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.7,
                shadowRadius: 6,
                elevation: 4,
              }}>
                <Text style={{ color: BG, fontSize: 11, fontWeight: '800' }}>
                  {conversation.unread_count_driver}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DriverChat() {
  const router = useRouter();
  const { driverId, driverName } = useLocalSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeCustomers, setActiveCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [error, setError] = useState('');

  const headerAnim = useRef(new Animated.Value(0)).current;
  const broadcastGlow = useRef(new Animated.Value(0)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadConversations();
    loadActiveCustomers();
    const unsub = subscribeToConversations();
    Animated.spring(headerAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(broadcastGlow, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(broadcastGlow, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    );
    glowLoop.start();
    return () => {
      glowLoop.stop();
      if (unsub) unsub();
    };
  }, [driverId]);

  useEffect(() => {
    Animated.timing(inputBorderAnim, {
      toValue: inputFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [inputFocused]);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select(`
          *,
          customers:customer_id (
            id,
            full_name,
            phone_number
          )
        `)
        .eq('driver_id', driverId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          customer_id,
          customers:customer_id (
            id,
            full_name,
            phone_number
          )
        `)
        .eq('driver_id', driverId)
        .in('status', ['pending', 'accepted', 'in_progress'])
        .not('customers', 'is', null);

      if (error) throw error;

      const uniqueCustomers = Array.from(
        new Map(
          data.map((item: any) => [item.customers.id, item.customers])
        ).values()
      );

      setActiveCustomers(uniqueCustomers as Customer[]);
    } catch (err) {
      console.error('Error loading active customers:', err);
    }
  };

  const subscribeToConversations = () => {
    const channel = supabase
      .channel('driver-conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_conversations',
        filter: `driver_id=eq.${driverId}`,
      }, () => { loadConversations(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const sendBroadcastMessage = async () => {
    if (!broadcastMessage.trim() || sendingBroadcast) return;
    setSendingBroadcast(true);
    setError('');

    try {
      for (const customer of activeCustomers) {
        const { data: conversationId, error: convError } = await supabase.rpc('get_or_create_conversation', {
          p_driver_id: driverId,
          p_customer_id: customer.id,
        });
        if (convError) throw convError;

        const { error: msgError } = await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          sender_type: 'driver',
          sender_id: driverId,
          message: broadcastMessage.trim(),
          is_broadcast: true,
        });
        if (msgError) throw msgError;
      }

      setBroadcastMessage('');
      setShowBroadcast(false);
      loadConversations();
    } catch (err: any) {
      setError(err.message || 'Failed to send broadcast message');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTotalUnread = () =>
    conversations.reduce((sum, conv) => sum + conv.unread_count_driver, 0);

  const broadcastShadowRadius = broadcastGlow.interpolate({ inputRange: [0, 1], outputRange: [6, 22] });
  const broadcastShadowOpacity = broadcastGlow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] });
  const inputBorderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BORDER, CYAN],
  });

  if (selectedConversation) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 58, left: 16, zIndex: 10,
            width: 38, height: 38, borderRadius: 8,
            backgroundColor: SURFACE,
            borderWidth: 1, borderColor: BORDER,
            justifyContent: 'center', alignItems: 'center',
            shadowColor: CYAN,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 5,
          }}
          onPress={() => setSelectedConversation(null)}
          activeOpacity={0.8}
        >
          <ArrowLeft size={18} color={TEXT_SUB} />
        </TouchableOpacity>

        <ChatInterface
          conversationId={selectedConversation.id}
          driverId={driverId as string}
          customerId={selectedConversation.customer_id}
          currentUserType="driver"
          currentUserId={driverId as string}
          customerName={selectedConversation.customers.full_name}
          customerPhone={selectedConversation.customers.phone_number}
          driverName={driverName as string}
          deliveryId={selectedConversation.delivery_id || undefined}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <Animated.View style={{
        backgroundColor: SURFACE,
        paddingTop: 56,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        position: 'relative',
        overflow: 'hidden',
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
      }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: CYAN, opacity: 0.6 }} />
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 8,
            backgroundColor: CYAN_DIM, borderWidth: 1, borderColor: CYAN,
            justifyContent: 'center', alignItems: 'center',
          }}
          activeOpacity={0.8}
        >
          <ArrowLeft size={18} color={CYAN} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: TEXT_MUTED }}>MESSENGER</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT }}>Messages</Text>
            {getTotalUnread() > 0 && (
              <View style={{
                backgroundColor: RED,
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 3,
                minWidth: 24,
                alignItems: 'center',
                shadowColor: RED,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.7,
                shadowRadius: 6,
                elevation: 4,
              }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{getTotalUnread()}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {activeCustomers.length > 0 && (
        <View style={{ marginHorizontal: 16, marginTop: 14, marginBottom: 4 }}>
          <Animated.View style={{
            shadowColor: CYAN,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: broadcastShadowRadius,
            shadowOpacity: broadcastShadowOpacity,
            borderRadius: 14,
            elevation: 8,
          }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                paddingVertical: 13,
                paddingHorizontal: 20,
                backgroundColor: CARD,
                borderWidth: 1.5,
                borderColor: CYAN,
                borderRadius: 14,
                position: 'relative',
                overflow: 'hidden',
              }}
              onPress={() => setShowBroadcast(true)}
              activeOpacity={0.85}
            >
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: '45%' as any,
                backgroundColor: CYAN_DIM,
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
              }} />
              <Radio size={17} color={CYAN} />
              <Text style={{ color: CYAN, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>
                Broadcast Message
              </Text>
              <View style={{
                backgroundColor: CYAN,
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 2,
                minWidth: 24,
                alignItems: 'center',
              }}>
                <Text style={{ color: BG, fontSize: 11, fontWeight: '800' }}>{activeCustomers.length}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {error ? (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: RED_DIM,
          padding: 12,
          marginHorizontal: 16,
          marginTop: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: 'rgba(255,51,102,0.3)',
        }}>
          <AlertCircle size={16} color={RED} />
          <Text style={{ flex: 1, color: RED, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <View style={{
            width: 68, height: 68, borderRadius: 34,
            backgroundColor: CYAN_DIM, borderWidth: 1, borderColor: BORDER,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <ActivityIndicator size="large" color={CYAN} />
          </View>
          <Text style={{ fontSize: 14, color: TEXT_SUB, letterSpacing: 0.5 }}>Loading conversations...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {conversations.length > 0 && (
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: TEXT_MUTED }}>
                CONVERSATIONS — {conversations.length}
              </Text>
            </View>
          )}

          {conversations.length === 0 ? (
            <View style={{ paddingVertical: 80, alignItems: 'center', gap: 14 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: CARD,
                borderWidth: 1.5, borderColor: CYAN,
                justifyContent: 'center', alignItems: 'center',
                shadowColor: CYAN,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 6,
              }}>
                <MessageCircle size={34} color={CYAN} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT_SUB, letterSpacing: 0.3 }}>
                No conversations yet
              </Text>
              <Text style={{ fontSize: 13, color: TEXT_MUTED, textAlign: 'center', paddingHorizontal: 40 }}>
                Messages from your customers will appear here
              </Text>
            </View>
          ) : (
            conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                onPress={() => setSelectedConversation(conversation)}
                formatTime={formatTime}
              />
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={showBroadcast}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBroadcast(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: SURFACE,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 44,
            gap: 18,
            borderTopWidth: 1,
            borderColor: BORDER,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: 1.5, backgroundColor: CYAN, opacity: 0.5,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
            }} />

            <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: BORDER_BRIGHT, alignSelf: 'center', marginBottom: 2 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ gap: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: TEXT_MUTED }}>MASS MESSAGE</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: TEXT }}>Broadcast Message</Text>
              </View>
              <TouchableOpacity
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: RED_DIM,
                  borderWidth: 1, borderColor: 'rgba(255,51,102,0.3)',
                  justifyContent: 'center', alignItems: 'center',
                }}
                onPress={() => setShowBroadcast(false)}
                activeOpacity={0.8}
              >
                <X size={16} color={RED} />
              </TouchableOpacity>
            </View>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: CARD,
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: CYAN }} />
              <Text style={{ fontSize: 13, color: TEXT_SUB }}>
                Sending to {activeCustomers.length} active customer{activeCustomers.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <Animated.View style={{
              backgroundColor: CARD,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: inputBorderColor,
              shadowColor: CYAN,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            }}>
              <TextInput
                style={{
                  padding: 16,
                  fontSize: 15,
                  color: TEXT,
                  minHeight: 110,
                  textAlignVertical: 'top',
                  lineHeight: 22,
                }}
                value={broadcastMessage}
                onChangeText={setBroadcastMessage}
                placeholder="Type your broadcast message..."
                placeholderTextColor={TEXT_MUTED}
                multiline
                maxLength={500}
                numberOfLines={4}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
            </Animated.View>

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                paddingVertical: 16,
                paddingHorizontal: 24,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                backgroundColor: (!broadcastMessage.trim() || sendingBroadcast) ? CARD : CYAN,
                borderWidth: (!broadcastMessage.trim() || sendingBroadcast) ? 1 : 0,
                borderColor: BORDER,
                shadowColor: CYAN,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: (!broadcastMessage.trim() || sendingBroadcast) ? 0 : 0.5,
                shadowRadius: 12,
                elevation: (!broadcastMessage.trim() || sendingBroadcast) ? 0 : 8,
                overflow: 'hidden',
              }}
              onPress={sendBroadcastMessage}
              disabled={!broadcastMessage.trim() || sendingBroadcast}
              activeOpacity={0.85}
            >
              {sendingBroadcast ? (
                <ActivityIndicator color={TEXT_SUB} />
              ) : (
                <>
                  <Zap size={18} color={(!broadcastMessage.trim()) ? TEXT_MUTED : BG} />
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    letterSpacing: 0.4,
                    color: (!broadcastMessage.trim()) ? TEXT_MUTED : BG,
                  }}>
                    Send to All Customers
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
