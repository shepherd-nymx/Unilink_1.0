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
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { reverseGeocode, getCurrentLocation } from '@/lib/map-utils';
import {
  MapPin,
  CircleAlert as AlertCircle,
  Navigation,
  ArrowLeft,
  Check,
  Search,
  User,
  Phone,
  Mail,
  Lock,
  ShoppingCart,
  UserPlus,
  LocateFixed,
  CircleCheck as CheckCircle,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { TermsAndConditions } from '@/components/TermsAndConditions';

type LocationData = {
  latitude: number;
  longitude: number;
  formatted_address: string;
  accuracy?: number;
};

export default function CustomerRegister() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [universities, setUniversities] = useState<Array<{ id: string; name: string }>>([]);
  const [otherPlaces, setOtherPlaces] = useState<Array<{ id: string; name: string }>>([]);
  const [otherPlaceId, setOtherPlaceId] = useState('');
  const [otherPlaceSearch, setOtherPlaceSearch] = useState('');
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);

  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [privacyContent, setPrivacyContent] = useState('');
  const [termsVersion, setTermsVersion] = useState('');
  const [termsLoading, setTermsLoading] = useState(false);

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

  const fetchTermsAndConditions = async () => {
    setTermsLoading(true);
    try {
      const { data, error } = await supabase
        .from('terms_and_conditions')
        .select('version, content, privacy_policy')
        .eq('is_active', true)
        .single();
      if (error) throw error;
      setTermsContent(data.content);
      setPrivacyContent(data.privacy_policy || '');
      setTermsVersion(data.version);
      setShowTermsModal(true);
    } catch {
      setError('Failed to load Terms & Conditions.');
    } finally {
      setTermsLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!fullName || !phoneNumber || !password || !username) {
      setError('Please fill in all required fields');
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
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!location) {
      setError('Please detect your GPS location before continuing');
      return;
    }
    await fetchTermsAndConditions();
  };

  const handleTermsAccept = async () => {
    setLoading(true);
    setShowTermsModal(false);
    try {
      // Create a Supabase Auth account for new registrations.
      // Uses the provided email, or a synthetic internal address so all new
      // accounts are linked to auth even when email is optional.
      const authEmail = email.trim()
        ? email.trim()
        : `${username.trim().toLowerCase()}@unilink-app.internal`;
      let authId: string | null = null;
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: authEmail,
          password,
        });
        if (!authError && authData.user) {
          authId = authData.user.id;
        }
        // Sign out immediately — the app manages its own session separately
        // from Supabase Auth, so we don't want an active auth session here.
        await supabase.auth.signOut();
      } catch {
        // Auth signup failure is non-fatal: the customer record is still
        // created and the legacy btoa login continues to work.
      }

      const passwordHash = btoa(password);
      const finalUniversityId = universityId === 'other' ? otherPlaceId : universityId;
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          full_name: fullName,
          phone_number: phoneNumber,
          email: email || null,
          username,
          password_hash: passwordHash,
          phone_verified: false,
          latitude: location!.latitude,
          longitude: location!.longitude,
          university_id: finalUniversityId,
          terms_accepted: true,
          terms_version: termsVersion,
          terms_accepted_at: new Date().toISOString(),
          ...(authId ? { auth_id: authId } : {}),
        })
        .select()
        .single();
      if (customerError) throw customerError;
      const { error: addressError } = await supabase.from('customer_addresses').insert({
        customer_id: customer.id,
        address_type: 'default',
        latitude: location!.latitude,
        longitude: location!.longitude,
        formatted_address: location!.formatted_address,
        is_default: true,
        accuracy: location!.accuracy,
        timestamp: new Date().toISOString(),
      });
      if (addressError) throw addressError;
      await supabase.from('terms_acceptance_log').insert({
        user_id: customer.user_id,
        user_type: 'customer',
        terms_version: termsVersion,
      });
      router.replace({ pathname: '/customer/login', params: { registered: 'true' } });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTermsDecline = () => {
    setShowTermsModal(false);
    setError('You must accept the Terms & Conditions to register');
  };

  const isFocused = (field: string) => focused === field;

  return (
    <>
      <TermsAndConditions
        visible={showTermsModal}
        onAccept={handleTermsAccept}
        onDecline={handleTermsDecline}
        userType="customer"
        termsContent={termsContent}
        privacyContent={privacyContent}
        loading={termsLoading}
      />
      <ScrollView style={[styles.container, { backgroundColor: bg }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.bgCircle1, { borderColor: isDark ? 'rgba(26,115,232,0.1)' : 'rgba(26,115,232,0.06)' }]} />
        <View style={[styles.bgCircle2, { borderColor: isDark ? 'rgba(74,158,255,0.07)' : 'rgba(26,115,232,0.04)' }]} />
        <View style={[styles.bgDot1, { backgroundColor: isDark ? 'rgba(26,115,232,0.18)' : 'rgba(26,115,232,0.1)' }]} />

        <View style={[styles.header, { backgroundColor: isDark ? '#0D1B2E' : '#FFFFFF', borderBottomColor: cardBorder }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? '#0A1828' : '#F5F8FF', borderColor: cardBorder }]}
            onPress={() => router.back()}
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
              <Text style={[styles.headerSub, { color: textSecondary }]}>Create your shopper account</Text>
            </View>
          </View>
        </View>

        <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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
              {[
                { field: 'fullName', label: 'FULL NAME', placeholder: 'Enter your full name', value: fullName, setter: setFullName, icon: <User size={16} color={isFocused('fullName') ? primary : placeholderColor} />, required: true, caps: 'words' as any },
                { field: 'username', label: 'USERNAME', placeholder: 'Choose a username', value: username, setter: setUsername, icon: <User size={16} color={isFocused('username') ? primary : placeholderColor} />, required: true, caps: 'none' as any },
                { field: 'phone', label: 'PHONE NUMBER', placeholder: '+263...', value: phoneNumber, setter: setPhoneNumber, icon: <Phone size={16} color={isFocused('phone') ? primary : placeholderColor} />, required: true, keyboard: 'phone-pad' as any },
                { field: 'email', label: 'EMAIL', placeholder: 'your@email.com (optional)', value: email, setter: setEmail, icon: <Mail size={16} color={isFocused('email') ? primary : placeholderColor} />, required: false, caps: 'none' as any, keyboard: 'email-address' as any },
                { field: 'password', label: 'PASSWORD', placeholder: 'At least 6 characters', value: password, setter: setPassword, icon: <Lock size={16} color={isFocused('password') ? primary : placeholderColor} />, required: true, secure: true },
                { field: 'confirmPassword', label: 'CONFIRM PASSWORD', placeholder: 'Re-enter password', value: confirmPassword, setter: setConfirmPassword, icon: <Lock size={16} color={isFocused('confirmPassword') ? primary : placeholderColor} />, required: true, secure: true },
              ].map(({ field, label, placeholder, value, setter, icon, required, caps, keyboard, secure }) => (
                <View key={field} style={styles.inputGroup}>
                  <Text style={[styles.label, { color: textSecondary }]}>
                    {label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}
                  </Text>
                  <View style={[
                    styles.inputWrapper,
                    { backgroundColor: inputBg, borderColor: isFocused(field) ? primary : inputBorder },
                    isFocused(field) && styles.inputFocused,
                  ]}>
                    <View style={styles.inputIcon}>{icon}</View>
                    <TextInput
                      style={[styles.input, { color: textPrimary }]}
                      value={value}
                      onChangeText={setter}
                      placeholder={placeholder}
                      placeholderTextColor={placeholderColor}
                      autoCapitalize={caps || 'sentences'}
                      keyboardType={keyboard}
                      secureTextEntry={secure}
                      onFocus={() => setFocused(field)}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>
              ))}

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
                      outline: 'none',
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
                            backgroundColor: 'transparent', border: 'none', outline: 'none',
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
                      {!showPlaceDropdown && !otherPlaceId && otherPlaceSearch === '' && (
                        <Text style={[styles.placeHint, { color: placeholderColor }]}>
                          Start typing to find your location
                        </Text>
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
            style={[styles.submitBtn, { backgroundColor: primary, opacity: (loading || termsLoading) ? 0.7 : 1 }]}
            onPress={handleRegister}
            disabled={loading || termsLoading}
            activeOpacity={0.85}
          >
            {loading || termsLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <UserPlus size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Review Terms & Create Account</Text>
              </>
            )}
            <View style={styles.btnShine} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/customer/login')} activeOpacity={0.7}>
            <Text style={[styles.loginLinkText, { color: textSecondary }]}>
              Already have an account?{'  '}
              <Text style={[styles.loginLinkBold, { color: primary }]}>Login</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgCircle1: { position: 'absolute', width: 500, height: 500, borderRadius: 250, borderWidth: 1, top: -200, right: -180 },
  bgCircle2: { position: 'absolute', width: 340, height: 340, borderRadius: 170, borderWidth: 1, bottom: 200, left: -100 },
  bgDot1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -60, left: -50 },
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
  loginLink: { paddingVertical: 16, alignItems: 'center' },
  loginLinkText: { fontSize: 14 },
  loginLinkBold: { fontWeight: '700' },
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
  placeHint: { fontSize: 12, marginTop: 6, paddingHorizontal: 4 },
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
