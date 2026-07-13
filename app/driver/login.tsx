import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Phone, Key, Truck, Zap, LogIn, UserPlus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { saveUserData } from '@/lib/storage-service';
import { registerForPushNotificationsOnLogin } from '@/lib/notification-service';
import { registerDeviceToken } from '@/lib/device-token-service';

async function getCurrentTermsVersion(): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('terms_and_conditions').select('version').eq('is_active', true).single();
    if (error) return null;
    return data?.version || null;
  } catch { return null; }
}

export default function DriverLogin() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [monthlyKey, setMonthlyKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [keyFocused, setKeyFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const primary = '#10B981';
  const primaryLight = '#34D399';
  const bg = isDark ? '#020F09' : '#F0FDF9';
  const cardBg = isDark ? '#061A10' : '#FFFFFF';
  const cardBorder = isDark ? '#0D3A22' : '#A7F3D0';
  const textPrimary = isDark ? '#D1FAE5' : '#022C1A';
  const textSecondary = isDark ? '#4A9A70' : '#2D7A54';
  const inputBg = isDark ? '#041209' : '#F5FFFE';
  const inputBorder = isDark ? '#0D3A22' : '#A7F3D0';
  const placeholderColor = isDark ? '#1A5C38' : '#70B89A';
  const glowColor = isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)';

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
  }, []);

  const handleLogin = async () => {
    const trimmedPhone = phoneNumber.trim();
    const trimmedKey = monthlyKey.trim().toUpperCase();
    if (!trimmedPhone || !trimmedKey) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const { data, error: dbError } = await supabase
        .from('drivers').select('*').eq('phone_number', trimmedPhone).eq('current_key', trimmedKey).maybeSingle();
      if (dbError) throw dbError;
      if (!data) { setError('Invalid phone number or key. Please check your credentials.'); setLoading(false); return; }
      if (new Date(data.key_expires_at) < new Date()) { setError('Your key has expired. Please contact admin for renewal.'); setLoading(false); return; }
      if (!data.terms_accepted || data.terms_version !== await getCurrentTermsVersion()) {
        saveUserData({ id: data.id, type: 'driver', name: data.full_name });
        registerForPushNotificationsOnLogin(data.id, 'driver').catch(() => {});
        registerDeviceToken(data.id).catch(() => {});
        router.replace({ pathname: '/driver/terms', params: { driverId: data.id } });
        return;
      }
      saveUserData({ id: data.id, type: 'driver', name: data.full_name });
      registerForPushNotificationsOnLogin(data.id, 'driver').catch(() => {});
      registerDeviceToken(data.id).catch(() => {});
      router.replace({ pathname: '/driver/dashboard', params: { driverId: data.id, driverName: data.full_name } });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.bgCircle1, { borderColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.07)' }]} />
      <View style={[styles.bgCircle2, { borderColor: isDark ? 'rgba(52,211,153,0.07)' : 'rgba(16,185,129,0.04)' }]} />
      <View style={[styles.bgDot1, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)' }]} />
      <View style={[styles.bgDot2, { backgroundColor: isDark ? 'rgba(52,211,153,0.1)' : 'rgba(16,185,129,0.06)' }]} />

      <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
        <View style={[styles.backButtonInner, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ArrowLeft size={18} color={textSecondary} />
        </View>
      </TouchableOpacity>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.logoArea}>
          <Animated.View style={[styles.logoRingOuter, { borderColor: primary, transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.logoRingInner, { backgroundColor: glowColor, borderColor: primaryLight }]}>
              <Truck size={32} color={primary} />
            </View>
          </Animated.View>
          <View style={styles.titleRow}>
            <Text style={[styles.titleUni, { color: textPrimary }]}>UNI</Text>
            <Text style={[styles.titleLink, { color: primary }]}>LINK</Text>
          </View>
          <View style={styles.accentBar}>
            <View style={[styles.accentLine, { backgroundColor: primary }]} />
            <Zap size={10} color={primary} />
            <View style={[styles.accentLine, { backgroundColor: primary }]} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: primary }]}>
          <View style={[styles.roleBadge, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5', borderColor: isDark ? 'rgba(16,185,129,0.3)' : '#6EE7B7' }]}>
            <Truck size={14} color={primary} />
            <Text style={[styles.roleBadgeText, { color: primary }]}>MESSENGER PORTAL</Text>
          </View>

          <Text style={[styles.cardTitle, { color: textPrimary }]}>Driver Login</Text>
          <Text style={[styles.cardSubtitle, { color: textSecondary }]}>Enter your credentials to continue</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FFF5F5', borderColor: '#EF4444' }]}>
              <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>PHONE NUMBER</Text>
              <View style={[
                styles.inputWrapper,
                { backgroundColor: inputBg, borderColor: phoneFocused ? primary : inputBorder },
                phoneFocused && { shadowColor: primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
              ]}>
                <Phone size={16} color={phoneFocused ? primary : placeholderColor} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="Enter phone number"
                  placeholderTextColor={placeholderColor}
                  keyboardType="phone-pad"
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>MONTHLY KEY</Text>
              <View style={[
                styles.inputWrapper,
                { backgroundColor: inputBg, borderColor: keyFocused ? primary : inputBorder },
                keyFocused && { shadowColor: primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
              ]}>
                <Key size={16} color={keyFocused ? primary : placeholderColor} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={monthlyKey}
                  onChangeText={setMonthlyKey}
                  placeholder="Enter your monthly key"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  onFocus={() => setKeyFocused(true)}
                  onBlur={() => setKeyFocused(false)}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <View style={styles.loginButtonInner}>
                {loading ? (
                  <Text style={styles.loginButtonText}>Authenticating...</Text>
                ) : (
                  <>
                    <LogIn size={18} color="#fff" />
                    <Text style={styles.loginButtonText}>Login</Text>
                  </>
                )}
              </View>
              <View style={styles.btnShine} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/driver/register')} activeOpacity={0.7}>
          <Text style={[styles.registerLinkText, { color: textSecondary }]}>
            New driver?{'  '}
            <Text style={[styles.registerLinkBold, { color: primary }]}>Register Here</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgCircle1: { position: 'absolute', width: 500, height: 500, borderRadius: 250, borderWidth: 1, top: -200, right: -180 },
  bgCircle2: { position: 'absolute', width: 340, height: 340, borderRadius: 170, borderWidth: 1, bottom: -120, left: -100 },
  bgDot1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -60, left: -50 },
  bgDot2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, bottom: 60, right: -30 },
  backButton: { position: 'absolute', top: 56, left: 20, zIndex: 10 },
  backButtonInner: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoRingOuter: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  logoRingInner: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  titleUni: { fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  titleLink: { fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  accentBar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accentLine: { height: 1, width: 28, opacity: 0.5 },
  card: { borderRadius: 20, borderWidth: 1, padding: 28, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16 },
  roleBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  cardTitle: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  cardSubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 22, letterSpacing: 0.3 },
  errorBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
  form: { gap: 18 },
  inputGroup: { gap: 7 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) },
  loginButton: { borderRadius: 14, height: 54, marginTop: 4, overflow: 'hidden', position: 'relative' },
  loginButtonInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  btnShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' as any, backgroundColor: 'rgba(255,255,255,0.08)', borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  registerLink: { paddingVertical: 20, alignItems: 'center' },
  registerLinkText: { fontSize: 14 },
  registerLinkBold: { fontWeight: '700' },
});
