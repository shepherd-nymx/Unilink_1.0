import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Platform, Modal, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CircleCheck as CheckCircle, User, Lock, ShoppingCart, Zap, LogIn, Mail, CircleAlert as AlertCircle, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { saveUserData } from '@/lib/storage-service';
import { registerForPushNotificationsOnLogin } from '@/lib/notification-service';
import { registerDeviceToken } from '@/lib/device-token-service';

export default function CustomerLogin() {
  const router = useRouter();
  const { registered } = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (registered === 'true') {
      setSuccessMessage('Registration successful! A verification email has been sent. Please verify your email, then login to continue.');
    }

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

    Animated.loop(
      Animated.timing(shimmerAnim, { toValue: 1, duration: 3000, useNativeDriver: false })
    ).start();
  }, [registered]);

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
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'https://updates.unilinkbase.com'}/customer/login`,
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
    const userTrim = username.trim();
    if (!userTrim || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // A stale auth session (e.g. from the shop portal in the same browser)
      // switches requests to the authenticated role, whose policies hide all
      // customer rows and break this lookup. The app manages sessions itself.
      await supabase.auth.signOut().catch(() => {});

      const lookup = userTrim.replace(/([%_\\])/g, '\\$1');
      const { data: candidates, error: dbError } = await supabase
        .from('customers')
        .select('*')
        .ilike('username', `${lookup}%`)
        .limit(20);

      if (dbError) throw dbError;

      const customer = (candidates || []).find(
        (c: any) => String(c.username || '').trim().toLowerCase() === userTrim.toLowerCase()
      );

      if (!customer) {
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      const storedHash = customer.password_hash;

      if (!storedHash) {
        // Admin-created accounts have no password yet — first login sets it.
        const { error: setErr } = await supabase
          .from('customers')
          .update({ password_hash: btoa(password.trim()) })
          .eq('id', customer.id);
        if (setErr) throw setErr;
      } else {
        const matchedInput = [password, password.trim(), `${password} `, ` ${password}`]
          .find((candidate) => {
            try { return btoa(candidate) === storedHash; } catch { return false; }
          });

        if (matchedInput == null) {
          setError('Invalid username or password');
          setLoading(false);
          return;
        }

        if (matchedInput !== password.trim()) {
          await supabase
            .from('customers')
            .update({ password_hash: btoa(password.trim()) })
            .eq('id', customer.id);
        }
      }

      saveUserData({ id: customer.id, type: 'customer', name: customer.full_name });
      registerForPushNotificationsOnLogin(customer.id, 'customer').catch(() => {});
      registerDeviceToken(customer.id).catch(() => {});
      router.replace({
        pathname: '/customer/dashboard',
        params: { customerId: customer.id, customerName: customer.full_name },
      });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const primary = '#1A73E8';
  const primaryLight = '#4A9EFF';
  const bg = isDark ? '#050D1A' : '#F0F4FF';
  const cardBg = isDark ? '#0D1B2E' : '#FFFFFF';
  const cardBorder = isDark ? '#1A3A5C' : '#DDE8FF';
  const textPrimary = isDark ? '#E8F4FF' : '#0A1628';
  const textSecondary = isDark ? '#7AA3CC' : '#5A7A9A';
  const inputBg = isDark ? '#0A1828' : '#F5F8FF';
  const inputBorder = isDark ? '#1E3A5C' : '#C8D8F0';
  const inputBorderFocus = primary;
  const placeholderColor = isDark ? '#3A6A8A' : '#9AB0CC';
  const glowColor = isDark ? 'rgba(26,115,232,0.18)' : 'rgba(26,115,232,0.08)';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Background geometric accents */}
      <View style={[styles.bgCircle1, { borderColor: isDark ? 'rgba(26,115,232,0.12)' : 'rgba(26,115,232,0.07)' }]} />
      <View style={[styles.bgCircle2, { borderColor: isDark ? 'rgba(74,158,255,0.08)' : 'rgba(26,115,232,0.05)' }]} />
      <View style={[styles.bgDot1, { backgroundColor: isDark ? 'rgba(26,115,232,0.2)' : 'rgba(26,115,232,0.12)' }]} />
      <View style={[styles.bgDot2, { backgroundColor: isDark ? 'rgba(74,158,255,0.15)' : 'rgba(26,115,232,0.08)' }]} />

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <View style={[styles.backButtonInner, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ArrowLeft size={18} color={textSecondary} />
        </View>
      </TouchableOpacity>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Logo badge */}
        <View style={styles.logoArea}>
          <Animated.View style={[styles.logoRingOuter, { borderColor: primary, transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.logoRingInner, { backgroundColor: glowColor, borderColor: primaryLight }]}>
              <ShoppingCart size={32} color={primary} />
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

        {/* Card */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: primary }]}>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Customer Login</Text>
          <Text style={[styles.cardSubtitle, { color: textSecondary }]}>Enter your credentials to continue</Text>

          {successMessage ? (
            <View style={[styles.successBox, { backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#F0FDF9', borderColor: '#10B981' }]}>
              <CheckCircle size={16} color="#10B981" />
              <Text style={[styles.successText, { color: '#10B981' }]}>{successMessage}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FFF5F5', borderColor: '#EF4444' }]}>
              <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>USERNAME</Text>
              <View style={[
                styles.inputWrapper,
                { backgroundColor: inputBg, borderColor: usernameFocused ? inputBorderFocus : inputBorder },
                usernameFocused && styles.inputWrapperFocused,
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

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>PASSWORD</Text>
              <View style={[
                styles.inputWrapper,
                { backgroundColor: inputBg, borderColor: passwordFocused ? inputBorderFocus : inputBorder },
                passwordFocused && styles.inputWrapperFocused,
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

            {/* Forgot password link */}
            <TouchableOpacity
              onPress={() => { setShowResetModal(true); setResetMessage(''); setResetEmail(''); }}
              style={{ alignSelf: 'flex-end', marginTop: 4, marginBottom: 4 }}
            >
              <Text style={{ color: primary, fontSize: 12, fontWeight: '600' }}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login button */}
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
              <View style={[styles.loginButtonShine, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Register link */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => router.push('/customer/register')}
          activeOpacity={0.7}
        >
          <Text style={[styles.registerLinkText, { color: textSecondary }]}>
            Don't have an account?{'  '}
            <Text style={[styles.registerLinkBold, { color: primary }]}>Register</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Password Reset Modal */}
      <Modal visible={showResetModal} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
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
              <Mail size={16} color={placeholderColor} style={styles.inputIcon} />
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
              <View style={[styles.resetMessageBox, { backgroundColor: resetMessage.includes('sent') ? (isDark ? 'rgba(16,185,129,0.1)' : '#F0FDF9') : (isDark ? 'rgba(239,68,68,0.1)' : '#FFF5F5'), borderColor: resetMessage.includes('sent') ? '#10B981' : '#EF4444' }]}>
                {resetMessage.includes('sent') ? <CheckCircle size={14} color="#10B981" /> : <AlertCircle size={14} color="#EF4444" />}
                <Text style={[styles.resetMessageText, { color: resetMessage.includes('sent') ? '#10B981' : '#EF4444' }]}>{resetMessage}</Text>
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
  container: {
    flex: 1,
  },
  bgCircle1: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    borderWidth: 1,
    top: -200,
    right: -180,
  },
  bgCircle2: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    borderWidth: 1,
    bottom: -120,
    left: -100,
  },
  bgDot1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -60,
    left: -50,
  },
  bgDot2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    bottom: 60,
    right: -30,
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoRingOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  logoRingInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleUni: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
  },
  titleLink: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
  },
  accentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accentLine: {
    height: 1,
    width: 28,
    opacity: 0.5,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 22,
    letterSpacing: 0.3,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  form: {
    gap: 18,
  },
  inputGroup: {
    gap: 7,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperFocused: {
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  loginButton: {
    borderRadius: 14,
    height: 54,
    marginTop: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  loginButtonInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loginButtonShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  registerLink: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  registerLinkText: {
    fontSize: 14,
  },
  registerLinkBold: {
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resetModal: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
  },
  resetModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resetModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  resetModalSub: {
    fontSize: 13,
    lineHeight: 19,
  },
  resetMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  resetMessageText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  resetSubmitBtn: {
    borderRadius: 12,
    height: 48,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetSubmitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
