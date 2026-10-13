import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Shield, RefreshCcw, FileText } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';

const LAST_UPDATED = '13 October 2026';

type PolicySection = { heading: string; body: string[] };

const PRIVACY_POLICY: PolicySection[] = [
  {
    heading: '1. Who We Are',
    body: [
      'UniLink ("we", "us", "our") is operated by Future Pulse Investments, based in Bulawayo, Zimbabwe. We provide a platform that connects shoppers with independent messengers who deliver groceries and other items.',
      'We are committed to protecting your personal information in line with the Cyber and Data Protection Act [Chapter 12:07] of Zimbabwe.',
    ],
  },
  {
    heading: '2. Information We Collect',
    body: [
      'Registration details: your full name, phone number, email address, university or campus location, and login credentials.',
      'Order details: items ordered, delivery addresses, delivery instructions, and order history.',
      'Location data: GPS coordinates, only where you grant permission, used to match you with nearby messengers and to route deliveries.',
      'Device and usage data: device type, app version, IP address, and interaction logs used for security and to improve the platform.',
      'Communications: messages you send through the in-app chat.',
    ],
  },
  {
    heading: '3. How We Use Your Information',
    body: [
      'We use your information to create and manage your account, match you with available messengers, process and track orders, send you order and account notifications, prevent fraud, comply with legal obligations, and improve the service.',
      'We do not sell or rent your personal information to third parties for marketing purposes.',
    ],
  },
  {
    heading: '4. Sharing of Information',
    body: [
      'Your name, delivery address, and phone number are shared with the messenger assigned to your order so they can complete the delivery.',
      'We may share information with payment providers (such as Paynow) to process payments you request, and with authorities where the law requires it.',
      'We never share more information than is necessary for the task at hand.',
    ],
  },
  {
    heading: '5. Data Storage and Security',
    body: [
      'Your data is stored on secure, access-controlled servers. Passwords are stored using encryption, and access to personal data is limited to what is needed to run the service.',
      'While no system is perfectly secure, we take reasonable technical and organisational measures to protect your information.',
    ],
  },
  {
    heading: '6. Data Retention',
    body: [
      'We keep your account information for as long as your account is active. Order and transaction records are retained as required for accounting and legal purposes.',
      'You may request deletion of your account and personal data at any time through the Privacy Centre or by contacting support. Some records may be retained where the law requires it.',
    ],
  },
  {
    heading: '7. Your Rights',
    body: [
      'You have the right to access the personal information we hold about you, to correct inaccurate information, to request deletion of your data, and to object to or restrict certain processing.',
      'To exercise any of these rights, use the Privacy Centre in the app or contact us at shepherdmutevedzi@gmail.com.',
    ],
  },
  {
    heading: '8. Contact',
    body: [
      'For any privacy questions or concerns, contact us at shepherdmutevedzi@gmail.com or call 0782627990. We aim to respond within 24 hours.',
    ],
  },
];

const REFUND_POLICY: PolicySection[] = [
  {
    heading: '1. Overview',
    body: [
      'This Refund Policy applies to all orders placed through the UniLink platform. UniLink is a technology platform that connects you with independent messengers; refunds for the cost of goods are coordinated between you, the messenger, and the shop where applicable.',
    ],
  },
  {
    heading: '2. When You Are Eligible for a Refund',
    body: [
      'An item you ordered could not be sourced and you had already paid for it through Paynow.',
      'You were charged the wrong amount for an order.',
      'Your order was cancelled by the messenger or the shop after payment was made.',
      'Items delivered were significantly different from what you ordered, or were damaged or missing on arrival.',
      'A delivery was never completed and the messenger cannot be reached.',
    ],
  },
  {
    heading: '3. How to Request a Refund',
    body: [
      'Contact your messenger through the in-app chat first — most issues are resolved immediately.',
      'If the issue is not resolved, submit a ticket through the Support page or email shepherdmutevedzi@gmail.com with your order ID, a description of the problem, and photos of the items if the issue is about damaged or wrong goods.',
      'Refund requests should be made within 24 hours of delivery (or the expected delivery time) so we can verify the details with the messenger.',
    ],
  },
  {
    heading: '4. How Refunds Are Processed',
    body: [
      'Paynow payments: approved refunds are returned to the original payment method, typically within 3 to 5 business days depending on your bank or mobile money provider.',
      'Cash on delivery: no refund is needed if you have not yet paid. If you already handed over cash and the issue qualifies for a refund, the messenger will return the amount directly, or we will coordinate the repayment.',
      'Partial refunds may apply where only some items in the order were affected.',
    ],
  },
  {
    heading: '5. Non-Refundable Situations',
    body: [
      'Change of mind after the messenger has already purchased the items.',
      'Delays caused by factors outside the platform\u2019s control (weather, traffic, unreachable phone, or an incorrect address you provided).',
      'Requests made more than 24 hours after delivery without a valid reason.',
      'Perishable goods that were accepted at delivery in good condition.',
    ],
  },
  {
    heading: '6. Order Cancellations',
    body: [
      'You may cancel an order free of charge at any point before a messenger accepts it or starts purchasing your items.',
      'Once a messenger has begun purchasing, cancellation may still be possible but you may be asked to cover the cost of any items already bought.',
    ],
  },
  {
    heading: '7. Disputes',
    body: [
      'If you and the messenger cannot agree on a resolution, UniLink will review the order details, chat history, and any evidence provided and make a fair final decision.',
      'Contact us at shepherdmutevedzi@gmail.com or call 0782627990 for help with any dispute.',
    ],
  },
];

