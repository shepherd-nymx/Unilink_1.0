import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, MapPin, Lock, User, Mail, Phone, School, Eye, EyeOff, CircleCheck as CheckCircle, ChevronDown, Search, Navigation, X, LogOut, Shield, ChevronRight } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { reverseGeocode } from '@/lib/map-utils';
import { clearUserData } from '@/lib/storage-service';

type UniversityOption = { id: string; name: string; location_type?: string };

export default function CustomerProfile() {
  const router = useRouter();
  const { customerId, customerName } = useLocalSearchParams();
  const { isDark } = useTheme();

  const P = '#1A73E8';
  const PL = '#4A9EFF';
  const BG = isDark ? '#050D1A' : '#F0F4FF';
  const CARD = isDark ? '#0D1B2E' : '#FFFFFF';
  const CARD_B = isDark ? '#1A3A5C' : '#DDE8FF';
  const TX = isDark ? '#E8F4FF' : '#0A1628';
  const TX2 = isDark ? '#7AA3CC' : '#5A7A9A';
  const TX3 = isDark ? '#3A6A8A' : '#9AB0CC';
  const INPUT = isDark ? '#0A1828' : '#F5F8FF';
  const INPUT_B = isDark ? '#1E3A5C' : '#C8D8F0';
  const SUCCESS = '#10B981';
  const ERR = '#EF4444';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [universityName, setUniversityName] = useState('');

  const [allLocations, setAllLocations] = useState<UniversityOption[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [pendingLocationId, setPendingLocationId] = useState('');

  const [newGpsCoords, setNewGpsCoords] = useState<{ lat: number; lon: number; address: string } | null>(null);
  const [showGpsUpdateModal, setShowGpsUpdateModal] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
    loadAllLocations();
  }, [customerId]);

  const loadProfile = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('customers')
        .select('full_name, username, phone_number, email, latitude, longitude, university_id, universities(id, name)')
        .eq('id', customerId as string)
        .single();

      if (dbError) throw dbError;

      if (data) {
        setFullName(data.full_name || '');
        setUsername(data.username || '');
        setPhoneNumber(data.phone_number || '');
        setEmail(data.email || '');
        setLatitude(data.latitude?.toString() || '');
        setLongitude(data.longitude?.toString() || '');
        setUniversityId(data.university_id || '');
        setUniversityName((data.universities as any)?.name || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadAllLocations = async () => {
    try {
      const { data } = await supabase
        .from('universities')
        .select('id, name, location_type')
        .eq('is_active', true)
        .order('name');
      setAllLocations(data || []);
    } catch {}
  };

  const detectGps = async () => {
    setUpdating(true);
    setError('');
    try {
      let coords: { latitude: number; longitude: number };
      if (Platform.OS === 'web') {
        coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            (err) => reject(new Error('Could not get location: ' + err.message)),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission is required');
          setUpdating(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }

      let address = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      try { address = await reverseGeocode(coords.latitude, coords.longitude); } catch {}

      setNewGpsCoords({ lat: coords.latitude, lon: coords.longitude, address });
      setShowGpsUpdateModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to get location');
    } finally {
      setUpdating(false);
    }
  };

  const confirmGpsOnly = async () => {
    if (!newGpsCoords) return;
    setSaving(true);
    setShowGpsUpdateModal(false);
    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update({ latitude: newGpsCoords.lat, longitude: newGpsCoords.lon })
        .eq('id', customerId as string);
      if (updateError) throw updateError;
      setLatitude(newGpsCoords.lat.toString());
      setLongitude(newGpsCoords.lon.toString());
      setNewGpsCoords(null);
      showSuccess('GPS location updated');
    } catch (err: any) {
      setError(err.message || 'Failed to update GPS');
    } finally {
      setSaving(false);
    }
  };

  const confirmGpsAndLocation = async () => {
    if (!newGpsCoords) return;
    setShowGpsUpdateModal(false);
    setLatitude(newGpsCoords.lat.toString());
    setLongitude(newGpsCoords.lon.toString());
    setNewGpsCoords(null);
    setShowLocationModal(true);
  };

  const saveProfile = async () => {
    if (!fullName.trim() || !phoneNumber.trim()) {
      setError('Name and phone number are required');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updates: any = {
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
      };
      if (email.trim()) updates.email = email.trim();
      if (latitude && longitude) {
        updates.latitude = parseFloat(latitude);
        updates.longitude = parseFloat(longitude);
      }
      const { error: updateError } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', customerId as string);
      if (updateError) throw updateError;
      showSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const saveRegisteredLocation = async (locId: string) => {
    if (!locId) return;
    setSavingLocation(true);
    setError('');
    try {
      const gpsUpdates: any = { university_id: locId };
      if (newGpsCoords) {
        gpsUpdates.latitude = newGpsCoords.lat;
        gpsUpdates.longitude = newGpsCoords.lon;
      }
      const { error: updateError } = await supabase
        .from('customers')
        .update(gpsUpdates)
        .eq('id', customerId as string);
      if (updateError) throw updateError;
      const found = allLocations.find(l => l.id === locId);
      setUniversityId(locId);
      setUniversityName(found?.name || '');
      if (newGpsCoords) {
        setLatitude(newGpsCoords.lat.toString());
        setLongitude(newGpsCoords.lon.toString());
        setNewGpsCoords(null);
      }
      setShowLocationModal(false);
      showSuccess('Location updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update location');
    } finally {
      setSavingLocation(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data: verifyData, error: verifyError } = await supabase.rpc(
        'verify_customer_password',
        { customer_id: customerId as string, input_password: currentPassword }
      );
      if (verifyError || !verifyData) throw new Error('Current password is incorrect');
      const { error: updateError } = await supabase.rpc('update_customer_password', {
        customer_id: customerId as string,
        new_password: newPassword,
      });
      if (updateError) throw updateError;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSuccess('Password changed successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const inputStyle = (field: string, disabled = false) => [
    styles.input,
    focusedField === field && styles.inputFocused,
    disabled && styles.inputDisabled,
  ];

  const filteredLocations = allLocations.filter(l =>
    l.name.toLowerCase().includes(locationSearch.toLowerCase())
  );
  const universities = filteredLocations.filter(l => l.location_type !== 'place');
  const places = filteredLocations.filter(l => l.location_type === 'place');

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    centered: { justifyContent: 'center', alignItems: 'center' },
    bgCircle: {
      position: 'absolute', width: 320, height: 320, borderRadius: 160, borderWidth: 1,
      borderColor: isDark ? 'rgba(26,115,232,0.07)' : 'rgba(26,115,232,0.05)',
      top: -120, right: -100,
    },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
      backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: CARD_B,
    },
    backButton: {
      width: 40, height: 40, borderRadius: 12, borderWidth: 1,
      borderColor: CARD_B, justifyContent: 'center', alignItems: 'center',
      backgroundColor: BG, marginRight: 14,
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: TX, letterSpacing: 0.3 },
    alertBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, marginTop: 14, padding: 12,
      borderRadius: 12, borderWidth: 1,
    },
    alertError: {
      backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
      borderColor: ERR,
    },
    alertSuccess: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)',
      borderColor: SUCCESS,
    },
    alertText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
    content: { flex: 1 },
    section: {
      backgroundColor: CARD, marginHorizontal: 16, marginTop: 16,
      borderRadius: 18, borderWidth: 1, borderColor: CARD_B, overflow: 'hidden',
      shadowColor: P, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.18 : 0.07, shadowRadius: 14, elevation: 4,
    },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: CARD_B,
      backgroundColor: isDark ? 'rgba(26,115,232,0.06)' : 'rgba(26,115,232,0.03)',
    },
    sectionHeaderText: { fontSize: 12, fontWeight: '800', color: P, letterSpacing: 1.5, textTransform: 'uppercase' as any },
    sectionBody: { padding: 20, gap: 16 },
    inputGroup: { gap: 7 },
    label: { fontSize: 11, fontWeight: '700', color: TX3, letterSpacing: 1.2, textTransform: 'uppercase' as any },
    input: {
      backgroundColor: INPUT, borderWidth: 1.5, borderColor: INPUT_B,
      borderRadius: 12, paddingHorizontal: 14, height: 50,
      fontSize: 15, fontWeight: '500', color: TX,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    inputFocused: {
      borderColor: P, shadowColor: P,
      shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
    },
    inputDisabled: {
      backgroundColor: isDark ? 'rgba(26,58,92,0.3)' : 'rgba(221,232,255,0.5)', color: TX3,
    },
    passwordWrapper: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: INPUT,
      borderWidth: 1.5, borderColor: INPUT_B, borderRadius: 12, paddingHorizontal: 14, height: 50,
    },
    passwordWrapperFocused: {
      borderColor: P, shadowColor: P,
      shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
    },
    passwordInput: {
      flex: 1, fontSize: 15, fontWeight: '500', color: TX,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    helperText: { fontSize: 11, color: TX3, fontStyle: 'italic', marginTop: 2 },
    infoChip: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: isDark ? 'rgba(26,115,232,0.08)' : 'rgba(26,115,232,0.05)',
      borderWidth: 1, borderColor: CARD_B, borderRadius: 12, padding: 14,
    },
    infoChipLabel: { fontSize: 11, color: TX3, marginBottom: 2, letterSpacing: 0.5 },
    infoChipValue: { fontSize: 15, fontWeight: '700', color: TX },
    coordRow: { flexDirection: 'row', gap: 12 },
    coordField: { flex: 1 },
    button: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: P, height: 50, borderRadius: 12, marginTop: 4,
      shadowColor: P, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 10, elevation: 6, overflow: 'hidden', position: 'relative',
    },
    buttonSecondary: { backgroundColor: isDark ? '#0D4A8A' : '#1558C0' },
    buttonOutline: {
      backgroundColor: 'transparent', borderWidth: 1.5, borderColor: CARD_B,
      shadowOpacity: 0, elevation: 0,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
    buttonOutlineText: { color: TX2, fontSize: 15, fontWeight: '700' },
    btnShine: {
      position: 'absolute', top: 0, left: 0, right: 0, height: '50%' as any,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderTopLeftRadius: 12, borderTopRightRadius: 12,
    },
    locationPickerButton: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: INPUT, borderWidth: 1.5, borderColor: INPUT_B,
      borderRadius: 12, paddingHorizontal: 14, height: 54,
    },
    locationPickerButtonActive: { borderColor: P },
    locationPickerText: { flex: 1, fontSize: 15, fontWeight: '600', color: TX },
    locationPickerPlaceholder: { flex: 1, fontSize: 15, color: TX3 },
    locationPickerChevron: { marginLeft: 4 },
    currentLocationBadge: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
      backgroundColor: isDark ? 'rgba(26,115,232,0.15)' : '#EBF3FF',
    },
    currentLocationBadgeText: { fontSize: 10, fontWeight: '700', color: P, letterSpacing: 0.5 },
    coordsDisplay: {
      flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
      backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF9',
      borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(16,185,129,0.2)' : '#A7F3D0',
    },
    coordsText: { flex: 1, fontSize: 12, color: SUCCESS, fontWeight: '500' },
    bottomSpacer: { height: 24 },
    hiddenLogout: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 16,
    },
    hiddenLogoutText: {
      fontSize: 12, color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', fontWeight: '500',
    },
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    locationModal: {
      backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderWidth: 1, borderColor: CARD_B, maxHeight: '80%',
      paddingBottom: 24,
    },
    locationModalHandle: {
      width: 40, height: 4, backgroundColor: TX3, borderRadius: 2,
      alignSelf: 'center', marginTop: 12, marginBottom: 16,
    },
    locationModalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: CARD_B,
    },
    locationModalTitle: { fontSize: 18, fontWeight: '800', color: TX },
    locationModalClose: {
      width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
      backgroundColor: INPUT, borderWidth: 1, borderColor: INPUT_B,
    },
    locationSearchWrapper: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 20, marginTop: 16, marginBottom: 8,
      backgroundColor: INPUT, borderWidth: 1.5, borderColor: INPUT_B,
      borderRadius: 12, paddingHorizontal: 14, height: 46,
    },
    locationSearchInput: {
      flex: 1, fontSize: 14, color: TX,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    locationGroupLabel: {
      fontSize: 10, fontWeight: '800', color: TX3, letterSpacing: 1.5,
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6,
      textTransform: 'uppercase' as any,
    },
    locationOption: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(26,58,92,0.5)' : '#F0F4FF',
    },
    locationOptionActive: {
      backgroundColor: isDark ? 'rgba(26,115,232,0.1)' : '#EBF3FF',
    },
    locationOptionText: { flex: 1, fontSize: 15, fontWeight: '600', color: TX },
    locationOptionTextActive: { color: P },
    locationOptionDot: {
      width: 8, height: 8, borderRadius: 4, backgroundColor: P,
    },
    gpsConfirmModal: {
      backgroundColor: CARD, borderRadius: 24, margin: 20,
      borderWidth: 1, borderColor: CARD_B, padding: 24,
      shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25, shadowRadius: 30, elevation: 24,
    },
    gpsConfirmIcon: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#F0FDF9',
      borderWidth: 1.5, borderColor: isDark ? 'rgba(16,185,129,0.3)' : '#A7F3D0',
      justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16,
    },
    gpsConfirmTitle: { fontSize: 20, fontWeight: '800', color: TX, textAlign: 'center', marginBottom: 6 },
    gpsConfirmSubtitle: { fontSize: 13, color: TX2, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
    gpsConfirmAddress: {
      padding: 12, borderRadius: 12, marginBottom: 20,
      backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF9',
      borderWidth: 1, borderColor: isDark ? 'rgba(16,185,129,0.2)' : '#A7F3D0',
    },
    gpsConfirmAddressLabel: { fontSize: 10, fontWeight: '700', color: SUCCESS, letterSpacing: 1, marginBottom: 4 },
    gpsConfirmAddressText: { fontSize: 13, color: TX, fontWeight: '500', lineHeight: 18 },
    gpsConfirmButtons: { gap: 10 },
    gpsConfirmBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 50, borderRadius: 12, overflow: 'hidden',
    },
    gpsConfirmBtnPrimary: {
      backgroundColor: P,
      shadowColor: P, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    },
    gpsConfirmBtnSecondary: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#F0FDF9',
      borderWidth: 1.5, borderColor: isDark ? 'rgba(16,185,129,0.3)' : '#A7F3D0',
    },
    gpsConfirmBtnOutline: {
      backgroundColor: INPUT, borderWidth: 1.5, borderColor: INPUT_B,
    },
    gpsConfirmBtnText: { fontSize: 15, fontWeight: '700' },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={P} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.bgCircle} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={18} color={TX2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>

      {error ? (
        <View style={[styles.alertBanner, styles.alertError]}>
          <Text style={[styles.alertText, { color: ERR }]}>{error}</Text>
        </View>
      ) : null}
      {success ? (
        <View style={[styles.alertBanner, styles.alertSuccess]}>
          <CheckCircle size={16} color={SUCCESS} />
          <Text style={[styles.alertText, { color: SUCCESS }]}>{success}</Text>
        </View>
      ) : null}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Personal Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={14} color={P} />
            <Text style={styles.sectionHeaderText}>Personal Information</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={username}
                editable={false}
                placeholderTextColor={TX3}
              />
              <Text style={styles.helperText}>Username cannot be changed</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={inputStyle('fullName')}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={TX3}
                onFocus={() => setFocusedField('fullName')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={inputStyle('phone')}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Enter your phone number"
                placeholderTextColor={TX3}
                keyboardType="phone-pad"
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email (Optional)</Text>
              <TextInput
                style={inputStyle('email')}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={TX3}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={saveProfile}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Save size={18} color="#fff" />
              <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
              <View style={styles.btnShine} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Registered Location */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <School size={14} color={P} />
            <Text style={styles.sectionHeaderText}>Registered Location</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Location</Text>
              <TouchableOpacity
                style={[styles.locationPickerButton, universityId && styles.locationPickerButtonActive]}
                onPress={() => { setLocationSearch(''); setShowLocationModal(true); }}
                activeOpacity={0.8}
              >
                <School size={18} color={universityId ? P : TX3} />
                {universityName ? (
                  <Text style={styles.locationPickerText} numberOfLines={1}>{universityName}</Text>
                ) : (
                  <Text style={styles.locationPickerPlaceholder}>Select a location</Text>
                )}
                {universityId && (
                  <View style={styles.currentLocationBadge}>
                    <Text style={styles.currentLocationBadgeText}>CURRENT</Text>
                  </View>
                )}
                <ChevronDown size={16} color={TX3} style={styles.locationPickerChevron} />
              </TouchableOpacity>
              <Text style={styles.helperText}>Drivers in your location area will see your orders</Text>
            </View>
          </View>
        </View>

        {/* Delivery GPS Location */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={14} color={P} />
            <Text style={styles.sectionHeaderText}>Delivery GPS Location</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Coordinates</Text>
              <View style={styles.coordRow}>
                <View style={styles.coordField}>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={latitude ? parseFloat(latitude).toFixed(5) : ''}
                    editable={false}
                    placeholder="Latitude"
                    placeholderTextColor={TX3}
                  />
                </View>
                <View style={styles.coordField}>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={longitude ? parseFloat(longitude).toFixed(5) : ''}
                    editable={false}
                    placeholder="Longitude"
                    placeholderTextColor={TX3}
                  />
                </View>
              </View>
              <Text style={styles.helperText}>Your precise GPS pin used by drivers to navigate to you</Text>
            </View>

            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, updating && styles.buttonDisabled]}
              onPress={detectGps}
              disabled={updating}
              activeOpacity={0.85}
            >
              <Navigation size={18} color="#fff" />
              <Text style={styles.buttonText}>{updating ? 'Detecting...' : 'Update My GPS Location'}</Text>
              <View style={styles.btnShine} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Change Password */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Lock size={14} color={P} />
            <Text style={styles.sectionHeaderText}>Change Password</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <View style={[styles.passwordWrapper, focusedField === 'curPw' && styles.passwordWrapperFocused]}>
                <TextInput
                  style={styles.passwordInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={TX3}
                  secureTextEntry={!showCurrentPw}
                  onFocus={() => setFocusedField('curPw')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity onPress={() => setShowCurrentPw(v => !v)}>
                  {showCurrentPw ? <EyeOff size={18} color={TX3} /> : <Eye size={18} color={TX3} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={[styles.passwordWrapper, focusedField === 'newPw' && styles.passwordWrapperFocused]}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={TX3}
                  secureTextEntry={!showNewPw}
                  onFocus={() => setFocusedField('newPw')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity onPress={() => setShowNewPw(v => !v)}>
                  {showNewPw ? <EyeOff size={18} color={TX3} /> : <Eye size={18} color={TX3} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={[styles.passwordWrapper, focusedField === 'confPw' && styles.passwordWrapperFocused]}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={TX3}
                  secureTextEntry={!showConfirmPw}
                  onFocus={() => setFocusedField('confPw')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity onPress={() => setShowConfirmPw(v => !v)}>
                  {showConfirmPw ? <EyeOff size={18} color={TX3} /> : <Eye size={18} color={TX3} />}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={changePassword}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Lock size={18} color="#fff" />
              <Text style={styles.buttonText}>{saving ? 'Changing Password...' : 'Change Password'}</Text>
              <View style={styles.btnShine} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy Centre */}
        <TouchableOpacity
          style={[styles.section, { flexDirection: 'row', alignItems: 'center' }]}
          onPress={() => router.push({ pathname: '/customer/privacy-centre', params: { customerId: customerId as string } })}
          activeOpacity={0.8}
        >
          <View style={[styles.sectionHeader, { borderBottomWidth: 0, flex: 1 }]}>
            <Shield size={14} color={P} />
            <Text style={styles.sectionHeaderText}>Privacy Centre</Text>
            <View style={{ flex: 1 }} />
            <ChevronRight size={18} color={TX3} />
          </View>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />

        {/* Discreet logout — hidden at the bottom, small and muted */}
        <TouchableOpacity
          style={styles.hiddenLogout}
          onPress={() => { clearUserData(); router.replace('/'); }}
          activeOpacity={0.5}
        >
          <LogOut size={13} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
          <Text style={styles.hiddenLogoutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* GPS Update Confirmation Modal */}
      <Modal
        visible={showGpsUpdateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGpsUpdateModal(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View style={styles.gpsConfirmModal}>
            <View style={styles.gpsConfirmIcon}>
              <Navigation size={26} color={SUCCESS} />
            </View>
            <Text style={styles.gpsConfirmTitle}>Location Detected</Text>
            <Text style={styles.gpsConfirmSubtitle}>
              Your GPS coordinates have been captured. Would you also like to update your registered location (university / area)?
            </Text>
            {newGpsCoords && (
              <View style={styles.gpsConfirmAddress}>
                <Text style={styles.gpsConfirmAddressLabel}>DETECTED ADDRESS</Text>
                <Text style={styles.gpsConfirmAddressText}>{newGpsCoords.address}</Text>
              </View>
            )}
            <View style={styles.gpsConfirmButtons}>
              <TouchableOpacity
                style={[styles.gpsConfirmBtn, styles.gpsConfirmBtnPrimary]}
                onPress={confirmGpsAndLocation}
                activeOpacity={0.85}
              >
                <School size={18} color="#fff" />
                <Text style={[styles.gpsConfirmBtnText, { color: '#fff' }]}>Update GPS + Change Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gpsConfirmBtn, styles.gpsConfirmBtnSecondary]}
                onPress={confirmGpsOnly}
                activeOpacity={0.85}
              >
                <MapPin size={18} color={SUCCESS} />
                <Text style={[styles.gpsConfirmBtnText, { color: SUCCESS }]}>Update GPS Only</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gpsConfirmBtn, styles.gpsConfirmBtnOutline]}
                onPress={() => { setShowGpsUpdateModal(false); setNewGpsCoords(null); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.gpsConfirmBtnText, { color: TX2 }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.locationModal}>
            <View style={styles.locationModalHandle} />
            <View style={styles.locationModalHeader}>
              <Text style={styles.locationModalTitle}>Select Location</Text>
              <TouchableOpacity
                style={styles.locationModalClose}
                onPress={() => { setShowLocationModal(false); setNewGpsCoords(null); }}
              >
                <X size={18} color={TX2} />
              </TouchableOpacity>
            </View>

            <View style={styles.locationSearchWrapper}>
              <Search size={16} color={TX3} />
              <TextInput
                style={styles.locationSearchInput}
                value={locationSearch}
                onChangeText={setLocationSearch}
                placeholder="Search universities or areas..."
                placeholderTextColor={TX3}
                autoFocus
              />
              {locationSearch.length > 0 && (
                <TouchableOpacity onPress={() => setLocationSearch('')}>
                  <X size={14} color={TX3} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {universities.length > 0 && (
                <>
                  <Text style={styles.locationGroupLabel}>Universities</Text>
                  {universities.map(loc => (
                    <TouchableOpacity
                      key={loc.id}
                      style={[styles.locationOption, loc.id === universityId && styles.locationOptionActive]}
                      onPress={() => saveRegisteredLocation(loc.id)}
                      activeOpacity={0.7}
                    >
                      <School size={16} color={loc.id === universityId ? P : TX3} />
                      <Text style={[styles.locationOptionText, loc.id === universityId && styles.locationOptionTextActive]}>
                        {loc.name}
                      </Text>
                      {loc.id === universityId && <View style={styles.locationOptionDot} />}
                      {savingLocation && loc.id === pendingLocationId && (
                        <ActivityIndicator size="small" color={P} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {places.length > 0 && (
                <>
                  <Text style={styles.locationGroupLabel}>Other Areas</Text>
                  {places.map(loc => (
                    <TouchableOpacity
                      key={loc.id}
                      style={[styles.locationOption, loc.id === universityId && styles.locationOptionActive]}
                      onPress={() => saveRegisteredLocation(loc.id)}
                      activeOpacity={0.7}
                    >
                      <MapPin size={16} color={loc.id === universityId ? P : TX3} />
                      <Text style={[styles.locationOptionText, loc.id === universityId && styles.locationOptionTextActive]}>
                        {loc.name}
                      </Text>
                      {loc.id === universityId && <View style={styles.locationOptionDot} />}
                      {savingLocation && loc.id === pendingLocationId && (
                        <ActivityIndicator size="small" color={P} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {filteredLocations.length === 0 && (
                <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
                  <Search size={32} color={TX3} />
                  <Text style={{ fontSize: 14, color: TX3 }}>No locations match your search</Text>
                </View>
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
