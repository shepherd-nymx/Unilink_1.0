import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShoppingCart,
  Truck,
  UserCog,
  UserPlus,
  Store,
  Moon,
  Sun,
  Download,
  Bell,
  X,
  Zap,
  MapPin,
  Star,
  MessageCircle,
  CircleCheck as CheckCircle,
  ArrowRight,
  Package,
  Clock,
  Shield,
  ChevronDown,
  Circle as HelpCircle,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect, useRef } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { isFirstVisit, markFirstVisitDone } from '@/lib/storage-service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: UserPlus,
    title: 'Create Your Account',
    desc: 'Register as a Shopper or Messenger in under 30 seconds.',
  },
  {
    step: '02',
    icon: MapPin,
    title: 'Set Your Location',
    desc: 'Pick your campus or delivery zone so we match you with the right people.',
  },
  {
    step: '03',
    icon: Package,
    title: 'Place or Accept Orders',
    desc: 'Shoppers browse and order. Messengers accept and deliver.',
  },
  {
    step: '04',
    icon: Clock,
    title: 'Real-Time Tracking',
    desc: 'Follow your order live and chat directly with your messenger.',
  },
  {
    step: '05',
    icon: Star,
    title: 'Rate & Repeat',
    desc: 'Leave a review, build trust, and keep the community strong.',
  },
];

const FEATURES = [
  { icon: Shield, label: 'Verified Messengers', desc: 'Every driver is approved before going live.' },
  { icon: MessageCircle, label: 'In-App Chat', desc: 'Talk to your messenger without sharing numbers.' },
  { icon: Zap, label: 'Fast Dispatch', desc: 'Orders go out to nearby messengers instantly.' },
  { icon: Star, label: 'Ratings System', desc: 'Quality is kept high through community reviews.' },
];

