import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { saveShopSession } from '@/lib/shop-session-service';
import { ArrowLeft, CircleAlert as AlertCircle, Store, Mail, CreditCard, Lock, CircleCheck as CheckCircle, X } from 'lucide-react-native';
import { S } from '@/lib/shop-theme';

export default function ShopLogin() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [orphanRecovery, setOrphanRecovery] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const bg = '#050b16';
  const cardBg = '#0a1220';
  const cardBorder = '#1a2d4a';
  const textPrimary = '#e0eeff';
  const textSecondary = '#6a8fb0';
  const inputBg = '#0d1828';
  const inputBorder = '#1a2d4a';
  const placeholderColor = '#3d5577';
  const primary = '#00e5ff';
  const errorColor = '#ff3366';

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setResetMessage('Please enter your email address');
      return;
    }
    const emailTrim = resetEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setResetMessage('Please enter a valid email address');
      return;
    }
    setResetLoading(true);
    setResetMessage('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailTrim, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'https://updates.unilinkbase.com'}/shop/login`,
      });
      if (resetError) throw resetError;
      setResetMessage('Password reset email sent. Check your inbox for instructions to reset your password.');
    } catch (err: any) {
      setResetMessage(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

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
      if (!shop) {
        // Auth account exists but no shop record — orphaned registration.
        // Offer recovery: redirect to register page so they can complete setup.
        try { await supabase.auth.signOut(); } catch {}
        setOrphanRecovery(true);
        setError('Your account exists but your shop profile was not fully created. Please complete your registration.');
        setLoading(false);
        return;
      }

      setOrphanRecovery(false);
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
            <View style={[styles.headerLogoInner, { backgroundColor: S.cyanDim, borderColor: S.borderBright }]}>
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
          <View style={[styles.errorBox, { backgroundColor: 'rgba(255,51,102,0.12)', borderColor: errorColor }]}>
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
                <View style={styles.inputIcon}><Lock size={16} color={focused === 'password' ? primary : placeholderColor} /></View>
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
              onPress={() => { setShowResetModal(true); setResetMessage(''); setResetEmail(''); }}
              style={{ alignSelf: 'flex-end', marginTop: -4, marginBottom: 4 }}
            >
              <Text style={{ color: primary, fontSize: 12, fontWeight: '600' }}>Forgot Password?</Text>
            </TouchableOpacity>

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

        {orphanRecovery && (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: primary, marginTop: 0 }]}
            onPress={() => router.push('/shop/register')}
          >
            <Text style={styles.submitBtnText}>Complete Your Registration</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/shop/register')}>
          <Text style={{ color: textSecondary, fontSize: 14 }}>
            Don't have a shop? <Text style={{ color: primary, fontWeight: '600' }}>Register</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={showResetModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.resetModal, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.resetModalHeader}>
              <Text style={[styles.resetModalTitle, { color: textPrimary }]}>Reset Password</Text>
              <TouchableOpacity onPress={() => setShowResetModal(false)}>
                <X size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.resetModalSub, { color: textSecondary }]}>
              Enter your email and we'll send you a link to reset your password.
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder, marginTop: 16 }]}>
              <View style={styles.inputIcon}><Mail size={16} color={placeholderColor} /></View>
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                value={resetEmail}
                onChangeText={setResetEmail}
                placeholder="Enter your email"
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            {resetMessage ? (
              <View style={[styles.resetMessageBox, { backgroundColor: resetMessage.includes('sent') ? S.greenDim : S.redDim, borderColor: resetMessage.includes('sent') ? S.green : S.red }]}>
                {resetMessage.includes('sent') ? <CheckCircle size={14} color={S.green} /> : <AlertCircle size={14} color={S.red} />}
                <Text style={[styles.resetMessageText, { color: resetMessage.includes('sent') ? S.green : S.red }]}>{resetMessage}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.resetSubmitBtn, { backgroundColor: primary, opacity: resetLoading ? 0.7 : 1 }]}
              onPress={handleResetPassword}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <Text style={styles.resetSubmitBtnText}>Sending...</Text>
              ) : (
                <Text style={styles.resetSubmitBtnText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  resetModal: { width: '100%', maxWidth: 380, borderRadius: 18, borderWidth: 1, padding: 24 },
  resetModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resetModalTitle: { fontSize: 18, fontWeight: '800' },
  resetModalSub: { fontSize: 13, lineHeight: 19 },
  resetMessageBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 12 },
  resetMessageText: { flex: 1, fontSize: 12, fontWeight: '500' },
  resetSubmitBtn: { borderRadius: 12, height: 48, marginTop: 16, justifyContent: 'center', alignItems: 'center' },
  resetSubmitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
