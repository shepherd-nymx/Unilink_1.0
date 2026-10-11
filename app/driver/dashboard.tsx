import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Image,
  Modal,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Settings, MapPin, Clock, DollarSign, CircleCheck as CheckCircle, Package, Users, Key, Bell, Zap, ShoppingBag, Navigation, X, ZoomIn, Navigation2, Circle as HelpCircle, Phone, Truck, RotateCcw, TriangleAlert as AlertTriangle, Lock } from 'lucide-react-native';
import AnimatedChatIcon from '@/components/AnimatedChatIcon';
import InAppNotificationBanner from '@/components/InAppNotificationBanner';
import SwitchLocationModal from '@/components/SwitchLocationModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useTermsGuard } from '@/hooks/useTermsGuard';
import { useNotifications } from '@/contexts/NotificationContext';
import { setCurrentUser, registerForPushNotificationsOnLogin } from '@/lib/notification-service';
import AnnouncementPopup from '@/components/AnnouncementPopup';
import DriverTutorial from '@/components/DriverTutorial';
import { saveUserData, clearUserData, loadUserData } from '@/lib/storage-service';
import NotificationPermissionModal from '@/components/NotificationPermissionModal';

function FlashingDot({ count, color = '#00e5ff' }: { count: number; color?: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (count === 0) return;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.spring(scale, { toValue: 1.3, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [count]);

  if (count === 0) return null;

  return (
    <Animated.View style={[s.requestDot, { opacity, transform: [{ scale }], backgroundColor: '#ef4444' }]}>
      <Text style={s.requestDotText}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}

const CYAN = '#00e5ff';
const CYAN_DIM = 'rgba(0,229,255,0.12)';
const CYAN_BORDER = 'rgba(0,229,255,0.25)';
const GREEN = '#00ff88';
const GREEN_DIM = 'rgba(0,255,136,0.1)';
const AMBER = '#ffb300';
const AMBER_DIM = 'rgba(255,179,0,0.1)';
const BG = '#030810';
const CARD = '#070f1c';
const CARD2 = '#0b1628';
const TEXT = '#d0eaff';
const TEXT2 = '#4a7a9b';
const TEXT3 = '#1e3a5f';

type Delivery = {
  id: string;
  items: any[];
  total_amount: number;
  delivery_fee: number;
  payment_option: string;
  customer_latitude: number;
  customer_longitude: number;
  status: string;
  created_at: string;
  payment_received: boolean;
  preferred_shops: string | null;
  item_image_url: string | null;
  delivery_mode?: string;
  driver_id?: string | null;
  customers: {
    full_name: string;
    phone_number: string;
  };
};

function GlowButton({ onPress, label, icon, color = CYAN, dim = CYAN_DIM, disabled = false }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.9, duration: 1400, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.4, duration: 1400, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.65] });

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.5 : 1 }}>
      <Animated.View style={{
        borderRadius: 10,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity,
        shadowRadius: 12,
        elevation: 8,
      }}>
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            paddingVertical: 10, paddingHorizontal: 12,
            backgroundColor: dim, borderRadius: 10,
            borderWidth: 1, borderColor: color + '55', gap: 6,
          }}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={disabled}
          activeOpacity={0.85}
        >
          {icon}
          <Text style={{ color, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

function PrimaryGlowButton({ onPress, label, icon, disabled = false }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.5, duration: 1000, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.5 : 1 }}>
      <Animated.View style={{
        borderRadius: 10, shadowColor: GREEN,
        shadowOffset: { width: 0, height: 0 }, shadowOpacity, shadowRadius: 14, elevation: 10,
      }}>
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            paddingVertical: 11, paddingHorizontal: 16,
            backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 10,
            borderWidth: 1.5, borderColor: GREEN + '66', gap: 7,
          }}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={disabled}
          activeOpacity={0.85}
        >
          {icon}
          <Text style={{ color: GREEN, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

export default function DriverDashboard() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [resolvedDriverId] = useState<string | undefined>(() => {
    const fromParams = params.driverId as string;
    if (fromParams) return fromParams;
    const stored = loadUserData();
    return stored?.type === 'driver' ? stored.id : undefined;
  });
  const driverId = resolvedDriverId;
  const driverName = params.driverName as string;
  const { colors } = useTheme();
  const { isChecking, isAccepted } = useTermsGuard('driver');
  const {
    unreadMessageCount,
    pendingDeliveriesCount,
    pendingRequestsCount,
    activeShopDeliveriesCount,
    hasNotificationPermission,
    inAppMessage,
    clearInAppMessage,
    requestNotificationPermission,
    refreshPendingDeliveries
  } = useNotifications();
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  const [acceptedDeliveries, setAcceptedDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const driverInfoRef = useRef<any>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [myInterests, setMyInterests] = useState<Set<string>>(new Set());
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    show: boolean;
    type: 'accept' | 'decline' | 'deliver';
    deliveryId: string;
    delivery?: any;
  }>({ show: false, type: 'accept', deliveryId: '' });
  const [undoInfo, setUndoInfo] = useState<{ deliveryId: string; expiresAt: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [showSwitchLocation, setShowSwitchLocation] = useState(false);
  const [activeUniversityId, setActiveUniversityId] = useState<string | null>(null);
  const [activeUniversityName, setActiveUniversityName] = useState<string>('');
  const [showTutorial, setShowTutorial] = useState(false);
  const activeUniversityIdRef = useRef<string | null>(null);

  const headerGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlow, { toValue: 1, duration: 2500, useNativeDriver: false }),
        Animated.timing(headerGlow, { toValue: 0, duration: 2500, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (!isChecking && !driverId) {
      router.replace('/driver/login');
      return;
    }
    if (!isChecking && isAccepted && driverId) {
      setCurrentUser(driverId, 'driver');
      saveUserData({ id: driverId, type: 'driver' });
      registerForPushNotificationsOnLogin(driverId, 'driver').catch(() => {});
      loadDriverInfo();

      const tutorialKey = `driver_tutorial_seen_${driverId}`;
      const seen = typeof window !== 'undefined' ? localStorage.getItem(tutorialKey) : null;
      if (!seen) {
        setTimeout(() => setShowTutorial(true), 1500);
      }

      const channel = supabase
        .channel('driver-deliveries')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deliveries', filter: `status=eq.pending` },
          () => { if (!driverInfoRef.current) return; showNotification('New delivery order received!'); loadDeliveries(); refreshPendingDeliveries(); }
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliveries' },
          () => { loadDeliveries(); refreshPendingDeliveries(); }
        )
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'deliveries' },
          () => { loadDeliveries(); refreshPendingDeliveries(); }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'driver_requests', filter: `driver_id=eq.${driverId}` },
          (payload: any) => {
            if (payload.new?.status === 'selected') {
              showNotification('You have been chosen! The shopper selected you for their delivery.');
              loadDeliveries();
              refreshPendingDeliveries();
            } else if (payload.new?.status === 'cancelled') {
              showNotification('Another driver was selected for this request.');
              loadMyInterests();
              loadDeliveries();
              refreshPendingDeliveries();
            } else {
              loadMyInterests();
            }
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [isChecking, isAccepted, driverId, requestNotificationPermission, refreshPendingDeliveries]);

  useEffect(() => {
    if (driverInfo) loadDeliveries();
  }, [driverInfo]);

  const loadDriverInfo = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('drivers')
        .select('*, universities!drivers_university_id_fkey(name), active_uni:universities!drivers_active_university_id_fkey(name)')
        .eq('id', driverId!)
        .single();
      if (dbError) throw dbError;
      driverInfoRef.current = data;
      setDriverInfo(data);
      const effectiveId = data.active_university_id ?? data.university_id;
      const effectiveName = (data.active_uni as any)?.name ?? (data.universities as any)?.name ?? '';
      activeUniversityIdRef.current = effectiveId;
      setActiveUniversityId(effectiveId);
      setActiveUniversityName(effectiveName);
    } catch (err: any) { setError(err.message || 'Failed to load driver info'); }
  };

  const loadDeliveries = async () => {
    if (!driverId) { setLoading(false); return; }
    try {
      await supabase.rpc('delete_expired_pending_orders');
      const driverUniversityId = activeUniversityIdRef.current
        ?? driverInfoRef.current?.active_university_id
        ?? driverInfoRef.current?.university_id;

      const { data: directPending, error: directError } = await supabase
        .from('deliveries')
        .select('*, customers!inner (full_name, phone_number, university_id)')
        .eq('status', 'pending')
        .eq('delivery_mode', 'direct')
        .eq('driver_id', driverId)
        .eq('customers.university_id', driverUniversityId)
        .order('created_at', { ascending: false });

      if (directError) throw directError;

      const { data: openPending, error: openError } = await supabase
        .from('deliveries')
        .select('*, customers!inner (full_name, phone_number, university_id)')
        .eq('status', 'pending')
        .eq('delivery_mode', 'open_request')
        .is('driver_id', null)
        .eq('customers.university_id', driverUniversityId)
        .order('created_at', { ascending: false });

      if (openError) throw openError;

      const combined = [...(directPending || []), ...(openPending || [])];
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPendingDeliveries(combined);

      const { data: accepted, error: acceptedError } = await supabase
        .from('deliveries')
        .select('*, customers (full_name, phone_number)')
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'in_progress'])
        .order('accepted_at', { ascending: false });

      if (acceptedError) throw acceptedError;
      setAcceptedDeliveries(accepted || []);

      await loadMyInterests();
    } catch (err: any) { setError(err.message || 'Failed to load deliveries'); }
    finally { setLoading(false); }
  };

  const loadMyInterests = async () => {
    if (!driverId) return;
    const { data } = await supabase
      .from('driver_requests')
      .select('delivery_id')
      .eq('driver_id', driverId)
      .eq('status', 'accepted');
    if (data) {
      setMyInterests(new Set(data.map((r: any) => r.delivery_id)));
    }
  };

  const withdrawInterest = async (deliveryId: string) => {
    if (!driverId || withdrawingId) return;
    setWithdrawingId(deliveryId);
    try {
      await supabase
        .from('driver_requests')
        .update({ status: 'cancelled' })
        .eq('delivery_id', deliveryId)
        .eq('driver_id', driverId);
      setMyInterests(prev => { const n = new Set(prev); n.delete(deliveryId); return n; });
      showNotification('You have withdrawn your interest.');
    } catch (err: any) {
      setError(err.message || 'Failed to withdraw');
    } finally {
      setWithdrawingId(null);
    }
  };

  const showConfirmDialog = (deliveryId: string) => {
    const delivery = pendingDeliveries.find(d => d.id === deliveryId);
    setConfirmAction({ show: true, type: 'accept', deliveryId, delivery });
  };

  const handleConfirmAction = async () => {
    const { deliveryId, type } = confirmAction;
    setConfirmAction({ show: false, type: 'accept', deliveryId: '' });
    if (type === 'deliver') {
      await markAsDelivered(deliveryId);
    } else {
      await acceptDelivery(deliveryId);
    }
  };

  const handleCancelAction = () => setConfirmAction({ show: false, type: 'accept', deliveryId: '' });

  const handleDeliverPress = (deliveryId: string) => {
    setConfirmAction({ show: true, type: 'deliver', deliveryId });
  };

  const acceptDelivery = async (deliveryId: string) => {
    if (!driverId) { setError('Session expired. Please log out and log in again.'); return; }
    try {
      const delivery = pendingDeliveries.find(d => d.id === deliveryId);
      if (delivery?.delivery_mode === 'open_request') {
        const { error: reqError } = await supabase
          .from('driver_requests')
          .upsert({
            delivery_id: deliveryId,
            driver_id: driverId,
            status: 'accepted',
            responded_at: new Date().toISOString(),
          }, { onConflict: 'delivery_id,driver_id' });
        if (reqError) throw reqError;
        showNotification('Your acceptance was sent! Waiting for customer to pick you.');
      } else {
        const { error: dbError } = await supabase.from('deliveries')
          .update({ driver_id: driverId, status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', deliveryId);
        if (dbError) throw dbError;
      }
      loadDeliveries();
    } catch (err: any) { setError(err.message || 'Failed to accept delivery'); }
  };

  const confirmPaymentReceived = async (deliveryId: string) => {
    try {
      const { error: dbError } = await supabase.from('deliveries')
        .update({ payment_received: true, status: 'in_progress' }).eq('id', deliveryId);
      if (dbError) throw dbError;
      loadDeliveries();
    } catch (err: any) { setError(err.message || 'Failed to confirm payment'); }
  };

  const markAsDelivered = async (deliveryId: string) => {
    try {
      const { error: dbError } = await supabase.from('deliveries')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', deliveryId);
      if (dbError) throw dbError;
      loadDeliveries();
      // Open 10-minute undo window
      const expiresAt = Date.now() + 10 * 60 * 1000;
      setUndoInfo({ deliveryId, expiresAt });
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoInfo(null), 10 * 60 * 1000);
    } catch (err: any) { setError(err.message || 'Failed to mark as delivered'); }
  };

  const handleUndoDeliver = async () => {
    if (!undoInfo) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const { deliveryId, expiresAt } = undoInfo;
    setUndoInfo(null);
    if (Date.now() > expiresAt) {
      showNotification('Undo window has expired — cannot reverse.');
      return;
    }
    try {
      const { data: current } = await supabase.from('deliveries')
        .select('delivered_snapshot_expires_at').eq('id', deliveryId).maybeSingle();
      if (!current?.delivered_snapshot_expires_at || new Date(current.delivered_snapshot_expires_at) < new Date()) {
        showNotification('Undo window has expired on the server — cannot reverse.');
        return;
      }
      const { error: undoErr } = await supabase.from('deliveries')
        .update({ status: 'in_progress', delivered_at: null } as any).eq('id', deliveryId);
      if (undoErr) throw undoErr;
      loadDeliveries();
      showNotification('Delivery restored to In Progress.');
    } catch (err: any) { setError(err.message || 'Failed to undo delivery'); }
  };

  const handleLocationSwitched = (universityId: string, universityName: string) => {
    activeUniversityIdRef.current = universityId;
    setActiveUniversityId(universityId);
    setActiveUniversityName(universityName);
    if (driverInfoRef.current) {
      driverInfoRef.current = { ...driverInfoRef.current, active_university_id: universityId };
    }
    loadDeliveries();
    showNotification(`Location switched to ${universityName}`);
  };

  const openInMaps = (latitude: number, longitude: number) => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
  };

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 5000);
  };

  const headerBorderColor = headerGlow.interpolate({
    inputRange: [0, 1], outputRange: ['rgba(0,229,255,0.08)', 'rgba(0,229,255,0.3)']
  });

  if (isChecking) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={CYAN} />
        <Text style={{ color: TEXT2, marginTop: 16, fontSize: 13 }}>Verifying access...</Text>
      </View>
    );
  }

  if (!isAccepted) return null;

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={CYAN} />
      </View>
    );
  }

  const isOnline = driverInfo?.is_available;

  const tokenExpiry = driverInfo?.key_expires_at ? new Date(driverInfo.key_expires_at) : null;
  const now = new Date();
  const isTokenExpired = !tokenExpiry || tokenExpiry <= now;
  const tokenDaysLeft = tokenExpiry ? Math.ceil((tokenExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const showTokenWarning = !isTokenExpired && tokenDaysLeft <= 7;

  return (
    <View style={s.container}>
      <NotificationPermissionModal userType="driver" />
      <InAppNotificationBanner
        visible={!!inAppMessage}
        title={inAppMessage?.title || ''}
        body={inAppMessage?.body || ''}
        onPress={() => { clearInAppMessage(); router.push({ pathname: '/driver/chat', params: { driverId, driverName } }); }}
        onDismiss={clearInAppMessage}
      />

      <Animated.View style={[s.header, { borderBottomColor: headerBorderColor }]}>
        <View style={s.headerLeft}>
          <View style={s.statusDot}>
            <View style={[s.dot, { backgroundColor: isOnline ? GREEN : '#ff4444' }]} />
            <Text style={[s.statusText, { color: isOnline ? GREEN : '#ff4444' }]}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
          <Text style={s.headerTitle} numberOfLines={1}>{driverName}</Text>
          <Text style={s.headerSubtitle} numberOfLines={1}>
            {driverInfo?.delivery_type}
            {driverInfo?.availability_start_time && driverInfo?.availability_end_time
              ? `  ·  ${driverInfo.availability_start_time.substring(0, 5)}–${driverInfo.availability_end_time.substring(0, 5)}`
              : ''}
          </Text>
          {activeUniversityName ? (
            <TouchableOpacity style={s.locationPill} onPress={() => setShowSwitchLocation(true)} activeOpacity={0.75}>
              <MapPin size={10} color={CYAN} />
              <Text style={s.locationPillText} numberOfLines={1}>{activeUniversityName}</Text>
              <Navigation2 size={9} color={CYAN} />
            </TouchableOpacity>
          ) : null}
          {driverInfo?.current_key && (
            <View style={s.keyPill}>
              <Key size={10} color={GREEN} />
              <Text style={s.keyText} numberOfLines={1}>{driverInfo.current_key}</Text>
              {driverInfo.key_expires_at && (
                <Text style={s.keyExpiry}>exp {new Date(driverInfo.key_expires_at).toLocaleDateString()}</Text>
              )}
            </View>
          )}
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowTutorial(true)} activeOpacity={0.75}>
          <HelpCircle size={18} color={CYAN} />
        </TouchableOpacity>
      </Animated.View>

      {error ? (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {showTokenWarning && (
        <View style={s.tokenWarningBanner}>
          <AlertTriangle size={16} color="#000" />
          <Text style={s.tokenWarningText}>
            {tokenDaysLeft === 0
              ? 'Your access token expires today — contact admin to renew.'
              : `Access token expires in ${tokenDaysLeft} day${tokenDaysLeft === 1 ? '' : 's'} — contact admin to renew.`}
          </Text>
        </View>
      )}

      {notification && (
        <View style={s.notifBanner}>
          <Bell size={14} color={CYAN} />
          <Text style={s.notifText}>{notification}</Text>
        </View>
      )}

      {isTokenExpired ? (
        <View style={s.pausedScreen}>
          <View style={s.pausedIconWrap}>
            <Lock size={48} color={AMBER} strokeWidth={1.5} />
          </View>
          <Text style={s.pausedTitle}>Portal Paused</Text>
          <Text style={s.pausedBody}>
            Your monthly access token has{tokenExpiry ? ` expired on ${tokenExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ' not been assigned yet'}.
            Contact your admin to renew your token and restore full access.
          </Text>
          {tokenExpiry && (
            <View style={s.pausedExpiredRow}>
              <Key size={14} color={AMBER} />
              <Text style={s.pausedExpiredText}>Expired: {tokenExpiry.toLocaleString()}</Text>
            </View>
          )}
        </View>
      ) : (
        <>
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {acceptedDeliveries.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>Active Orders</Text>
              <View style={s.countPill}>
                <Text style={s.countText}>{acceptedDeliveries.length}</Text>
              </View>
            </View>

            <View style={s.cardsList}>
              {acceptedDeliveries.map(delivery => (
                <View key={delivery.id} style={s.acceptedCard}>
                  <View style={s.cardGlow} />

                  {delivery.payment_received && (
                    <View style={s.paidBadge}>
                      <CheckCircle size={11} color={GREEN} />
                      <Text style={s.paidBadgeText}>PAID · AWAITING DELIVERY</Text>
                    </View>
                  )}

                  <View style={s.cardTop}>
                    <View style={s.customerRow}>
                      <View style={s.avatarSmall}>
                        <Text style={s.avatarLetter}>{delivery.customers.full_name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={s.customerName}>{delivery.customers.full_name}</Text>
                    </View>
                    <View style={s.feePill}>
                      <Text style={s.feeText}>${delivery.delivery_fee.toFixed(2)}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={s.contactBar}
                    onPress={() => Linking.openURL(`tel:${delivery.customers.phone_number}`)}
                    activeOpacity={0.75}
                  >
                    <Phone size={13} color={GREEN} />
                    <Text style={s.contactBarText}>{delivery.customers.phone_number}</Text>
                    <Text style={s.contactBarCta}>Tap to call</Text>
                  </TouchableOpacity>

                  <View style={s.infoGrid}>
                    <View style={s.infoItem}>
                      <DollarSign size={11} color={TEXT2} />
                      <Text style={s.infoVal}>${delivery.total_amount.toFixed(2)}</Text>
                    </View>
                    <View style={s.infoItem}>
                      <Zap size={11} color={TEXT2} />
                      <Text style={s.infoVal}>{delivery.payment_option === 'pay_on_delivery' ? 'Cash' : 'Paynow'}</Text>
                    </View>
                    <View style={s.infoItem}>
                      <Clock size={11} color={TEXT2} />
                      <Text style={s.infoVal}>{new Date(delivery.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                  </View>

                  <View style={s.itemsBlock}>
                    <Text style={s.itemsLabel}>Items ({delivery.items.length})</Text>
                    {delivery.items.map((item: any, i: number) => (
                      <View key={i} style={s.itemLine}>
                        <Text style={s.itemDot}>▸</Text>
                        <Text style={s.itemName}>{item.name} ×{item.quantity}</Text>
                        <Text style={s.itemAmt}>${(item.price * item.quantity).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>

                  {delivery.preferred_shops && (
                    <View style={s.shopsPill}>
                      <ShoppingBag size={11} color={AMBER} />
                      <Text style={s.shopsText} numberOfLines={1}>{delivery.preferred_shops}</Text>
                    </View>
                  )}

                  {delivery.item_image_url && (
                    <TouchableOpacity onPress={() => setZoomImage(delivery.item_image_url)} activeOpacity={0.9} style={s.imageWrapper}>
                      <Image source={{ uri: delivery.item_image_url }} style={s.itemImage} resizeMode="cover" />
                      <View style={s.zoomBadge}>
                        <ZoomIn size={14} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  )}

                  {!delivery.payment_received && (
                    <View style={s.paymentWarningBox}>
                      <Text style={s.paymentWarningText}>
                        {delivery.payment_option === 'paynow'
                          ? 'Awaiting Paynow payment from customer'
                          : 'Confirm cash received from customer'}
                      </Text>
                    </View>
                  )}

                  <View style={s.actionRow}>
                    {!delivery.payment_received && (
                      <GlowButton
                        onPress={() => confirmPaymentReceived(delivery.id)}
                        label="Confirm Payment"
                        icon={<CheckCircle size={13} color={GREEN} />}
                        color={GREEN}
                        dim={GREEN_DIM}
                      />
                    )}
                    {delivery.payment_received && (
                      <View style={s.paymentReceivedChip}>
                        <CheckCircle size={11} color={GREEN} />
                        <Text style={s.paymentReceivedChipText}>Payment Received</Text>
                      </View>
                    )}
                    <GlowButton
                      onPress={() => openInMaps(delivery.customer_latitude, delivery.customer_longitude)}
                      label="Maps"
                      icon={<Navigation size={13} color={CYAN} />}
                      color={CYAN}
                      dim={CYAN_DIM}
                    />
                    <PrimaryGlowButton
                      onPress={() => handleDeliverPress(delivery.id)}
                      label="Delivered"
                      icon={<Package size={13} color={GREEN} />}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={s.sectionHeader}>
          <View style={[s.sectionDot, { backgroundColor: AMBER }]} />
          <Text style={s.sectionTitle}>Pending Orders</Text>
          <View style={[s.countPill, { backgroundColor: AMBER_DIM, borderColor: AMBER + '44' }]}>
            <Text style={[s.countText, { color: AMBER }]}>{pendingDeliveries.length}</Text>
          </View>
        </View>

        {pendingDeliveries.length === 0 ? (
          <View style={s.emptyState}>
            <Bell size={28} color={TEXT3} />
            <Text style={s.emptyText}>No pending deliveries</Text>
          </View>
        ) : (
          <View style={s.cardsList}>
            {pendingDeliveries.map(delivery => {
              const hasInterest = delivery.delivery_mode === 'open_request' && myInterests.has(delivery.id);
              const isWithdrawing = withdrawingId === delivery.id;
              return (
              <View key={delivery.id} style={[s.pendingCard, hasInterest && { borderColor: 'rgba(0,184,148,0.5)', borderWidth: 1.5 }]}>
                {delivery.delivery_mode === 'open_request' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      backgroundColor: 'rgba(0,184,148,0.12)', borderRadius: 8,
                      borderWidth: 1, borderColor: 'rgba(0,184,148,0.4)',
                      paddingHorizontal: 8, paddingVertical: 3,
                    }}>
                      <Zap size={10} color="#00b894" />
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#00b894', letterSpacing: 0.5 }}>OPEN REQUEST</Text>
                    </View>
                    {hasInterest ? (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        backgroundColor: 'rgba(0,184,148,0.1)', borderRadius: 8,
                        borderWidth: 1, borderColor: 'rgba(0,184,148,0.35)',
                        paddingHorizontal: 8, paddingVertical: 3,
                      }}>
                        <CheckCircle size={10} color="#00b894" />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#00b894' }}>Interest Sent — Waiting for shopper</Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 10, color: TEXT2 }}>Tap to register your interest</Text>
                    )}
                  </View>
                )}
                <View style={s.cardTop}>
                  <View style={s.customerRow}>
                    <View style={[s.avatarSmall, { backgroundColor: 'rgba(255,179,0,0.1)', borderColor: AMBER + '44' }]}>
                      <Text style={[s.avatarLetter, { color: AMBER }]}>{delivery.customers.full_name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={s.customerName}>{delivery.customers.full_name}</Text>
                  </View>
                  <View style={[s.feePill, { backgroundColor: AMBER_DIM, borderColor: AMBER + '55' }]}>
                    <Text style={[s.feeText, { color: AMBER }]}>${delivery.delivery_fee.toFixed(2)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.contactBar, { backgroundColor: 'rgba(255,179,0,0.08)', borderColor: AMBER + '44' }]}
                  onPress={() => Linking.openURL(`tel:${delivery.customers.phone_number}`)}
                  activeOpacity={0.75}
                >
                  <Phone size={13} color={AMBER} />
                  <Text style={[s.contactBarText, { color: AMBER }]}>{delivery.customers.phone_number}</Text>
                  <Text style={[s.contactBarCta, { color: AMBER + 'aa' }]}>Tap to call</Text>
                </TouchableOpacity>

                <View style={s.infoGrid}>
                  <View style={s.infoItem}>
                    <DollarSign size={11} color={TEXT2} />
                    <Text style={s.infoVal}>${delivery.total_amount.toFixed(2)}</Text>
                  </View>
                  <View style={s.infoItem}>
                    <Zap size={11} color={TEXT2} />
                    <Text style={s.infoVal}>{delivery.payment_option === 'pay_on_delivery' ? 'Cash' : 'Paynow'}</Text>
                  </View>
                  <View style={s.infoItem}>
                    <Clock size={11} color={TEXT2} />
                    <Text style={s.infoVal}>{new Date(delivery.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>

                <View style={s.itemsBlock}>
                  <Text style={s.itemsLabel}>Items ({delivery.items.length})</Text>
                  {delivery.items.map((item: any, i: number) => (
                    <View key={i} style={s.itemLine}>
                      <Text style={s.itemDot}>▸</Text>
                      <Text style={s.itemName}>{item.name} ×{item.quantity}</Text>
                      <Text style={s.itemAmt}>${(item.price * item.quantity).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {delivery.preferred_shops && (
                  <View style={[s.shopsPill, { borderColor: AMBER + '44' }]}>
                    <ShoppingBag size={11} color={AMBER} />
                    <Text style={s.shopsText} numberOfLines={1}>{delivery.preferred_shops}</Text>
                  </View>
                )}

                {delivery.item_image_url && (
                  <TouchableOpacity onPress={() => setZoomImage(delivery.item_image_url)} activeOpacity={0.9} style={s.imageWrapper}>
                    <Image source={{ uri: delivery.item_image_url }} style={s.itemImage} resizeMode="cover" />
                    <View style={s.zoomBadge}>
                      <ZoomIn size={14} color="#fff" />
                    </View>
                  </TouchableOpacity>
                )}

                {hasInterest && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: 'rgba(0,184,148,0.06)', borderRadius: 10,
                    borderWidth: 1, borderColor: 'rgba(0,184,148,0.25)',
                    padding: 10, marginBottom: 8,
                  }}>
                    <Zap size={14} color="#00b894" />
                    <Text style={{ flex: 1, fontSize: 11, color: '#00b894', fontWeight: '600', lineHeight: 16 }}>
                      Your interest has been submitted. You will be notified if the shopper picks you.
                    </Text>
                  </View>
                )}

                <View style={s.actionRow}>
                  <GlowButton
                    onPress={() => openInMaps(delivery.customer_latitude, delivery.customer_longitude)}
                    label="View Location"
                    icon={<MapPin size={13} color={CYAN} />}
                    color={CYAN}
                    dim={CYAN_DIM}
                  />
                  {delivery.delivery_mode === 'open_request' && hasInterest ? (
                    <GlowButton
                      onPress={() => withdrawInterest(delivery.id)}
                      label={isWithdrawing ? 'Withdrawing...' : 'Withdraw Interest'}
                      icon={<X size={13} color="#ff6b6b" />}
                      color="#ff6b6b"
                      dim="rgba(255,107,107,0.1)"
                      disabled={isWithdrawing}
                    />
                  ) : (
                    <PrimaryGlowButton
                      onPress={() => showConfirmDialog(delivery.id)}
                      label={delivery.delivery_mode === 'open_request' ? 'I Want This Delivery' : 'Accept Order'}
                      icon={<CheckCircle size={13} color={GREEN} />}
                    />
                  )}
                </View>
              </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!zoomImage} transparent animationType="fade" onRequestClose={() => setZoomImage(null)}>
        <View style={s.zoomOverlay}>
          <TouchableOpacity style={s.zoomClose} onPress={() => setZoomImage(null)}>
            <X size={20} color="#fff" />
          </TouchableOpacity>
          {zoomImage && (
            <Image
              source={{ uri: zoomImage }}
              style={s.zoomImg}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <SwitchLocationModal
        visible={showSwitchLocation}
        driverId={driverId!}
        currentActiveUniversityId={activeUniversityId}
        defaultUniversityId={driverInfo?.university_id ?? null}
        hasActiveDelivery={acceptedDeliveries.length > 0}
        onClose={() => setShowSwitchLocation(false)}
        onSwitched={handleLocationSwitched}
      />

      <Modal visible={confirmAction.show} transparent animationType="fade" onRequestClose={handleCancelAction}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalGlow} />
            {confirmAction.type === 'deliver' ? (
              <>
                <Package size={32} color={GREEN} style={{ marginBottom: 12 }} />
                <Text style={s.modalTitle}>Mark as Delivered?</Text>
                <Text style={s.modalBody}>
                  Confirm that the order has been successfully delivered to the customer. You have 10 minutes to undo this if it was a mistake.
                </Text>
              </>
            ) : confirmAction.delivery?.delivery_mode === 'open_request' ? (
              <>
                <Zap size={32} color="#00b894" style={{ marginBottom: 12 }} />
                <Text style={s.modalTitle}>Express Interest?</Text>
                <Text style={s.modalBody}>
                  You'll appear in the shopper's list of available drivers. They will review your profile and choose — only then will the delivery be secured to you.
                </Text>
              </>
            ) : (
              <>
                <CheckCircle size={32} color={GREEN} style={{ marginBottom: 12 }} />
                <Text style={s.modalTitle}>Accept Order?</Text>
                <Text style={s.modalBody}>
                  Confirm you want to take this delivery. You'll be responsible for completing it.
                </Text>
              </>
            )}
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={handleCancelAction}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={handleConfirmAction}>
                <Text style={s.modalConfirmText}>
                  {confirmAction.type === 'deliver' ? 'Confirm' : 'Accept'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Undo delivered bar */}
      {undoInfo && (
        <View style={s.undoBar}>
          <CheckCircle size={18} color={GREEN} />
          <Text style={s.undoBarText}>Marked as delivered. Tap undo if this was a mistake.</Text>
          <TouchableOpacity style={s.undoBtn} onPress={handleUndoDeliver} activeOpacity={0.8}>
            <RotateCcw size={14} color={GREEN} />
            <Text style={s.undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navItem}
          onPress={() => router.push({ pathname: '/driver/delivery-requests', params: { driverId, driverName } } as any)}>
          <View style={s.navIconWrap}>
            <Truck size={24} color={pendingRequestsCount > 0 ? CYAN : TEXT2} />
            <FlashingDot count={pendingRequestsCount} />
          </View>
          <Text style={[s.navItemLabel, pendingRequestsCount > 0 && { color: CYAN }]}>Requests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem}
          onPress={() => router.push({ pathname: '/driver/chat', params: { driverId, driverName } })}>
          <View style={s.navIconWrap}>
            <AnimatedChatIcon unreadCount={unreadMessageCount} iconColor={unreadMessageCount > 0 ? CYAN : TEXT2} size={24} />
            <FlashingDot count={unreadMessageCount} />
          </View>
          <Text style={[s.navItemLabel, unreadMessageCount > 0 && { color: CYAN }]}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem}
          onPress={() => router.push({ pathname: '/driver/customers', params: { driverId, driverName } })}>
          <View style={s.navIconWrap}>
            <Users size={24} color={activeShopDeliveriesCount > 0 ? CYAN : TEXT2} />
            <FlashingDot count={activeShopDeliveriesCount} />
          </View>
          <Text style={[s.navItemLabel, activeShopDeliveriesCount > 0 && { color: CYAN }]}>Customers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem}
          onPress={() => router.push('/driver/shop-deliveries' as any)}>
          <View style={s.navIconWrap}>
            <Package size={24} color={pendingDeliveriesCount > 0 ? CYAN : TEXT2} />
            <FlashingDot count={pendingDeliveriesCount} />
          </View>
          <Text style={[s.navItemLabel, pendingDeliveriesCount > 0 && { color: CYAN }]}>Shop Deliveries</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem}
          onPress={() => router.push({ pathname: '/driver/settings', params: { driverId } })}>
          <Settings size={24} color={TEXT2} />
          <Text style={s.navItemLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
        </>
      )}

      <DriverTutorial
        visible={showTutorial}
        onClose={() => {
          setShowTutorial(false);
          const tutorialKey = `driver_tutorial_seen_${driverId}`;
          if (typeof window !== 'undefined') {
            localStorage.setItem(tutorialKey, '1');
          }
        }}
      />

      <AnnouncementPopup audience="drivers" />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14,
    backgroundColor: CARD, borderBottomWidth: 1,
  },
  headerLeft: { flex: 1, minWidth: 0, gap: 2 },
  statusDot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: TEXT, letterSpacing: 0.3 },
  headerSubtitle: { fontSize: 11, color: TEXT2, letterSpacing: 0.3 },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: CYAN_DIM, borderRadius: 12,
    borderWidth: 1, borderColor: CYAN_BORDER, alignSelf: 'flex-start',
    maxWidth: 200,
  },
  locationPillText: { fontSize: 10, fontWeight: '700', color: CYAN, flexShrink: 1 },
  keyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(0,255,136,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: GREEN + '33', alignSelf: 'flex-start',
  },
  keyText: { fontSize: 10, fontWeight: '700', color: GREEN },
  keyExpiry: { fontSize: 9, color: TEXT2 },
  headerActions: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: CARD2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: TEXT3,
  },

  errorBanner: {
    marginHorizontal: 16, marginTop: 8, padding: 10,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { color: '#ff6b6b', fontSize: 12, textAlign: 'center' },

  notifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 8, padding: 10,
    backgroundColor: CYAN_DIM, borderRadius: 8, borderWidth: 1, borderColor: CYAN_BORDER,
  },
  notifText: { flex: 1, fontSize: 12, color: CYAN, fontWeight: '600' },

  tokenWarningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: AMBER, borderRadius: 10,
  },
  tokenWarningText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#000' },

  pausedScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 36, gap: 16,
  },
  pausedIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,179,0,0.12)', borderWidth: 1.5,
    borderColor: 'rgba(255,179,0,0.3)', marginBottom: 8,
  },
  pausedTitle: { fontSize: 26, fontWeight: '800', color: AMBER, letterSpacing: 0.3 },
  pausedBody: {
    fontSize: 14, color: TEXT2, textAlign: 'center', lineHeight: 22,
  },
  pausedExpiredRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
    backgroundColor: 'rgba(255,179,0,0.08)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,179,0,0.2)',
  },
  pausedExpiredText: { fontSize: 12, color: AMBER, fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingTop: 20, paddingBottom: 10,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: CYAN },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: TEXT, letterSpacing: 0.8, textTransform: 'uppercase' },
  countPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    backgroundColor: CYAN_DIM, borderWidth: 1, borderColor: CYAN_BORDER,
  },
  countText: { fontSize: 11, fontWeight: '800', color: CYAN },

  cardsList: { paddingHorizontal: 14, gap: 10 },

  acceptedCard: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.2)',
    padding: 14, overflow: 'hidden', gap: 8,
    shadowColor: CYAN, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  pendingCard: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,179,0,0.2)',
    padding: 14, overflow: 'hidden', gap: 8,
    shadowColor: AMBER, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  cardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: CYAN, opacity: 0.4,
  },

  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start',
    backgroundColor: GREEN_DIM, borderRadius: 8,
    borderWidth: 1, borderColor: GREEN + '44',
  },
  paidBadgeText: { fontSize: 9, fontWeight: '800', color: GREEN, letterSpacing: 1 },

  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: CYAN_DIM, borderWidth: 1, borderColor: CYAN_BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLetter: { fontSize: 11, fontWeight: '800', color: CYAN },
  customerName: { fontSize: 14, fontWeight: '700', color: TEXT, flex: 1 },
  feePill: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: CYAN_DIM, borderRadius: 8, borderWidth: 1, borderColor: CYAN + '55',
  },
  feeText: { fontSize: 13, fontWeight: '800', color: CYAN },

  infoGrid: { flexDirection: 'row', gap: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoVal: { fontSize: 11, color: TEXT2 },

  itemsBlock: { gap: 3 },
  itemsLabel: { fontSize: 10, fontWeight: '700', color: TEXT2, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  itemLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  itemDot: { fontSize: 8, color: CYAN, marginTop: 1 },
  itemName: { flex: 1, fontSize: 12, color: TEXT },
  itemAmt: { fontSize: 11, color: TEXT2, fontWeight: '600' },
  moreItems: { fontSize: 10, color: TEXT2, fontStyle: 'italic', marginTop: 2 },

  shopsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: AMBER_DIM, borderRadius: 8, borderWidth: 1, borderColor: AMBER + '44',
  },
  shopsText: { flex: 1, fontSize: 11, color: AMBER },

  itemImage: { width: '100%', height: 140, borderRadius: 8 },
  imageWrapper: { borderRadius: 8, overflow: 'hidden', position: 'relative' },
  zoomBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16,
    padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  zoomOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  zoomClose: {
    position: 'absolute', top: 56, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  zoomImg: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },

  paymentWarningBox: {
    padding: 8, borderRadius: 8,
    backgroundColor: AMBER_DIM, borderWidth: 1, borderColor: AMBER + '44',
  },
  paymentWarningText: { fontSize: 11, color: AMBER, textAlign: 'center', fontWeight: '600' },

  paymentReceivedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: GREEN_DIM, borderRadius: 8, borderWidth: 1, borderColor: GREEN + '44',
  },
  paymentReceivedChipText: { fontSize: 11, color: GREEN, fontWeight: '700' },

  contactBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: GREEN_DIM, borderRadius: 8,
    borderWidth: 1, borderColor: GREEN + '44',
  },
  contactBarText: { flex: 1, fontSize: 13, fontWeight: '700', color: GREEN },
  contactBarCta: { fontSize: 10, fontWeight: '600', color: GREEN + 'aa', letterSpacing: 0.3 },

  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, color: TEXT2 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalBox: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: CYAN_BORDER,
    padding: 28, width: '100%', maxWidth: 380,
    alignItems: 'center', overflow: 'hidden',
    shadowColor: CYAN, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  modalGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: CYAN, opacity: 0.5,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 8 },
  modalBody: { fontSize: 13, color: TEXT2, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3, alignItems: 'center',
  },
  modalCancelText: { color: TEXT2, fontSize: 14, fontWeight: '600' },
  modalConfirm: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: 'rgba(0,255,136,0.15)', borderWidth: 1, borderColor: GREEN + '55', alignItems: 'center',
  },
  modalConfirmText: { color: GREEN, fontSize: 14, fontWeight: '800' },

  undoBar: {
    position: 'absolute', bottom: 90, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#041a0e',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.35)',
    shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 14,
    zIndex: 99,
  },
  undoBarText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#6ee7b7', lineHeight: 17 },
  undoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,255,136,0.15)', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 9, borderWidth: 1, borderColor: 'rgba(0,255,136,0.35)',
  },
  undoBtnText: { fontSize: 12, fontWeight: '800', color: GREEN },

  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingVertical: 12,
    paddingBottom: 20,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,229,255,0.12)',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  navItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT2,
    letterSpacing: 0.3,
  },
  navIconWrap: {
    position: 'relative',
  },
  requestDot: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: BG,
  },
  requestDotText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 12,
  },
});
