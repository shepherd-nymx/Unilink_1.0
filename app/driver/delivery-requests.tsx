import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Platform, Linking, Modal, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, ShoppingBag, Package, MapPin, Phone, User, Clock, CircleCheck as CheckCircle, Navigation, X, ChevronRight, Truck, FileText, CircleAlert as AlertCircle, RefreshCw, MessageCircle, ExternalLink, RotateCcw, Lock, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { SkeletonList } from '@/components/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';
import { useDeliveryRequest } from '@/hooks/useDeliveryRequest';
import type { DeliveryRequestRow } from '@/lib/delivery-request-types';

const CYAN = '#00e5ff';
const AMBER = '#f59e0b';
const GREEN = '#10b981';
const RED = '#ff3366';

export default function DriverDeliveryRequests() {
  const router = useRouter();
  const { driverId, driverName } = useLocalSearchParams<{ driverId: string; driverName: string }>();
  const { colors, isDark } = useTheme();
  const { acceptRequest, updateStatus, undoDeliver } = useDeliveryRequest();

  const [requests, setRequests] = useState<DeliveryRequestRow[]>([]);
  const [myRequests, setMyRequests] = useState<DeliveryRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'mine'>('available');
  const [selectedRequest, setSelectedRequest] = useState<DeliveryRequestRow | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Confirmation modal state
  type ConfirmType = 'accept' | 'deliver';
  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; type: ConfirmType; req: DeliveryRequestRow | null }>({
    visible: false, type: 'accept', req: null,
  });

  // Undo delivered toast: shows for 10 minutes after marking delivered
  const [undoInfo, setUndoInfo] = useState<{ requestId: string; expiresAt: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [tokenExpiryDate, setTokenExpiryDate] = useState<Date | null>(null);

  const P = isDark ? CYAN : '#1A73E8';
  const BG = isDark ? '#070f1c' : '#f0f4f8';
  const CARD = isDark ? '#0d1b2e' : '#ffffff';
  const CARD_B = isDark ? 'rgba(0,229,255,0.15)' : '#dde8ff';
  const TX = isDark ? '#e0eeff' : '#0a1628';
  const TX2 = isDark ? '#8296b0' : '#64748b';
  const TX3 = isDark ? '#3a5a7a' : '#94a3b8';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchRequests = useCallback(async () => {
    try {
      const { data: available } = await supabase
        .from('delivery_requests')
        .select(`
          *,
          delivery_request_buy_details(*),
          delivery_request_pickup_details(*),
          customers(full_name, phone_number)
        `)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .or(`delivery_mode.eq.open_request,and(delivery_mode.eq.direct,driver_id.eq.${driverId})`)
        .order('created_at', { ascending: false });

      const { data: mine } = await supabase
        .from('delivery_requests')
        .select(`
          *,
          delivery_request_buy_details(*),
          delivery_request_pickup_details(*),
          customers(full_name, phone_number)
        `)
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'in_progress'])
        .order('created_at', { ascending: false });

      setRequests((available as DeliveryRequestRow[]) ?? []);
      setMyRequests((mine as DeliveryRequestRow[]) ?? []);
    } catch {}
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;
    supabase
      .from('drivers')
      .select('key_expires_at')
      .eq('id', driverId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.key_expires_at) {
          const expiry = new Date(data.key_expires_at);
          setTokenExpiryDate(expiry);
          if (expiry <= new Date()) setTokenExpired(true);
        } else if (data) {
          setTokenExpired(true);
        }
      });
  }, [driverId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchRequests().finally(() => setLoading(false));

    const channel = supabase
      .channel('driver-delivery-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRequests]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const doAccept = async (req: DeliveryRequestRow) => {
    setAccepting(true);
    const ok = await acceptRequest(req.id, driverId);
    if (ok) {
      showToast('Request accepted! Customer will be notified.');
      setSelectedRequest(null);
      await fetchRequests();
      setActiveTab('mine');
    } else {
      showToast('Could not accept — request may have been taken.');
    }
    setAccepting(false);
  };

  const doDeliver = async (req: DeliveryRequestRow) => {
    const ok = await updateStatus(req.id, 'delivered');
    if (ok) {
      setSelectedRequest(null);
      await fetchRequests();
      // Set undo window: 10 minutes
      const expiresAt = Date.now() + 10 * 60 * 1000;
      setUndoInfo({ requestId: req.id, expiresAt });
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoInfo(null), 10 * 60 * 1000);
    } else {
      showToast('Failed to mark as delivered.');
    }
  };

  const handleUndoDeliver = async () => {
    if (!undoInfo) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo(null);
    const ok = await undoDeliver(undoInfo.requestId);
    if (ok) {
      showToast('Delivery restored to In Progress.');
      await fetchRequests();
      setActiveTab('mine');
    } else {
      showToast('Undo window has expired — cannot reverse.');
    }
  };

  const handleAccept = (req: DeliveryRequestRow) => {
    setConfirmModal({ visible: true, type: 'accept', req });
  };

  const handleUpdateStatus = (req: DeliveryRequestRow, status: string) => {
    if (status === 'delivered') {
      setConfirmModal({ visible: true, type: 'deliver', req });
      return;
    }
    // in_progress doesn't need confirmation
    updateStatus(req.id, status).then(ok => {
      if (ok) { showToast('Marked as In Progress'); fetchRequests(); }
    });
  };

  const handleConfirm = async () => {
    const { type, req } = confirmModal;
    setConfirmModal(m => ({ ...m, visible: false }));
    if (!req) return;
    if (type === 'accept') await doAccept(req);
    else await doDeliver(req);
  };

  const handleCancelConfirm = () => setConfirmModal(m => ({ ...m, visible: false }));

  const openNavigation = (lat: number, lng: number) => {
    const url = Platform.OS === 'web'
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(url);
  };

  const openGoogleMapsLocation = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const callContact = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const openChat = (req: DeliveryRequestRow) => {
    const customer = (req as any).customers;
    router.push({
      pathname: '/driver/chat',
      params: { driverId, driverName, targetCustomerId: req.customer_id, targetCustomerName: customer?.full_name ?? 'Customer' },
    } as any);
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    pausedScreen: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: 36, gap: 16,
    },
    pausedIconWrap: {
      width: 96, height: 96, borderRadius: 48,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: 'rgba(255,179,0,0.1)', borderWidth: 1.5,
      borderColor: 'rgba(255,179,0,0.28)', marginBottom: 8,
    },
    pausedTitle: { fontSize: 24, fontWeight: '800', color: AMBER },
    pausedBody: {
      fontSize: 14, color: isDark ? '#4a7a9b' : '#64748b',
      textAlign: 'center', lineHeight: 22,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 56 : (Platform.OS === 'web' ? 20 : 44),
      paddingBottom: 16,
      backgroundColor: isDark ? '#070f1c' : '#fff',
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(0,229,255,0.12)' : '#e2e8f0',
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f0f4f8',
      borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: TX },
    headerSub: { fontSize: 12, color: P, marginTop: 2, fontWeight: '600' },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },

    tabs: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#070f1c' : '#fff',
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(0,229,255,0.08)' : '#e2e8f0',
    },
    tab: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 14,
      borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: P },
    tabText: { fontSize: 13, fontWeight: '700', color: TX3 },
    tabTextActive: { color: P },
    tabBadge: {
      minWidth: 20, height: 20, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
    },
    tabBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

    content: { flex: 1 },
    centeredLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
    emptyIcon: {
      width: 72, height: 72, borderRadius: 22,
      backgroundColor: isDark ? 'rgba(0,229,255,0.07)' : '#eef2ff',
      justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    },
    emptyTitle: { fontSize: 17, fontWeight: '800', color: TX, textAlign: 'center' },
    emptyText: { fontSize: 13, color: TX2, textAlign: 'center', lineHeight: 20 },
    refreshBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
      borderWidth: 1.5, borderColor: P, marginTop: 8,
    },
    refreshBtnText: { fontSize: 13, fontWeight: '700', color: P },

    card: {
      backgroundColor: CARD, marginHorizontal: 16, marginTop: 14,
      borderRadius: 20, borderWidth: 1, borderColor: CARD_B,
      shadowColor: isDark ? CYAN : '#1A73E8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 4,
      overflow: 'hidden',
    },
    cardTopLine: { height: 3 },
    cardBody: { padding: 18 },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    cardTypeIcon: {
      width: 44, height: 44, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center',
    },
    cardTypeInfo: { flex: 1 },
    cardTypeName: { fontSize: 15, fontWeight: '800', color: TX },
    cardTimestamp: { fontSize: 11, color: TX3, marginTop: 2 },
    cardStatusBadge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    },
    cardStatusText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    cardInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
    cardInfoIcon: { marginTop: 1 },
    cardInfoText: { flex: 1, fontSize: 13, color: TX2, lineHeight: 18 },
    cardInfoBold: { fontWeight: '700', color: TX },
    cardDivider: { height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f4f8', marginVertical: 12 },
    cardActions: { flexDirection: 'row', gap: 10 },
    cardBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: 42, borderRadius: 12,
    },
    cardBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    cardBtnOutline: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: 42, borderRadius: 12, borderWidth: 1.5,
    },
    cardBtnOutlineText: { fontSize: 13, fontWeight: '700' },

    detailModal: { flex: 1, backgroundColor: BG },
    detailHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 56 : (Platform.OS === 'web' ? 20 : 44),
      paddingBottom: 16,
      backgroundColor: isDark ? '#070f1c' : '#fff',
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(0,229,255,0.12)' : '#e2e8f0',
    },
    detailSection: {
      backgroundColor: CARD, marginHorizontal: 16, marginTop: 14,
      borderRadius: 18, borderWidth: 1, borderColor: CARD_B, overflow: 'hidden',
    },
    detailSectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 18, paddingVertical: 13,
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f4f8',
    },
    detailSectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' as any },
    detailSectionBody: { padding: 18, gap: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    detailRowIcon: {
      width: 32, height: 32, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center', marginTop: 1,
    },
    detailRowContent: { flex: 1 },
    detailRowLabel: { fontSize: 10, fontWeight: '700', color: TX3, letterSpacing: 1, textTransform: 'uppercase' as any, marginBottom: 2 },
    detailRowValue: { fontSize: 14, fontWeight: '600', color: TX, lineHeight: 20 },
    detailMapBtnRow: {
      flexDirection: 'row', gap: 8,
      marginHorizontal: 16, marginTop: 8,
    },
    detailMapBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: 38, borderRadius: 10, borderWidth: 1,
    },
    detailMapBtnText: { fontSize: 12, fontWeight: '700' },
    coordChip: {
      marginHorizontal: 16, marginTop: 6,
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8faff',
      borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    },
    coordChipText: { fontSize: 11, color: TX3, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
    navActionRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 14 },
    navBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 48, borderRadius: 14,
    },
    navBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
    acceptBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      marginHorizontal: 16, marginTop: 16, marginBottom: 32, height: 56, borderRadius: 18,
      backgroundColor: GREEN,
      shadowColor: GREEN, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
    },
    acceptBtnText: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },

    toast: {
      position: 'absolute', bottom: 90, alignSelf: 'center',
      backgroundColor: isDark ? '#0d1b2e' : '#1a2332',
      paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 12,
    },
    toastText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    // Confirmation modal
    confirmOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
    },
    confirmBox: {
      width: '100%', borderRadius: 24, padding: 24, gap: 0,
      backgroundColor: isDark ? '#0d1b2e' : '#fff',
      borderWidth: 1, borderColor: isDark ? 'rgba(0,229,255,0.2)' : '#dde8ff',
      shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 28, elevation: 20,
    },
    confirmIconWrap: {
      width: 60, height: 60, borderRadius: 30,
      justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 18,
    },
    confirmTitle: { fontSize: 20, fontWeight: '800', color: TX, textAlign: 'center', marginBottom: 8 },
    confirmBody: { fontSize: 14, color: TX2, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
    confirmBtns: { flexDirection: 'row', gap: 12 },
    confirmBtnCancel: {
      flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f4f8',
      borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    },
    confirmBtnCancelText: { fontSize: 15, fontWeight: '700', color: TX2 },
    confirmBtnConfirm: {
      flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    },
    confirmBtnConfirmText: { fontSize: 15, fontWeight: '800', color: '#fff' },

    // Undo bar
    undoBar: {
      position: 'absolute', bottom: 24, left: 16, right: 16,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: isDark ? '#0d2a1a' : '#052e16',
      borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14,
      borderWidth: 1, borderColor: isDark ? 'rgba(16,185,129,0.4)' : 'rgba(16,185,129,0.6)',
      shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 12,
    },
    undoBarText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#6ee7b7', lineHeight: 18 },
    undoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: 'rgba(16,185,129,0.2)', paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 10, borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)',
    },
    undoBtnText: { fontSize: 13, fontWeight: '800', color: GREEN },
  });

  const renderRequestCard = (req: DeliveryRequestRow, showAccept = false) => {
    const isBuy = req.service_type === 'buy_and_deliver';
    const buy = req.delivery_request_buy_details?.[0];
    const pickup = req.delivery_request_pickup_details?.[0];
    const accent = isBuy ? P : AMBER;
    const customer = (req as any).customers;
    const age = Math.floor((Date.now() - new Date(req.created_at).getTime()) / 60000);

    const statusColor: Record<string, string> = {
      pending: AMBER, accepted: P, in_progress: '#8b5cf6', delivered: GREEN, cancelled: RED, expired: TX3,
    };

    return (
      <TouchableOpacity key={req.id} style={s.card} onPress={() => setSelectedRequest(req)} activeOpacity={0.85}>
        <View style={[s.cardTopLine, { backgroundColor: accent }]} />
        <View style={s.cardBody}>
          <View style={s.cardHeaderRow}>
            <View style={[s.cardTypeIcon, { backgroundColor: isBuy ? 'rgba(0,229,255,0.12)' : 'rgba(245,158,11,0.12)' }]}>
              {isBuy ? <ShoppingBag size={22} color={accent} /> : <Package size={22} color={accent} />}
            </View>
            <View style={s.cardTypeInfo}>
              <Text style={s.cardTypeName}>{isBuy ? 'Buy & Deliver' : 'Pickup & Deliver'}</Text>
              <Text style={s.cardTimestamp}>{age < 1 ? 'Just now' : `${age}m ago`}</Text>
            </View>
            <View style={[s.cardStatusBadge, { backgroundColor: statusColor[req.status] ?? TX3 }]}>
              <Text style={s.cardStatusText}>{req.status.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>

          {isBuy && buy && (
            <>
              <View style={s.cardInfoRow}>
                <ShoppingBag size={14} color={P} style={s.cardInfoIcon} />
                <Text style={s.cardInfoText}><Text style={s.cardInfoBold}>{buy.item_name}</Text> × {buy.quantity} — Budget: ${buy.budget_estimate}</Text>
              </View>
              <View style={s.cardInfoRow}>
                <MapPin size={14} color={TX3} style={s.cardInfoIcon} />
                <Text style={s.cardInfoText} numberOfLines={1}>
                  <Text style={s.cardInfoBold}>Shop:</Text> {buy.shop_name}{buy.shop_location ? ` · ${buy.shop_location}` : ''}
                </Text>
              </View>
              <View style={s.cardInfoRow}>
                <Navigation size={14} color={GREEN} style={s.cardInfoIcon} />
                <Text style={s.cardInfoText} numberOfLines={2}><Text style={s.cardInfoBold}>Deliver to:</Text> {buy.destination_address}</Text>
              </View>
            </>
          )}

          {!isBuy && pickup && (
            <>
              <View style={s.cardInfoRow}>
                <MapPin size={14} color={AMBER} style={s.cardInfoIcon} />
                <Text style={s.cardInfoText} numberOfLines={1}><Text style={s.cardInfoBold}>Pickup:</Text> {pickup.pickup_address}</Text>
              </View>
              <View style={s.cardInfoRow}>
                <Navigation size={14} color={GREEN} style={s.cardInfoIcon} />
                <Text style={s.cardInfoText} numberOfLines={1}><Text style={s.cardInfoBold}>Deliver to:</Text> {pickup.destination_address}</Text>
              </View>
              <View style={s.cardInfoRow}>
                <User size={14} color={TX3} style={s.cardInfoIcon} />
                <Text style={s.cardInfoText}>{pickup.pickup_contact_name} → {pickup.receiver_name}</Text>
              </View>
            </>
          )}

          {customer && (
            <View style={s.cardInfoRow}>
              <User size={14} color={TX3} style={s.cardInfoIcon} />
              <Text style={s.cardInfoText}><Text style={s.cardInfoBold}>Customer:</Text> {customer.full_name}</Text>
            </View>
          )}

          <View style={s.cardDivider} />
          <View style={s.cardActions}>
            {showAccept ? (
              <>
                <TouchableOpacity
                  style={[s.cardBtn, { backgroundColor: GREEN, flex: 2 }]}
                  onPress={() => handleAccept(req)}
                  activeOpacity={0.85}
                >
                  <CheckCircle size={16} color="#fff" />
                  <Text style={s.cardBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.cardBtnOutline, { borderColor: P }]}
                  onPress={() => setSelectedRequest(req)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.cardBtnOutlineText, { color: P }]}>Details</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {req.status === 'accepted' && (
                  <TouchableOpacity
                    style={[s.cardBtn, { backgroundColor: '#8b5cf6' }]}
                    onPress={() => handleUpdateStatus(req, 'in_progress')}
                    activeOpacity={0.85}
                  >
                    <Truck size={14} color="#fff" />
                    <Text style={s.cardBtnText}>Start</Text>
                  </TouchableOpacity>
                )}
                {req.status === 'in_progress' && (
                  <TouchableOpacity
                    style={[s.cardBtn, { backgroundColor: GREEN }]}
                    onPress={() => handleUpdateStatus(req, 'delivered')}
                    activeOpacity={0.85}
                  >
                    <CheckCircle size={14} color="#fff" />
                    <Text style={s.cardBtnText}>Delivered</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.cardBtnOutline, { borderColor: P }]}
                  onPress={() => openChat(req)}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={14} color={P} />
                  <Text style={[s.cardBtnOutlineText, { color: P }]}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.cardBtnOutline, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1' }]}
                  onPress={() => setSelectedRequest(req)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.cardBtnOutlineText, { color: TX2 }]}>Details</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedRequest) return null;
    const req = selectedRequest;
    const isBuy = req.service_type === 'buy_and_deliver';
    const buy = req.delivery_request_buy_details?.[0];
    const pickup = req.delivery_request_pickup_details?.[0];
    const accent = isBuy ? P : AMBER;
    const customer = (req as any).customers;
    const isPending = req.status === 'pending';

    return (
      <Modal visible animationType="slide" onRequestClose={() => setSelectedRequest(null)}>
        <View style={s.detailModal}>
          <View style={s.detailHeader}>
            <TouchableOpacity style={s.backBtn} onPress={() => setSelectedRequest(null)}>
              <X size={18} color={TX} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>{isBuy ? 'Buy & Deliver' : 'Pickup & Deliver'}</Text>
              <Text style={s.headerSub}>#{req.id.slice(0, 8).toUpperCase()}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Customer info */}
            <View style={s.detailSection}>
              <View style={[s.detailSectionHeader, { backgroundColor: isDark ? 'rgba(0,229,255,0.04)' : '#f8faff' }]}>
                <User size={14} color={P} />
                <Text style={[s.detailSectionTitle, { color: P }]}>Customer</Text>
              </View>
              <View style={s.detailSectionBody}>
                <View style={s.detailRow}>
                  <View style={[s.detailRowIcon, { backgroundColor: isDark ? 'rgba(0,229,255,0.1)' : '#eef2ff' }]}>
                    <User size={16} color={P} />
                  </View>
                  <View style={s.detailRowContent}>
                    <Text style={s.detailRowLabel}>Name</Text>
                    <Text style={s.detailRowValue}>{customer?.full_name ?? 'Unknown'}</Text>
                  </View>
                </View>
                {customer?.phone_number && (
                  <TouchableOpacity style={s.detailRow} onPress={() => callContact(customer.phone_number)} activeOpacity={0.8}>
                    <View style={[s.detailRowIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                      <Phone size={16} color={GREEN} />
                    </View>
                    <View style={s.detailRowContent}>
                      <Text style={s.detailRowLabel}>Phone — tap to call</Text>
                      <Text style={[s.detailRowValue, { color: GREEN }]}>{customer.phone_number}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Buy details */}
            {isBuy && buy && (
              <View style={s.detailSection}>
                <View style={[s.detailSectionHeader, { backgroundColor: isDark ? 'rgba(0,229,255,0.04)' : '#f8faff' }]}>
                  <ShoppingBag size={14} color={P} />
                  <Text style={[s.detailSectionTitle, { color: P }]}>Item Details</Text>
                </View>
                <View style={s.detailSectionBody}>
                  {[
                    { label: 'Item', value: `${buy.item_name} × ${buy.quantity}`, icon: ShoppingBag, color: P },
                    { label: 'Shop', value: buy.shop_name, icon: MapPin, color: AMBER },
                    { label: 'Shop Location', value: buy.shop_location || '—', icon: MapPin, color: TX3 },
                    { label: 'Budget', value: `$${buy.budget_estimate}`, icon: FileText, color: GREEN },
                    { label: 'Instructions', value: buy.instructions || '—', icon: FileText, color: TX3 },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <View key={item.label} style={s.detailRow}>
                        <View style={[s.detailRowIcon, { backgroundColor: item.color + '15' }]}>
                          <Icon size={16} color={item.color} />
                        </View>
                        <View style={s.detailRowContent}>
                          <Text style={s.detailRowLabel}>{item.label}</Text>
                          <Text style={s.detailRowValue}>{item.value}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Buy delivery destination */}
            {isBuy && buy && (
              <View style={s.detailSection}>
                <View style={[s.detailSectionHeader, { backgroundColor: isDark ? 'rgba(16,185,129,0.04)' : '#f0fdf9' }]}>
                  <Navigation size={14} color={GREEN} />
                  <Text style={[s.detailSectionTitle, { color: GREEN }]}>Delivery Destination</Text>
                </View>
                <View style={s.detailSectionBody}>
                  <View style={s.detailRow}>
                    <View style={[s.detailRowIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                      <MapPin size={16} color={GREEN} />
                    </View>
                    <View style={s.detailRowContent}>
                      <Text style={s.detailRowLabel}>Address</Text>
                      <Text style={s.detailRowValue}>{buy.destination_address}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.coordChip}>
                  <MapPin size={12} color={TX3} />
                  <Text style={s.coordChipText}>{buy.destination_lat.toFixed(6)}, {buy.destination_lng.toFixed(6)}</Text>
                </View>
                <View style={s.detailMapBtnRow}>
                  <TouchableOpacity
                    style={[s.detailMapBtn, { backgroundColor: GREEN, borderColor: GREEN }]}
                    onPress={() => openNavigation(buy.destination_lat, buy.destination_lng)}
                    activeOpacity={0.85}
                  >
                    <Navigation size={14} color="#fff" />
                    <Text style={[s.detailMapBtnText, { color: '#fff' }]}>Navigate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.detailMapBtn, { borderColor: isDark ? 'rgba(66,133,244,0.4)' : 'rgba(66,133,244,0.3)', backgroundColor: isDark ? 'rgba(66,133,244,0.08)' : 'rgba(66,133,244,0.05)' }]}
                    onPress={() => openGoogleMapsLocation(buy.destination_lat, buy.destination_lng)}
                    activeOpacity={0.85}
                  >
                    <ExternalLink size={14} color="#4285F4" />
                    <Text style={[s.detailMapBtnText, { color: '#4285F4' }]}>View on Google Maps</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ height: 14 }} />
              </View>
            )}

            {/* Pickup details */}
            {!isBuy && pickup && (
              <>
                <View style={s.detailSection}>
                  <View style={[s.detailSectionHeader, { backgroundColor: isDark ? 'rgba(245,158,11,0.04)' : '#fefce8' }]}>
                    <Package size={14} color={AMBER} />
                    <Text style={[s.detailSectionTitle, { color: AMBER }]}>Pickup Location</Text>
                  </View>
                  <View style={s.detailSectionBody}>
                    {[
                      { label: 'Address', value: pickup.pickup_address, icon: MapPin, color: AMBER },
                      { label: 'Contact', value: pickup.pickup_contact_name, icon: User, color: TX2 },
                      { label: 'Phone', value: pickup.pickup_contact_phone, icon: Phone, color: GREEN, tap: () => callContact(pickup.pickup_contact_phone) },
                      { label: 'Landmark', value: pickup.pickup_landmark || '—', icon: MapPin, color: TX3 },
                      { label: 'Notes', value: pickup.pickup_notes || '—', icon: FileText, color: TX3 },
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <TouchableOpacity
                          key={item.label}
                          style={s.detailRow}
                          onPress={(item as any).tap}
                          activeOpacity={(item as any).tap ? 0.8 : 1}
                        >
                          <View style={[s.detailRowIcon, { backgroundColor: item.color + '18' }]}>
                            <Icon size={16} color={item.color} />
                          </View>
                          <View style={s.detailRowContent}>
                            <Text style={s.detailRowLabel}>{item.label}{(item as any).tap ? ' — tap to call' : ''}</Text>
                            <Text style={[s.detailRowValue, (item as any).tap && { color: GREEN }]}>{item.value}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={s.coordChip}>
                    <MapPin size={12} color={TX3} />
                    <Text style={s.coordChipText}>{pickup.pickup_lat.toFixed(6)}, {pickup.pickup_lng.toFixed(6)}</Text>
                  </View>
                  <View style={s.detailMapBtnRow}>
                    <TouchableOpacity
                      style={[s.detailMapBtn, { backgroundColor: AMBER, borderColor: AMBER }]}
                      onPress={() => openNavigation(pickup.pickup_lat, pickup.pickup_lng)}
                      activeOpacity={0.85}
                    >
                      <Navigation size={14} color="#fff" />
                      <Text style={[s.detailMapBtnText, { color: '#fff' }]}>Navigate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.detailMapBtn, { borderColor: isDark ? 'rgba(66,133,244,0.4)' : 'rgba(66,133,244,0.3)', backgroundColor: isDark ? 'rgba(66,133,244,0.08)' : 'rgba(66,133,244,0.05)' }]}
                      onPress={() => openGoogleMapsLocation(pickup.pickup_lat, pickup.pickup_lng)}
                      activeOpacity={0.85}
                    >
                      <ExternalLink size={14} color="#4285F4" />
                      <Text style={[s.detailMapBtnText, { color: '#4285F4' }]}>Google Maps</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: 14 }} />
                </View>

                <View style={s.detailSection}>
                  <View style={[s.detailSectionHeader, { backgroundColor: isDark ? 'rgba(16,185,129,0.04)' : '#f0fdf9' }]}>
                    <Navigation size={14} color={GREEN} />
                    <Text style={[s.detailSectionTitle, { color: GREEN }]}>Delivery Destination</Text>
                  </View>
                  <View style={s.detailSectionBody}>
                    {[
                      { label: 'Address', value: pickup.destination_address, icon: MapPin, color: GREEN },
                      { label: 'Receiver', value: pickup.receiver_name, icon: User, color: TX2 },
                      { label: 'Phone', value: pickup.receiver_phone, icon: Phone, color: GREEN, tap: () => callContact(pickup.receiver_phone) },
                      { label: 'Notes', value: pickup.destination_notes || '—', icon: FileText, color: TX3 },
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <TouchableOpacity
                          key={item.label}
                          style={s.detailRow}
                          onPress={(item as any).tap}
                          activeOpacity={(item as any).tap ? 0.8 : 1}
                        >
                          <View style={[s.detailRowIcon, { backgroundColor: item.color + '18' }]}>
                            <Icon size={16} color={item.color} />
                          </View>
                          <View style={s.detailRowContent}>
                            <Text style={s.detailRowLabel}>{item.label}{(item as any).tap ? ' — tap to call' : ''}</Text>
                            <Text style={[s.detailRowValue, (item as any).tap && { color: GREEN }]}>{item.value}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={s.coordChip}>
                    <MapPin size={12} color={TX3} />
                    <Text style={s.coordChipText}>{pickup.destination_lat.toFixed(6)}, {pickup.destination_lng.toFixed(6)}</Text>
                  </View>
                  <View style={s.detailMapBtnRow}>
                    <TouchableOpacity
                      style={[s.detailMapBtn, { backgroundColor: GREEN, borderColor: GREEN }]}
                      onPress={() => openNavigation(pickup.destination_lat, pickup.destination_lng)}
                      activeOpacity={0.85}
                    >
                      <Navigation size={14} color="#fff" />
                      <Text style={[s.detailMapBtnText, { color: '#fff' }]}>Navigate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.detailMapBtn, { borderColor: isDark ? 'rgba(66,133,244,0.4)' : 'rgba(66,133,244,0.3)', backgroundColor: isDark ? 'rgba(66,133,244,0.08)' : 'rgba(66,133,244,0.05)' }]}
                      onPress={() => openGoogleMapsLocation(pickup.destination_lat, pickup.destination_lng)}
                      activeOpacity={0.85}
                    >
                      <ExternalLink size={14} color="#4285F4" />
                      <Text style={[s.detailMapBtnText, { color: '#4285F4' }]}>Google Maps</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: 14 }} />
                </View>
              </>
            )}

            {isPending && (
              <TouchableOpacity
                style={[s.acceptBtn, accepting && { opacity: 0.6 }]}
                onPress={() => handleAccept(req)}
                disabled={accepting}
                activeOpacity={0.85}
              >
                {accepting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <CheckCircle size={22} color="#fff" />}
                <Text style={s.acceptBtnText}>{accepting ? 'Accepting...' : 'Accept This Request'}</Text>
              </TouchableOpacity>
            )}

            {(req.status === 'accepted' || req.status === 'in_progress') && (
              <View style={[s.navActionRow, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={[s.navBtn, { borderWidth: 1.5, borderColor: P, backgroundColor: 'transparent' }]}
                  onPress={() => { setSelectedRequest(null); openChat(req); }}
                  activeOpacity={0.85}
                >
                  <MessageCircle size={18} color={P} />
                  <Text style={[s.navBtnText, { color: P }]}>Chat with Customer</Text>
                </TouchableOpacity>
              </View>
            )}

            {req.status === 'accepted' && (
              <TouchableOpacity
                style={[s.acceptBtn, { backgroundColor: '#8b5cf6', shadowColor: '#8b5cf6' }]}
                onPress={() => { handleUpdateStatus(req, 'in_progress'); setSelectedRequest(null); }}
                activeOpacity={0.85}
              >
                <Truck size={22} color="#fff" />
                <Text style={s.acceptBtnText}>Start Delivery</Text>
              </TouchableOpacity>
            )}

            {req.status === 'in_progress' && (
              <TouchableOpacity
                style={[s.acceptBtn]}
                onPress={() => { handleUpdateStatus(req, 'delivered'); setSelectedRequest(null); }}
                activeOpacity={0.85}
              >
                <CheckCircle size={22} color="#fff" />
                <Text style={s.acceptBtnText}>Mark as Delivered</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const displayList = activeTab === 'available' ? requests : myRequests;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={18} color={TX} />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.headerTitle}>Delivery Requests</Text>
          <Text style={s.headerSub}>Campus Logistics</Text>
        </View>
        <View style={s.liveDot} />
      </View>

      {tokenExpired ? (
        <View style={s.pausedScreen}>
          <View style={s.pausedIconWrap}>
            <Lock size={44} color={AMBER} strokeWidth={1.5} />
          </View>
          <Text style={s.pausedTitle}>Portal Paused</Text>
          <Text style={s.pausedBody}>
            Your monthly access token has{tokenExpiryDate
              ? ` expired on ${tokenExpiryDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : ' not been issued yet'}.{'\n'}Contact your admin to renew access.
          </Text>
        </View>
      ) : (
        <>
      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'available' && s.tabActive]}
          onPress={() => setActiveTab('available')}
        >
          <Truck size={15} color={activeTab === 'available' ? P : TX3} />
          <Text style={[s.tabText, activeTab === 'available' && s.tabTextActive]}>Available</Text>
          {requests.length > 0 && (
            <View style={[s.tabBadge, { backgroundColor: AMBER }]}>
              <Text style={s.tabBadgeText}>{requests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'mine' && s.tabActive]}
          onPress={() => setActiveTab('mine')}
        >
          <CheckCircle size={15} color={activeTab === 'mine' ? P : TX3} />
          <Text style={[s.tabText, activeTab === 'mine' && s.tabTextActive]}>My Requests</Text>
          {myRequests.length > 0 && (
            <View style={[s.tabBadge, { backgroundColor: GREEN }]}>
              <Text style={s.tabBadgeText}>{myRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.centeredLoader}>
          <SkeletonList count={5} lines={4} />
        </View>
      ) : displayList.length === 0 ? (
        <View style={s.emptyState}>
          <View style={s.emptyIcon}>
            <Truck size={32} color={isDark ? CYAN : '#94a3b8'} />
          </View>
          <Text style={s.emptyTitle}>
            {activeTab === 'available' ? 'No requests available' : 'No active requests'}
          </Text>
          <Text style={s.emptyText}>
            {activeTab === 'available'
              ? 'New delivery requests from students will appear here in real time.'
              : 'Accept a request from the Available tab to start earning.'}
          </Text>
          <TouchableOpacity style={s.refreshBtn} onPress={handleRefresh} activeOpacity={0.8}>
            <RefreshCw size={14} color={P} />
            <Text style={s.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={P} />}
        >
          {displayList.map(req => renderRequestCard(req, activeTab === 'available'))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {renderDetailModal()}

      {/* Confirmation modal */}
      <Modal
        visible={confirmModal.visible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelConfirm}
      >
        <View style={s.confirmOverlay}>
          <View style={s.confirmBox}>
            <View style={[
              s.confirmIconWrap,
              { backgroundColor: confirmModal.type === 'accept' ? 'rgba(16,185,129,0.12)' : 'rgba(0,229,255,0.1)' },
            ]}>
              {confirmModal.type === 'accept'
                ? <CheckCircle size={28} color={GREEN} />
                : <Package size={28} color={P} />}
            </View>
            <Text style={s.confirmTitle}>
              {confirmModal.type === 'accept' ? 'Accept this request?' : 'Mark as Delivered?'}
            </Text>
            <Text style={s.confirmBody}>
              {confirmModal.type === 'accept'
                ? 'You will be assigned to this delivery and the customer will be notified. Make sure you can complete it.'
                : 'Confirm that the item has been successfully delivered. You have 10 minutes to undo this if it was a mistake.'}
            </Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmBtnCancel} onPress={handleCancelConfirm} activeOpacity={0.8}>
                <Text style={s.confirmBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmBtnConfirm, { backgroundColor: confirmModal.type === 'accept' ? GREEN : P }]}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Text style={s.confirmBtnConfirmText}>
                  {confirmModal.type === 'accept' ? 'Yes, Accept' : 'Yes, Delivered'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Undo delivered bar — visible for 10 minutes after marking delivered */}
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

      {/* Toast */}
      {toastMsg && (
        <View style={s.toast}>
          <Text style={s.toastText}>{toastMsg}</Text>
        </View>
      )}
        </>
      )}
    </View>
  );
}
