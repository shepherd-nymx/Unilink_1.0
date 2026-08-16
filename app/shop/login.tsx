import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { saveShopSession } from '@/lib/shop-session-service';
import { ArrowLeft, CircleAlert as AlertCircle, Store, Mail, CreditCard } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function ShopLogin() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const bg = isDark ? '#050b16' : '#f0f4f8';
  const cardBg = isDark ? '#0a1220' : '#ffffff';
  const cardBorder = isDark ? '#1a2d4a' : '#e2e8f0';
  const textPrimary = isDark ? '#e0eeff' : '#0a1929';
  const textSecondary = isDark ? '#6a8fb0' : '#64748b';
  const inputBg = isDark ? '#0d1828' : '#f8fafc';
  const inputBorder = isDark ? '#1a2d4a' : '#cbd5e1';
  const placeholderColor = isDark ? '#3d5577' : '#94a3b8';
  const primary = '#0066ff';
  const errorColor = '#ef4444';

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Login failed');

      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', authData.user.id)
        .maybeSingle();
      if (shopError) throw shopError;
      if (!shop) throw new Error('No shop found for this account');

      await saveShopSession({
        shopId: shop.id,
        ownerId: authData.user.id,
        email: email.trim().toLowerCase(),
        shopName: shop.name,
        shopStatus: shop.status,
      });

      router.replace('/shop/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: inputBg, borderColor: inputBorder }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={18} color={textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerLogo, { borderColor: primary }]}>
            <View style={[styles.headerLogoInner, { backgroundColor: `${primary}15`, borderColor: '#3385ff' }]}>
              <Store size={22} color={primary} />
            </View>
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={[styles.titleUni, { color: textPrimary }]}>UNI</Text>
              <Text style={[styles.titleLink, { color: primary }]}>LINK</Text>
            </View>
            <Text style={[styles.headerSub, { color: textSecondary }]}>Shop Owner Login</Text>
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
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>EMAIL</Text>
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
              <Text style={[styles.label, { color: textSecondary }]}>PASSWORD</Text>
              <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focused === 'password' ? primary : inputBorder }]}>
                <View style={styles.inputIcon}><CreditCard size={16} color={focused === 'password' ? primary : placeholderColor} /></View>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={placeholderColor}
                  secureTextEntry
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: primary, opacity: loading ? 0.6 : 1 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Login to Dashboard</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/shop/register')}>
          <Text style={{ color: textSecondary, fontSize: 14 }}>
            Don't have a shop? <Text style={{ color: primary, fontWeight: '600' }}>Register</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
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
  body: { flex: 1, padding: 16, gap: 16 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 13, flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18 },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 12, minHeight: 48,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  submitBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  registerLink: { alignItems: 'center', paddingVertical: 12 },
});
