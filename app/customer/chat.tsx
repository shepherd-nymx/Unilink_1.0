import PageSkeleton from '@/components/PageSkeleton';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Truck, Radio, MessageSquare } from 'lucide-react-native';
import ChatInterface from '@/components/ChatInterface';

const BG = '#030810';
const SURFACE = '#060f1e';
const CARD = '#091526';
const BORDER = '#0e2240';
const CYAN = '#00e5ff';
const CYAN_DIM = 'rgba(0,229,255,0.1)';
const GREEN = '#00ff88';
const TEXT = '#d0eaff';
const TEXT_SUB = '#4a7a9b';
const TEXT_MUTED = '#1a3a55';

type Delivery = {
  id: string;
  driver_id: string;
  status: string;
  drivers: {
    id: string;
    full_name: string;
    phone_number: string;
    profile_picture_url?: string;
  };
};

function PulsingRing() {
  const scale1 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.5)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale1, { toValue: 1.8, duration: 1600, useNativeDriver: true }),
          Animated.timing(scale1, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity1, { toValue: 0, duration: 1600, useNativeDriver: true }),
          Animated.timing(opacity1, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    const loop2 = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(scale2, { toValue: 1.5, duration: 1600, useNativeDriver: true }),
          Animated.timing(scale2, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(opacity2, { toValue: 0, duration: 1600, useNativeDriver: true }),
          Animated.timing(opacity2, { toValue: 0.3, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop1.start();
    loop2.start();
    return () => { loop1.stop(); loop2.stop(); };
  }, []);

  return (
    <>
      <Animated.View style={{
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: CYAN,
        transform: [{ scale: scale1 }],
        opacity: opacity1,
      }} />
      <Animated.View style={{
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: CYAN,
        transform: [{ scale: scale2 }],
        opacity: opacity2,
      }} />
    </>
  );
}

export default function CustomerChat() {
  const router = useRouter();
  const { customerId, customerName } = useLocalSearchParams();

  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    loadActiveDelivery();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [customerId]);

  const loadActiveDelivery = async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id,
          driver_id,
          status,
          drivers:driver_id (
            id,
            full_name,
            phone_number,
            profile_picture_url
          )
        `)
        .eq('customer_id', customerId)
        .in('status', ['pending', 'accepted', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data && data.driver_id) {
        setActiveDelivery(data as any);
        await initializeConversation(data.driver_id, data.id);
      }
    } catch (err) {
      console.error('Error loading active delivery:', err);
    } finally {
      setLoading(false);
    }
  };

  const initializeConversation = async (driverId: string, deliveryId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        p_driver_id: driverId,
        p_customer_id: customerId,
        p_delivery_id: deliveryId,
      });
      if (error) throw error;
      setConversationId(data);
    } catch (err) {
      console.error('Error initializing conversation:', err);
    }
  };

  if (loading) {
    return <PageSkeleton page="customer/chat" onBack={() => router.back()}/>;
  }

  if (!activeDelivery || !activeDelivery.driver_id) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <View style={{
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
        }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: CYAN, opacity: 0.6 }} />
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 36, height: 36, borderRadius: 8,
              backgroundColor: CYAN_DIM, borderWidth: 1, borderColor: CYAN,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <ArrowLeft size={18} color={CYAN} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: TEXT_MUTED }}>MESSENGER</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT }}>Messages</Text>
          </View>
        </View>

        <Animated.View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 40,
          gap: 20,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}>
          <View style={{ width: 100, height: 100, justifyContent: 'center', alignItems: 'center' }}>
            <PulsingRing />
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: CARD,
              borderWidth: 2, borderColor: CYAN,
              justifyContent: 'center', alignItems: 'center',
              shadowColor: CYAN,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 8,
            }}>
              <Radio size={34} color={CYAN} />
            </View>
          </View>

          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: TEXT_SUB, textAlign: 'center', letterSpacing: 0.3 }}>
              No active delivery
            </Text>
            <Text style={{ fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 22 }}>
              Chat becomes available once your order is accepted by a driver
            </Text>
          </View>

          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: CARD,
            borderWidth: 1,
            borderColor: BORDER,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffaa00' }} />
            <Text style={{ fontSize: 12, color: TEXT_SUB }}>Waiting for driver assignment</Text>
          </View>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 28,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: CYAN,
              shadowColor: CYAN,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 14,
              elevation: 8,
            }}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Truck size={16} color={BG} />
            <Text style={{ color: BG, fontSize: 15, fontWeight: '700' }}>Back to Dashboard</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 58,
          left: 16,
          zIndex: 10,
          width: 38,
          height: 38,
          borderRadius: 8,
          backgroundColor: SURFACE,
          borderWidth: 1,
          borderColor: BORDER,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: CYAN,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 5,
        }}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <ArrowLeft size={18} color={TEXT_SUB} />
      </TouchableOpacity>

      <ChatInterface
        conversationId={conversationId}
        driverId={activeDelivery.driver_id}
        customerId={customerId as string}
        currentUserType="customer"
        currentUserId={customerId as string}
        driverName={activeDelivery.drivers.full_name}
        driverPhone={activeDelivery.drivers.phone_number}
        customerName={customerName as string}
        deliveryId={activeDelivery.id}
        driverProfilePicture={activeDelivery.drivers.profile_picture_url}
      />
    </View>
  );
}
