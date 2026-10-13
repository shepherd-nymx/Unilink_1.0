import { useState } from 'react';
import {
  Modal,
  Platform,
  Share as RNShare,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link2, Mail, MessageCircle, Share2, Smartphone } from 'lucide-react-native';

const SHARE_URL = 'https://unilinkbase.com';
const SHARE_MESSAGE = 'Check out UniLink — get groceries and deliveries brought straight to you: ' + SHARE_URL;

export function AppShareButton({ accent = '#00e5ff' }: { accent?: string }) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (Platform.OS !== 'web') {
      RNShare.share({ message: SHARE_MESSAGE }).catch(() => {});
      return;
    }
    setShowModal(true);
  };

  const shareViaWhatsApp = () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(SHARE_MESSAGE), '_blank');
    setShowModal(false);
  };

  const shareViaSMS = () => {
    window.open('sms:?&body=' + encodeURIComponent(SHARE_MESSAGE), '_self');
    setShowModal(false);
  };

  const shareViaEmail = () => {
    window.open('mailto:?subject=' + encodeURIComponent('Check out UniLink') + '&body=' + encodeURIComponent(SHARE_MESSAGE));
    setShowModal(false);
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const tryNativeShare = async () => {
    setShowModal(false);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'UniLink', text: SHARE_MESSAGE, url: SHARE_URL });
      } else {
        await copyShareLink();
      }
    } catch {}
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleShare}
        style={[ss.button, { borderColor: accent + '55', backgroundColor: accent + '12' }]}
        activeOpacity={0.75}
        accessibilityLabel="Share UniLink"
      >
        <Share2 size={14} color={accent} />
        <Text style={[ss.buttonText, { color: accent }]}>{copied ? 'Copied!' : 'Share'}</Text>
      </TouchableOpacity>

      <Modal transparent visible={showModal} onRequestClose={() => setShowModal(false)}>
        <View style={ss.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowModal(false)} />
          <View style={ss.card}>
            <Text style={ss.cardTitle}>Share UniLink with friends</Text>
            <View style={ss.options}>
              <TouchableOpacity style={ss.option} onPress={shareViaWhatsApp} activeOpacity={0.7}>
                <Smartphone size={20} color="#25D366" />
                <Text style={ss.optionText}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.option} onPress={shareViaSMS} activeOpacity={0.7}>
                <MessageCircle size={20} color="#00e5ff" />
                <Text style={ss.optionText}>SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.option} onPress={shareViaEmail} activeOpacity={0.7}>
                <Mail size={20} color="#F59E0B" />
                <Text style={ss.optionText}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.option} onPress={tryNativeShare} activeOpacity={0.7}>
                <Share2 size={20} color="#8B5CF6" />
                <Text style={ss.optionText}>More</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={ss.copyRow} onPress={copyShareLink} activeOpacity={0.7}>
              <Link2 size={14} color="#00e5ff" />
              <Text style={ss.copyText} numberOfLines={1}>unilinkbase.com</Text>
              <Text style={ss.copyAction}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const ss = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  buttonText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#0b1c2c', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,229,255,0.25)',
    padding: 16, width: 300, gap: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  options: { flexDirection: 'row', justifyContent: 'space-between' },
  option: { alignItems: 'center', gap: 5, flex: 1 },
  optionText: { fontSize: 10, fontWeight: '700', color: '#cbd5e1' },
  copyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,229,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,255,0.25)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  copyText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#e2e8f0' },
  copyAction: { fontSize: 11, fontWeight: '800', color: '#00e5ff' },
});