export default function Home() {
  const router = useRouter();
  const { colors, toggleTheme, isDark } = useTheme();
  const { requestNotificationPermission } = useNotifications();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  const isNarrow = SCREEN_WIDTH < 600;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
      ])
    ).start();

    if (Platform.OS === 'web') {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowInstallButton(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      if (isFirstVisit()) setTimeout(() => setShowNotifModal(true), 800);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    } else {
      if (isFirstVisit()) setTimeout(() => setShowNotifModal(true), 800);
    }
  }, []);

  const handleAllowNotifications = async () => {
    await requestNotificationPermission();
    markFirstVisitDone();
    setShowNotifModal(false);
  };

  const handleDismissNotifModal = () => {
    markFirstVisitDone();
    setShowNotifModal(false);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  };

  const scrollToLearnMore = () => {
    scrollRef.current?.scrollTo({ y: SCREEN_HEIGHT * 0.92, animated: true });
  };

  const s = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },

    heroScreen: {
      minHeight: SCREEN_HEIGHT,
      paddingBottom: 32,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'web' ? 16 : 48,
      paddingBottom: 8,
      gap: 10,
    },
    topBarBtn: {
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    installBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: '#10b981',
    },
    installBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },

    heroContent: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 24,
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    },

    logoRing: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 1.5,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    logoInner: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: isDark ? 'rgba(0,212,255,0.12)' : 'rgba(0,102,255,0.08)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    heroLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 4,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    heroTitle: {
      fontSize: isNarrow ? 46 : 56,
      fontWeight: '900',
      letterSpacing: 2,
      textAlign: 'center',
      marginBottom: 2,
    },
    heroTitleUni: { color: colors.text },
    heroTitleLink: { color: colors.primary },

    heroDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 10,
    },
    heroDividerLine: {
      height: 1,
      width: 36,
      backgroundColor: colors.primary,
      opacity: 0.4,
    },
    heroTagline: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 3,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    heroSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 23,
      marginTop: 8,
      marginBottom: 32,
    },

    actionButtons: {
      width: '100%',
      gap: 12,
    },
    bigBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 22,
      gap: 14,
    },
    bigBtnIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bigBtnTexts: {
      flex: 1,
    },
    bigBtnHint: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 1,
    },
    bigBtnLabel: {
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: 0.2,
    },

    adminRow: {
      marginTop: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    adminBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    adminBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textTertiary,
    },

    scrollHint: {
      alignItems: 'center',
      paddingTop: 24,
      gap: 6,
    },
    scrollHintText: {
      fontSize: 11,
      color: colors.textTertiary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },

    section: {
      paddingHorizontal: 20,
      paddingBottom: 56,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 3,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginBottom: 6,
    },
    sectionTitle: {
      fontSize: isNarrow ? 22 : 28,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 34,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginBottom: 48,
      marginHorizontal: 20,
    },

    stepsWrap: {
      maxWidth: 680,
      alignSelf: 'center',
      width: '100%',
      gap: 0,
    },
    stepRow: {
      flexDirection: 'row',
      gap: 16,
      alignItems: 'flex-start',
    },
    stepLeft: {
      alignItems: 'center',
      width: 48,
    },
    stepNumberCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(0,212,255,0.1)' : 'rgba(0,102,255,0.07)',
      borderWidth: 1.5,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepNumber: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 1,
    },
    stepConnector: {
      width: 2,
      flex: 1,
      minHeight: 24,
      backgroundColor: colors.borderLight,
      marginVertical: 4,
    },
    stepContent: {
      flex: 1,
      paddingTop: 10,
      paddingBottom: 28,
    },
    stepTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    stepDesc: {
      fontSize: 14,
      color: colors.textTertiary,
      lineHeight: 21,
    },

    featuresGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      maxWidth: 860,
      alignSelf: 'center',
      width: '100%',
    },
    featureCard: {
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      width: isNarrow ? '100%' : '47%',
      flexGrow: 1,
    },
    featureIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(0,212,255,0.1)' : 'rgba(0,102,255,0.07)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    featureTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    featureDesc: {
      fontSize: 13,
      color: colors.textTertiary,
      lineHeight: 19,
    },

    ctaBanner: {
      marginHorizontal: 20,
      marginBottom: 56,
      borderRadius: 24,
      padding: 36,
      alignItems: 'center',
      backgroundColor: isDark ? colors.card : '#f0f6ff',
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#c7deff',
      maxWidth: 860,
      alignSelf: 'center',
      width: SCREEN_WIDTH - 40,
    },
    ctaBannerTitle: {
      fontSize: isNarrow ? 22 : 28,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
      lineHeight: 36,
    },
    ctaBannerSub: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 28,
      maxWidth: 440,
    },
    ctaBannerBtns: {
      flexDirection: isNarrow ? 'column' : 'row',
      gap: 12,
      width: '100%',
      maxWidth: 400,
    },
    ctaPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    ctaPrimaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
    ctaSecondary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: 'transparent',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    ctaSecondaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },

    footer: {
      paddingVertical: 24,
      paddingHorizontal: 20,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      alignItems: 'center',
      gap: 8,
    },
    footerText: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    footerLinks: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    footerDot: {
      fontSize: 14,
      color: colors.textTertiary,
      opacity: 0.3,
      paddingHorizontal: 2,
    },
    footerAdmin: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      padding: 6,
    },
    footerAdminText: {
      fontSize: 12,
      color: colors.textTertiary,
      opacity: 0.6,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 28,
      width: '100%',
      maxWidth: 420,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 10,
    },
    modalCloseBtn: {
      position: 'absolute',
      top: 16,
      right: 16,
      padding: 6,
      zIndex: 1,
    },
    modalIconWrap: { alignItems: 'center', marginBottom: 20 },
    modalIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? 'rgba(0,212,255,0.12)' : 'rgba(0,102,255,0.08)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 10,
    },
    modalSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    modalBenefits: {
      marginTop: 20,
      marginBottom: 24,
      gap: 12,
    },
    modalBenefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    modalBullet: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 6,
    },
    modalBenefitText: {
      flex: 1,
      fontSize: 14,
      color: colors.textTertiary,
      lineHeight: 20,
    },
    modalAllowBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 10,
    },
    modalAllowBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
    modalDismissBtn: {
      paddingVertical: 10,
      alignItems: 'center',
    },
    modalDismissBtnText: {
      fontSize: 14,
      color: colors.textTertiary,
      fontWeight: '500',
    },
  });

  const SHOPPER_BLUE = '#0066ff';
  const SHOPPER_DARK = '#003fcc';
  const MESSENGER_TEAL = '#00b894';
  const MESSENGER_DARK = '#009b7a';

  return (
    <View style={s.page}>
      <Modal
        visible={showNotifModal}
        transparent
        animationType="fade"
        onRequestClose={handleDismissNotifModal}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <TouchableOpacity style={s.modalCloseBtn} onPress={handleDismissNotifModal}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
            <View style={s.modalIconWrap}>
              <View style={s.modalIconCircle}>
                <Bell size={36} color={colors.primary} />
              </View>
              <Text style={s.modalTitle}>Stay in the Loop</Text>
              <Text style={s.modalSubtitle}>
                Enable notifications to get real-time updates on your orders and deliveries
              </Text>
            </View>
            <View style={s.modalBenefits}>
              {[
                'Know the moment a driver picks up your order',
                'Drivers get instant alerts for new delivery requests',
                'Receive messages and status updates without refreshing',
              ].map((t, i) => (
                <View key={i} style={s.modalBenefitRow}>
                  <View style={s.modalBullet} />
                  <Text style={s.modalBenefitText}>{t}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={s.modalAllowBtn} onPress={handleAllowNotifications}>
              <Bell size={20} color="#fff" />
              <Text style={s.modalAllowBtnText}>Allow Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalDismissBtn} onPress={handleDismissNotifModal}>
              <Text style={s.modalDismissBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView ref={scrollRef} style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HERO SCREEN (first fold) ── */}
        <View style={s.heroScreen}>
          <View style={s.topBar}>
            {showInstallButton && (
              <TouchableOpacity style={s.installBtn} onPress={handleInstallClick}>
                <Download size={16} color="#fff" />
                <Text style={s.installBtnText}>Install App</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.topBarBtn} onPress={toggleTheme}>
              {isDark ? <Sun size={20} color={colors.text} /> : <Moon size={20} color={colors.text} />}
            </TouchableOpacity>
          </View>

          <View style={s.heroContent}>
            <Animated.View style={[s.logoRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={s.logoInner}>
                <ShoppingCart size={40} color={colors.primary} />
              </View>
            </Animated.View>

            <Text style={s.heroLabel}>Welcome to</Text>
            <Text style={s.heroTitle}>
              <Text style={s.heroTitleUni}>UNI</Text>
              <Text style={s.heroTitleLink}>LINK</Text>
            </Text>

            <View style={s.heroDivider}>
              <View style={s.heroDividerLine} />
              <Zap size={12} color={colors.primary} />
              <View style={s.heroDividerLine} />
            </View>

            <Text style={s.heroTagline}>Fast Grocery Delivery</Text>
            <Text style={s.heroSubtitle}>
              Order from your favourite stores{'\n'}and get it delivered to your door
            </Text>

            {/* Action Buttons */}
            <View style={s.actionButtons}>
              {/* Sign In Shopper */}
              <TouchableOpacity
                style={[s.bigBtn, { backgroundColor: SHOPPER_BLUE }]}
                onPress={() => router.push('/customer/login')}
                activeOpacity={0.88}
              >
                <View style={[s.bigBtnIconWrap, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                  <ShoppingCart size={20} color="#fff" />
                </View>
                <View style={s.bigBtnTexts}>
                  <Text style={[s.bigBtnHint, { color: 'rgba(255,255,255,0.75)' }]}>Sign In</Text>
                  <Text style={[s.bigBtnLabel, { color: '#fff' }]}>Shopper</Text>
                </View>
                <ArrowRight size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>

              {/* Register as Shopper */}
              <TouchableOpacity
                style={[s.bigBtn, { backgroundColor: SHOPPER_DARK }]}
                onPress={() => router.push('/customer/register')}
                activeOpacity={0.88}
              >
                <View style={[s.bigBtnIconWrap, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <UserPlus size={20} color="#fff" />
                </View>
                <View style={s.bigBtnTexts}>
                  <Text style={[s.bigBtnHint, { color: 'rgba(255,255,255,0.7)' }]}>New Account</Text>
                  <Text style={[s.bigBtnLabel, { color: '#fff' }]}>Register as Shopper</Text>
                </View>
                <ArrowRight size={18} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>

              {/* Sign In Messenger */}
              <TouchableOpacity
                style={[s.bigBtn, { backgroundColor: MESSENGER_TEAL }]}
                onPress={() => router.push('/driver/login')}
                activeOpacity={0.88}
              >
                <View style={[s.bigBtnIconWrap, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                  <Truck size={20} color="#fff" />
                </View>
                <View style={s.bigBtnTexts}>
                  <Text style={[s.bigBtnHint, { color: 'rgba(255,255,255,0.75)' }]}>Sign In</Text>
                  <Text style={[s.bigBtnLabel, { color: '#fff' }]}>Messenger</Text>
                </View>
                <ArrowRight size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Shop Owner + Admin row */}
            <View style={s.adminRow}>
              <TouchableOpacity style={s.adminBtn} onPress={() => router.push('/shop/login')}>
                <Store size={15} color={colors.textTertiary} />
                <Text style={s.adminBtnText}>Shop Owner</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.adminBtn} onPress={() => router.push('/admin/login')}>
                <UserCog size={15} color={colors.textTertiary} />
                <Text style={s.adminBtnText}>Admin</Text>
              </TouchableOpacity>
            </View>

            {/* Scroll hint */}
            <TouchableOpacity style={s.scrollHint} onPress={scrollToLearnMore} activeOpacity={0.7}>
              <Text style={s.scrollHintText}>How it works</Text>
              <ChevronDown size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── DIVIDER ── */}
        <View style={s.sectionDivider} />

        {/* ── HOW IT WORKS ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Simple Process</Text>
          <Text style={s.sectionTitle}>How UniLink Works</Text>

          <View style={s.stepsWrap}>
            {HOW_IT_WORKS.map((step, idx) => {
              const isLast = idx === HOW_IT_WORKS.length - 1;
              return (
                <View key={step.step} style={s.stepRow}>
                  <View style={s.stepLeft}>
                    <View style={s.stepNumberCircle}>
                      <Text style={s.stepNumber}>{step.step}</Text>
                    </View>
                    {!isLast && <View style={s.stepConnector} />}
                  </View>
                  <View style={[s.stepContent, isLast && { paddingBottom: 0 }]}>
                    <Text style={s.stepTitle}>{step.title}</Text>
                    <Text style={s.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── FEATURES ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Why UniLink</Text>
          <Text style={s.sectionTitle}>Built for Trust & Speed</Text>

          <View style={s.featuresGrid}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <View key={f.label} style={s.featureCard}>
                  <View style={s.featureIconWrap}>
                    <Icon size={20} color={colors.primary} />
                  </View>
                  <Text style={s.featureTitle}>{f.label}</Text>
                  <Text style={s.featureDesc}>{f.desc}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── CTA BANNER ── */}
        <View style={s.ctaBanner}>
          <Text style={s.ctaBannerTitle}>Ready to get started?{'\n'}Sign up in 30 seconds.</Text>
          <Text style={s.ctaBannerSub}>
            Join thousands of students already using UniLink to order and earn on campus.
          </Text>
          <View style={s.ctaBannerBtns}>
            <TouchableOpacity style={s.ctaPrimary} onPress={() => router.push('/customer/register')}>
              <ShoppingCart size={18} color="#fff" />
              <Text style={s.ctaPrimaryText}>I want to order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.ctaSecondary} onPress={() => router.push('/driver/register')}>
              <Truck size={18} color={colors.primary} />
              <Text style={s.ctaSecondaryText}>I want to deliver</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>UniLink — connect, deliver, and receive anywhere, anytime.</Text>
          <View style={s.footerLinks}>
            <TouchableOpacity style={s.footerAdmin} onPress={() => router.push('/support' as any)}>
              <HelpCircle size={13} color={colors.textTertiary} />
              <Text style={s.footerAdminText}>Help & Support</Text>
            </TouchableOpacity>
            <Text style={s.footerDot}>·</Text>
            <TouchableOpacity style={s.footerAdmin} onPress={() => router.push('/admin/login')}>
              <UserCog size={13} color={colors.textTertiary} />
              <Text style={s.footerAdminText}>Admin Portal</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}
