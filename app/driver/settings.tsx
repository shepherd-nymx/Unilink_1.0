import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, User, School, Save, CircleCheck as CheckCircle, Zap, Clock, Bike, Car, MapPin, Navigation2, MessageCircle, LogOut, Mail } from 'lucide-react-native';
import SwitchLocationModal from '@/components/SwitchLocationModal';
import { useTheme } from '@/contexts/ThemeContext';
import { clearUserData } from '@/lib/storage-service';

const CYAN = '#00e5ff';
const CYAN_DIM = 'rgba(0,229,255,0.1)';
const CYAN_BORDER = 'rgba(0,229,255,0.22)';
const GREEN = '#00ff88';
const GREEN_DIM = 'rgba(0,255,136,0.1)';
const AMBER = '#ffb300';
const BG = '#030810';
const CARD = '#070f1c';
const CARD2 = '#0b1628';
const TEXT = '#d0eaff';
const TEXT2 = '#4a7a9b';
const TEXT3 = '#1e3a5f';

function AnimatedSaveButton({ onPress, saving }: { onPress: () => void; saving: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const onIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] });

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: saving ? 0.6 : 1, marginBottom: 40 }}>
      <Animated.View style={{
        borderRadius: 14, shadowColor: GREEN,
        shadowOffset: { width: 0, height: 0 }, shadowOpacity, shadowRadius: 18, elevation: 12,
      }}>
        <TouchableOpacity
          style={ss.saveBtn}
          onPress={onPress}
          onPressIn={onIn}
          onPressOut={onOut}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color={GREEN} />
          ) : (
            <Save size={18} color={GREEN} />
          )}
          <Text style={ss.saveBtnText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

export default function DriverSettings() {
  const router = useRouter();
  const { driverId } = useLocalSearchParams();
  const { colors, toggleTheme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [defaultUniversityId, setDefaultUniversityId] = useState<string | null>(null);
  const [activeUniversityId, setActiveUniversityId] = useState<string | null>(null);
  const [activeUniversityName, setActiveUniversityName] = useState('');
  const [showSwitchLocation, setShowSwitchLocation] = useState(false);
  const [maxDistance, setMaxDistance] = useState('10');
  const [feeUpTo10, setFeeUpTo10] = useState('2');
  const [feeUpTo20, setFeeUpTo20] = useState('3.5');
  const [feeUpTo30, setFeeUpTo30] = useState('5');
  const [feeUpTo40, setFeeUpTo40] = useState('6.5');
  const [feeUpTo50, setFeeUpTo50] = useState('8');
  const [feeUpTo100, setFeeUpTo100] = useState('12');
  const [feeUpTo200, setFeeUpTo200] = useState('18');
  const [feeUpTo300, setFeeUpTo300] = useState('25');
  const [feeUpTo400, setFeeUpTo400] = useState('32');
  const [feeUpTo500, setFeeUpTo500] = useState('40');
  const [isAvailable, setIsAvailable] = useState(false);
  const [deliveryTypes, setDeliveryTypes] = useState<string[]>(['walking']);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['pay_on_delivery']);
  const [whatsappCountryCode, setWhatsappCountryCode] = useState('+263');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [homeLatitude, setHomeLatitude] = useState('');
  const [homeLongitude, setHomeLongitude] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [distanceTiers, setDistanceTiers] = useState<{ id?: string; min_km: string; max_km: string; fee: string; label: string }[]>([
    { min_km: '0', max_km: '2', fee: '1.50', label: 'Short hop' },
    { min_km: '2', max_km: '5', fee: '3.00', label: 'Medium' },
  ]);
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [availabilityStartTime, setAvailabilityStartTime] = useState('');
  const [availabilityEndTime, setAvailabilityEndTime] = useState('');
  const [availabilityDays, setAvailabilityDays] = useState<string[]>([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ]);

  const headerGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlow, { toValue: 1, duration: 3000, useNativeDriver: false }),
        Animated.timing(headerGlow, { toValue: 0, duration: 3000, useNativeDriver: false }),
      ])
    );
    loop.start();
    loadSettings();
    return () => loop.stop();
  }, []);

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) { setError('Image size must be less than 5MB'); return; }
          const reader = new FileReader();
          reader.onloadend = async () => {
            await uploadImageFromBase64(reader.result as string, file.name);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
      return;
    }
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) await uploadImage(result.assets[0].uri);
  };

  const uploadImageFromBase64 = async (base64: string, originalFileName: string) => {
    try {
      setUploadingImage(true); setError('');
      const fileExt = originalFileName.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${driverId}/${Date.now()}.${fileExt}`;
      const blob = await fetch(base64).then(r => r.blob());
      const { error: uploadError } = await supabase.storage.from('profile-pictures').upload(fileName, blob, { contentType: `image/${fileExt}`, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('profile-pictures').getPublicUrl(fileName);
      setProfilePictureUrl(publicUrl);
      setSuccessMessage('Photo uploaded');
    } catch (err: any) { setError(err.message || 'Failed to upload image'); }
    finally { setUploadingImage(false); }
  };

  const uploadImage = async (uri: string) => {
    try {
      setUploadingImage(true); setError('');
      const blob = await fetch(uri).then(r => r.blob());
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${driverId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('profile-pictures').upload(fileName, blob, { contentType: `image/${fileExt}`, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('profile-pictures').getPublicUrl(fileName);
      setProfilePictureUrl(publicUrl);
      setSuccessMessage('Photo uploaded');
    } catch (err: any) { setError(err.message || 'Failed to upload image'); }
    finally { setUploadingImage(false); }
  };

  const loadSettings = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('drivers')
        .select('*, universities!drivers_university_id_fkey(name), active_uni:universities!drivers_active_university_id_fkey(name)')
        .eq('id', driverId as string)
        .single();
      if (dbError) throw dbError;
      setMaxDistance(data.max_distance_km.toString());
      setFeeUpTo10(data.fee_up_to_10?.toString() || '2');
      setFeeUpTo20(data.fee_up_to_20?.toString() || '3.5');
      setFeeUpTo30(data.fee_up_to_30?.toString() || '5');
      setFeeUpTo40(data.fee_up_to_40?.toString() || '6.5');
      setFeeUpTo50(data.fee_up_to_50?.toString() || '8');
      setFeeUpTo100(data.fee_up_to_100?.toString() || '12');
      setFeeUpTo200(data.fee_up_to_200?.toString() || '18');
      setFeeUpTo300(data.fee_up_to_300?.toString() || '25');
      setFeeUpTo400(data.fee_up_to_400?.toString() || '32');
      setFeeUpTo500(data.fee_up_to_500?.toString() || '40');
      setIsAvailable(data.is_available);
      setDeliveryTypes(data.delivery_type || ['walking']);
      setPaymentMethods(data.payment_methods || ['pay_on_delivery']);
      const rawWp = data.whatsapp_number || '';
      if (rawWp.startsWith('+')) {
        const match = rawWp.match(/^(\+\d{1,4})(.*)$/);
        if (match) { setWhatsappCountryCode(match[1]); setWhatsappNumber(match[2].replace(/\D/g, '')); }
        else { setWhatsappNumber(rawWp.replace(/[^0-9]/g, '')); }
      } else { setWhatsappNumber(rawWp.replace(/[^0-9]/g, '')); }
      setNotificationEmail(data.notification_email || data.email || '');
      setHomeLatitude(data.home_latitude != null ? String(data.home_latitude) : '');
      setHomeLongitude(data.home_longitude != null ? String(data.home_longitude) : '');
      setHomeAddress(data.home_address || '');
      const { data: tiers } = await supabase
        .from('driver_distance_fee_tiers')
        .select('id, min_km, max_km, fee, label, sort_order')
        .eq('driver_id', driverId as string)
        .order('sort_order', { ascending: true });
      if (tiers && tiers.length > 0) {
        setDistanceTiers(tiers.map((t: any) => ({
          id: t.id, min_km: String(t.min_km), max_km: t.max_km != null ? String(t.max_km) : '',
          fee: String(t.fee), label: t.label || '',
        })));
      }
      setProfilePictureUrl(data.profile_picture_url || '');
      setUniversityName((data.universities as any)?.name || '');
      setDefaultUniversityId(data.university_id || null);
      setActiveUniversityId(data.active_university_id ?? data.university_id ?? null);
      setActiveUniversityName((data.active_uni as any)?.name ?? (data.universities as any)?.name ?? '');
      setAvailabilityStartTime(data.availability_start_time || '');
      setAvailabilityEndTime(data.availability_end_time || '');
      setAvailabilityDays(data.availability_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    } catch (err: any) { setError(err.message || 'Failed to load settings'); }
    finally { setLoading(false); }
  };

  const saveSettings = async () => {
    if (deliveryTypes.length === 0) { setError('Please select at least one delivery type'); return; }
    if (paymentMethods.length === 0) { setError('Please select at least one payment method'); return; }
    setSaving(true); setError(''); setSuccessMessage('');
    try {
      const { error: dbError } = await supabase.from('drivers').update({
        max_distance_km: parseFloat(maxDistance),
        fee_up_to_10: parseFloat(feeUpTo10), fee_up_to_20: parseFloat(feeUpTo20),
        fee_up_to_30: parseFloat(feeUpTo30), fee_up_to_40: parseFloat(feeUpTo40),
        fee_up_to_50: parseFloat(feeUpTo50), fee_up_to_100: parseFloat(feeUpTo100),
        fee_up_to_200: parseFloat(feeUpTo200), fee_up_to_300: parseFloat(feeUpTo300),
        fee_up_to_400: parseFloat(feeUpTo400), fee_up_to_500: parseFloat(feeUpTo500),
        is_available: isAvailable, delivery_type: deliveryTypes, payment_methods: paymentMethods,
        whatsapp_number: (whatsappCountryCode.trim() + whatsappNumber.trim()) || null,
        notification_email: notificationEmail.trim() || null,
        home_latitude: homeLatitude.trim() ? parseFloat(homeLatitude) : null,
        home_longitude: homeLongitude.trim() ? parseFloat(homeLongitude) : null,
        home_address: homeAddress.trim() || null,
        profile_picture_url: profilePictureUrl.trim() || null,
        availability_start_time: availabilityStartTime.trim() || null,
        availability_end_time: availabilityEndTime.trim() || null,
        availability_days: availabilityDays,
      }).eq('id', driverId as string);
      if (dbError) throw dbError;

      await supabase.from('driver_distance_fee_tiers').delete().eq('driver_id', driverId as string);
      const tiersToInsert = distanceTiers
        .filter(t => t.fee.trim() && t.min_km.trim())
        .map((t, i) => ({
          driver_id: driverId as string,
          min_km: parseFloat(t.min_km),
          max_km: t.max_km.trim() ? parseFloat(t.max_km) : null,
          fee: parseFloat(t.fee),
          label: t.label.trim() || null,
          sort_order: i,
        }));
      if (tiersToInsert.length > 0) {
        const { error: tierErr } = await supabase.from('driver_distance_fee_tiers').insert(tiersToInsert);
        if (tierErr) throw tierErr;
      }

      setSuccessMessage('Settings saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) { setError(err.message || 'Failed to save settings'); }
    finally { setSaving(false); }
  };

  const toggleType = (t: string) => setDeliveryTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const togglePayment = (m: string) => setPaymentMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  const toggleDay = (d: string) => setAvailabilityDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const updateTier = (idx: number, field: 'min_km' | 'max_km' | 'fee' | 'label', val: string) =>
    setDistanceTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  const addTier = () => setDistanceTiers(prev => [...prev, { min_km: '', max_km: '', fee: '', label: '' }]);
  const removeTier = (idx: number) => setDistanceTiers(prev => prev.filter((_, i) => i !== idx));

  const headerBorder = headerGlow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,229,255,0.06)', 'rgba(0,229,255,0.25)'] });

  if (loading) {
    return (
      <View style={ss.centered}>
        <ActivityIndicator size="large" color={CYAN} />
      </View>
    );
  }

  return (
    <View style={ss.container}>
      <Animated.View style={[ss.header, { borderBottomColor: headerBorder }]}>
        <TouchableOpacity style={ss.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={CYAN} />
        </TouchableOpacity>
        <Text style={ss.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </Animated.View>

      <ScrollView style={ss.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={ss.errorBox}>
            <Text style={ss.errorText}>{error}</Text>
          </View>
        ) : null}
        {successMessage ? (
          <View style={ss.successBox}>
            <CheckCircle size={14} color={GREEN} />
            <Text style={ss.successText}>{successMessage}</Text>
          </View>
        ) : null}

        <View style={ss.locationCard}>
          <View style={ss.locationCardRow}>
            <View style={ss.locationIconWrap}>
              <MapPin size={16} color={CYAN} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={ss.locationRow}>
                <View style={{ flex: 1 }}>
                  <Text style={ss.infoLabel}>Active Location</Text>
                  <Text style={ss.infoValue}>{activeUniversityName || universityName || '—'}</Text>
                </View>
                <TouchableOpacity style={ss.switchBtn} onPress={() => setShowSwitchLocation(true)}>
                  <Navigation2 size={11} color={CYAN} />
                  <Text style={ss.switchBtnText}>Switch</Text>
                </TouchableOpacity>
              </View>
              {universityName && activeUniversityName && activeUniversityName !== universityName && (
                <View style={ss.defaultLocationRow}>
                  <School size={11} color={TEXT2} />
                  <Text style={ss.defaultLocationText}>Default: {universityName}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <SwitchLocationModal
          visible={showSwitchLocation}
          driverId={driverId as string}
          currentActiveUniversityId={activeUniversityId}
          defaultUniversityId={defaultUniversityId}
          hasActiveDelivery={false}
          onClose={() => setShowSwitchLocation(false)}
          onSwitched={(id, name) => {
            setActiveUniversityId(id);
            setActiveUniversityName(name);
            setSuccessMessage(`Location switched to ${name}`);
            setTimeout(() => setSuccessMessage(''), 3000);
          }}
        />

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Profile Picture</Text>
          <View style={ss.photoCenter}>
            <View style={ss.avatarRing}>
              {profilePictureUrl ? (
                <Image source={{ uri: profilePictureUrl }} style={ss.avatar} resizeMode="cover" />
              ) : (
                <User size={40} color={TEXT2} />
              )}
            </View>
            <TouchableOpacity style={ss.photoBtn} onPress={pickImage} disabled={uploadingImage}>
              {uploadingImage ? <ActivityIndicator size="small" color={CYAN} /> : <Camera size={15} color={CYAN} />}
              <Text style={ss.photoBtnText}>{uploadingImage ? 'Uploading...' : (profilePictureUrl ? 'Change Photo' : 'Add Photo')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={ss.fieldLabel}>Photo URL</Text>
          <TextInput
            style={ss.input}
            value={profilePictureUrl}
            onChangeText={setProfilePictureUrl}
            placeholder="https://..."
            placeholderTextColor={TEXT3}
          />
        </View>

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Appearance</Text>
          <View style={ss.switchRow}>
            <Text style={ss.switchLabel}>Dark Mode</Text>
            <Switch value={isDark} onValueChange={toggleTheme}
              trackColor={{ false: TEXT3, true: CYAN + '66' }} thumbColor={isDark ? CYAN : '#666'} />
          </View>
        </View>

        <View style={ss.section}>
          <View style={ss.switchRow}>
            <View style={{ gap: 2 }}>
              <Text style={ss.sectionTitle}>Availability</Text>
              <Text style={ss.sectionDesc}>Accept new delivery orders</Text>
            </View>
            <Switch value={isAvailable} onValueChange={setIsAvailable}
              trackColor={{ false: TEXT3, true: GREEN + '66' }} thumbColor={isAvailable ? GREEN : '#666'} />
          </View>
        </View>

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Schedule</Text>
          <Text style={ss.sectionDesc}>Set your working hours</Text>

          <View style={ss.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={ss.fieldLabel}>Start</Text>
              <View style={ss.timeInputWrap}>
                <Clock size={13} color={TEXT2} />
                <TextInput
                  style={ss.timeInput}
                  value={availabilityStartTime}
                  onChangeText={setAvailabilityStartTime}
                  placeholder="08:00"
                  placeholderTextColor={TEXT3}
                />
              </View>
            </View>
            <View style={ss.timeSep}><Text style={ss.timeSepText}>–</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={ss.fieldLabel}>End</Text>
              <View style={ss.timeInputWrap}>
                <Clock size={13} color={TEXT2} />
                <TextInput
                  style={ss.timeInput}
                  value={availabilityEndTime}
                  onChangeText={setAvailabilityEndTime}
                  placeholder="18:00"
                  placeholderTextColor={TEXT3}
                />
              </View>
            </View>
          </View>

          <Text style={[ss.fieldLabel, { marginTop: 14 }]}>Available Days</Text>
          <View style={ss.daysGrid}>
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
              const active = availabilityDays.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[ss.dayChip, active && ss.dayChipActive]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[ss.dayChipText, active && ss.dayChipTextActive]}>{day.substring(0, 3)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Your GPS Location</Text>
          <Text style={ss.sectionDesc}>Customers use this to find the messenger closest to them. Set your typical base location (e.g. your dorm, campus spot).</Text>
          <View style={ss.inputWrap}>
            <MapPin size={14} color={TEXT2} />
            <TextInput
              style={ss.inputInline}
              value={homeAddress}
              onChangeText={setHomeAddress}
              placeholder="e.g. Near UZ Maths Department"
              placeholderTextColor={TEXT3}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={ss.fieldLabel}>Latitude</Text>
              <View style={ss.inputWrap}>
                <TextInput
                  style={ss.inputInline}
                  value={homeLatitude}
                  onChangeText={setHomeLatitude}
                  placeholder="-17.7852"
                  placeholderTextColor={TEXT3}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.fieldLabel}>Longitude</Text>
              <View style={ss.inputWrap}>
                <TextInput
                  style={ss.inputInline}
                  value={homeLongitude}
                  onChangeText={setHomeLongitude}
                  placeholder="31.0522"
                  placeholderTextColor={TEXT3}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={[ss.toggleBtn, { marginTop: 10, alignSelf: 'flex-start' }]}
            onPress={async () => {
              setDetectingGps(true);
              setError('');
              try {
                let lat: number;
                let lng: number;

                if (Platform.OS === 'web') {
                  if (!navigator.geolocation) {
                    setError('Geolocation is not supported by your browser. Please enter coordinates manually.');
                    return;
                  }
                  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
                  });
                  lat = pos.coords.latitude;
                  lng = pos.coords.longitude;
                } else {
                  const Location = await import('expo-location');
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== 'granted') {
                    setError('Location permission denied. Please enter coordinates manually.');
                    return;
                  }
                  const pos = await Location.getCurrentPositionAsync({});
                  lat = pos.coords.latitude;
                  lng = pos.coords.longitude;
                }

                setHomeLatitude(String(lat.toFixed(6)));
                setHomeLongitude(String(lng.toFixed(6)));

                await supabase
                  .from('drivers')
                  .update({ home_latitude: lat, home_longitude: lng })
                  .eq('id', driverId as string);

                setSuccessMessage('GPS location saved to your profile');
                setTimeout(() => setSuccessMessage(''), 3000);
              } catch (err: any) {
                setError(err?.message || 'Failed to detect GPS location');
              } finally {
                setDetectingGps(false);
              }
            }}
            disabled={detectingGps}
            activeOpacity={0.85}
          >
            {detectingGps ? <ActivityIndicator size="small" color={CYAN} /> : <Navigation2 size={14} color={CYAN} />}
            <Text style={[ss.toggleBtnText, { color: CYAN }]}>{detectingGps ? 'Detecting...' : 'Use My Current GPS'}</Text>
          </TouchableOpacity>
        </View>

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Distance-Based Delivery Fees</Text>
          <Text style={ss.sectionDesc}>Set the fee you charge based on how far the customer is from your base location. Customers see this when choosing you.</Text>
          {distanceTiers.map((tier, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <View style={{ flex: 0.8 }}>
                <Text style={ss.fieldLabel}>Min km</Text>
                <TextInput
                  style={[ss.input, { paddingHorizontal: 8, paddingVertical: 8, fontSize: 13 }]}
                  value={tier.min_km}
                  onChangeText={v => updateTier(idx, 'min_km', v)}
                  placeholder="0"
                  placeholderTextColor={TEXT3}
                  keyboardType="decimal-pad"
                />
              </View>
              <Text style={{ color: TEXT2, fontSize: 16, marginTop: 18 }}>–</Text>
              <View style={{ flex: 0.8 }}>
                <Text style={ss.fieldLabel}>Max km</Text>
                <TextInput
                  style={[ss.input, { paddingHorizontal: 8, paddingVertical: 8, fontSize: 13 }]}
                  value={tier.max_km}
                  onChangeText={v => updateTier(idx, 'max_km', v)}
                  placeholder="∞"
                  placeholderTextColor={TEXT3}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 0.7 }}>
                <Text style={ss.fieldLabel}>Fee $</Text>
                <TextInput
                  style={[ss.input, { paddingHorizontal: 8, paddingVertical: 8, fontSize: 13 }]}
                  value={tier.fee}
                  onChangeText={v => updateTier(idx, 'fee', v)}
                  placeholder="2.00"
                  placeholderTextColor={TEXT3}
                  keyboardType="decimal-pad"
                />
              </View>
              <TouchableOpacity onPress={() => removeTier(idx)} style={{ marginTop: 18, paddingHorizontal: 4 }}>
                <Text style={{ color: '#ff5555', fontSize: 20, fontWeight: '700' }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={ss.photoBtn} onPress={addTier}>
            <Text style={ss.photoBtnText}>+ Add Distance Tier</Text>
          </TouchableOpacity>
        </View>

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>WhatsApp Number</Text>
          <Text style={ss.sectionDesc}>Customers will use this to notify you when an order is placed</Text>
          <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
            <View style={[ss.inputWrap, { width: 92, flexShrink: 1 }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT2 }}>Code</Text>
              <TextInput
                style={[ss.inputInline, { fontSize: 13 }]}
                value={whatsappCountryCode}
                onChangeText={setWhatsappCountryCode}
                placeholder="+263"
                placeholderTextColor={TEXT3}
                keyboardType="phone-pad"
                autoCorrect={false}
              />
            </View>
            <View style={[ss.inputWrap, { flex: 1, minWidth: 0 }]}>
              <MessageCircle size={14} color={TEXT2} />
              <TextInput
                style={ss.inputInline}
                value={whatsappNumber}
                onChangeText={setWhatsappNumber}
                placeholder="771234567"
                placeholderTextColor={TEXT3}
                keyboardType="number-pad"
                autoCorrect={false}
              />
            </View>
          </View>
        </View>

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Notification Email</Text>
          <Text style={ss.sectionDesc}>Receive email alerts when a shop order is assigned to you</Text>
          <View style={ss.inputWrap}>
            <Mail size={14} color={TEXT2} />
            <TextInput
              style={ss.inputInline}
              value={notificationEmail}
              onChangeText={setNotificationEmail}
              placeholder="e.g. yourname@gmail.com"
              placeholderTextColor={TEXT3}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Delivery Types</Text>
          <Text style={ss.sectionDesc}>Select all that you offer</Text>
          <View style={ss.toggleRow}>
            {[
              { key: 'walking', label: 'Walking', icon: <Zap size={14} color={deliveryTypes.includes('walking') ? CYAN : TEXT2} /> },
              { key: 'vehicle', label: 'Vehicle', icon: <Car size={14} color={deliveryTypes.includes('vehicle') ? CYAN : TEXT2} /> },
            ].map(({ key, label, icon }) => {
              const active = deliveryTypes.includes(key);
              return (
                <TouchableOpacity key={key} style={[ss.toggleBtn, active && ss.toggleBtnActive]} onPress={() => toggleType(key)}>
                  {icon}
                  <Text style={[ss.toggleBtnText, active && ss.toggleBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Payment Methods</Text>
          <Text style={ss.sectionDesc}>Select all you accept</Text>
          <View style={ss.toggleRow}>
            {[
              { key: 'pay_on_delivery', label: 'Cash' },
              { key: 'paynow', label: 'Paynow' },
            ].map(({ key, label }) => {
              const active = paymentMethods.includes(key);
              return (
                <TouchableOpacity key={key} style={[ss.toggleBtn, active && ss.toggleBtnActive]} onPress={() => togglePayment(key)}>
                  <Text style={[ss.toggleBtnText, active && ss.toggleBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Max Distance</Text>
          <Text style={ss.sectionDesc}>How far you'll travel (km)</Text>
          <View style={ss.inputWrap}>
            <TextInput
              style={[ss.inputInline, { flex: 1 }]}
              value={maxDistance}
              onChangeText={setMaxDistance}
              keyboardType="numeric"
              placeholder="10"
              placeholderTextColor={TEXT3}
            />
            <Text style={ss.unit}>km</Text>
          </View>
        </View>

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Delivery Fees</Text>
          <Text style={ss.sectionDesc}>Fee per order price tier</Text>

          <Text style={ss.tierGroupLabel}>Basic Tiers</Text>
          {[
            { label: 'Up to $10', val: feeUpTo10, set: setFeeUpTo10 },
            { label: '$10–$20', val: feeUpTo20, set: setFeeUpTo20 },
            { label: '$20–$30', val: feeUpTo30, set: setFeeUpTo30 },
            { label: '$30–$40', val: feeUpTo40, set: setFeeUpTo40 },
            { label: '$40–$50', val: feeUpTo50, set: setFeeUpTo50 },
          ].map(({ label, val, set }) => (
            <View key={label} style={ss.feeRow}>
              <Text style={ss.feeLabel}>{label}</Text>
              <View style={ss.feeInputWrap}>
                <Text style={ss.feePrefix}>$</Text>
                <TextInput
                  style={ss.feeInput}
                  value={val}
                  onChangeText={set}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={TEXT3}
                />
              </View>
            </View>
          ))}

          {deliveryTypes.includes('vehicle') && (
            <>
              <Text style={[ss.tierGroupLabel, { color: AMBER, marginTop: 14 }]}>Vehicle-Only Tiers</Text>
              {[
                { label: '$50–$100', val: feeUpTo100, set: setFeeUpTo100 },
                { label: '$100–$200', val: feeUpTo200, set: setFeeUpTo200 },
                { label: '$200–$300', val: feeUpTo300, set: setFeeUpTo300 },
                { label: '$300–$400', val: feeUpTo400, set: setFeeUpTo400 },
                { label: '$400–$500', val: feeUpTo500, set: setFeeUpTo500 },
              ].map(({ label, val, set }) => (
                <View key={label} style={ss.feeRow}>
                  <Text style={ss.feeLabel}>{label}</Text>
                  <View style={[ss.feeInputWrap, { borderColor: AMBER + '44' }]}>
                    <Text style={[ss.feePrefix, { color: AMBER }]}>$</Text>
                    <TextInput
                      style={ss.feeInput}
                      value={val}
                      onChangeText={set}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={TEXT3}
                    />
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        <AnimatedSaveButton onPress={saveSettings} saving={saving} />

        <View style={ss.logoutSection}>
          <Text style={ss.logoutTitle}>Account</Text>
          <Text style={ss.logoutDesc}>Sign out of your driver account</Text>
          <TouchableOpacity
            style={ss.logoutBtn}
            onPress={() => {
              clearUserData();
              supabase.auth.signOut();
              router.replace('/driver/login');
            }}
            activeOpacity={0.85}
          >
            <LogOut size={18} color="#ff5555" />
            <Text style={ss.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14,
    backgroundColor: CARD, borderBottomWidth: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: CARD2,
    borderWidth: 1, borderColor: CYAN_BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: TEXT, letterSpacing: 0.5 },

  errorBox: {
    padding: 10, borderRadius: 8, marginBottom: 12,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { color: '#ff6b6b', fontSize: 12, textAlign: 'center' },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 8, marginBottom: 12,
    backgroundColor: GREEN_DIM, borderWidth: 1, borderColor: GREEN + '44',
  },
  successText: { color: GREEN, fontSize: 12, fontWeight: '600' },

  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: CYAN_BORDER,
    padding: 14, marginBottom: 14,
  },
  infoLabel: { fontSize: 10, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.8 },
  infoValue: { fontSize: 15, fontWeight: '700', color: TEXT, marginTop: 2 },

  locationCard: {
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: CYAN_BORDER,
    padding: 14, marginBottom: 14,
  },
  locationCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  locationIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: CYAN_DIM, borderWidth: 1, borderColor: CYAN_BORDER,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: CYAN_DIM, borderRadius: 10,
    borderWidth: 1, borderColor: CYAN_BORDER,
  },
  switchBtnText: { fontSize: 11, fontWeight: '700', color: CYAN },
  defaultLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  defaultLocationText: { fontSize: 11, color: TEXT2 },

  section: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: TEXT3,
    padding: 16, marginBottom: 12, gap: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: TEXT, letterSpacing: 0.5 },
  sectionDesc: { fontSize: 11, color: TEXT2 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.7 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 13, color: TEXT2 },

  photoCenter: { alignItems: 'center', gap: 12 },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: CARD2, borderWidth: 2, borderColor: CYAN_BORDER,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: CYAN_DIM, borderRadius: 20,
    borderWidth: 1, borderColor: CYAN_BORDER,
  },
  photoBtnText: { fontSize: 12, fontWeight: '700', color: CYAN },

  input: {
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
    borderRadius: 10, padding: 10, fontSize: 13, color: TEXT,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0,
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  inputInline: { flex: 1, fontSize: 13, color: TEXT, paddingVertical: 0 },
  unit: { fontSize: 12, color: TEXT2, fontWeight: '600' },

  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  timeInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  timeInput: { flex: 1, fontSize: 13, color: TEXT, paddingVertical: 0 },
  timeSep: { paddingBottom: 10 },
  timeSepText: { color: TEXT2, fontSize: 16 },

  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  dayChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
  },
  dayChipActive: { backgroundColor: CYAN_DIM, borderColor: CYAN + '66' },
  dayChipText: { fontSize: 11, fontWeight: '700', color: TEXT2 },
  dayChipTextActive: { color: CYAN },

  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: CARD2, borderWidth: 1.5, borderColor: TEXT3,
  },
  toggleBtnActive: { backgroundColor: CYAN_DIM, borderColor: CYAN + '66' },
  toggleBtnText: { fontSize: 13, fontWeight: '700', color: TEXT2 },
  toggleBtnTextActive: { color: CYAN },

  tierGroupLabel: { fontSize: 11, fontWeight: '800', color: CYAN, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, marginBottom: 6 },
  feeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  feeLabel: { fontSize: 12, color: TEXT2, flex: 1 },
  feeInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD2, borderWidth: 1, borderColor: TEXT3,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, width: 90,
  },
  feePrefix: { fontSize: 12, color: CYAN, marginRight: 2 },
  feeInput: { flex: 1, fontSize: 13, color: TEXT, paddingVertical: 0 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, borderRadius: 14,
    backgroundColor: GREEN_DIM, borderWidth: 1.5, borderColor: GREEN + '66',
  },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: GREEN, letterSpacing: 0.5 },

  logoutSection: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    padding: 16, marginBottom: 40, gap: 10,
  },
  logoutTitle: { fontSize: 13, fontWeight: '800', color: TEXT, letterSpacing: 0.5 },
  logoutDesc: { fontSize: 11, color: TEXT2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.35)',
  },
  logoutBtnText: { fontSize: 15, fontWeight: '800', color: '#ff5555', letterSpacing: 0.5 },
});
