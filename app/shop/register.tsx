import { SkeletonField } from '@/components/Skeleton';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { validateUpload } from '@/lib/upload-validation';
import { saveShopSession } from '@/lib/shop-session-service';
import {
  ArrowLeft,
  CircleAlert as AlertCircle,
  Store,
  Mail,
  Phone,
  MapPin,
  Navigation,
  CreditCard,
  FileText,
  Clock,
  CircleCheck as CheckCircle2,
  ChevronDown,
  Check,
  Tag,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { TermsAndConditions } from '@/components/TermsAndConditions';
import { sendEmail } from '@/lib/email-service';
import { SHOP_CATEGORIES } from '@/components/marketplace/types';

export default function ShopRegister() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locating, setLocating] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [areas, setAreas] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [termsVersion, setTermsVersion] = useState('');
  const [termsLoading, setTermsLoading] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    loadAreas();
  }, []);

  const loadAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_areas')
        .select('id, name, city')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setAreas(data || []);
    } catch (err) {
      console.error('Failed to load areas:', err);
    } finally { setCatalogLoading(false); }
  };

  const bg = isDark ? '#050b16' : '#f0f4f8';
  const cardBg = isDark ? '#0a1220' : '#ffffff';
  const cardBorder = isDark ? '#1a2d4a' : '#e2e8f0';
  const textPrimary = isDark ? '#e0eeff' : '#0a1929';
  const textSecondary = isDark ? '#6a8fb0' : '#64748b';
  const inputBg = isDark ? '#0d1828' : '#f8fafc';
  const inputBorder = isDark ? '#1a2d4a' : '#cbd5e1';
  const placeholderColor = isDark ? '#3d5577' : '#94a3b8';
  const primary = '#0066ff';
  const primaryLight = '#3385ff';
  const errorColor = '#ef4444';
  const successColor = '#10b981';

  const useGps = async () => {
    setLocating(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Enter coordinates manually.');
        setLocating(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(pos.coords.latitude.toFixed(6));
      setLongitude(pos.coords.longitude.toFixed(6));
    } catch (e: any) {
      setError(e.message || 'Could not detect location. Enter coordinates manually.');
    } finally {
      setLocating(false);
    }
  };

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access photos is required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setLogoUri(result.assets[0].uri);
    }
  };

  const fetchMerchantTerms = async () => {
    setTermsLoading(true);
    try {
      const { data, error: termsErr } = await supabase
        .from('merchant_policies')
        .select('version, content')
        .eq('is_active', true)
        .maybeSingle();
      if (termsErr || !data) throw termsErr || new Error('No active merchant policy found');
      setTermsVersion(data.version);
      setTermsContent(data.content || '');
      setShowTermsModal(true);
    } catch {
      setError('Failed to load Merchant Terms & Conditions.');
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
    setError('You must accept the Merchant Terms & Conditions to register.');
  };

  const handleRegister = async () => {
    setError('');
    if (!shopName || !email.trim() || !password || !contactPhone || !address || !area || !category) {
      setError('Please fill in all required fields including area and category');
      return;
    }
    const emailTrim = email.trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
    if (!emailOk) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!termsContent) {
      await fetchMerchantTerms();
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create auth account or sign in if one already exists (orphan recovery)
      let authUserId: string;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailTrim,
        password,
      });
      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered') || signUpError.message.toLowerCase().includes('already been registered')) {
          // An auth account exists but may not have a shop record (orphan from a failed registration).
          // Sign in with the provided credentials to recover and retry the shop insert.
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: emailTrim,
            password,
          });
          if (signInError) throw new Error('An account with this email already exists. If you forgot your password, use the reset link on the login page.');
          if (!signInData.user) throw new Error('Login failed during recovery. Please try again.');
          authUserId = signInData.user.id;
        } else {
          throw signUpError;
        }
      } else if (!signUpData.user) {
        throw new Error('Failed to create account');
      } else {
        authUserId = signUpData.user.id;
      }

      // Step 2: Check if a shop record already exists for this auth user (orphan recovery)
      const { data: existingShop } = await supabase
        .from('shops')
        .select('id, name, status')
        .eq('owner_id', authUserId)
        .maybeSingle();
      if (existingShop) {
        // Shop already exists — just log them in
        await saveShopSession({
          shopId: existingShop.id,
          ownerId: authUserId,
          email: emailTrim,
          shopName: existingShop.name,
          shopStatus: existingShop.status,
        });
        setSuccess(true);
        setTimeout(() => { router.replace('/shop/dashboard'); }, 1500);
        return;
      }

      // Step 3: Upload logo (if provided)
      let logoUrl: string | null = null;
      if (logoUri) {
        try {
          const fileExt = logoUri.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `logo-${Date.now()}.${fileExt}`;
          const response = await fetch(logoUri);
          const blob = await response.blob();
          const check = await validateUpload({ blob, fileNameOrUri: logoUri });
          if (!check.ok) throw new Error(check.reason);
          const { error: uploadError } = await supabase.storage
            .from('shop-assets')
            .upload(fileName, blob, { contentType: blob.type || 'image/jpeg' });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from('shop-assets').getPublicUrl(fileName);
          logoUrl = urlData.publicUrl;
        } catch (uploadErr: any) {
          throw new Error('Failed to upload logo: ' + (uploadErr.message || 'Unknown error'));
        }
      }

      // Step 4: Create the shop record
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .insert({
          owner_id: authUserId,
          name: shopName,
          logo_url: logoUrl,
          description: description || null,
          address,
          location: area,
          category,
          latitude: latitude.trim() ? parseFloat(latitude) : null,
          longitude: longitude.trim() ? parseFloat(longitude) : null,
          contact_phone: contactPhone,
          contact_email: emailTrim,
          hours: hours || null,
          status: 'pending_approval',
          terms_accepted: true,
          terms_version: termsVersion,
          terms_accepted_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (shopError) throw shopError;
      if (!shop) throw new Error('Failed to create shop record');

      // Step 5: Log terms acceptance (non-fatal)
      try {
        await supabase.from('terms_acceptance_log').insert({
          user_id: authUserId,
          user_type: 'shop',
          terms_version: termsVersion,
        });
      } catch {}

      // Step 6: Save session and redirect
      await saveShopSession({
        shopId: shop.id,
        ownerId: authUserId,
        email: emailTrim,
        shopName: shop.name,
        shopStatus: shop.status,
      });

      // Send registration confirmation email to shop owner
      try {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        await fetch(`${supabaseUrl}/functions/v1/resend-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: anonKey! },
          body: JSON.stringify({
            type: 'shop_notification',
            to: emailTrim,
            userType: 'shop',
            data: {
              action: 'registration_received',
              shopName: shop.name,
              shopId: shop.id,
            },
          }),
        });
      } catch {}

      // Admin alert — new merchant registration (fire-and-forget)
      try {
        sendEmail({
          type: 'admin_registration_alert' as any,
          to: 'unilinkbase@gmail.com',
          userId: shop.id,
          userType: 'shop',
          data: {
            role: 'shop',
            name: shop.name,
            email: emailTrim,
            phone: contactPhone,
            location: area,
            extra: `Category: ${category} · Awaiting admin approval`,
          },
        });
      } catch {}

      setSuccess(true);
      setTimeout(() => {
        router.replace('/shop/dashboard');
      }, 1500);
    } catch (err: any) {
      // Sign out any partial auth session so a retry starts clean
      try { await supabase.auth.signOut(); } catch {}
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { borderColor: successColor }]}>
            <CheckCircle2 size={48} color={successColor} />
          </View>
          <Text style={[styles.successTitle, { color: textPrimary }]}>Registration Submitted!</Text>
          <Text style={[styles.successText, { color: textSecondary }]}>
            Your shop application is now pending approval. We'll notify you by email once it's reviewed.
          </Text>
          <ActivityIndicator size="large" color={primary} style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: inputBg, borderColor: inputBorder }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={18} color={textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerLogo, { borderColor: primary }]}>
            <View style={[styles.headerLogoInner, { backgroundColor: `${primary}15`, borderColor: primaryLight }]}>
              <Store size={22} color={primary} />
            </View>
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={[styles.titleUni, { color: textPrimary }]}>UNI</Text>
              <Text style={[styles.titleLink, { color: primary }]}>LINK</Text>
            </View>
            <Text style={[styles.headerSub, { color: textSecondary }]}>Register your shop</Text>
          </View>
        </View>
      </View>

      <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fff5f5', borderColor: errorColor }]}>
            <AlertCircle size={16} color={errorColor} />
            <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderDot, { backgroundColor: primary }]} />
            <Text style={[styles.cardTitle, { color: textPrimary }]}>Shop Information</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                SHOP NAME <Text style={{ color: errorColor }}>*</Text>
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'shopName' ? primary : inputBorder }]}>
                <View style={styles.inputIcon}><Store size={16} color={focused === 'shopName' ? primary : placeholderColor} /></View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder="e.g. Campus Corner Store"
                  placeholderTextColor={placeholderColor}
                  onFocus={() => setFocused('shopName')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>DESCRIPTION</Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'description' ? primary : inputBorder }]}>
                <View style={styles.inputIcon}><FileText size={16} color={focused === 'description' ? primary : placeholderColor} /></View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Tell customers about your shop"
                  placeholderTextColor={placeholderColor}
                  multiline
                  onFocus={() => setFocused('description')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                ADDRESS <Text style={{ color: errorColor }}>*</Text>
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'address' ? primary : inputBorder }]}>
                <View style={styles.inputIcon}><MapPin size={16} color={focused === 'address' ? primary : placeholderColor} /></View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Shop physical address"
                  placeholderTextColor={placeholderColor}
                  onFocus={() => setFocused('address')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            {/* Category picker */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                SHOP CATEGORY <Text style={{ color: errorColor }}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'category' ? primary : inputBorder }]}
                onPress={() => { setShowCategoryPicker(!showCategoryPicker); setFocused('category'); }}
              >
                <View style={styles.inputIcon}><Tag size={16} color={focused === 'category' ? primary : placeholderColor} /></View>
                <Text
                  style={[styles.input, { color: category ? textPrimary : placeholderColor, flex: 1 }]}
                  onPress={() => { setShowCategoryPicker(!showCategoryPicker); setFocused('category'); }}
                >
                  {category || 'Select your shop category'}
                </Text>
                <ChevronDown size={16} color={placeholderColor} style={{ marginRight: 4 }} />
              </TouchableOpacity>

              {showCategoryPicker && (
                <View style={[styles.areaPickerBox, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {SHOP_CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.areaPickerItem, { borderBottomColor: inputBorder }]}
                        onPress={() => { setCategory(cat); setShowCategoryPicker(false); setFocused(null); }}
                      >
                        <Text style={{ color: textPrimary, fontSize: 14, flex: 1 }}>{cat}</Text>
                        {category === cat && <Check size={16} color={primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Area picker */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                AREA / LOCATION <Text style={{ color: errorColor }}>*</Text>
              </Text>
              {catalogLoading ? <SkeletonField/> : (<TouchableOpacity
                style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'area' ? primary : inputBorder }]}
                onPress={() => { setShowAreaPicker(!showAreaPicker); setFocused('area'); }}
              >
                <View style={styles.inputIcon}><MapPin size={16} color={focused === 'area' ? primary : placeholderColor} /></View>
                <Text
                  style={[styles.input, { color: area ? textPrimary : placeholderColor, flex: 1 }]}
                  onPress={() => { setShowAreaPicker(!showAreaPicker); setFocused('area'); }}
                >
                  {area || 'Select your area/suburb'}
                </Text>
                <ChevronDown size={16} color={placeholderColor} style={{ marginRight: 4 }} />
              </TouchableOpacity>)}

              {showAreaPicker && (
                <View style={[styles.areaPickerBox, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  {areas.length === 0 ? (
                    <Text style={{ color: placeholderColor, fontSize: 13, padding: 12 }}>No areas available</Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {areas.map(a => (
                        <TouchableOpacity
                          key={a.id}
                          style={[styles.areaPickerItem, { borderBottomColor: inputBorder }]}
                          onPress={() => { setArea(a.name); setShowAreaPicker(false); setFocused(null); }}
                        >
                          <Text style={{ color: textPrimary, fontSize: 14, flex: 1 }}>{a.name}</Text>
                          {a.city && <Text style={{ color: placeholderColor, fontSize: 11 }}>{a.city}</Text>}
                          {area === a.name && <Check size={16} color={primary} />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                SHOP GPS COORDINATES
              </Text>
              <Text style={{ fontSize: 11, color: placeholderColor, marginBottom: 6 }}>
                Enter your shop's latitude and longitude so messengers can navigate to you
              </Text>
              <TouchableOpacity
                style={[styles.gpsDetectBtn, { backgroundColor: isDark ? 'rgba(0,102,255,0.1)' : '#eff6ff', borderColor: `${primary}40` }]}
                onPress={useGps}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={primary} />
                ) : (
                  <Navigation size={16} color={primary} />
                )}
                <Text style={{ color: primary, fontSize: 13, fontWeight: '700' }}>
                  {locating ? 'Detecting location...' : 'Use My Current Location'}
                </Text>
              </TouchableOpacity>
              {(latitude && longitude) ? (
                <View style={[styles.gpsDetectedBox, { backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5', borderColor: `${successColor}40` }]}>
                  <MapPin size={12} color={successColor} />
                  <Text style={{ color: successColor, fontSize: 11, fontWeight: '600' }}>
                    Location detected: {latitude}, {longitude}
                  </Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'lat' ? primary : inputBorder }]}>
                    <View style={styles.inputIcon}><MapPin size={16} color={focused === 'lat' ? primary : placeholderColor} /></View>
                    <TextInput
                      style={[styles.input, { color: textPrimary }]}
                      value={latitude}
                      onChangeText={setLatitude}
                      placeholder="Latitude"
                      placeholderTextColor={placeholderColor}
                      keyboardType="decimal-pad"
                      onFocus={() => setFocused('lat')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'lng' ? primary : inputBorder }]}>
                    <View style={styles.inputIcon}><MapPin size={16} color={focused === 'lng' ? primary : placeholderColor} /></View>
                    <TextInput
                      style={[styles.input, { color: textPrimary }]}
                      value={longitude}
                      onChangeText={setLongitude}
                      placeholder="Longitude"
                      placeholderTextColor={placeholderColor}
                      keyboardType="decimal-pad"
                      onFocus={() => setFocused('lng')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                CONTACT PHONE <Text style={{ color: errorColor }}>*</Text>
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'phone' ? primary : inputBorder }]}>
                <View style={styles.inputIcon}><Phone size={16} color={focused === 'phone' ? primary : placeholderColor} /></View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  placeholder="+263..."
                  placeholderTextColor={placeholderColor}
                  keyboardType="phone-pad"
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                EMAIL <Text style={{ color: errorColor }}>*</Text>
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'email' ? primary : inputBorder }]}>
                <View style={styles.inputIcon}><Mail size={16} color={focused === 'email' ? primary : placeholderColor} /></View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={placeholderColor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                PASSWORD <Text style={{ color: errorColor }}>*</Text>
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'password' ? primary : inputBorder }]}>
                <View style={styles.inputIcon}><CreditCard size={16} color={focused === 'password' ? primary : placeholderColor} /></View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={placeholderColor}
                  secureTextEntry
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>
                CONFIRM PASSWORD <Text style={{ color: errorColor }}>*</Text>
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'confirmPassword' ? primary : inputBorder }]}>
                <View style={styles.inputIcon}><CreditCard size={16} color={focused === 'confirmPassword' ? primary : placeholderColor} /></View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor={placeholderColor}
                  secureTextEntry
                  onFocus={() => setFocused('confirmPassword')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>OPENING HOURS</Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'hours' ? primary : inputBorder }]}>
                <View style={styles.inputIcon}><Clock size={16} color={focused === 'hours' ? primary : placeholderColor} /></View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={hours}
                  onChangeText={setHours}
                  placeholder="e.g. Mon-Fri 8am-6pm"
                  placeholderTextColor={placeholderColor}
                  onFocus={() => setFocused('hours')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>SHOP LOGO</Text>
              {logoUri ? (
                <View style={{ gap: 10 }}>
                  {Platform.OS === 'web' ? (
                    <img src={logoUri} style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover' as any }} alt="Logo" />
                  ) : null}
                  <TouchableOpacity style={[styles.uploadBtn, { borderColor: primary }]} onPress={pickLogo}>
                    <Text style={{ color: primary, fontSize: 13, fontWeight: '600' }}>Change Logo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.uploadBtn, { backgroundColor: inputBg, borderColor: inputBorder }]}
                  onPress={pickLogo}
                >
                  <Store size={22} color={placeholderColor} />
                  <Text style={{ color: textSecondary, fontSize: 13, fontWeight: '600' }}>Upload Shop Logo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: primary, opacity: loading || termsLoading ? 0.6 : 1 }]}
          onPress={() => {
            if (!shopName || !email.trim() || !password || !contactPhone || !address || !area) {
              setError('Please fill in all required fields including area');
              return;
            }
            if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
            if (password !== confirmPassword) { setError('Passwords do not match'); return; }
            if (termsContent) { setShowTermsModal(true); } else { fetchMerchantTerms(); }
          }}
          disabled={loading || termsLoading}
        >
          {loading || termsLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Review Terms & Register</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/shop/login')}>
          <Text style={{ color: textSecondary, fontSize: 14 }}>
            Already registered? <Text style={{ color: primary, fontWeight: '600' }}>Login</Text>
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </Animated.View>

      <TermsAndConditions
        visible={showTermsModal}
        onAccept={handleTermsAccept}
        onDecline={handleTermsDecline}
        userType="shop"
        termsContent={termsContent}
        loading={termsLoading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerLogo: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  headerLogoInner: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row' },
  titleUni: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  titleLink: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  headerSub: { fontSize: 12, marginTop: 2 },
  body: { padding: 16, gap: 16 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 13, flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHeaderDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  form: { gap: 14 },
  inputGroup: { gap: 6 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 12, minHeight: 48,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  uploadBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5,
    paddingVertical: 24, borderStyle: 'dashed' as any,
  },
  areaPickerBox: {
    borderRadius: 12, borderWidth: 1, marginTop: 6, overflow: 'hidden',
  },
  areaPickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  gpsDetectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1.5, paddingVertical: 14,
  },
  gpsDetectedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8,
  },
  submitBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink: { alignItems: 'center', paddingVertical: 12 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  successIcon: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  successText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
