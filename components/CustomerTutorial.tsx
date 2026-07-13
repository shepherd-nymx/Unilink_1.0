import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import {
  Search,
  ChevronDown,
  Plus,
  ShoppingCart,
  Car,
  CreditCard,
  Users,
  MapPin,
  Package,
  MessageCircle,
  History,
  User,
  X,
  ChevronRight,
  ChevronLeft,
  Zap,
  Camera,
  Star,
  Bell,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');

type Step = {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
  accentColor: string;
};

const STEPS: Step[] = [
  {
    icon: null,
    title: 'Welcome to UniLink!',
    description:
      'This quick tour will show you how to place your first grocery delivery order. It only takes a minute.',
    accentColor: '#1A73E8',
  },
  {
    icon: null,
    title: 'Search for Items',
    description:
      'Use the search bar at the top to quickly find any grocery item by name. Type a few letters and the list filters instantly.',
    tip: 'Try typing "milk" or "bread" to see results.',
    accentColor: '#1A73E8',
  },
  {
    icon: null,
    title: 'Browse by Category',
    description:
      'Groceries are grouped into categories like Fruits, Vegetables, Dairy, and more. Tap any category header to expand it and see all items inside.',
    tip: 'Each category shows how many items it contains.',
    accentColor: '#10b981',
  },
  {
    icon: null,
    title: 'Add Items to Your Order',
    description:
      'Inside a category, tap the + button next to any item to add it. Use the – button to remove quantity. The price updates automatically as you build your cart.',
    accentColor: '#10b981',
  },
  {
    icon: null,
    title: 'Add Custom Items',
    description:
      "Can't find what you need in the list? Tap \"Add Custom Item\" to request any product by name with an approximate price. Great for specific brands or unlisted goods.",
    tip: 'Use this for toiletries, snacks, or anything not in the catalogue.',
    accentColor: '#f59e0b',
  },
  {
    icon: null,
    title: 'Order Summary',
    description:
      'Once you add items, an order summary appears at the bottom of the screen. It shows your subtotal, the delivery fee, and the combined total.',
    tip: 'Delivery fees vary based on order size and driver type.',
    accentColor: '#1A73E8',
  },
  {
    icon: null,
    title: 'Delivery Method',
    description:
      'Choose between Vehicle Delivery (faster, for larger orders) and Walking Delivery (best for nearby, lighter orders). This affects available drivers and the delivery fee.',
    accentColor: '#6366f1',
  },
  {
    icon: null,
    title: 'Payment Method',
    description:
      'Select how you want to pay:\n\n• Pay on Delivery — hand cash to the driver when they arrive.\n• EcoCash — send mobile money before delivery begins.',
    tip: 'EcoCash orders require you to send payment first.',
    accentColor: '#10b981',
  },
  {
    icon: null,
    title: 'Attach an Item Image',
    description:
      'Optionally take or upload a photo of your shopping list or a reference image. This helps the driver identify exactly what you need.',
    tip: 'Useful for specific product packaging or handwritten lists.',
    accentColor: '#f59e0b',
  },
  {
    icon: null,
    title: 'Choose a Driver',
    description:
      'Tap the driver selector to choose how your order is handled:\n\n• Direct Driver — pick a specific trusted driver from the list.\n• Open Request — broadcast your order to all available drivers and pick from whoever responds.',
    tip: 'Open Request is great when you want options and the best rate.',
    accentColor: '#1A73E8',
  },
  {
    icon: null,
    title: 'Open Request Flow',
    description:
      'When you use Open Request, a waiting screen appears showing drivers who express interest in real time. Review their profiles and ratings, then tap "Select" to secure one driver.',
    tip: 'Once you select a driver, all other responses are automatically cancelled.',
    accentColor: '#00b894',
  },
  {
    icon: null,
    title: 'Preferred Shops',
    description:
      'Optionally enter the name of a shop you prefer your driver to visit (e.g. "Pick n Pay" or "Spar"). If left blank, the driver will use their best judgement.',
    accentColor: '#f59e0b',
  },
  {
    icon: null,
    title: 'Confirm Your Location',
    description:
      'Before placing your order, confirm your delivery address. Tap the location box to adjust it on a map. Make sure your pin is placed at the right spot so the driver can find you.',
    tip: 'You can save a custom address or use your GPS location.',
    accentColor: '#ef4444',
  },
  {
    icon: null,
    title: 'Place Your Order',
    description:
      'Tap the green "Place Order" button when everything looks good. Your order is sent to the driver (or broadcast to all drivers for open requests).',
    accentColor: '#10b981',
  },
  {
    icon: null,
    title: 'Chat with Your Driver',
    description:
      'After your order is accepted, use the Chat button at the bottom of the screen to message your driver directly. Ask for updates, clarify items, or share access codes.',
    accentColor: '#1A73E8',
  },
  {
    icon: null,
    title: 'Track Your Orders',
    description:
      'Tap the Orders icon at the bottom to see all your current and past deliveries. You can also rate your driver after a completed order.',
    accentColor: '#10b981',
  },
  {
    icon: null,
    title: "You're All Set!",
    description:
      'That covers everything. Start by browsing the categories, adding items, and placing your first order. You can replay this tutorial anytime from the Help button.',
    accentColor: '#1A73E8',
  },
];

const STEP_ICONS: React.ReactNode[] = [
  null,
  <Search size={28} color="#1A73E8" />,
  <ChevronDown size={28} color="#10b981" />,
  <Plus size={28} color="#10b981" />,
  <Zap size={28} color="#f59e0b" />,
  <ShoppingCart size={28} color="#1A73E8" />,
  <Car size={28} color="#6366f1" />,
  <CreditCard size={28} color="#10b981" />,
  <Camera size={28} color="#f59e0b" />,
  <Users size={28} color="#1A73E8" />,
  <Zap size={28} color="#00b894" />,
  <Star size={28} color="#f59e0b" />,
  <MapPin size={28} color="#ef4444" />,
  <Package size={28} color="#10b981" />,
  <MessageCircle size={28} color="#1A73E8" />,
  <History size={28} color="#10b981" />,
  <Bell size={28} color="#1A73E8" />,
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function CustomerTutorial({ visible, onClose }: Props) {
  const { isDark } = useTheme();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const BG = isDark ? '#060f1e' : '#ffffff';
  const CARD = isDark ? '#0d1b2e' : '#f8fafc';
  const TX = isDark ? '#e2f0ff' : '#0f172a';
  const TX2 = isDark ? '#4a7a9b' : '#64748b';
  const BORDER = isDark ? '#1e3a5f' : '#e2e8f0';

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const animateTransition = (direction: 'forward' | 'back', callback: () => void) => {
    const toValue = direction === 'forward' ? -30 : 30;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(direction === 'forward' ? 30 : -30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  };

  const goNext = () => {
    if (step < STEPS.length - 1) {
      animateTransition('forward', () => setStep(s => s + 1));
    } else {
      onClose();
    }
  };

  const goBack = () => {
    if (step > 0) {
      animateTransition('back', () => setStep(s => s - 1));
    }
  };

  const current = STEPS[step];
  const accent = current.accentColor;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: BG, borderColor: BORDER }]}>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: CARD, borderColor: BORDER }]} onPress={onClose}>
            <X size={18} color={TX2} />
          </TouchableOpacity>

          <View style={styles.progressRow}>
            {STEPS.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => animateTransition(i > step ? 'forward' : 'back', () => setStep(i))}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: i === step ? accent : i < step ? accent + '55' : BORDER,
                    width: i === step ? 18 : 6,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.stepCounter, { color: TX2 }]}>
            {step + 1} of {STEPS.length}
          </Text>

          <Animated.View
            style={[
              styles.contentArea,
              { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: accent + '18', borderColor: accent + '33' }]}>
              {STEP_ICONS[step] ?? <Bell size={28} color={accent} />}
            </View>

            <Text style={[styles.title, { color: TX }]}>{current.title}</Text>
            <Text style={[styles.description, { color: TX2 }]}>{current.description}</Text>

            {current.tip && (
              <View style={[styles.tipBox, { backgroundColor: accent + '0f', borderColor: accent + '33' }]}>
                <Text style={[styles.tipLabel, { color: accent }]}>Tip</Text>
                <Text style={[styles.tipText, { color: isDark ? '#a0c4e0' : '#475569' }]}>{current.tip}</Text>
              </View>
            )}
          </Animated.View>

          <View style={styles.actions}>
            {!isFirst ? (
              <TouchableOpacity
                style={[styles.backBtn, { backgroundColor: CARD, borderColor: BORDER }]}
                onPress={goBack}
              >
                <ChevronLeft size={18} color={TX2} />
                <Text style={[styles.backBtnText, { color: TX2 }]}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: accent }]}
              onPress={goNext}
            >
              <Text style={styles.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
              {!isLast && <ChevronRight size={18} color="#fff" />}
            </TouchableOpacity>
          </View>

          {!isLast && (
            <TouchableOpacity onPress={onClose} style={styles.skipRow}>
              <Text style={[styles.skipText, { color: TX2 }]}>Skip tutorial</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 20,
    paddingBottom: 36,
    paddingHorizontal: 22,
    minHeight: H * 0.55,
    maxHeight: H * 0.82,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  progressDot: {
    height: 6,
    borderRadius: 3,
  },
  stepCounter: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  contentArea: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  tipBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    width: '100%',
    gap: 4,
  },
  tipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tipText: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  skipRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
