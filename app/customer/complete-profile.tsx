import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { reverseGeocode, getCurrentLocation } from '@/lib/map-utils';
import { saveUserData } from '@/lib/storage-service';
import { registerForPushNotificationsOnLogin } from '@/lib/notification-service';
import { registerDeviceToken } from '@/lib/device-token-service';
import {
  MapPin,
  CircleAlert as AlertCircle,
  Navigation,
  ArrowLeft,
  Check,
  Search,
  User,
  Phone,
  ShoppingCart,
  LocateFixed,
  CircleCheck as CheckCircle,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type LocationData = {
  latitude: number;
  longitude: number;
  formatted_address: string;
  accuracy?: number;
};

export default function CompleteProfile() {
  const router = useRouter();
  const { customerId } = useLocalSearchParams();
  const { isDark } = useTheme();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [universities, setUniversities] = useState<Array<{ id: string; name: string }>>([]);
  const [otherPlaces, setOtherPlaces] = useState<Array<{ id: string; name: string }>>([]);
  const [otherPlaceId, setOtherPlaceId] = useState('');
  const [otherPlaceSearch, setOtherPlaceSearch] = useState('');
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);

  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const primary = '#1A73E8';
  const primaryLight = '#4A9EFF';
  const bg = isDark ? '#050D1A' : '#F0F4FF';
  const cardBg = isDark ? '#0D1B2E' : '#FFFFFF';
  const cardBorder = isDark ? '#1A3A5C' : '#DDE8FF';
  const textPrimary = isDark ? '#E8F4FF' : '#0A1628';
  const textSecondary = isDark ? '#7AA3CC' : '#5A7A9A';
  const inputBg = isDark ? '#0A1828' : '#F5F8FF';
  const inputBorder = isDark ? '#1E3A5C' : '#C8D8F0';
  const placeholderColor = isDark ? '#3A6A8A' : '#9AB0CC';
  const glowColor = isDark ? 'rgba(26,115,232,0.18)' : 'rgba(26,115,232,0.08)';
  const successColor = '#10B981';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    loadUniversities();
    loadExistingProfile();
  }, []);

  const loadUniversities = async () => {
    try {
      const { data: unis } = await supabase
        .from('universities')
        .select('id, name')
        .eq('is_active', true)
        .or('location_type.eq.university,location_type.is.null')
        .order('name');
      setUniversities(unis || []);

      const { data: places } = await supabase
        .from('universities')
        .select('id, name')
        .eq('is_active', true)
        .eq('location_type', 'place')
        .order('name');
      setOtherPlaces(places || []);
    } catch {}
  };

  const loadExistingProfile = async () => {
    if (!customerId) return;
    try {
      const { data } = await supabase
        .from('customers')
        .select('full_name, phone_number, university_id, latitude, longitude')
        .eq('id', customerId as string)
        .maybeSingle();

      if (data) {
        setFullName(data.full_name || '');
        setPhoneNumber(data.phone_number || '');
        if (data.university_id) setUniversityId(data.university_id);
        if (data.latitude && data.longitude && data.latitude !== 0) {
          setLocation({
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            formatted_address: `${Number(data.latitude).toFixed(5)}, ${Number(data.longitude).toFixed(5)}`,
          });
        }
      }
    } catch {}
  };

  const handleDetectLocation = async () => {
    setLocationLoading(true);
    setError('');
    try {
      const position = await getCurrentLocation();
      let address = `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`;
      try {
        address = await reverseGeocode(position.latitude, position.longitude);
      } catch {}
      setLocation({
        latitude: position.latitude,
        longitude: position.longitude,
        formatted_address: address,
        accuracy: position.accuracy,
      });
    } catch (err: any) {
      setError(err.message || 'Could not get your location. Please allow location access and try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }
    if (!universityId) {
      setError('Please select your location');
      return;
    }
    if (universityId === 'other' && !otherPlaceId) {
      setError('Please select your location from the list');
      return;
    }
    if (!location) {
      setError('Please detect your GPS location before continuing');
      return;
    }

    setLoading(true);
    try {
      const finalUniversityId = universityId === 'other' ? otherPlaceId : universityId;
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim(),
          university_id: finalUniversityId,
          latitude: location!.latitude,
          longitude: location!.longitude,
        })
        .eq('id', customerId as string);

      if (updateError) throw updateError;

      saveUserData({ id: customerId as string, type: 'customer', name: fullName.trim() });
      registerForPushNotificationsOnLogin(customerId as string, 'customer').catch(() => {});
      registerDeviceToken(customerId as string).catch(() => {});

      router.replace({
        pathname: '/customer/dashboard',
        params: { customerId: customerId as string, customerName: fullName.trim() },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFocused = (field: string) => focused === field;

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.bgCircle1, { borderColor: isDark ? 'rgba(26,115,232,0.1)' : 'rgba(26,115,232,0.06)' }]} />
      <View style={[styles.bgCircle2, { borderColor: isDark ? 'rgba(74,158,255,0.07)' : 'rgba(26,115,232,0.04)' }]} />

      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: inputBg, borderColor: cardBorder }]}
          onPress={() => {
            supabase.auth.signOut();
            router.replace('/customer/login');
          }}
        >
          <ArrowLeft size={18} color={textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Animated.View style={[styles.headerLogo, { borderColor: primary, transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.headerLogoInner, { backgroundColor: glowColor, borderColor: primaryLight }]}>
              <ShoppingCart size={22} color={primary} />
            </View>
          </Animated.View>
          <View>
            <View style={styles.titleRow}>
              <Text style={[styles.titleUni, { color: textPrimary }]}>UNI</Text>
              <Text style={[styles.titleLink, { color: primary }]}>LINK</Text>
            </View>
            <Text style={[styles.headerSub, { color: textSecondary }]}>Complete your profile</Text>
          </View>
        </View>
      </View>

      <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={[styles.noticeBox, { backgroundColor: isDark ? 'rgba(26,115,232,0.1)' : '#EBF3FF', borderColor: isDark ? 'rgba(26,115,232,0.35)' : '#BFDBFE' }]}>
          <CheckCircle size={18} color={primary} />
          <Text style={[styles.noticeText, { color: isDark ? '#90C0FF' : '#1A5FBF' }]}>
            You're signed in with Google. Fill in the details below to start ordering.
          </Text>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FFF5F5', borderColor: '#EF4444' }]}>
            <AlertCircle size={16} color="#EF4444" />
            <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
          </View>
        ) : null}

        {/* Personal Info Card */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: primary }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderDot, { backgroundColor: primary }]} />
            <Text style={[styles.cardTitle, { color: textPrimary }]}>Personal Information</Text>
          </View>

          <View style={[styles.contactNotice, { backgroundColor: isDark ? 'rgba(26,115,232,0.1)' : '#EBF3FF', borderColor: isDark ? 'rgba(26,115,232,0.35)' : '#BFDBFE' }]}>
            <Phone size={15} color={primary} />
            <Text style={[styles.contactNoticeText, { color: isDark ? '#90C0FF' : '#1A5FBF' }]}>
              Please use your real name and an active phone number. Delivery drivers need to contact you directly to coordinate your order.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                FULL NAME <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View style={[
                styles.inputWrapper,
                { backgroundColor: inputBg, borderColor: isFocused('fullName') ? primary : inputBorder },
                isFocused('fullName') && styles.inputFocused,
              ]}>
                <View style={styles.inputIcon}>
                  <User size={16} color={isFocused('fullName') ? primary : placeholderColor} />
                </View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="words"
                  onFocus={() => setFocused('fullName')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                PHONE NUMBER <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View style={[
                styles.inputWrapper,
                { backgroundColor: inputBg, borderColor: isFocused('phone') ? primary : inputBorder },
                isFocused('phone') && styles.inputFocused,
              ]}>
                <View style={styles.inputIcon}>
                  <Phone size={16} color={isFocused('phone') ? primary : placeholderColor} />
                </View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="+263..."
                  placeholderTextColor={placeholderColor}
                  keyboardType="phone-pad"
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            {/* Location selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                LOCATION <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              {Platform.OS === 'web' ? (
                <select
                  value={universityId}
                  onChange={(e) => {
                    setUniversityId(e.target.value);
                    setOtherPlaceId('');
                    setOtherPlaceSearch('');
                    setShowPlaceDropdown(false);
                  }}
                  style={{
                    backgroundColor: inputBg,
                    border: `1.5px solid ${isFocused('location') ? primary : inputBorder}`,
                    borderRadius: 12,
                    padding: '14px 14px',
                    fontSize: 15,
                    color: universityId ? textPrimary : placeholderColor,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    outlineStyle: 'none',
                  }}
                  onFocus={() => setFocused('location')}
                  onBlur={() => setFocused(null)}
                >
                  <option value="">Select your location</option>
                  {universities.map((uni) => (
                    <option key={uni.id} value={uni.id}>{uni.name}</option>
                  ))}
                  <option value="other">Other</option>
                </select>
              ) : (
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <TextInput
                    style={[styles.input, { color: textPrimary }]}
                    value={universityId ? (universities.find(u => u.id === universityId)?.name || 'Other') : ''}
                    placeholder="Select your location"
                    placeholderTextColor={placeholderColor}
                    editable={false}
                  />
                </View>
              )}
            </View>

            {universityId === 'other' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: textSecondary }]}>
                  SEARCH YOUR LOCATION <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                {otherPlaces.length === 0 ? (
                  <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <View style={styles.inputIcon}><MapPin size={16} color={placeholderColor} /></View>
                    <Text style={[styles.input, { color: placeholderColor }]}>No locations available yet</Text>
                  </View>
                ) : Platform.OS === 'web' ? (
                  <View style={{ position: 'relative' as any }}>
                    <View style={[
                      styles.inputWrapper,
                      { backgroundColor: inputBg, borderColor: isFocused('otherSearch') ? primary : (otherPlaceId ? primary : inputBorder) },
                      isFocused('otherSearch') && styles.inputFocused,
                    ]}>
                      <View style={styles.inputIcon}><Search size={16} color={isFocused('otherSearch') ? primary : placeholderColor} /></View>
                      <input
                        type="text"
                        placeholder="Type to search places..."
                        value={otherPlaceSearch}
                        onChange={(e) => {
                          setOtherPlaceSearch(e.target.value);
                          setOtherPlaceId('');
                          setShowPlaceDropdown(true);
                        }}
                        onFocus={() => { setFocused('otherSearch'); setShowPlaceDropdown(true); }}
                        onBlur={() => { setFocused(null); setTimeout(() => setShowPlaceDropdown(false), 180); }}
                        style={{
                          flex: 1, padding: '10px 0', fontSize: 15, color: textPrimary,
                          backgroundColor: 'transparent', border: 'none', outlineStyle: 'none',
                          fontFamily: 'system-ui, -apple-system, sans-serif', width: '100%', marginLeft: 0,
                        }}
                      />
                      {otherPlaceId && (
                        <View style={{ marginLeft: 8 }}>
                          <Check size={16} color={primary} />
                        </View>
                      )}
                    </View>
                    {showPlaceDropdown && otherPlaceSearch.trim() !== '' && (
                      <View style={[styles.placesDropdown, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                        {otherPlaces
                          .filter((p) => p.name.toLowerCase().includes(otherPlaceSearch.toLowerCase()))
                          .slice(0, 8)
                          .map((p) => (
                            <TouchableOpacity
                              key={p.id}
                              style={[
                                styles.placeOption,
                                { borderBottomColor: isDark ? '#1A3A5C' : '#EEF2FF' },
                                otherPlaceId === p.id && { backgroundColor: isDark ? 'rgba(26,115,232,0.12)' : '#EEF6FF' },
                              ]}
                              onPress={() => {
                                setOtherPlaceId(p.id);
                                setOtherPlaceSearch(p.name);
                                setShowPlaceDropdown(false);
                              }}
                            >
                              <MapPin size={14} color={otherPlaceId === p.id ? primary : placeholderColor} />
                              <Text style={[styles.placeOptionText, { color: otherPlaceId === p.id ? primary : textPrimary }]}>
                                {p.name}
                              </Text>
                              {otherPlaceId === p.id && <Check size={14} color={primary} />}
                            </TouchableOpacity>
                          ))}
                        {otherPlaces.filter((p) => p.name.toLowerCase().includes(otherPlaceSearch.toLowerCase())).length === 0 && (
                          <View style={styles.placeOption}>
                            <Text style={[styles.placeOptionText, { color: placeholderColor }]}>No matching places found</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <View style={styles.inputIcon}><MapPin size={16} color={placeholderColor} /></View>
                    <TextInput
                      style={[styles.input, { color: textPrimary }]}
                      value={otherPlaceSearch}
                      onChangeText={(t) => {
                        setOtherPlaceSearch(t);
                        setOtherPlaceId('');
                        setShowPlaceDropdown(true);
                      }}
                      placeholder="Search location..."
                      placeholderTextColor={placeholderColor}
                      onFocus={() => { setFocused('otherSearch'); setShowPlaceDropdown(true); }}
                      onBlur={() => { setFocused(null); setTimeout(() => setShowPlaceDropdown(false), 180); }}
                    />
                  </View>
                )}
                {otherPlaceId && (
                  <View style={[styles.selectedPlace, { backgroundColor: isDark ? 'rgba(26,115,232,0.08)' : '#EEF6FF', borderColor: primary }]}>
                    <Check size={14} color={primary} />
                    <Text style={[styles.selectedPlaceText, { color: primary }]}>
                      {otherPlaces.find((p) => p.id === otherPlaceId)?.name}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* GPS Location Card */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: primary }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderDot, { backgroundColor: successColor }]} />
            <Text style={[styles.cardTitle, { color: textPrimary }]}>Delivery Location</Text>
          </View>
          <Text style={[styles.cardDesc, { color: textSecondary }]}>
            Allow location access so we can capture your GPS coordinates for accurate deliveries.
          </Text>

          <TouchableOpacity
            style={[
              styles.gpsBtn,
              {
                backgroundColor: location ? (isDark ? 'rgba(16,185,129,0.12)' : '#F0FDF9') : successColor,
                borderColor: location ? successColor : 'transparent',
                borderWidth: location ? 1.5 : 0,
                opacity: locationLoading ? 0.7 : 1,
              },
            ]}
            onPress={handleDetectLocation}
            disabled={locationLoading}
            activeOpacity={0.85}
          >
            {locationLoading ? (
              <>
                <ActivityIndicator color={location ? successColor : '#fff'} size="small" />
                <Text style={[styles.gpsBtnText, { color: location ? successColor : '#fff' }]}>
                  Detecting location...
                </Text>
              </>
            ) : location ? (
              <>
                <LocateFixed size={18} color={successColor} />
                <Text style={[styles.gpsBtnText, { color: successColor }]}>Re-detect My Location</Text>
              </>
            ) : (
              <>
                <Navigation size={18} color="#fff" />
                <Text style={[styles.gpsBtnText, { color: '#fff' }]}>Detect My Location</Text>
              </>
            )}
          </TouchableOpacity>

          {location && (
            <View style={[styles.locationConfirmed, { backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF9', borderColor: successColor }]}>
              <CheckCircle size={20} color={successColor} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.locationConfirmedTitle, { color: successColor }]}>Location Captured</Text>
                <Text style={[styles.locationConfirmedAddr, { color: textPrimary }]} numberOfLines={2}>
                  {location.formatted_address}
                </Text>
                <View style={styles.coordsRow}>
                  <MapPin size={11} color={textSecondary} />
                  <Text style={[styles.locationCoords, { color: textSecondary }]}>
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </Text>
                  {location.accuracy !== undefined && (
                    <Text style={[styles.accuracyBadge, {
                      color: location.accuracy <= 30 ? successColor : location.accuracy <= 80 ? '#F59E0B' : '#EF4444',
                      backgroundColor: location.accuracy <= 30
                        ? (isDark ? 'rgba(16,185,129,0.12)' : '#DCFCE7')
                        : location.accuracy <= 80
                        ? (isDark ? 'rgba(245,158,11,0.12)' : '#FEF3C7')
                        : (isDark ? 'rgba(239,68,68,0.12)' : '#FEE2E2'),
                    }]}>
                      ±{Math.round(location.accuracy)}m
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {!location && (
            <View style={[styles.locationHint, { backgroundColor: isDark ? 'rgba(26,115,232,0.06)' : '#EEF6FF', borderColor: isDark ? 'rgba(26,115,232,0.2)' : '#BFDBFE' }]}>
              <MapPin size={14} color={primary} />
              <Text style={[styles.locationHintText, { color: textSecondary }]}>
                Your browser or device will ask for permission. Please allow it to continue.
              </Text>
            </View>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: primary, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Save & Continue</Text>
            </>
          )}
          <View style={styles.btnShine} />
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgCircle1: { position: 'absolute', width: 500, height: 500, borderRadius: 250, borderWidth: 1, top: -200, right: -180 },
  bgCircle2: { position: 'absolute', width: 340, height: 340, borderRadius: 170, borderWidth: 1, bottom: 200, left: -100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    borderBottomWidth: 1,
    gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogo: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  headerLogoInner: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleUni: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  titleLink: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  headerSub: { fontSize: 12, marginTop: 1, letterSpacing: 0.3 },
  body: { padding: 20, gap: 20, paddingBottom: 40 },
  noticeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500' },
  card: {
    borderRadius: 20, borderWidth: 1, padding: 24,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 6,
    gap: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderDot: { width: 4, height: 20, borderRadius: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  cardDesc: { fontSize: 13, lineHeight: 19, marginTop: -6 },
  form: { gap: 16 },
  inputGroup: { gap: 7 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
    borderRadius: 12, paddingHorizontal: 14, height: 50,
  },
  inputFocused: {
    shadowColor: '#1A73E8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
  },
  gpsBtnText: { fontSize: 15, fontWeight: '700' },
  locationConfirmed: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1.5, borderRadius: 14, padding: 14,
  },
  locationConfirmedTitle: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  locationConfirmedAddr: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  locationCoords: { fontSize: 11 },
  accuracyBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  locationHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 12,
  },
  locationHintText: { flex: 1, fontSize: 12, lineHeight: 17 },
  submitBtn: {
    borderRadius: 14, height: 56, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  btnShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%' as any,
    backgroundColor: 'rgba(255,255,255,0.08)', borderTopLeftRadius: 14, borderTopRightRadius: 14,
  },
  placesDropdown: {
    position: 'absolute' as any,
    top: 54, left: 0, right: 0,
    borderRadius: 12, borderWidth: 1, zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
    overflow: 'hidden',
  },
  placeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  placeOptionText: { flex: 1, fontSize: 14, fontWeight: '500' },
  selectedPlace: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginTop: 4,
  },
  selectedPlaceText: { fontSize: 13, fontWeight: '600' },
  contactNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  contactNoticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
});
