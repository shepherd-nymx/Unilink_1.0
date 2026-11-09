import { SkeletonField } from '@/components/Skeleton';
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
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { validateUpload } from '@/lib/upload-validation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CircleAlert as AlertCircle, UserCheck, Bike, Car, ChevronRight, MapPin, Phone, Mail, User, Hop as Home, CreditCard, CircleCheck as CheckCircle2, Camera, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { TermsAndConditions } from '@/components/TermsAndConditions';
import { sendEmail } from '@/lib/email-service';

const { width } = Dimensions.get('window');

const NEON_CYAN = '#00e5ff';
const NEON_GREEN = '#00ff88';
const NEON_ORANGE = '#ff6b00';
const DARK_BG = '#060c18';
const DARK_SURFACE = '#0d1626';
const DARK_CARD = '#111d30';
const DARK_BORDER = '#1e3050';
const TEXT_PRIMARY = '#e8f4ff';
const TEXT_SECONDARY = '#7a9bbf';
const TEXT_MUTED = '#3d5a7a';

export default function DriverRegister() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [universities, setUniversities] = useState<Array<{ id: string; name: string }>>([]);
  const [deliveryType, setDeliveryType] = useState<'walking' | 'vehicle'>('walking');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleRegistration, setVehicleRegistration] = useState('');
  const [idPhotoUri, setIdPhotoUri] = useState<string | null>(null);
  const [idPhotoUploading, setIdPhotoUploading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [privacyContent, setPrivacyContent] = useState('');
  const [termsVersion, setTermsVersion] = useState('');
  const [termsLoading, setTermsLoading] = useState(false);

  useEffect(() => {
    loadUniversities();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadUniversities = async () => {
    try {
      const { data, error } = await supabase
        .from('universities')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setUniversities(data || []);
    } catch (err: any) {
      console.error('Failed to load universities:', err);
    } finally { setCatalogLoading(false); }
  };

  const fetchTermsAndConditions = async () => {
    setTermsLoading(true);
    try {
      const { data, error: termsErr } = await supabase
        .from('terms_and_conditions')
        .select('version, content, privacy_policy')
        .eq('is_active', true)
        .maybeSingle();
      if (termsErr || !data) throw termsErr || new Error('No active terms found');
      setTermsVersion(data.version);
      setTermsContent(data.content || '');
      setPrivacyContent(data.privacy_policy || '');
      setShowTermsModal(true);
    } catch {
      setError('Failed to load Terms & Conditions.');
    } finally {
      setTermsLoading(false);
    }
  };

  const handleTermsAccept = async () => {
    setShowTermsModal(false);
    await handleRegister();
  };

  const handleTermsDecline = () => {
    setShowTermsModal(false);
    setError('You must accept the Terms & Conditions to register.');
  };

  const handleRegister = async () => {
    setError('');

    if (!fullName || !phoneNumber || !address || !nationalId || !email.trim()) {
      setError('Please fill in all required fields, including email');
      return;
    }
    const emailTrim = email.trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
    if (!emailOk) {
      setError('Please enter a valid email address');
      return;
    }
    if (!idPhotoUri) {
      setError('Please upload a photo of your national ID card');
      return;
    }
    if (!universityId) {
      setError('Please select your service location');
      return;
    }
    if (universityId === 'other' && !customLocation.trim()) {
      setError('Please enter your service location');
      return;
    }
    if (deliveryType === 'vehicle' && !vehicleType) {
      setError('Please provide vehicle type');
      return;
    }

    if (!termsContent) {
      await fetchTermsAndConditions();
      return;
    }

    setLoading(true);
    try {
      const { data: existingDriver } = await supabase
        .from('drivers')
        .select('id, approval_status')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (existingDriver) {
        if (existingDriver.approval_status === 'pending') {
          setError('A registration with this phone number is already pending approval');
        } else if (existingDriver.approval_status === 'approved') {
          setError('This phone number is already registered. Please login instead.');
        } else {
          setError('A previous registration with this phone number was rejected. Please contact admin.');
        }
        setLoading(false);
        return;
      }

      let finalUniversityId = universityId;
      if (universityId === 'other') {
        const { data: existingUni } = await supabase
          .from('universities')
          .select('id')
          .eq('name', customLocation.trim())
          .maybeSingle();

        if (existingUni) {
          finalUniversityId = existingUni.id;
        } else {
          const { data: newUni, error: uniError } = await supabase
            .from('universities')
            .insert({ name: customLocation.trim(), is_active: true })
            .select('id')
            .single();
          if (uniError) throw uniError;
          finalUniversityId = newUni.id;
        }
      }

      // Upload national ID photo to storage
      let idPhotoUrl: string | null = null;
      if (idPhotoUri) {
        setIdPhotoUploading(true);
        try {
          const fileExt = idPhotoUri.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `id-card-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          // Convert URI to blob for upload
          const response = await fetch(idPhotoUri);
          const blob = await response.blob();

          const check = await validateUpload({ blob, fileNameOrUri: idPhotoUri });
          if (!check.ok) throw new Error(check.reason);

          const { error: uploadError } = await supabase.storage
            .from('driver-id-cards')
            .upload(filePath, blob, {
              contentType: blob.type || 'image/jpeg',
            });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('driver-id-cards')
            .getPublicUrl(filePath);

          idPhotoUrl = urlData.publicUrl;
        } catch (uploadErr: any) {
          throw new Error('Failed to upload ID photo: ' + (uploadErr.message || 'Unknown error'));
        } finally {
          setIdPhotoUploading(false);
        }
      }

      const { data: driver, error: insertError } = await supabase.from('drivers').insert({
        full_name: fullName,
        phone_number: phoneNumber,
        email: emailTrim,
        address: address,
        national_id: nationalId,
        national_id_photo_url: idPhotoUrl,
        university_id: finalUniversityId,
        delivery_type: [deliveryType],
        vehicle_type: deliveryType === 'vehicle' ? vehicleType : null,
        vehicle_registration: deliveryType === 'vehicle' ? (vehicleRegistration || null) : null,
        approval_status: 'pending',
        is_available: false,
        max_distance_km: 10,
        fee_under_10: 2,
        fee_10_to_30: 5,
        fee_30_to_50: 8,
        terms_accepted: true,
        terms_version: termsVersion,
        terms_accepted_at: new Date().toISOString(),
      }).select('id').single();

      if (insertError) throw insertError;
      if (emailTrim && driver) {
        void sendEmail({ type: 'welcome', to: emailTrim, userId: driver.id, userType: 'driver', data: { name: fullName } }).catch(() => {});
      }
      // Fire-and-forget admin alert — never blocks registration
      try {
        sendEmail({
          type: 'admin_registration_alert' as any,
          to: 'unilinkbase@gmail.com',
          userId: null,
          userType: 'driver',
          data: {
            role: 'driver',
            name: fullName,
            email: emailTrim,
            phone: phoneNumber,
            location: customLocation.trim() || universities.find((u) => u.id === universityId)?.name || '—',
            extra: `Vehicle: ${deliveryType === 'vehicle' ? `${vehicleType}${vehicleRegistration ? ' (' + vehicleRegistration + ')' : ''}` : 'Walking delivery'} · Awaiting admin approval`,
          },
        });
      } catch {}
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successScreen}>
          <View style={styles.successOrb}>
            <View style={styles.successOrbInner}>
              <CheckCircle2 size={48} color={NEON_GREEN} />
            </View>
          </View>
          <Text style={styles.successTitle}>Application Submitted</Text>
          <View style={styles.successDivider} />
          <Text style={styles.successMessage}>
            Your messenger profile has been transmitted to our command center. Our team will review your application and issue your access key upon approval.
          </Text>
          <View style={styles.successInfoBox}>
            <Text style={styles.successInfoText}>You will receive a monthly key after admin approval to activate your account.</Text>
          </View>
          <TouchableOpacity style={styles.successButton} onPress={() => router.push('/driver/login')}>
            <Text style={styles.successButtonText}>Return to Login</Text>
            <ChevronRight size={18} color={DARK_BG} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const getInputStyle = (fieldName: string) => [
    styles.input,
    focusedField === fieldName && styles.inputFocused,
  ];

  return (
    <View style={styles.container}>
      <View style={styles.gridOverlay} pointerEvents="none" />

      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={NEON_CYAN} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>MESSENGER PORTAL</Text>
          </View>
          <Text style={styles.title}>Join the Network</Text>
          <Text style={styles.subtitle}>Apply to become a UniLink delivery messenger</Text>
        </View>
        <View style={styles.headerAccent} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {error ? (
            <View style={styles.errorContainer}>
              <AlertCircle size={18} color='#ff3366' />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionLabel}>IDENTITY</Text>
            </View>

            <InputField
              icon={<User size={16} color={TEXT_MUTED} />}
              label="Full Name"
              required
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              autoCapitalize="words"
              fieldName="fullName"
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />

            <InputField
              icon={<Phone size={16} color={TEXT_MUTED} />}
              label="Phone Number"
              required
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+263..."
              keyboardType="phone-pad"
              fieldName="phone"
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />

            <InputField
              icon={<Mail size={16} color={TEXT_MUTED} />}
              label="Email Address"
              required
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              fieldName="email"
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />

            <InputField
              icon={<CreditCard size={16} color={TEXT_MUTED} />}
              label="National ID"
              required
              value={nationalId}
              onChangeText={setNationalId}
              placeholder="Your ID number"
              fieldName="nationalId"
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />

            <InputField
              icon={<Home size={16} color={TEXT_MUTED} />}
              label="Residential Address"
              required
              value={address}
              onChangeText={setAddress}
              placeholder="Your address"
              multiline
              numberOfLines={2}
              fieldName="address"
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />

            {/* National ID Photo Upload */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <CreditCard size={14} color={TEXT_MUTED} />
                <Text style={styles.label}>
                  National ID Card Photo <Text style={styles.required}>*</Text>
                </Text>
              </View>
              <Text style={styles.idPhotoHint}>
                Upload a clear photo of your national ID card. Admins will review it before approving your application.
              </Text>
              {idPhotoUri ? (
                <View style={styles.idPhotoPreviewContainer}>
                  {Platform.OS === 'web' ? (
                    <img
                      src={idPhotoUri}
                      style={{ width: '100%', maxHeight: 200, borderRadius: 10, objectFit: 'cover' as any }}
                      alt="National ID"
                    />
                  ) : (
                    <View style={styles.idPhotoPreview} />
                  )}
                  <View style={styles.idPhotoActions}>
                    <TouchableOpacity
                      style={styles.idPhotoRetakeBtn}
                      onPress={async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ['images'],
                          allowsEditing: true,
                          aspect: [16, 10],
                          quality: 0.8,
                        });
                        if (!result.canceled && result.assets[0]?.uri) {
                          setIdPhotoUri(result.assets[0].uri);
                        }
                      }}
                    >
                      <Text style={styles.idPhotoRetakeText}>Replace Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.idPhotoRemoveBtn}
                      onPress={() => setIdPhotoUri(null)}
                    >
                      <Text style={styles.idPhotoRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.idPhotoUploadRow}>
                  <TouchableOpacity
                    style={styles.idPhotoUploadBtn}
                    onPress={async () => {
                      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (status !== 'granted') {
                        setError('Permission to access photos is required');
                        return;
                      }
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ['images'],
                        allowsEditing: true,
                        aspect: [16, 10],
                        quality: 0.8,
                      });
                      if (!result.canceled && result.assets[0]?.uri) {
                        setIdPhotoUri(result.assets[0].uri);
                      }
                    }}
                  >
                    <ImageIcon size={22} color={NEON_CYAN} />
                    <Text style={styles.idPhotoUploadText}>Choose from Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.idPhotoUploadBtn}
                    onPress={async () => {
                      const { status } = await ImagePicker.requestCameraPermissionsAsync();
                      if (status !== 'granted') {
                        setError('Permission to access camera is required');
                        return;
                      }
                      const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ['images'],
                        allowsEditing: true,
                        aspect: [16, 10],
                        quality: 0.8,
                      });
                      if (!result.canceled && result.assets[0]?.uri) {
                        setIdPhotoUri(result.assets[0].uri);
                      }
                    }}
                  >
                    <Camera size={22} color={NEON_CYAN} />
                    <Text style={styles.idPhotoUploadText}>Take Photo</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: NEON_GREEN }]} />
              <Text style={styles.sectionLabel}>ZONE</Text>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <MapPin size={14} color={TEXT_MUTED} />
                <Text style={styles.label}>Service Location <Text style={styles.required}>*</Text></Text>
              </View>
              {catalogLoading ? <SkeletonField dark/> : (Platform.OS === 'web' ? (
                <select
                  value={universityId}
                  onChange={(e) => setUniversityId(e.target.value)}
                  style={{
                    backgroundColor: DARK_CARD,
                    border: `1px solid ${focusedField === 'location' ? NEON_CYAN : DARK_BORDER}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    fontSize: 14,
                    color: universityId ? TEXT_PRIMARY : TEXT_MUTED,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    outlineStyle: 'none',
                    width: '100%',
                    boxShadow: focusedField === 'location' ? `0 0 0 1px ${NEON_CYAN}20` : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={() => setFocusedField('location')}
                  onBlur={() => setFocusedField(null)}
                >
                  <option value="" style={{ color: TEXT_MUTED }}>Select your service location</option>
                  {universities.map((uni) => (
                    <option key={uni.id} value={uni.id} style={{ color: TEXT_PRIMARY, backgroundColor: DARK_CARD }}>{uni.name}</option>
                  ))}
                  <option value="other" style={{ color: TEXT_PRIMARY, backgroundColor: DARK_CARD }}>Other location...</option>
                </select>
              ) : (
                <View style={[styles.input, { paddingVertical: 16 }]}>
                  <Text style={{ color: universityId ? TEXT_PRIMARY : TEXT_MUTED, fontSize: 14 }}>
                    {universityId === 'other' ? 'Other location...' : (universities.find(u => u.id === universityId)?.name || 'Select your service location')}
                  </Text>
                </View>
              ))}
            </View>

            {universityId === 'other' && (
              <InputField
                icon={<MapPin size={16} color={TEXT_MUTED} />}
                label="Specify Location"
                required
                value={customLocation}
                onChangeText={setCustomLocation}
                placeholder="e.g., Guruve, Chinhoyi, Harare"
                fieldName="customLocation"
                focusedField={focusedField}
                setFocusedField={setFocusedField}
              />
            )}
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: NEON_ORANGE }]} />
              <Text style={styles.sectionLabel}>DELIVERY MODE</Text>
            </View>

            <View style={styles.deliveryTypeContainer}>
              <TouchableOpacity
                style={[styles.deliveryOption, deliveryType === 'walking' && styles.deliveryOptionActive]}
                onPress={() => setDeliveryType('walking')}
                activeOpacity={0.8}
              >
                <View style={[styles.deliveryIconWrap, deliveryType === 'walking' && styles.deliveryIconWrapActive]}>
                  <Bike size={26} color={deliveryType === 'walking' ? NEON_CYAN : TEXT_MUTED} />
                </View>
                <Text style={[styles.deliveryOptionTitle, deliveryType === 'walking' && styles.deliveryOptionTitleActive]}>On Foot</Text>
                <Text style={styles.deliveryOptionSub}>Walking deliveries</Text>
                {deliveryType === 'walking' && (
                  <View style={styles.activeIndicator} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deliveryOption, deliveryType === 'vehicle' && styles.deliveryOptionActive]}
                onPress={() => setDeliveryType('vehicle')}
                activeOpacity={0.8}
              >
                <View style={[styles.deliveryIconWrap, deliveryType === 'vehicle' && styles.deliveryIconWrapActive]}>
                  <Car size={26} color={deliveryType === 'vehicle' ? NEON_CYAN : TEXT_MUTED} />
                </View>
                <Text style={[styles.deliveryOptionTitle, deliveryType === 'vehicle' && styles.deliveryOptionTitleActive]}>Vehicle</Text>
                <Text style={styles.deliveryOptionSub}>Motorized transport</Text>
                {deliveryType === 'vehicle' && (
                  <View style={styles.activeIndicator} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {deliveryType === 'vehicle' && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: '#ffaa00' }]} />
                <Text style={styles.sectionLabel}>VEHICLE DETAILS</Text>
              </View>

              <InputField
                icon={<Car size={16} color={TEXT_MUTED} />}
                label="Vehicle Type"
                required
                value={vehicleType}
                onChangeText={setVehicleType}
                placeholder="e.g., Motorcycle, Car"
                fieldName="vehicleType"
                focusedField={focusedField}
                setFocusedField={setFocusedField}
              />

              <InputField
                icon={<CreditCard size={16} color={TEXT_MUTED} />}
                label="Registration Number"
                value={vehicleRegistration}
                onChangeText={setVehicleRegistration}
                placeholder="Optional"
                autoCapitalize="characters"
                fieldName="vehicleReg"
                focusedField={focusedField}
                setFocusedField={setFocusedField}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, (loading || termsLoading) && styles.submitButtonDisabled]}
            onPress={() => {
              if (!fullName || !phoneNumber || !address || !nationalId || !email.trim()) {
                setError('Please fill in all required fields, including email');
                return;
              }
              if (!idPhotoUri) { setError('Please upload a photo of your national ID card'); return; }
              if (!universityId) { setError('Please select your service location'); return; }
              if (universityId === 'other' && !customLocation.trim()) { setError('Please enter your service location'); return; }
              if (deliveryType === 'vehicle' && !vehicleType) { setError('Please provide vehicle type'); return; }
              if (termsContent) { setShowTermsModal(true); } else { fetchTermsAndConditions(); }
            }}
            disabled={loading || termsLoading}
            activeOpacity={0.85}
          >
            <View style={styles.submitButtonGlow} />
            {loading || termsLoading ? (
              <ActivityIndicator color={DARK_BG} size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Review Terms & Apply</Text>
                <ChevronRight size={20} color={DARK_BG} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/driver/login')}>
            <Text style={styles.loginLinkText}>
              Already approved? <Text style={styles.loginLinkAccent}>Sign In</Text>
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      <TermsAndConditions
        visible={showTermsModal}
        onAccept={handleTermsAccept}
        onDecline={handleTermsDecline}
        userType="driver"
        termsContent={termsContent}
        privacyContent={privacyContent}
        loading={termsLoading}
      />
    </View>
  );
}

