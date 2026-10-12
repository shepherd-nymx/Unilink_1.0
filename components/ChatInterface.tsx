import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  Animated,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { Send, MessageCircle, X, User, Phone, Zap, MapPin, Crosshair } from 'lucide-react-native';

const CHAT_BG = '#030810';
const SURFACE = '#060f1e';
const CARD = '#091526';
const BORDER = '#0e2240';
const BORDER_BRIGHT = '#143260';
const CYAN = '#00e5ff';
const CYAN_DIM = 'rgba(0,229,255,0.1)';
const GREEN = '#00ff88';
const TEXT = '#d0eaff';
const TEXT_SUB = '#4a7a9b';
const TEXT_MUTED = '#1a3a55';
const OWN_BUBBLE = '#0a3a7a';
const OWN_BUBBLE_BORDER = '#1455aa';
const OTHER_BUBBLE = '#0a1a2e';
const OTHER_BUBBLE_BORDER = '#0e2240';
const BROADCAST_BG = '#1a1200';
const BROADCAST_BORDER = '#3a2800';
const APP_BASE_URL = 'https://unilinkbase.com';

type Message = {
  id: string;
  sender_type: 'driver' | 'customer' | 'shop';
  sender_id: string;
  message: string;
  is_broadcast: boolean;
  read_by_receiver: boolean;
  created_at: string;
};

type ChatInterfaceProps = {
  conversationId: string | null;
  driverId?: string;
  customerId: string;
  shopId?: string;
  orderId?: string;
  currentUserType: 'driver' | 'customer' | 'shop';
  currentUserId: string;
  customerName?: string;
  customerPhone?: string;
  driverName?: string;
  driverPhone?: string;
  shopName?: string;
  shopPhone?: string;
  otherPartyName?: string;
  otherPartyPhone?: string;
  otherPartyAvatar?: string;
  otherPartyLabel?: string;
  onClose?: () => void;
  deliveryId?: string;
  driverProfilePicture?: string;
};

