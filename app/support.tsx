import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
  Platform,
  Animated,
  Share,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, Phone, MapPin, ChevronDown, ChevronUp, Search, Circle as HelpCircle, TriangleAlert as AlertTriangle, UserPlus, ShoppingCart, Truck, Lock, CreditCard, MessageCircle, ExternalLink, Send, Users, Share2, Code as Code2, Heart } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useRef, useEffect } from 'react';

const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/Iq9J9Gt0XC9GbyhgrSwoSW?mode=gi_t';
const APP_URL = 'https://unilink.app';
const DEVELOPER = {
  name: 'Shepherd Mufaro Mutevedzi',
  role: 'Founder & Developer',
  email: 'shepherdmutevedzi@gmail.com',
};

const CONTACT = {
  email: 'shepherdmutevedzi@gmail.com',
  phone: '0782627990',
  location: 'Bulawayo, Zimbabwe',
};

type FAQ = {
  id: string;
  icon: any;
  category: string;
  question: string;
  answer: string;
};

const FAQS: FAQ[] = [
  {
    id: '1',
    icon: UserPlus,
    category: 'Account',
    question: 'How do I register as a student?',
    answer:
      'Tap "Register" on the main page and choose "Shopper". Fill in your full name, phone number, email, and set a password. You\'ll be active immediately — no email confirmation required.',
  },
  {
    id: '2',
    icon: Truck,
    category: 'Messenger',
    question: 'How do I register as a messenger/driver?',
    answer:
      'Tap "Register" and choose "Messenger". Complete your profile including your vehicle type and Paynow number. Your account must be approved by an admin before you go live — you\'ll be notified once approved.',
  },
  {
    id: '3',
    icon: ShoppingCart,
    category: 'Orders',
    question: 'How do I place an order?',
    answer:
      'Log in as a Shopper, then browse the grocery list on your dashboard. Add items to your cart, choose your delivery method (Vehicle or Walking), pick a payment option, and tap "Place Order". Available messengers will see your request instantly.',
  },
  {
    id: '4',
    icon: MapPin,
    category: 'Orders',
    question: 'How do I track my delivery in real time?',
    answer:
      'Once a messenger accepts your order, head to "My Orders" from your dashboard. Your order status updates live: Pending → Accepted → In Progress → Delivered. You can also chat your messenger directly from the order page.',
  },
  {
    id: '5',
    icon: Lock,
    category: 'Account',
    question: 'How do I change my password or update my profile?',
    answer:
      'From your dashboard, tap the profile icon in the top right. Under "Account Settings" you can update your name, phone number, location (GPS), university, and password. Changes are saved immediately.',
  },
  {
    id: '6',
    icon: CreditCard,
    category: 'Payments',
    question: 'What payment methods does UniLink accept?',
    answer:
      'UniLink currently supports Pay on Delivery (cash or card) and Paynow online payment. When paying via Paynow, your messenger will share their Paynow number after accepting the order. More payment options are coming soon.',
  },
  {
    id: '7',
    icon: MessageCircle,
    category: 'Support',
    question: 'How do I report a missing or wrong delivery?',
    answer:
      'Use the in-app chat to contact your messenger first. If the issue is not resolved, email us at shepherdmutevedzi@gmail.com with your order ID and a description. We aim to resolve all complaints within 24 hours.',
  },
  {
    id: '8',
    icon: AlertTriangle,
    category: 'Support',
    question: 'My order expired or was not accepted — what now?',
    answer:
      'Orders expire after 10 minutes if no messenger accepts them. This usually happens during off-peak hours or when no messengers are available in your zone. Simply re-place your order or try switching to a different location.',
  },
  {
    id: '9',
    icon: Truck,
    category: 'Messenger',
    question: 'How do I update my delivery location or availability?',
    answer:
      'From your driver dashboard, tap "Settings". You can switch your active location, toggle availability, and update your vehicle type or payment preferences anytime.',
  },
  {
    id: '10',
    icon: UserPlus,
    category: 'Account',
    question: 'I forgot my password — how do I reset it?',
    answer:
      'On the login page, tap "Forgot Password?" and enter your registered email. A reset link will be sent. If you continue having trouble, contact support directly and we\'ll help you regain access.',
  },
];