function InputField({
  icon,
  label,
  required,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
  numberOfLines,
  fieldName,
  focusedField,
  setFocusedField,
}: any) {
  const isFocused = focusedField === fieldName;

  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelRow}>
        {icon}
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      </View>
      <TextInput
        style={[styles.input, isFocused && styles.inputFocused, multiline && { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={TEXT_MUTED}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'sentences'}
        multiline={multiline}
        numberOfLines={numberOfLines}
        onFocus={() => setFocusedField(fieldName)}
        onBlur={() => setFocusedField(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03,
    backgroundImage: Platform.OS === 'web'
      ? 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,229,255,0.8) 39px, rgba(0,229,255,0.8) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(0,229,255,0.8) 39px, rgba(0,229,255,0.8) 40px)'
      : undefined,
  } as any,
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: DARK_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: DARK_BORDER,
    position: 'relative',
    overflow: 'hidden',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerContent: {
    gap: 6,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,229,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.3)',
    marginBottom: 6,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: NEON_CYAN,
    letterSpacing: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  headerAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: NEON_CYAN,
    opacity: 0.04,
    transform: [{ translateX: 40 }, { translateY: -40 }],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,51,102,0.08)',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.3)',
    marginBottom: 4,
  },
  errorText: {
    flex: 1,
    color: '#ff3366',
    fontSize: 13,
  },
  sectionBlock: {
    backgroundColor: DARK_SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: NEON_CYAN,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_MUTED,
    letterSpacing: 2,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  required: {
    color: '#ff3366',
  },
  input: {
    backgroundColor: DARK_CARD,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  inputFocused: {
    borderColor: NEON_CYAN,
    backgroundColor: 'rgba(0,229,255,0.04)',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none', boxShadow: `0 0 0 1px rgba(0,229,255,0.15)` } : {}),
  } as any,
  deliveryTypeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  deliveryOption: {
    flex: 1,
    backgroundColor: DARK_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  deliveryOptionActive: {
    borderColor: NEON_CYAN,
    backgroundColor: 'rgba(0,229,255,0.06)',
  },
  deliveryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  deliveryIconWrapActive: {
    backgroundColor: 'rgba(0,229,255,0.12)',
  },
  deliveryOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  deliveryOptionTitleActive: {
    color: NEON_CYAN,
  },
  deliveryOptionSub: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  activeIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NEON_CYAN,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: NEON_CYAN,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  submitButtonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: DARK_BG,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loginLink: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  loginLinkText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  loginLinkAccent: {
    color: NEON_CYAN,
    fontWeight: '700',
  },
  successScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
    backgroundColor: DARK_BG,
  },
  successOrb: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,255,136,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successOrbInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,255,136,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  successDivider: {
    width: 48,
    height: 2,
    backgroundColor: NEON_GREEN,
    borderRadius: 2,
    opacity: 0.6,
  },
  successMessage: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  successInfoBox: {
    backgroundColor: 'rgba(0,255,136,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.2)',
    borderRadius: 12,
    padding: 14,
    maxWidth: 320,
  },
  successInfoText: {
    fontSize: 13,
    color: NEON_GREEN,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.85,
  },
  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: NEON_GREEN,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  successButtonText: {
    color: DARK_BG,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  idPhotoHint: {
    fontSize: 12,
    color: TEXT_MUTED,
    lineHeight: 17,
    marginBottom: 8,
  },
  idPhotoUploadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  idPhotoUploadBtn: {
    flex: 1,
    backgroundColor: DARK_CARD,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  idPhotoUploadText: {
    fontSize: 12,
    fontWeight: '600',
    color: NEON_CYAN,
  },
  idPhotoPreviewContainer: {
    gap: 10,
  },
  idPhotoPreview: {
    width: '100%',
    height: 200,
    backgroundColor: DARK_CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NEON_CYAN,
  },
  idPhotoActions: {
    flexDirection: 'row',
    gap: 10,
  },
  idPhotoRetakeBtn: {
    flex: 1,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1,
    borderColor: NEON_CYAN,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  idPhotoRetakeText: {
    fontSize: 13,
    fontWeight: '600',
    color: NEON_CYAN,
  },
  idPhotoRemoveBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,51,102,0.08)',
    borderWidth: 1,
    borderColor: '#ff3366',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  idPhotoRemoveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff3366',
  },
});
