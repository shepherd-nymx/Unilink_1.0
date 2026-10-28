import { useEffect, useState, type ReactElement } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { CheckCircle2, ShieldCheck, ShoppingCart, Zap } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const LOGO = require('../assets/images/future-pulse-logo.png');

type OAuthTokens = {
  access_token: string;
  refresh_token: string;
};

function GoogleMark(): ReactElement {
  return <Text style={styles.googleMark}>G</Text>;
}

function getOAuthTokens(url: string): OAuthTokens | null {
  const parsedUrl = new URL(url);
  const values = new URLSearchParams(parsedUrl.hash.replace(/^#/, '') || parsedUrl.search.replace(/^\?/, ''));
  const accessToken = values.get('access_token');
  const refreshToken = values.get('refresh_token');

  if (!accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

export default function Home() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const restoreGoogleSession = async (): Promise<void> => {
      if (Platform.OS === 'web') {
        const callbackParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const callbackError = callbackParams.get('error_description') || callbackParams.get('error');
        if (callbackError) {
          setError(decodeURIComponent(callbackError.replace(/\\+/g, ' ')));
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        router.replace('/welcome');
        return;
      }
      setIsLoading(false);
    };

    restoreGoogleSession().catch(() => {
      if (mounted) setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (session && event !== 'SIGNED_OUT') {
        router.replace('/welcome');
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const handleGoogleSignIn = async (): Promise<void> => {
    setIsSigningIn(true);
    setError('');

    try {
      const redirectTo = Platform.OS === 'web'
        ? `${window.location.origin}/`
        : Linking.createURL('/');
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
      });

      if (signInError) throw signInError;
      if (!data.url) throw new Error('Google sign-in could not be started.');

      if (Platform.OS !== 'web') {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== 'success') {
          setIsSigningIn(false);
          return;
        }

        const tokens = getOAuthTokens(result.url);
        if (!tokens) throw new Error('Google sign-in did not return a valid session.');
        const { error: sessionError } = await supabase.auth.setSession(tokens);
        if (sessionError) throw sessionError;
      }
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Google sign-in failed. Please try again.');
      setIsSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <View style={[styles.orbitLarge, { borderColor: isDark ? 'rgba(0,212,255,0.12)' : 'rgba(0,102,255,0.1)' }]} />
      <View style={[styles.orbitSmall, { borderColor: isDark ? 'rgba(0,212,255,0.1)' : 'rgba(0,102,255,0.08)' }]} />

      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityLabel="Toggle theme"
          onPress={toggleTheme}
          style={[styles.themeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.themeButtonText, { color: colors.text }]}>{isDark ? 'Light' : 'Dark'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.logoRing, { borderColor: colors.primary }]}>
          <View style={[styles.logoInner, { backgroundColor: isDark ? 'rgba(0,212,255,0.12)' : 'rgba(0,102,255,0.08)' }]}>
            <ShoppingCart size={42} color={colors.primary} strokeWidth={2.2} />
          </View>
        </View>

        <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>WELCOME TO</Text>
        <Text style={[styles.title, { color: colors.text }]}>UNI<Text style={{ color: colors.primary }}>LINK</Text></Text>
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.primary }]} />
          <Zap size={12} color={colors.primary} />
          <View style={[styles.dividerLine, { backgroundColor: colors.primary }]} />
        </View>
        <Text style={[styles.tagline, { color: colors.primary }]}>FAST GROCERY DELIVERY</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Order from your favourite stores{ '\n' }and get it delivered to your door</Text>

        <View style={[styles.signInCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
          <View style={[styles.cardIcon, { backgroundColor: isDark ? 'rgba(0,212,255,0.12)' : '#eef5ff' }]}>
            <ShieldCheck size={21} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>One secure sign-in</Text>
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>Use your Google account to access UniLink and continue to the delivery marketplace.</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fff1f2', borderColor: '#ef4444' }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            disabled={isSigningIn}
            onPress={handleGoogleSignIn}
            style={[styles.googleButton, { backgroundColor: colors.primary, opacity: isSigningIn ? 0.72 : 1 }]}
            activeOpacity={0.86}
          >
            {isSigningIn ? <ActivityIndicator size="small" color="#4285F4" /> : <GoogleMark />}
            <Text style={styles.googleButtonText}>{isSigningIn ? 'Connecting...' : 'Continue with Google'}</Text>
          </TouchableOpacity>

          <View style={styles.trustRow}>
            <CheckCircle2 size={14} color="#10b981" />
            <Text style={[styles.trustText, { color: colors.textTertiary }]}>Secure account access</Text>
          </View>
        </View>

        <Image source={LOGO} style={styles.poweredLogo} resizeMode="contain" />
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>Fast, trusted delivery for campus communities.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, minHeight: 700, overflow: 'hidden' },
  topBar: { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 24 },
  themeButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  themeButtonText: { fontSize: 12, fontWeight: '700' },
  orbitLarge: { position: 'absolute', width: 560, height: 560, borderWidth: 1, borderRadius: 280, top: -300, right: -220 },
  orbitSmall: { position: 'absolute', width: 310, height: 310, borderWidth: 1, borderRadius: 155, bottom: -170, left: -150 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24, maxWidth: 520, width: '100%', alignSelf: 'center' },
  logoRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoInner: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 4, marginBottom: 6 },
  title: { fontSize: 46, fontWeight: '900', letterSpacing: 2 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 },
  dividerLine: { width: 36, height: 1, opacity: 0.45 },
  tagline: { fontSize: 11, fontWeight: '800', letterSpacing: 2.5 },
  subtitle: { fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  signInCard: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 20, padding: 22, alignItems: 'center', shadowColor: '#0b1f3a', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  cardText: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  errorBox: { width: '100%', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  googleButton: { width: '100%', minHeight: 52, borderRadius: 4, borderWidth: 1, borderColor: '#dadce0', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 2 },
  googleMark: { color: '#4285F4', fontSize: 21, lineHeight: 24, fontWeight: '800', width: 22, textAlign: 'center' },
  googleButtonText: { color: '#202124', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  trustText: { fontSize: 12, fontWeight: '600' },
  poweredLogo: { width: 36, height: 36, marginTop: 24, opacity: 0.8 },
  footerText: { fontSize: 11, marginTop: 6, textAlign: 'center' },
});