const POLICIES = {
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How we collect, use, and protect your information',
    icon: Shield,
    color: '#0066ff',
    sections: PRIVACY_POLICY,
  },
  refund: {
    title: 'Refund Policy',
    subtitle: 'When and how you can get your money back',
    icon: RefreshCcw,
    color: '#f59e0b',
    sections: REFUND_POLICY,
  },
} as const;

type PolicyKey = keyof typeof POLICIES;

export default function PoliciesPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();

  const requested = String(params.type || 'privacy');
  const [current, setCurrent] = useState<PolicyKey>(
    requested === 'refund' ? 'refund' : 'privacy'
  );

  const policy = POLICIES[current];
  const PolicyIcon = policy.icon;

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? colors.card : '#f0f4ff', borderColor: colors.border }]}
          onPress={() => router.back()}
          activeOpacity={0.75}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{policy.title}</Text>
          <Text style={[styles.headerSub, { color: colors.textTertiary }]}>Future Pulse Investments</Text>
        </View>
        <PolicyIcon size={22} color={policy.color} />
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        {(Object.keys(POLICIES) as PolicyKey[]).map((key) => {
          const p = POLICIES[key];
          const Icon = p.icon;
          const active = current === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? p.color : 'transparent',
                  borderColor: active ? p.color : colors.border,
                },
              ]}
              onPress={() => setCurrent(key)}
              activeOpacity={0.75}
            >
              <Icon size={15} color={active ? '#fff' : p.color} />
              <Text style={[styles.tabText, { color: active ? '#fff' : colors.textSecondary }]}>{p.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.updatedNote, { color: colors.textTertiary }]}>
          Last updated {LAST_UPDATED}
        </Text>
        <View style={[styles.introCard, { backgroundColor: isDark ? colors.card : '#f8faff', borderColor: colors.border }]}>
          <View style={[styles.introIcon, { backgroundColor: isDark ? policy.color + '22' : policy.color + '14' }]}>
            <FileText size={20} color={policy.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.introTitle, { color: colors.text }]}>{policy.title}</Text>
            <Text style={[styles.introSub, { color: colors.textSecondary }]}>{policy.subtitle}</Text>
          </View>
        </View>

        {policy.sections.map((section) => (
          <View
            key={section.heading}
            style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.sectionHeading, { color: policy.color }]}>{section.heading}</Text>
            {section.body.map((para, i) => (
              <Text key={i} style={[styles.sectionBody, { color: colors.textSecondary }]}>
                {para}
              </Text>
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            Future Pulse Investments — Bulawayo, Zimbabwe
          </Text>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            Questions? shepherdmutevedzi@gmail.com | 0782627990
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 52,
    paddingBottom: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 1 },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  updatedNote: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase' as any,
    letterSpacing: 1,
    marginBottom: 12,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  introTitle: { fontSize: 16, fontWeight: '800' },
  introSub: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  sectionCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  footer: { alignItems: 'center', gap: 4, paddingTop: 16 },
  footerText: { fontSize: 12, textAlign: 'center' },
});