function AnimatedSendButton({ onPress, disabled, sending }: { onPress: () => void; disabled: boolean; sending: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!disabled) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: false }),
          Animated.timing(glow, { toValue: 0, duration: 900, useNativeDriver: false }),
        ])
      );
      pulseLoop.start();
      glowLoop.start();
      return () => { pulseLoop.stop(); glowLoop.stop(); };
    } else {
      pulse.setValue(1);
      glow.setValue(0);
    }
  }, [disabled]);

  const shadowRadius = glow.interpolate({ inputRange: [0, 1], outputRange: [6, 22] });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });

  return (
    <Animated.View style={{ transform: [{ scale: disabled ? 1 : pulse }] }}>
      <Animated.View style={{
        shadowColor: CYAN,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: disabled ? 0 : shadowRadius,
        shadowOpacity: disabled ? 0 : shadowOpacity,
        borderRadius: 26,
        elevation: disabled ? 0 : 12,
      }}>
        <TouchableOpacity
          style={[s.sendButton, disabled && s.sendButtonDisabled]}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.85}
        >
          <View style={s.sendButtonInner}>
            {sending ? (
              <ActivityIndicator size="small" color={CHAT_BG} />
            ) : (
              <Send size={18} color={disabled ? TEXT_MUTED : CHAT_BG} strokeWidth={2.5} />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideIn = useRef(new Animated.Value(isOwn ? 24 : -24)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(slideIn, { toValue: 0, tension: 90, friction: 11, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 90, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (msg.is_broadcast) {
    return (
      <Animated.View style={[s.broadcastWrapper, { opacity: fadeIn, transform: [{ scale }] }]}>
        <View style={s.broadcastBubble}>
          <View style={s.broadcastHeader}>
            <View style={s.broadcastIconWrap}>
              <Zap size={11} color="#ffaa00" />
            </View>
            <Text style={s.broadcastLabel}>BROADCAST</Text>
          </View>
          <Text style={s.broadcastText}>{msg.message}</Text>
          <Text style={s.broadcastTime}>{formatTime(msg.created_at)}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[
      s.messageWrapper,
      isOwn ? s.ownMessageWrapper : s.otherMessageWrapper,
      { opacity: fadeIn, transform: [{ translateX: slideIn }, { scale }] },
    ]}>
      <View style={[s.messageBubble, isOwn ? s.ownBubble : s.otherBubble]}>
        {isOwn && <View style={s.ownBubbleShine} />}
        <Text style={[s.messageText, isOwn ? s.ownText : s.otherText]}>
          {msg.message}
        </Text>
        <Text style={[s.messageTime, isOwn ? s.ownTime : s.otherTime]}>
          {formatTime(msg.created_at)}
        </Text>
        {isOwn && <View style={s.ownBubbleTail} />}
        {!isOwn && <View style={s.otherBubbleTail} />}
      </View>
    </Animated.View>
  );
}

export default function ChatInterface({
  conversationId: initialConversationId,
  driverId,
  customerId,
  shopId,
  orderId,
  currentUserType,
  currentUserId,
  customerName,
  customerPhone,
  driverName,
  driverPhone,
  shopName,
  shopPhone,
  otherPartyName,
  otherPartyPhone,
  otherPartyAvatar,
  otherPartyLabel,
  onClose,
  deliveryId,
  driverProfilePicture,
}: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;
  const [showLocationPanel, setShowLocationPanel] = useState(false);
  const [locAddress, setLocAddress] = useState('');
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [locDetecting, setLocDetecting] = useState(false);
  const [locSending, setLocSending] = useState(false);

  useEffect(() => {
    Animated.spring(headerAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Animated.timing(inputBorderAnim, {
      toValue: inputFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [inputFocused]);

  useEffect(() => {
    if (!initialConversationId) initializeConversation();
  }, [driverId, customerId, shopId, orderId]);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
      markMessagesAsRead();
      const unsub = subscribeToMessages();
      return unsub;
    }
  }, [conversationId]);

  const initializeConversation = async () => {
    if (!customerId || customerId === 'undefined') return;
    try {
      let rpcName: string;
      let rpcParams: Record<string, any>;

      if (shopId && customerId) {
        // Customer ↔ shop conversation (works from either side)
        rpcName = 'get_or_create_shop_conversation';
        rpcParams = { p_customer_id: customerId, p_shop_id: shopId, p_order_id: orderId || null };
      } else if (driverId && (driverId !== 'undefined')) {
        // Customer ↔ driver conversation (with optional order anchoring)
        if (orderId) {
          rpcName = 'get_or_create_driver_order_conversation';
          rpcParams = { p_customer_id: customerId, p_driver_id: driverId, p_order_id: orderId };
        } else {
          rpcName = 'get_or_create_conversation';
          rpcParams = { p_driver_id: driverId, p_customer_id: customerId, p_delivery_id: deliveryId || null };
        }
      } else {
        return;
      }

      const { data, error } = await supabase.rpc(rpcName, rpcParams);
      if (error) throw error;
      setConversationId(data);
    } catch (err) {
      console.error('Error initializing conversation:', err);
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!conversationId) return;
    try {
      await supabase.rpc('mark_messages_as_read', {
        p_conversation_id: conversationId,
        p_reader_type: currentUserType,
      });
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const subscribeToMessages = () => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages((prev) => [...prev, newMsg]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        if (newMsg.sender_type !== currentUserType) markMessagesAsRead();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const sendDmEmailNotification = async (messageText: string) => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey || !conversationId) return;

      let recipientEmail: string | null = null;
      let senderName = 'Someone';
      let chatUrl = APP_BASE_URL;

      if (currentUserType === 'customer' && driverId) {
        const { data } = await supabase.from('drivers').select('email, full_name').eq('id', driverId).maybeSingle();
        recipientEmail = data?.email || null;
        senderName = customerName || 'Customer';
        chatUrl = `${APP_BASE_URL}/driver/chat`;
      } else if (currentUserType === 'customer' && shopId) {
        const { data } = await supabase.from('shops').select('contact_email, name').eq('id', shopId).maybeSingle();
        recipientEmail = data?.contact_email || null;
        senderName = customerName || 'Customer';
        chatUrl = `${APP_BASE_URL}/shop/chat`;
      } else if (currentUserType === 'driver' && customerId) {
        const { data } = await supabase.from('customers').select('email, full_name').eq('id', customerId).maybeSingle();
        recipientEmail = data?.email || null;
        senderName = driverName || 'Your messenger';
        chatUrl = `${APP_BASE_URL}/customer/chat`;
      } else if (currentUserType === 'shop' && customerId) {
        const { data } = await supabase.from('customers').select('email, full_name').eq('id', customerId).maybeSingle();
        recipientEmail = data?.email || null;
        senderName = shopName || 'Shop';
        chatUrl = `${APP_BASE_URL}/customer/marketplace/chat`;
      }

      if (!recipientEmail) return;

      await fetch(`${supabaseUrl}/functions/v1/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({
          type: 'new_dm',
          to: recipientEmail,
          data: {
            senderName,
            preview: messageText.length > 120 ? messageText.slice(0, 120) + '...' : messageText,
            chatUrl,
          },
        }),
      });
    } catch {
      // fire-and-forget — never block the chat
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || sending) return;
    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');
    try {
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_type: currentUserType,
        sender_id: currentUserId,
        message: messageText,
        is_broadcast: false,
      });
      if (error) throw error;
      sendDmEmailNotification(messageText);
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const detectLocGps = async () => {
    setLocDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocLat(pos.coords.latitude);
      setLocLng(pos.coords.longitude);
    } catch {
    } finally {
      setLocDetecting(false);
    }
  };

  const sendLocationMessage = async () => {
    if (!locAddress.trim() || locLat == null || locLng == null || !conversationId || locSending) return;
    setLocSending(true);
    const parts = ['📍 Delivery Location', `Address: ${locAddress.trim()}`];
    parts.push(`GPS: ${locLat.toFixed(5)}, ${locLng.toFixed(5)}`);
    parts.push(`Map: https://www.google.com/maps?q=${locLat},${locLng}`);
    const messageText = parts.join('\n');
    try {
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_type: currentUserType,
        sender_id: currentUserId,
        message: messageText,
        is_broadcast: false,
      });
      if (error) throw error;
      sendDmEmailNotification(messageText);
      setLocAddress('');
      setLocLat(null);
      setLocLng(null);
      setShowLocationPanel(false);
    } catch (err) {
      console.error('Error sending location:', err);
    } finally {
      setLocSending(false);
    }
  };

  const getDisplayName = () => {
    if (otherPartyName) return otherPartyName;
    if (currentUserType === 'driver') return customerName || 'Customer';
    if (currentUserType === 'shop') return customerName || 'Customer';
    return driverName || shopName || 'Driver';
  };

  const getDisplayPhone = () => {
    if (otherPartyPhone) return otherPartyPhone;
    if (currentUserType === 'driver') return customerPhone;
    if (currentUserType === 'shop') return customerPhone;
    return driverPhone || shopPhone;
  };

  const getDisplayLabel = () => {
    if (otherPartyLabel) return otherPartyLabel;
    if (currentUserType === 'driver') return 'Customer';
    if (currentUserType === 'shop') return 'Customer';
    return 'Your Driver';
  };

  const displayPhone = getDisplayPhone();
  const displayLabel = getDisplayLabel();

  const inputBorderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BORDER, CYAN],
  });

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <Animated.View style={[s.header, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
      }]}>
        <View style={s.headerGlowLine} />
        <View style={s.headerLeft}>
          <View style={{ position: 'relative' }}>
            {currentUserType === 'customer' && (driverProfilePicture || otherPartyAvatar) ? (
              <View style={s.avatarRing}>
                <Image source={{ uri: driverProfilePicture || otherPartyAvatar }} style={s.avatarImage} resizeMode="cover" />
              </View>
            ) : (
              <View style={s.avatarPlaceholder}>
                <User size={20} color={CYAN} />
              </View>
            )}
            <View style={s.onlineDot} />
          </View>
          <View style={s.headerTextBlock}>
            <Text style={s.headerName}>{getDisplayName()}</Text>
            {displayPhone ? (
              <View style={s.headerSubRow}>
                <Phone size={10} color={GREEN} />
                <Text style={s.headerPhone}>{displayPhone}</Text>
              </View>
            ) : (
              <View style={s.headerSubRow}>
                <View style={s.statusPulse} />
                <Text style={s.headerStatus}>{displayLabel}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={s.headerActions}>
          {displayPhone && (
            <TouchableOpacity
              style={s.callBtn}
              onPress={() => Linking.openURL(`tel:${displayPhone}`)}
              activeOpacity={0.8}
            >
              <Phone size={17} color={GREEN} />
            </TouchableOpacity>
          )}
          {onClose && (
            <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <X size={18} color="#ff4466" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {loading ? (
        <View style={s.loadingContainer}>
          <View style={s.loadingRing}>
            <ActivityIndicator size="large" color={CYAN} />
          </View>
          <Text style={s.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollViewRef}
            style={s.messagesList}
            contentContainerStyle={s.messagesContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View style={s.emptyState}>
                <View style={s.emptyRingOuter}>
                  <View style={s.emptyRingInner}>
                    <MessageCircle size={32} color={CYAN} />
                  </View>
                </View>
                <Text style={s.emptyTitle}>No messages yet</Text>
                <Text style={s.emptySub}>Send a message to start the conversation</Text>
              </View>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={msg.sender_type === currentUserType}
                />
              ))
            )}
          </ScrollView>

          {currentUserType === 'customer' && (
            <View style={s.locSection}>
              <TouchableOpacity
                style={s.locToggle}
                onPress={() => setShowLocationPanel(v => !v)}
                activeOpacity={0.8}
              >
                <MapPin size={13} color={CYAN} />
                <Text style={s.locToggleText}>{showLocationPanel ? 'Hide Location Details' : 'Add Delivery Location'}</Text>
              </TouchableOpacity>
              {showLocationPanel && (
                <View style={s.locPanel}>
                  <TextInput
                    style={s.locInput}
                    value={locAddress}
                    onChangeText={setLocAddress}
                    placeholder="e.g. Stand 4521, Brentwood, Bulawayo"
                    placeholderTextColor={TEXT_MUTED}
                    multiline
                    maxLength={200}
                    {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
                  />
                  <View style={s.locActions}>
                    <TouchableOpacity
                      style={s.locGpsBtn}
                      onPress={detectLocGps}
                      disabled={locDetecting || locLat != null}
                      activeOpacity={0.8}
                    >
                      {locDetecting ? (
                        <ActivityIndicator size="small" color={CYAN} />
                      ) : (
                        <Crosshair size={13} color={CYAN} />
                      )}
                      <Text style={s.locGpsText}>{locLat != null ? 'GPS Captured' : 'Attach GPS (Required)'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.locSendBtn, (!locAddress.trim() || locLat == null || locSending) && s.locSendBtnDisabled]}
                      onPress={sendLocationMessage}
                      disabled={!locAddress.trim() || locLat == null || locSending}
                      activeOpacity={0.8}
                    >
                      <Send size={12} color={CHAT_BG} />
                      <Text style={s.locSendText}>{locSending ? 'Sending...' : 'Send Location'}</Text>
                    </TouchableOpacity>
                  </View>
                  {locLat != null && locLng != null ? (
                    <Text style={s.locCoordsPreview}>GPS: {locLat.toFixed(5)}, {locLng.toFixed(5)}</Text>
                  ) : (
                    <Text style={s.locGpsRequiredNote}>GPS location is required before sending.</Text>
                  )}
                </View>
              )}
            </View>
          )}

          <View style={s.inputArea}>
            <Animated.View style={[s.inputWrap, { borderColor: inputBorderColor }]}>
              <TextInput
                style={s.input}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Message..."
                placeholderTextColor={TEXT_MUTED}
                multiline
                maxLength={500}
                onSubmitEditing={sendMessage}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
              />
            </Animated.View>
            <AnimatedSendButton
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
              sending={sending}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CHAT_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 18,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGlowLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1.5,
    backgroundColor: CYAN,
    opacity: 0.6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: CYAN,
    overflow: 'hidden',
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: CYAN,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GREEN,
    borderWidth: 2,
    borderColor: SURFACE,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTextBlock: {
    gap: 3,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: 0.3,
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  headerStatus: {
    fontSize: 12,
    color: GREEN,
    fontWeight: '500',
  },
  headerPhone: {
    fontSize: 12,
    color: GREEN,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,255,136,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,51,102,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: CYAN_DIM,
    borderWidth: 1,
    borderColor: BORDER_BRIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: TEXT_SUB,
    letterSpacing: 0.5,
  },
  messagesList: {
    flex: 1,
    backgroundColor: CHAT_BG,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 10,
    gap: 2,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 14,
  },
  emptyRingOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyRingInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: CYAN,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_SUB,
    letterSpacing: 0.3,
  },
  emptySub: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  input: {
    fontSize: 15,
    color: TEXT,
    maxHeight: 100,
    lineHeight: 22,
  },
  locSection: {
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  locToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  locToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: CYAN,
    letterSpacing: 0.3,
  },
  locPanel: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 10,
    gap: 8,
    marginBottom: 8,
  },
  locInput: {
    fontSize: 14,
    color: TEXT,
    backgroundColor: CHAT_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
    textAlignVertical: 'center',
  },
  locActions: {
    flexDirection: 'row',
    gap: 8,
  },
  locGpsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: CYAN_DIM,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.35)',
  },
  locGpsText: {
    fontSize: 11,
    fontWeight: '700',
    color: CYAN,
  },
  locSendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: GREEN,
  },
  locSendBtnDisabled: {
    opacity: 0.4,
  },
  locSendText: {
    fontSize: 11,
    fontWeight: '800',
    color: CHAT_BG,
  },
  locCoordsPreview: {
    fontSize: 10,
    color: TEXT_SUB,
    letterSpacing: 0.3,
  },
  locGpsRequiredNote: {
    fontSize: 10,
    color: '#ffaa00',
    letterSpacing: 0.3,
  },
  messageWrapper: {
    marginBottom: 8,
  },
  ownMessageWrapper: {
    alignItems: 'flex-end',
  },
  otherMessageWrapper: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '76%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  ownBubble: {
    backgroundColor: OWN_BUBBLE,
    borderWidth: 1,
    borderColor: OWN_BUBBLE_BORDER,
    borderBottomRightRadius: 4,
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  otherBubble: {
    backgroundColor: OTHER_BUBBLE,
    borderWidth: 1,
    borderColor: OTHER_BUBBLE_BORDER,
    borderBottomLeftRadius: 4,
  },
  ownBubbleShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '45%' as any,
    backgroundColor: 'rgba(0,229,255,0.04)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  ownBubbleTail: {
    position: 'absolute',
    bottom: 0,
    right: -1,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: OWN_BUBBLE_BORDER,
    borderLeftWidth: 8,
    borderLeftColor: 'transparent',
  },
  otherBubbleTail: {
    position: 'absolute',
    bottom: 0,
    left: -1,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: OTHER_BUBBLE_BORDER,
    borderRightWidth: 8,
    borderRightColor: 'transparent',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  ownText: {
    color: '#cde8ff',
  },
  otherText: {
    color: '#a0c8e8',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  ownTime: {
    color: 'rgba(160,210,255,0.45)',
    textAlign: 'right',
  },
  otherTime: {
    color: 'rgba(74,122,155,0.7)',
  },
  broadcastWrapper: {
    alignItems: 'center',
    marginVertical: 6,
  },
  broadcastBubble: {
    backgroundColor: BROADCAST_BG,
    borderWidth: 1,
    borderColor: BROADCAST_BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '86%',
    gap: 6,
  },
  broadcastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  broadcastIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,170,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  broadcastLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffaa00',
    letterSpacing: 2,
  },
  broadcastText: {
    fontSize: 14,
    color: '#e0c880',
    lineHeight: 21,
  },
  broadcastTime: {
    fontSize: 10,
    color: 'rgba(180,150,60,0.6)',
    marginTop: 2,
  },
  sendButton: {
    backgroundColor: CYAN,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  sendButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    shadowOpacity: 0,
    elevation: 0,
  },
});
