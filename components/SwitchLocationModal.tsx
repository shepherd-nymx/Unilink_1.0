import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { X, MapPin, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Navigation } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

const CYAN = '#00e5ff';
const CYAN_DIM = 'rgba(0,229,255,0.1)';
const CYAN_BORDER = 'rgba(0,229,255,0.22)';
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

type University = {
  id: string;
  name: string;
  is_active: boolean;
};

type Props = {
  visible: boolean;
  driverId: string;
  currentActiveUniversityId: string | null;
  defaultUniversityId: string | null;
  hasActiveDelivery: boolean;
  onClose: () => void;
  onSwitched: (universityId: string, universityName: string) => void;
};

export default function SwitchLocationModal({
  visible,
  driverId,
  currentActiveUniversityId,
  defaultUniversityId,
  hasActiveDelivery,
  onClose,
  onSwitched,
}: Props) {
  const [universities, setUniversities] = useState<University[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<University | null>(null);

  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelected(currentActiveUniversityId);
      setConfirmTarget(null);
      setError('');
      loadUniversities();
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      slideAnim.setValue(60);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const loadUniversities = async () => {
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('universities')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');
      if (dbError) throw dbError;
      setUniversities(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLocation = (uni: University) => {
    if (uni.id === currentActiveUniversityId) return;
    if (hasActiveDelivery) {
      setError('You cannot switch location while you have an active delivery in progress.');
      return;
    }
    setConfirmTarget(uni);
  };

  const handleConfirmSwitch = async () => {
    if (!confirmTarget) return;
    setSaving(true);
    setError('');
    try {
      const { error: dbError } = await supabase
        .from('drivers')
        .update({ active_university_id: confirmTarget.id })
        .eq('id', driverId);
      if (dbError) throw dbError;
      setSelected(confirmTarget.id);
      onSwitched(confirmTarget.id, confirmTarget.name);
      setConfirmTarget(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to switch location');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelConfirm = () => setConfirmTarget(null);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <Animated.View style={[ms.sheet, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
          <View style={ms.topBar} />

          <View style={ms.header}>
            <View style={ms.headerLeft}>
              <Navigation size={18} color={CYAN} />
              <Text style={ms.headerTitle}>Switch Location</Text>
            </View>
            <TouchableOpacity style={ms.closeBtn} onPress={onClose}>
              <X size={18} color={TEXT2} />
            </TouchableOpacity>
          </View>

          <Text style={ms.headerDesc}>
            Select your active service area. You will only receive orders from the chosen location.
          </Text>

          {hasActiveDelivery && (
            <View style={ms.warningBox}>
              <AlertTriangle size={13} color={AMBER} />
              <Text style={ms.warningText}>
                Cannot switch while a delivery is in progress. Complete your current delivery first.
              </Text>
            </View>
          )}

          {error ? (
            <View style={ms.errorBox}>
              <Text style={ms.errorText}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={ms.loadingBox}>
              <ActivityIndicator size="small" color={CYAN} />
              <Text style={ms.loadingText}>Loading locations...</Text>
            </View>
          ) : (
            <ScrollView style={ms.list} contentContainerStyle={{ gap: 8, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              {universities.map(uni => {
                const isActive = uni.id === (selected ?? currentActiveUniversityId);
                const isDefault = uni.id === defaultUniversityId;
                const isDisabled = hasActiveDelivery && !isActive;

                return (
                  <TouchableOpacity
                    key={uni.id}
                    style={[ms.locationRow, isActive && ms.locationRowActive, isDisabled && ms.locationRowDisabled]}
                    onPress={() => handleSelectLocation(uni)}
                    disabled={isDisabled || isActive}
                    activeOpacity={0.75}
                  >
                    <View style={[ms.locationIcon, isActive && ms.locationIconActive]}>
                      <MapPin size={15} color={isActive ? CYAN : TEXT2} />
                    </View>
                    <View style={ms.locationInfo}>
                      <Text style={[ms.locationName, isActive && ms.locationNameActive]}>{uni.name}</Text>
                      {isDefault && (
                        <Text style={ms.defaultBadge}>Default location</Text>
                      )}
                    </View>
                    {isActive && (
                      <View style={ms.activeBadge}>
                        <CheckCircle size={14} color={GREEN} />
                        <Text style={ms.activeBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {confirmTarget && (
            <View style={ms.confirmBox}>
              <View style={ms.confirmGlow} />
              <MapPin size={20} color={CYAN} style={{ marginBottom: 6 }} />
              <Text style={ms.confirmTitle}>Switch to {confirmTarget.name}?</Text>
              <Text style={ms.confirmDesc}>
                You will only receive orders from this location. Your current pending orders from the previous location will no longer appear.
              </Text>
              <View style={ms.confirmActions}>
                <TouchableOpacity style={ms.confirmCancel} onPress={handleCancelConfirm} disabled={saving}>
                  <Text style={ms.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ms.confirmSwitch} onPress={handleConfirmSwitch} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color={CYAN} />
                  ) : (
                    <Text style={ms.confirmSwitchText}>Switch Now</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: CYAN_BORDER,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '80%',
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
  },
  topBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: TEXT3, alignSelf: 'center', marginBottom: 18,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: TEXT, letterSpacing: 0.4 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
    justifyContent: 'center', alignItems: 'center',
  },
  headerDesc: {
    fontSize: 12, color: TEXT2, lineHeight: 17, marginBottom: 16,
  },

  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: AMBER_DIM, borderRadius: 10,
    borderWidth: 1, borderColor: AMBER + '44',
    padding: 10, marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 12, color: AMBER, lineHeight: 17 },

  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    padding: 10, marginBottom: 12,
  },
  errorText: { fontSize: 12, color: '#ff6b6b', textAlign: 'center' },

  loadingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 24, justifyContent: 'center',
  },
  loadingText: { fontSize: 13, color: TEXT2 },

  list: { maxHeight: 280 },
  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD2, borderRadius: 12,
    borderWidth: 1, borderColor: TEXT3,
    padding: 13,
  },
  locationRowActive: {
    backgroundColor: CYAN_DIM, borderColor: CYAN_BORDER,
  },
  locationRowDisabled: { opacity: 0.4 },
  locationIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: BG, borderWidth: 1, borderColor: TEXT3,
    justifyContent: 'center', alignItems: 'center',
  },
  locationIconActive: { borderColor: CYAN_BORDER, backgroundColor: CYAN_DIM },
  locationInfo: { flex: 1, gap: 2 },
  locationName: { fontSize: 14, fontWeight: '600', color: TEXT2 },
  locationNameActive: { color: TEXT, fontWeight: '700' },
  defaultBadge: { fontSize: 10, color: TEXT3, fontWeight: '600', letterSpacing: 0.4 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: GREEN_DIM, borderRadius: 8, borderWidth: 1, borderColor: GREEN + '44',
  },
  activeBadgeText: { fontSize: 9, fontWeight: '800', color: GREEN, letterSpacing: 1 },

  confirmBox: {
    backgroundColor: CARD2, borderRadius: 14,
    borderWidth: 1, borderColor: CYAN_BORDER,
    padding: 18, marginTop: 14, alignItems: 'center',
    overflow: 'hidden',
    shadowColor: CYAN, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  confirmGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: CYAN, opacity: 0.45,
  },
  confirmTitle: { fontSize: 15, fontWeight: '800', color: TEXT, marginBottom: 6, textAlign: 'center' },
  confirmDesc: { fontSize: 12, color: TEXT2, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  confirmActions: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmCancel: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: BG, borderWidth: 1, borderColor: TEXT3, alignItems: 'center',
  },
  confirmCancelText: { color: TEXT2, fontSize: 13, fontWeight: '600' },
  confirmSwitch: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: CYAN_DIM, borderWidth: 1, borderColor: CYAN_BORDER, alignItems: 'center',
  },
  confirmSwitchText: { color: CYAN, fontSize: 13, fontWeight: '800' },
});