const CATEGORIES = ['All', 'Account', 'Orders', 'Messenger', 'Payments', 'Support'];

const QUICK_LINKS = [
  { label: 'Report Missing Delivery', icon: AlertTriangle, color: '#ef4444' },
  { label: 'Update Account Info', icon: UserPlus, color: '#0066ff' },
  { label: 'Track My Order', icon: MapPin, color: '#00b894' },
  { label: 'Payment Issue', icon: CreditCard, color: '#f59e0b' },
];

function FAQItem({ faq, colors, isDark }: { faq: FAQ; colors: any; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const Icon = faq.icon;

  const toggle = () => {
    Animated.timing(anim, {
      toValue: open ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setOpen(!open);
  };

  const categoryColor: Record<string, string> = {
    Account: '#0066ff',
    Orders: '#00b894',
    Messenger: '#f59e0b',
    Payments: '#8b5cf6',
    Support: '#ef4444',
  };

  const color = categoryColor[faq.category] ?? colors.primary;

  return (
    <View
      style={[
        styles.faqCard,
        {
          backgroundColor: colors.card,
          borderColor: open ? color + '44' : colors.border,
        },
      ]}
    >
      <TouchableOpacity style={styles.faqHeader} onPress={toggle} activeOpacity={0.75}>
        <View style={[styles.faqIconWrap, { backgroundColor: isDark ? color + '22' : color + '15' }]}>
          <Icon size={18} color={color} />
        </View>
        <View style={styles.faqHeaderMid}>
          <Text style={[styles.faqCategory, { color }]}>{faq.category}</Text>
          <Text style={[styles.faqQuestion, { color: colors.text }]}>{faq.question}</Text>
        </View>
        <View style={styles.faqChevron}>
          {open ? (
            <ChevronUp size={18} color={colors.textTertiary} />
          ) : (
            <ChevronDown size={18} color={colors.textTertiary} />
          )}
        </View>
      </TouchableOpacity>

      {open && (
        <View style={[styles.faqAnswer, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.faqAnswerText, { color: colors.textSecondary }]}>{faq.answer}</Text>
        </View>
      )}
    </View>
  );
}

export default function SupportPage() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [ticketName, setTicketName] = useState('');
  const [ticketEmail, setTicketEmail] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketSent, setTicketSent] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const filtered = FAQS.filter((f) => {
    const matchesSearch =
      search.trim() === '' ||
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'All' || f.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleEmail = () => Linking.openURL(`mailto:${CONTACT.email}`);
  const handlePhone = () => Linking.openURL(`tel:${CONTACT.phone}`);

  const handleTicketSubmit = () => {
    if (!ticketName.trim() || !ticketEmail.trim() || !ticketMsg.trim()) return;
    const subject = encodeURIComponent(`UniLink Support Request from ${ticketName}`);
    const body = encodeURIComponent(`Name: ${ticketName}\nEmail: ${ticketEmail}\n\n${ticketMsg}`);
    Linking.openURL(`mailto:${CONTACT.email}?subject=${subject}&body=${body}`);
    setTicketSent(true);
    setTicketName('');
    setTicketEmail('');
    setTicketMsg('');
    setTimeout(() => setTicketSent(false), 4000);
  };

  const handleJoinWhatsApp = () => Linking.openURL(WHATSAPP_GROUP_URL);

  const SHARE_TEXT = `Order groceries delivered right to your door at university! Try UniLink: ${APP_URL}`;
  const SHARE_TEXT_ENCODED = encodeURIComponent(SHARE_TEXT);

  const handleCopyLink = async () => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(APP_URL);
      } else {
        await Share.share({ message: APP_URL });
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {}
  };

  const handleShareWhatsApp = () =>
    Linking.openURL(`https://wa.me/?text=${SHARE_TEXT_ENCODED}`);

  const handleShareFacebook = () =>
    Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_URL)}`);

  const handleShareTwitter = () =>
    Linking.openURL(`https://twitter.com/intent/tweet?text=${SHARE_TEXT_ENCODED}`);

  const handleShareTelegram = () =>
    Linking.openURL(`https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`);

  const handleShareEmail = () =>
    Linking.openURL(`mailto:?subject=${encodeURIComponent('Try UniLink – Campus Grocery Delivery')}&body=${SHARE_TEXT_ENCODED}`);

  const handleShareSMS = () =>
    Linking.openURL(`sms:?body=${SHARE_TEXT_ENCODED}`);

  const handleSystemShare = async () => {
    try {
      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({
          title: 'UniLink – Campus Grocery Delivery',
          text: 'Order groceries delivered right to your door at university! Try UniLink.',
          url: APP_URL,
        });
      } else if (Platform.OS !== 'web') {
        await Share.share({
          message: SHARE_TEXT,
          url: APP_URL,
          title: 'UniLink – Campus Grocery Delivery',
        });
      }
    } catch {}
  };

  const s = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'web' ? 20 : 52,
      paddingBottom: 16,
      gap: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    backBtn: {
      padding: 8,
      borderRadius: 10,
      backgroundColor: isDark ? colors.card : '#f0f4ff',
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitleWrap: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    headerSub: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
    heroBanner: {
      backgroundColor: isDark ? colors.card : '#f0f6ff',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : '#c7deff',
      paddingHorizontal: 24,
      paddingVertical: 28,
      alignItems: 'center',
    },
    heroBannerIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? 'rgba(0,102,255,0.15)' : 'rgba(0,102,255,0.08)',
      borderWidth: 1.5,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    heroBannerTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    heroBannerSub: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      maxWidth: 340,
    },
    section: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 8 },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 3,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 16,
    },
    contactRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    contactCard: {
      flex: 1,
      minWidth: 140,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'flex-start',
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
    contactIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    contactCardLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    contactCardValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 18,
    },
    contactCardAction: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    locationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginTop: 10,
    },
    locationIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 13,
      backgroundColor: isDark ? 'rgba(0,184,148,0.15)' : '#e0f7f4',
      justifyContent: 'center',
      alignItems: 'center',
    },
    locationText: { flex: 1 },
    locationLabel: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1 },
    locationValue: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
    quickLinksRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    quickLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1.5,
    },
    quickLinkText: {
      fontSize: 13,
      fontWeight: '600',
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      marginBottom: 14,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    noResults: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 8,
    },
    noResultsText: { fontSize: 14, color: colors.textTertiary },
    ticketCard: {
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      gap: 12,
    },
    ticketInput: {
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
    },
    ticketTextarea: {
      height: 96,
      textAlignVertical: 'top',
    },
    ticketBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 12,
      marginTop: 4,
    },
    ticketBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? '#0d2e1f' : '#ecfdf5',
      borderWidth: 1,
      borderColor: '#10b981',
      borderRadius: 10,
      padding: 12,
    },
    successText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#10b981',
    },
    footerPad: { height: 48 },

    communityCard: {
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(0,229,255,0.2)' : 'rgba(0,150,136,0.2)',
      backgroundColor: isDark ? '#070f1c' : '#f0fffe',
    },
    communityGlow: {
      position: 'absolute' as any, top: 0, left: 0, right: 0, height: 3,
      backgroundColor: '#00e5ff',
    },
    communityHeader: {
      flexDirection: 'row' as any, alignItems: 'center' as any, gap: 14,
      padding: 20, paddingBottom: 16,
    },
    communityIconWrap: {
      width: 52, height: 52, borderRadius: 16,
      justifyContent: 'center' as any, alignItems: 'center' as any,
      backgroundColor: isDark ? 'rgba(0,229,255,0.12)' : 'rgba(37,211,102,0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(0,229,255,0.25)' : 'rgba(37,211,102,0.25)',
    },
    communityHeaderText: { flex: 1 },
    communityTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 2 },
    communitySubtitle: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
    communityDivider: { height: 1, backgroundColor: isDark ? 'rgba(0,229,255,0.08)' : 'rgba(0,150,136,0.12)', marginHorizontal: 20 },
    communityActions: { padding: 16, gap: 10 },
    whatsappBtn: {
      flexDirection: 'row' as any, alignItems: 'center' as any, gap: 12,
      paddingHorizontal: 18, paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: '#25d366',
      shadowColor: '#25d366',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    whatsappBtnText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff' },
    whatsappBtnArrow: { fontSize: 16, color: '#fff', opacity: 0.8 },
    shareBtn: {
      flexDirection: 'row' as any, alignItems: 'center' as any, gap: 12,
      paddingHorizontal: 18, paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(0,229,255,0.1)' : 'rgba(26,115,232,0.08)',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(0,229,255,0.3)' : 'rgba(26,115,232,0.25)',
    },
    shareBtnText: { flex: 1, fontSize: 15, fontWeight: '700', color: isDark ? '#00e5ff' : '#1A73E8' },

    aboutCard: {
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,179,0,0.2)' : 'rgba(245,158,11,0.2)',
      backgroundColor: isDark ? '#0c100a' : '#fffdf0',
    },
    aboutGlow: {
      position: 'absolute' as any, top: 0, left: 0, right: 0, height: 3,
      backgroundColor: '#f59e0b',
    },
    aboutInner: { padding: 20, gap: 16 },
    aboutDevRow: {
      flexDirection: 'row' as any, alignItems: 'center' as any, gap: 14,
    },
    aboutAvatar: {
      width: 56, height: 56, borderRadius: 18,
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
      borderWidth: 2, borderColor: isDark ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.3)',
      justifyContent: 'center' as any, alignItems: 'center' as any,
    },
    aboutAvatarText: { fontSize: 22, fontWeight: '900', color: '#f59e0b' },
    aboutDevInfo: { flex: 1 },
    aboutDevName: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 0.2 },
    aboutDevRole: {
      fontSize: 11, fontWeight: '700', color: '#f59e0b',
      letterSpacing: 1.2, textTransform: 'uppercase' as any, marginTop: 3,
    },
    aboutTagline: {
      fontSize: 13, color: colors.textSecondary, lineHeight: 20,
      fontStyle: 'italic' as any,
    },
    aboutEmailBtn: {
      flexDirection: 'row' as any, alignItems: 'center' as any, gap: 10,
      paddingHorizontal: 14, paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
      borderWidth: 1, borderColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.2)',
    },
    aboutEmailText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#f59e0b' },
    aboutMadeWith: {
      flexDirection: 'row' as any, alignItems: 'center' as any, justifyContent: 'center' as any,
      gap: 6, paddingTop: 4,
    },
    aboutMadeWithText: { fontSize: 12, color: colors.textTertiary },

    shareModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end' as any,
    },
    shareModalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      borderColor: isDark ? 'rgba(0,229,255,0.15)' : colors.border,
      paddingHorizontal: 20,
    },
    shareModalHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: isDark ? 'rgba(0,229,255,0.3)' : colors.border,
      alignSelf: 'center' as any,
      marginTop: 12, marginBottom: 20,
    },
    shareModalHeader: {
      flexDirection: 'row' as any,
      alignItems: 'center' as any,
      gap: 12,
      marginBottom: 20,
    },
    shareModalIconWrap: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: isDark ? 'rgba(0,229,255,0.12)' : 'rgba(26,115,232,0.08)',
      borderWidth: 1, borderColor: isDark ? 'rgba(0,229,255,0.25)' : 'rgba(26,115,232,0.15)',
      justifyContent: 'center' as any, alignItems: 'center' as any,
    },
    shareModalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
    shareModalSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    shareModalClose: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
      justifyContent: 'center' as any, alignItems: 'center' as any,
    },
    shareModalCloseText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

    shareLinkRow: {
      flexDirection: 'row' as any, alignItems: 'center' as any, gap: 12,
      paddingVertical: 14, paddingHorizontal: 16,
      borderRadius: 14, marginBottom: 20,
      backgroundColor: isDark ? 'rgba(0,229,255,0.06)' : 'rgba(26,115,232,0.04)',
      borderWidth: 1, borderColor: isDark ? 'rgba(0,229,255,0.15)' : 'rgba(26,115,232,0.12)',
    },
    shareChannelUrl: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
    shareChannelLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    copyBadge: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
      backgroundColor: isDark ? 'rgba(0,229,255,0.12)' : 'rgba(26,115,232,0.08)',
      borderWidth: 1, borderColor: isDark ? 'rgba(0,229,255,0.3)' : 'rgba(26,115,232,0.2)',
    },
    copyBadgeDone: {
      backgroundColor: 'rgba(16,185,129,0.12)',
      borderColor: 'rgba(16,185,129,0.35)',
    },
    copyBadgeText: { fontSize: 12, fontWeight: '700', color: isDark ? '#00e5ff' : '#1A73E8' },
    copyBadgeTextDone: { color: '#10b981' },

    shareChannelGrid: {
      flexDirection: 'row' as any,
      flexWrap: 'wrap' as any,
      gap: 12,
      marginBottom: 20,
    },
    shareChannelBtn: {
      alignItems: 'center' as any,
      gap: 8,
      width: '30%' as any,
    },
    shareChannelIcon: {
      width: 58, height: 58, borderRadius: 18,
      justifyContent: 'center' as any, alignItems: 'center' as any,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    shareChannelName: {
      fontSize: 12, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' as any,
    },

    systemShareBtn: {
      flexDirection: 'row' as any, alignItems: 'center' as any, justifyContent: 'center' as any,
      gap: 10, paddingVertical: 13,
      borderRadius: 14, borderWidth: 1.5,
      borderColor: isDark ? 'rgba(0,229,255,0.2)' : colors.border,
      marginBottom: 4,
    },
    systemShareBtnText: { fontSize: 14, fontWeight: '700', color: isDark ? '#00e5ff' : '#1A73E8' },
  });

  return (
    <View style={s.page}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerTitleWrap}>
          <Text style={s.headerTitle}>Support & Help</Text>
          <Text style={s.headerSub}>We're here for you</Text>
        </View>
        <HelpCircle size={22} color={colors.primary} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Banner */}
        <View style={s.heroBanner}>
          <View style={s.heroBannerIcon}>
            <HelpCircle size={30} color={colors.primary} />
          </View>
          <Text style={s.heroBannerTitle}>Need Help? We're Here for You!</Text>
          <Text style={s.heroBannerSub}>
            Questions, issues, or suggestions? UniLink support is ready to assist students and messengers quickly and efficiently.
          </Text>
        </View>

        {/* Contact Section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Get in Touch</Text>
          <Text style={s.sectionTitle}>Contact Support</Text>

          <View style={s.contactRow}>
            <TouchableOpacity
              style={[s.contactCard, { borderColor: isDark ? '#1e3a6e' : '#c7deff' }]}
              onPress={handleEmail}
              activeOpacity={0.75}
            >
              <View style={[s.contactIconWrap, { backgroundColor: isDark ? 'rgba(0,102,255,0.15)' : '#e8f0ff' }]}>
                <Mail size={20} color="#0066ff" />
              </View>
              <Text style={s.contactCardLabel}>Email</Text>
              <Text style={s.contactCardValue}>{CONTACT.email}</Text>
              <Text style={[s.contactCardAction, { color: '#0066ff' }]}>Tap to email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.contactCard, { borderColor: isDark ? '#1a3a2a' : '#c6f0e0' }]}
              onPress={handlePhone}
              activeOpacity={0.75}
            >
              <View style={[s.contactIconWrap, { backgroundColor: isDark ? 'rgba(0,184,148,0.15)' : '#e0f7f4' }]}>
                <Phone size={20} color="#00b894" />
              </View>
              <Text style={s.contactCardLabel}>Phone</Text>
              <Text style={s.contactCardValue}>{CONTACT.phone}</Text>
              <Text style={[s.contactCardAction, { color: '#00b894' }]}>Tap to call</Text>
            </TouchableOpacity>
          </View>

          <View style={s.locationCard}>
            <View style={s.locationIconWrap}>
              <MapPin size={22} color="#00b894" />
            </View>
            <View style={s.locationText}>
              <Text style={s.locationLabel}>Location</Text>
              <Text style={s.locationValue}>{CONTACT.location}</Text>
            </View>
          </View>
        </View>

        {/* Quick Links */}
        <View style={[s.section, { paddingTop: 24 }]}>
          <Text style={s.sectionLabel}>Quick Actions</Text>
          <Text style={s.sectionTitle}>Common Issues</Text>

          <View style={s.quickLinksRow}>
            {QUICK_LINKS.map((ql) => {
              const Icon = ql.icon;
              return (
                <TouchableOpacity
                  key={ql.label}
                  style={[s.quickLink, { borderColor: ql.color + '55', backgroundColor: isDark ? ql.color + '15' : ql.color + '0D' }]}
                  onPress={handleEmail}
                  activeOpacity={0.75}
                >
                  <Icon size={15} color={ql.color} />
                  <Text style={[s.quickLinkText, { color: ql.color }]}>{ql.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* FAQ Section */}
        <View style={[s.section, { paddingTop: 24, paddingBottom: 16 }]}>
          <Text style={s.sectionLabel}>Help Center</Text>
          <Text style={s.sectionTitle}>Frequently Asked Questions</Text>

          <View style={s.searchWrap}>
            <Search size={18} color={colors.placeholder} />
            <TextInput
              style={s.searchInput}
              placeholder="Search questions..."
              placeholderTextColor={colors.placeholder}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <View style={s.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  s.categoryChip,
                  {
                    backgroundColor: activeCategory === cat ? colors.primary : 'transparent',
                    borderColor: activeCategory === cat ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text
                  style={[
                    s.categoryChipText,
                    { color: activeCategory === cat ? '#fff' : colors.textSecondary },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filtered.length === 0 ? (
            <View style={s.noResults}>
              <HelpCircle size={36} color={colors.textTertiary} />
              <Text style={s.noResultsText}>No results found for "{search}"</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {filtered.map((faq) => (
                <FAQItem key={faq.id} faq={faq} colors={colors} isDark={isDark} />
              ))}
            </View>
          )}
        </View>

        {/* Community & Share */}
        <View style={[s.section, { paddingTop: 24 }]}>
          <Text style={s.sectionLabel}>Community</Text>
          <Text style={s.sectionTitle}>Join & Share UniLink</Text>

          <View style={s.communityCard}>
            <View style={s.communityGlow} />
            <View style={s.communityHeader}>
              <View style={s.communityIconWrap}>
                <Users size={26} color={isDark ? '#00e5ff' : '#25d366'} />
              </View>
              <View style={s.communityHeaderText}>
                <Text style={s.communityTitle}>UniLink Community</Text>
                <Text style={s.communitySubtitle}>
                  Join our WhatsApp group for updates, tips, and connecting with fellow students.
                </Text>
              </View>
            </View>

            <View style={s.communityDivider} />

            <View style={s.communityActions}>
              <TouchableOpacity style={s.whatsappBtn} onPress={handleJoinWhatsApp} activeOpacity={0.8}>
                <MessageCircle size={22} color="#fff" />
                <Text style={s.whatsappBtnText}>Join WhatsApp Group</Text>
                <Text style={s.whatsappBtnArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.shareBtn} onPress={() => setShowShareModal(true)} activeOpacity={0.8}>
                <Share2 size={20} color={isDark ? '#00e5ff' : '#1A73E8'} />
                <Text style={s.shareBtnText}>Share UniLink with Friends</Text>
                <ExternalLink size={16} color={isDark ? '#00e5ff' : '#1A73E8'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* About / Developer */}
        <View style={[s.section, { paddingTop: 24 }]}>
          <Text style={s.sectionLabel}>About</Text>
          <Text style={s.sectionTitle}>Meet the Developer</Text>

          <View style={s.aboutCard}>
            <View style={s.aboutGlow} />
            <View style={s.aboutInner}>
              <View style={s.aboutDevRow}>
                <View style={s.aboutAvatar}>
                  <Text style={s.aboutAvatarText}>S</Text>
                </View>
                <View style={s.aboutDevInfo}>
                  <Text style={s.aboutDevName}>{DEVELOPER.name}</Text>
                  <Text style={s.aboutDevRole}>{DEVELOPER.role}</Text>
                </View>
              </View>

              <Text style={s.aboutTagline}>
                "Built UniLink to make campus life easier — so students can spend less time running errands and more time focused on what matters."
              </Text>

              <TouchableOpacity
                style={s.aboutEmailBtn}
                onPress={() => Linking.openURL(`mailto:${DEVELOPER.email}`)}
                activeOpacity={0.8}
              >
                <Mail size={16} color="#f59e0b" />
                <Text style={s.aboutEmailText}>{DEVELOPER.email}</Text>
                <ExternalLink size={14} color="#f59e0b" />
              </TouchableOpacity>

              <View style={s.aboutMadeWith}>
                <Code2 size={14} color={colors.textTertiary} />
                <Text style={s.aboutMadeWithText}>Made with</Text>
                <Heart size={13} color="#ef4444" />
                <Text style={s.aboutMadeWithText}>for students in Zimbabwe</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Submit Ticket */}
        <View style={[s.section, { paddingTop: 24 }]}>
          <Text style={s.sectionLabel}>Still Need Help?</Text>
          <Text style={s.sectionTitle}>Submit a Ticket</Text>

          <View style={s.ticketCard}>
            {ticketSent && (
              <View style={s.successBanner}>
                <Send size={16} color="#10b981" />
                <Text style={s.successText}>Your ticket has been sent! We'll get back to you soon.</Text>
              </View>
            )}
            <TextInput
              style={s.ticketInput}
              placeholder="Your name"
              placeholderTextColor={colors.placeholder}
              value={ticketName}
              onChangeText={setTicketName}
            />
            <TextInput
              style={s.ticketInput}
              placeholder="Your email address"
              placeholderTextColor={colors.placeholder}
              value={ticketEmail}
              onChangeText={setTicketEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={[s.ticketInput, s.ticketTextarea]}
              placeholder="Describe your issue or question..."
              placeholderTextColor={colors.placeholder}
              value={ticketMsg}
              onChangeText={setTicketMsg}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={[s.ticketBtn, { opacity: ticketName && ticketEmail && ticketMsg ? 1 : 0.5 }]}
              onPress={handleTicketSubmit}
              disabled={!ticketName || !ticketEmail || !ticketMsg}
            >
              <Send size={18} color="#fff" />
              <Text style={s.ticketBtnText}>Send Ticket</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.footerPad} />
      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <TouchableOpacity
          style={s.shareModalOverlay}
          activeOpacity={1}
          onPress={() => setShowShareModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.shareModalSheet}>
            <View style={s.shareModalHandle} />

            <View style={s.shareModalHeader}>
              <View style={s.shareModalIconWrap}>
                <Share2 size={22} color={isDark ? '#00e5ff' : '#1A73E8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.shareModalTitle}>Share UniLink</Text>
                <Text style={s.shareModalSub}>Choose how to share with friends</Text>
              </View>
              <TouchableOpacity style={s.shareModalClose} onPress={() => setShowShareModal(false)}>
                <Text style={s.shareModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Copy Link */}
            <TouchableOpacity style={s.shareLinkRow} onPress={handleCopyLink} activeOpacity={0.8}>
              <View style={[s.shareChannelIcon, { backgroundColor: isDark ? 'rgba(0,229,255,0.12)' : '#e8f0ff' }]}>
                <ExternalLink size={20} color={isDark ? '#00e5ff' : '#1A73E8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.shareChannelLabel}>Copy Link</Text>
                <Text style={s.shareChannelUrl} numberOfLines={1}>{APP_URL}</Text>
              </View>
              <View style={[s.copyBadge, linkCopied && s.copyBadgeDone]}>
                <Text style={[s.copyBadgeText, linkCopied && s.copyBadgeTextDone]}>
                  {linkCopied ? 'Copied!' : 'Copy'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={s.shareChannelGrid}>
              {/* WhatsApp */}
              <TouchableOpacity style={s.shareChannelBtn} onPress={handleShareWhatsApp} activeOpacity={0.8}>
                <View style={[s.shareChannelIcon, { backgroundColor: '#e8faf0' }]}>
                  <MessageCircle size={24} color="#25d366" />
                </View>
                <Text style={s.shareChannelName}>WhatsApp</Text>
              </TouchableOpacity>

              {/* Facebook */}
              <TouchableOpacity style={s.shareChannelBtn} onPress={handleShareFacebook} activeOpacity={0.8}>
                <View style={[s.shareChannelIcon, { backgroundColor: '#e8f0fb' }]}>
                  <Users size={24} color="#1877f2" />
                </View>
                <Text style={s.shareChannelName}>Facebook</Text>
              </TouchableOpacity>

              {/* X / Twitter */}
              <TouchableOpacity style={s.shareChannelBtn} onPress={handleShareTwitter} activeOpacity={0.8}>
                <View style={[s.shareChannelIcon, { backgroundColor: isDark ? '#111' : '#f0f0f0' }]}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#fff' : '#000' }}>𝕏</Text>
                </View>
                <Text style={s.shareChannelName}>X (Twitter)</Text>
              </TouchableOpacity>

              {/* Telegram */}
              <TouchableOpacity style={s.shareChannelBtn} onPress={handleShareTelegram} activeOpacity={0.8}>
                <View style={[s.shareChannelIcon, { backgroundColor: '#e8f4fb' }]}>
                  <Send size={22} color="#0088cc" />
                </View>
                <Text style={s.shareChannelName}>Telegram</Text>
              </TouchableOpacity>

              {/* Email */}
              <TouchableOpacity style={s.shareChannelBtn} onPress={handleShareEmail} activeOpacity={0.8}>
                <View style={[s.shareChannelIcon, { backgroundColor: '#fff3e8' }]}>
                  <Mail size={22} color="#f59e0b" />
                </View>
                <Text style={s.shareChannelName}>Email</Text>
              </TouchableOpacity>

              {/* SMS */}
              <TouchableOpacity style={s.shareChannelBtn} onPress={handleShareSMS} activeOpacity={0.8}>
                <View style={[s.shareChannelIcon, { backgroundColor: '#f0ffe8' }]}>
                  <MessageCircle size={22} color="#00b894" />
                </View>
                <Text style={s.shareChannelName}>SMS</Text>
              </TouchableOpacity>
            </View>

            {Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator) ? (
              <TouchableOpacity style={s.systemShareBtn} onPress={handleSystemShare} activeOpacity={0.8}>
                <Share2 size={18} color={isDark ? '#00e5ff' : '#1A73E8'} />
                <Text style={s.systemShareBtnText}>More options...</Text>
              </TouchableOpacity>
            ) : null}

            <View style={{ height: 24 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  faqCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  faqIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faqHeaderMid: { flex: 1 },
  faqCategory: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  faqChevron: { paddingLeft: 4 },
  faqAnswer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  faqAnswerText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
