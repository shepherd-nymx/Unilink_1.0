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
  Truck,
  Package,
  MessageCircle,
  Users,
  Settings,
  CheckCircle,
  Bell,
  Zap,
  CreditCard,
  DollarSign,
  MapPin,
  Key,
  Clock,
  Star,
  Store,
  X,
} from 'lucide-react-native';

const { width: W, height: H } = Dimensions.get('window');

const CYAN = '#00e5ff';
const GREEN = '#00ff88';
const AMBER = '#ffb300';
const BG = '#030810';
const CARD = '#0b1628';
const TEXT = '#d0eaff';
const TEXT2 = '#4a7a9b';
const BORDER = '#1e3a5f';

type Step = {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
  accentColor: string;
};

const STEPS: Step[] = [
  {
    icon: <Truck size={28} color={CYAN} />,
    title: 'Welcome, Driver!',
    description:
      'This tour walks you through every part of your driver portal — what each section does, why the information matters, and how to get the most out of it. It only takes a minute.',
    accentColor: CYAN,
  },
  {
    icon: <Bell size={28} color={AMBER} />,
    title: 'Dashboard — Your Home Base',
    description:
      'The dashboard is the first screen you see. New orders appear here automatically while you are online.\n\n• Active Orders (top) — jobs you have already accepted.\n• Pending Orders (below) — new jobs waiting for a driver. Act fast: unaccepted orders expire after 10 minutes.',
    tip: 'Keep this screen open while you work — a notification pops up the moment an order arrives.',
    accentColor: AMBER,
  },
  {
    icon: <CheckCircle size={28} color={GREEN} />,
    title: 'Handling an Active Order',
    description:
      'Each active order card shows the customer, phone number (tap to call), items, total and delivery fee.\n\n1. Tap "Confirm Payment" once you have the customer\'s payment — this lets you proceed.\n2. Tap "Maps" to open the delivery location in Google Maps.\n3. Tap "Delivered" when the job is done.\n\nMade a mistake? You get a 10-minute undo window after marking delivered.',
    tip: 'Always confirm payment before heading out — it protects you and the customer.',
    accentColor: GREEN,
  },
  {
    icon: <Zap size={28} color="#00b894" />,
    title: 'Pending Orders: Direct vs Open',
    description:
      'There are two kinds of pending orders:\n\n• Direct orders — the customer chose YOU personally. Tap "Accept" to take the job.\n\n• Open Requests (marked with a green badge) — broadcast to all drivers. Tap to express interest. The customer then reviews every interested driver and picks one.',
    tip: 'On open requests, submitting interest does not guarantee the job — the shopper chooses.',
    accentColor: '#00b894',
  },
  {
    icon: <Truck size={28} color={CYAN} />,
    title: 'Requests Tab',
    description:
      'The Requests tab (truck icon, bottom-left) shows customer delivery requests — shopping lists that customers post with an approximate price.\n\nYou act as the messenger: you look for the items, chat with the customer about availability and real prices, and deliver what you find. Some items may not be found, and prices can change from the estimate — communicate this through chat.',
    tip: 'Requests are a great way to earn when there are no direct orders.',
    accentColor: CYAN,
  },
  {
    icon: <MessageCircle size={28} color={CYAN} />,
    title: 'Chat Tab',
    description:
      'Chat is where you talk directly with customers about their orders.\n\nUse it to confirm items, agree on real prices for request-based shopping, share your location or ETA, and sort out access details. A flashing dot means unread messages.',
    tip: 'Fast, clear replies lead to better ratings and more repeat customers.',
    accentColor: CYAN,
  },
  {
    icon: <Users size={28} color={CYAN} />,
    title: 'Customers Tab',
    description:
      'Here you can see your customer history — everyone you have delivered to, with their delivery records.\n\nIt is your personal track record: use it to follow up with regulars and keep track of your completed jobs.',
    accentColor: CYAN,
  },
  {
    icon: <Store size={28} color={CYAN} />,
    title: 'Shop Deliveries Tab',
    description:
      'This tab handles deliveries assigned by registered shops. It has two sub-tabs:\n\n• Orders — shop orders assigned to you, ready to pick up and deliver.\n• Shops — the list of shops you work with.\n\nShop-assigned orders also trigger an email alert if you set a Notification Email in Settings.',
    accentColor: CYAN,
  },
  {
    icon: <Settings size={28} color={CYAN} />,
    title: 'Settings — Set Yourself Up',
    description:
      'Settings is where customers find and trust you. Every field matters:\n\n• Profile Picture — builds instant trust.\n• Appearance — light or dark mode.\n• Availability & Schedule — when you take orders.\n• WhatsApp & Notification Email — how you get alerted.\n• Delivery Types, Payment Methods, Max Distance & Fees — what you offer and at what price.',
    tip: 'Fill in everything — complete profiles get picked far more often.',
    accentColor: CYAN,
  },
  {
    icon: <Clock size={28} color={AMBER} />,
    title: 'Availability & Schedule',
    description:
      'The Availability switch is your online/offline toggle — only available drivers receive new orders.\n\nYour Schedule tells the system your working hours and days. Set them accurately so orders only arrive when you can actually deliver.',
    tip: 'Going off duty? Switch availability off so customers are not left waiting.',
    accentColor: AMBER,
  },
  {
    icon: <CreditCard size={28} color={CYAN} />,
    title: 'Delivery Types, Payments & Distance',
    description:
      '• Delivery Types — choose Walking, Vehicle, or both. Customers filter drivers by this.\n• Payment Methods — tick Cash and/or Paynow. Only the methods you accept are offered to customers.\n• Max Distance — how far you are willing to travel (km). Orders beyond it are hidden from you.',
    accentColor: CYAN,
  },
  {
    icon: <DollarSign size={28} color={GREEN} />,
    title: 'Delivery Fees',
    description:
      'Set your fee for each order-value tier (e.g. up to $10, $10–$20, ...). Vehicle drivers have extra tiers for larger orders.\n\nThese fees are shown to customers when they choose a driver — competitive, honest fees win more jobs. You can update them anytime.',
    tip: 'Check what other drivers charge in your area and price yourself sensibly.',
    accentColor: GREEN,
  },
  {
    icon: <Key size={28} color={GREEN} />,
    title: 'Your Access Key & Location',
    description:
      'Your monthly access key (shown in the header) keeps your account active. When it expires the portal pauses — contact your admin to renew; a warning appears 7 days before.\n\nThe location pill in the header lets you switch which university campus you operate in, so you only see orders near you.',
    accentColor: GREEN,
  },
  {
    icon: <Star size={28} color={AMBER} />,
    title: "You're All Set!",
    description:
      'Deliver on time, communicate clearly, and collect good ratings — highly rated drivers get picked first for open requests and direct orders.\n\nYou can replay this tutorial anytime from the help button in the header. Good luck out there!',
    accentColor: AMBER,
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function DriverTutorial({ visible, onClose }: Props) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

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
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={18} color={TEXT2} />
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

          <Text style={styles.stepCounter}>
            {step + 1} of {STEPS.length}
          </Text>

          <Animated.View
            style={[
              styles.contentArea,
              { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: accent + '18', borderColor: accent + '33' }]}>
              {current.icon}
            </View>

            <Text style={styles.title}>{current.title}</Text>
            <ScrollView
              style={{ maxHeight: H * 0.32 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.description}>{current.description}</Text>
            </ScrollView>

            {current.tip && (
              <View style={[styles.tipBox, { backgroundColor: accent + '0f', borderColor: accent + '33' }]}>
                <Text style={[styles.tipLabel, { color: accent }]}>Tip</Text>
                <Text style={styles.tipText}>{current.tip}</Text>
              </View>
            )}
          </Animated.View>

          <View style={styles.actions}>
            {!isFirst ? (
              <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.8}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: accent + '1a', borderColor: accent + '55' }]}
              onPress={goNext}
              activeOpacity={0.85}
            >
              <Text style={[styles.nextBtnText, { color: accent }]}>
                {isLast ? 'Get Started' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
    padding: 24,
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  progressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  progressDot: {
    height: 6,
    borderRadius: 3,
  },
  stepCounter: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT2,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 12,
  },
  contentArea: {
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13,
    lineHeight: 21,
    color: TEXT2,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 4,
    width: '100%',
  },
  tipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: TEXT,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  backBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT2,
  },
  nextBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
