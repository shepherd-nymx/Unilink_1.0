import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, User, Lock, ShieldCheck, Zap, LogIn } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { saveUserData } from '@/lib/storage-service';

export default function AdminLogin() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const primary = '#F59E0B';
  const primaryLight = '#FCD34D';
  const bg = isDark ? '#0A0700' : '#FFFBF0';
  const cardBg = isDark ? '#1A1200' : '#FFFFFF';
  const cardBorder = isDark ? '#3D2800' : '#FDE68A';
  const textPrimary = isDark ? '#FEF3C7' : '#1C1000';
  const textSecondary = isDark ? '#B08040' : '#7A6000';
  const inputBg = isDark ? '#120D00' : '#FFFDF5';
  const inputBorder = isDark ? '#3D2800' : '#FDE68A';
  const placeholderColor = isDark ? '#5A4020' : '#C8A840';
  const glowColor = isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)';

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
    if (!username || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      // Clear any stale auth session from another portal (e.g. shop login in
      // the same browser) so data queries run under the intended role.
      await supabase.auth.signOut().catch(() => {});

      const { data, error: dbError } = await supabase
        .rpc('verify_admin_login', { p_username: username, p_password: password }).maybeSingle() as { data: { id: string; username: string } | null; error: any };
      if (dbError) throw dbError;
      if (!data) { setError('Invalid username or password'); setLoading(false); return; }
      saveUserData({ id: data.id, type: 'admin' });
      router.replace({ pathname: '/admin/dashboard', params: { adminId: data.id, adminUsername: data.username } });
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.bgCircle1, { borderColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.07)' }]} />
      <View style={[styles.bgCircle2, { borderColor: isDark ? 'rgba(252,211,77,0.07)' : 'rgba(245,158,11,0.04)' }]} />
      <View style={[styles.bgDot1, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)' }]} />
      <View style={[styles.bgDot2, { backgroundColor: isDark ? 'rgba(252,211,77,0.1)' : 'rgba(245,158,11,0.06)' }]} />

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <View style={[styles.backButtonInner, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ArrowLeft size={18} color={textSecondary} />
        </View>
      </TouchableOpacity>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.logoArea}>
          <Animated.View style={[styles.logoRingOuter, { borderColor: primary, transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.logoRingInner, { backgroundColor: glowColor, borderColor: primaryLight }]}>
              <ShieldCheck size={32} color={primary} />
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
          <View style={[styles.roleBadge, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7', borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FCD34D' }]}>
            <ShieldCheck size={14} color={primary} />
            <Text style={[styles.roleBadgeText, { color: primary }]}>ADMIN ACCESS</Text>
          </View>

          <Text style={[styles.cardTitle, { color: textPrimary }]}>Admin Login</Text>
          <Text style={[styles.cardSubtitle, { color: textSecondary }]}>Secure administrator portal</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FFF5F5', borderColor: '#EF4444' }]}>
              <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>USERNAME</Text>
              <View style={[
                styles.inputWrapper,
                { backgroundColor: inputBg, borderColor: usernameFocused ? primary : inputBorder },
                usernameFocused && { shadowColor: primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
              ]}>
                <User size={16} color={usernameFocused ? primary : placeholderColor} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>PASSWORD</Text>
              <View style={[
                styles.inputWrapper,
                { backgroundColor: inputBg, borderColor: passwordFocused ? primary : inputBorder },
                passwordFocused && { shadowColor: primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
              ]}>
                <Lock size={16} color={passwordFocused ? primary : placeholderColor} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={placeholderColor}
                  secureTextEntry
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
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
});
