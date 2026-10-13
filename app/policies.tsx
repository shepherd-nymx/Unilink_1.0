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
      'UniLink ("we", "us", "our") is a delivery platform operated by Future Pulse Investments, based in Bulawayo, Zimbabwe. We connect shoppers with independent messengers who deliver groceries and other items.',
      'Future Pulse Investments is the responsible party for your personal information under the Cyber and Data Protection Act [Chapter 12:07] ("the Act"). We collect and process your information only for the purposes described in this policy, and only to the extent needed to run the service.',
    ],
  },
  {
    heading: '2. What We Collect and Why — Data by Data',
    body: [
      'Full name and phone number — We need these to create your account and verify who you are. Your name and number are shared with the messenger delivering your order so they can find you and call you at the gate or on arrival. Without them, deliveries cannot be completed.',
      'Email address — Used to send you order confirmations, receipts, payment notifications, and account security messages. It also serves as a recovery point if you lose access to your account.',
      'Login credentials (username and password) — These protect your account from unauthorised access. Your password is stored using one-way encryption and is never visible to our staff.',
      'University or campus location — UniLink operates around specific campuses. Knowing your campus lets us show you messengers and shops that actually serve your area, and keeps delivery fees fair and accurate.',
      'Delivery address and GPS coordinates — When you place an order we need to know where to bring it. GPS location is collected only with your permission (you can deny the permission in your device settings) and is used to pin the delivery point, help messengers navigate, and match you with nearby messengers. We do not track your location in the background when you are not using the app.',
      'Order details (items, amounts, payment option, order history) — These records let you and us track what was ordered, resolve disputes, process refunds, and meet our record-keeping obligations.',
      'Payment information — If you pay through Paynow, your payment is processed by Paynow (Pvt) Ltd. We never see or store your card numbers or mobile money PINs; we only receive confirmation that a payment succeeded and a transaction reference.',
      'In-app chat messages — Conversations between you, messengers, and shops are stored so you can refer back to them, and so we can investigate reports of misconduct, disputes, or fraud.',
      'Device and technical data (device type, app version, IP address, push notification tokens) — Used to deliver notifications about your orders, keep the platform secure, diagnose crashes and problems, and prevent abuse such as fake accounts.',
      'Profile pictures, national ID photos, and vehicle details (messengers only) — Verification documents are collected from messengers to confirm their identity before they can accept orders. This protects shoppers and is required for trust and safety on the platform.',
    ],
  },
  {
    heading: '3. What We Do NOT Do With Your Data',
    body: [
      'We do not sell or rent your personal information to anyone.',
      'We do not use your personal information for advertising, and we do not share it with advertisers.',
      'We do not read your private messages outside of resolving a reported dispute, a support ticket you raised, or a legal obligation.',
      'We do not collect more information than the specific purpose requires. Where a permission (such as location or camera) is optional, the app works without it — you just may lose some features.',
    ],
  },
  {
    heading: '4. Who We Share Information With, and Why',
    body: [
      'Messengers — For each order, the assigned messenger receives your name, delivery location, and phone number. This is the minimum needed to complete your delivery. Messengers do not see your order history with other messengers, your payment details, or your password.',
      'Shops — When you order from a marketplace shop, the shop sees your order items and your name so they can prepare it.',
      'Paynow (Pvt) Ltd — Payment processing. Paynow handles your payment details directly under its own privacy terms; we only receive the payment status.',
      'Messaging and notification providers — We use providers to deliver push notifications, emails, and WhatsApp messages about your orders.',
      'Law enforcement and regulators — We disclose information where we are legally required to, for example under a court order, or to the Data Protection Authority, the police, or tax authorities acting within their legal powers.',
      'Anyone else — Only with your explicit consent.',
    ],
  },
  {
    heading: '5. Lawful Basis and How We Use Information',
    body: [
      'Under the Act we process your information on the following bases: to perform the delivery service you requested (a contract with you); to comply with legal obligations such as tax, accounting, and lawful requests from authorities; on the basis of your consent where consent is required (for example location permissions and marketing); and for our legitimate interests in keeping the platform secure, preventing fraud, and improving the service — always balanced against your rights.',
      'We use your information to: create and manage your account; match you with messengers; process, track, and complete orders; send you notifications you need as part of the service; handle support tickets, disputes, and refunds; verify messenger identity; prevent and investigate fraud or abuse; and comply with the law.',
      'We will only send you marketing messages (promotions, offers, announcements) where you have agreed to receive them. You can opt out at any time through the app or by contacting us, and service messages about your orders will continue regardless.',
    ],
  },
  {
    heading: '6. Data Security',
    body: [
      'Your data is stored on access-controlled infrastructure. Passwords are hashed, not stored as plain text. Access to personal information is limited to staff and systems that need it for a specific purpose.',
      'All traffic between your device and our servers is encrypted in transit.',
      'Uploads (images) are validated before they are accepted, and executable or dangerous file types are blocked.',
      'While no system can be guaranteed perfectly secure, we apply reasonable technical and organisational safeguards appropriate to the sensitivity of the data, as required by the Act.',
      'If a data breach occurs that is likely to harm you, we will notify you and the Data Protection Authority as required by the Act.',
    ],
  },
  {
    heading: '7. How Long We Keep Your Information',
    body: [
      'Account information is kept while your account is active.',
      'Order and transaction records are kept for the period required by Zimbabwean tax and accounting law after a transaction.',
      'Chat messages are kept for as long as your account is active so you can refer back to conversations.',
      'Verification documents for messengers are kept while the messenger is active on the platform and for a reasonable period after, in line with legal record-keeping duties.',
      'When information is no longer needed for the purpose it was collected and no law requires us to keep it, we delete or anonymise it.',
    ],
  },
  {
    heading: '8. Your Rights Under Zimbabwean Law',
    body: [
      'You have the right to: be informed about how your data is used (this policy); access the personal information we hold about you; correct information that is wrong or incomplete; request deletion of your personal data; object to or restrict certain processing; withdraw consent where processing is based on consent; and not be subject to purely automated decisions that significantly affect you.',
      'To exercise any of these rights, use the Privacy Centre in the app, or contact us at shepherdmutevedzi@gmail.com or 0782627990. We aim to respond within a reasonable time and will confirm what action we have taken.',
      'If you are unhappy with how we handle your personal information, you may lodge a complaint with the Postal and Telecommunications Regulatory Authority of Zimbabwe (POTRAZ), which is the Data Protection Authority under the Act, or take the matter to the courts.',
    ],
  },
  {
    heading: '9. Data Transfers Outside Zimbabwe',
    body: [
      'Some of our service providers (for example cloud hosting, email delivery, and push notification infrastructure) may process data in other countries. Where this happens, we take steps to ensure your information receives a comparable level of protection to that required by the Act, including contractual safeguards with those providers.',
    ],
  },
  {
    heading: '10. Children',
    body: [
      'UniLink is not intended for children under 16. We do not knowingly collect personal information from children under 16. If you believe a child has provided us with personal information, contact us and we will delete it.',
    ],
  },
  {
    heading: '11. Changes to This Policy',
    body: [
      'If we change this policy in a way that matters, we will update the date below and, where the change is significant, notify you in the app before the change takes effect.',
    ],
  },
  {
    heading: '12. Contact',
    body: [
      'Future Pulse Investments — Bulawayo, Zimbabwe.',
      'Privacy questions, access requests, or complaints: shepherdmutevedzi@gmail.com or 0782627990. We aim to respond within 24 hours.',
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
