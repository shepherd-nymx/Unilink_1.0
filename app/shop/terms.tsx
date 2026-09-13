import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle, FileText, Shield } from 'lucide-react-native';
import { ScrollView, TouchableOpacity } from 'react-native';

type Tab = 'terms' | 'privacy';

export default function ShopTermsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [termsContent, setTermsContent] = useState('');
  const [termsVersion, setTermsVersion] = useState('');
  const [termsTitle, setTermsTitle] = useState('');
  const [shopId, setShopId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('terms');
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const BG = isDark ? '#050b16' : '#ffffff';
  const TX = isDark ? '#e0eeff' : '#1f2937';
  const TX2 = isDark ? '#6a8fb0' : '#6b7280';

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      const { data, error } = await supabase
        .from('merchant_policies')
        .select('version, title, content')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        Alert.alert('Error', 'No merchant terms found');
        router.back();
        return;
      }
      setTermsContent(data.content);
      setTermsVersion(data.version);
      setTermsTitle(data.title);

      if (params.shopId) {
        setShopId(params.shopId as string);
      }
    } catch {
      Alert.alert('Error', 'Failed to load Merchant Terms');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('shops')
        .update({
          terms_accepted: true,
          terms_version: termsVersion,
        })
        .eq('id', shopId);

      if (updateError) throw updateError;
      router.replace('/shop/dashboard');
    } catch {
      Alert.alert('Error', 'Failed to accept Merchant Terms');
      setLoading(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Terms Required',
      'You must accept the Merchant Terms & Conditions to use UniLink. You will be logged out.',
      [
        { text: 'Review Again', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => router.replace('/shop/login'),
        },
      ]
    );
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    if (isAtBottom) setTermsScrolled(true);
  };

  if (loading && !termsContent) {
    return (
      <View style={[styles.container, { backgroundColor: BG, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0066ff" />
        <Text style={{ color: TX2, marginTop: 16, fontSize: 16 }}>Loading Merchant Terms...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={styles.header}>
        <AlertCircle size={28} color="#dc2626" />
        <Text style={styles.headerTitle}>Merchant Agreement</Text>
        <Text style={styles.headerSubtitle}>Read the terms before accepting</Text>
      </View>

      <View style={styles.warningBanner}>
        <AlertCircle size={18} color="#854d0e" />
        <Text style={styles.warningText}>
          You must read and accept the UniLink Merchant Terms & Conditions to operate your shop on UniLink.
        </Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'terms' && styles.tabActive]} onPress={() => setActiveTab('terms')}>
          <FileText size={16} color={activeTab === 'terms' ? '#1d4ed8' : TX2} />
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>Merchant Terms</Text>
          {termsScrolled && (
            <View style={styles.tabBadge}>
              <CheckCircle size={12} color="#16a34a" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066ff" />
          <Text style={styles.loadingText}>Loading document...</Text>
        </View>
      ) : (
        <>
          {activeTab === 'terms' && (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <Text style={[styles.documentText, { color: TX }]}>{termsContent}</Text>
              <View style={styles.endMarker}>
                <Text style={styles.endMarkerText}>— End of {termsTitle} —</Text>
              </View>
            </ScrollView>
          )}

          {!termsScrolled && (
            <View style={styles.scrollHint}>
              <Text style={styles.scrollHintText}>
                Scroll to the bottom to mark this document as read
              </Text>
            </View>
          )}

          <View style={styles.acceptanceSection}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setIsChecked(!isChecked)}
              disabled={!termsScrolled}
            >
              <View style={[styles.checkbox, isChecked && styles.checkboxChecked, !termsScrolled && styles.checkboxDisabled]}>
                {isChecked && <CheckCircle size={18} color="#ffffff" />}
              </View>
              <Text style={[styles.checkboxLabel, !termsScrolled && styles.checkboxLabelDisabled, { color: TX }]}>
                I have read and I agree to the UniLink Merchant Terms & Conditions
              </Text>
            </TouchableOpacity>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.acceptButton, !(isChecked && termsScrolled) && styles.acceptButtonDisabled]}
                onPress={handleAccept}
                disabled={!(isChecked && termsScrolled)}
              >
                <Text style={[styles.acceptButtonText, !(isChecked && termsScrolled) && styles.acceptButtonTextDisabled]}>
                  Accept & Continue as Merchant
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
                <Text style={styles.declineButtonText}>Decline & Exit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: '#fef2f2',
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#fee2e2',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1f2937', marginTop: 10 },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  warningBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  warningText: { flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '600', color: '#854d0e', lineHeight: 18 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#1d4ed8' },
  tabBadge: { marginLeft: 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 14, color: '#6b7280' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  documentText: { fontSize: 13, lineHeight: 21 },
  endMarker: { alignItems: 'center', marginTop: 20, paddingBottom: 10 },
  endMarkerText: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  scrollHint: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  scrollHintText: { fontSize: 11, color: '#854d0e', fontWeight: '600' },
  acceptanceSection: { padding: 20, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  checkboxDisabled: { opacity: 0.4 },
  checkboxLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  checkboxLabelDisabled: { opacity: 0.4 },
  buttonContainer: { gap: 10 },
  acceptButton: {
    backgroundColor: '#0066ff', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptButtonDisabled: { backgroundColor: '#d1d5db' },
  acceptButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  acceptButtonTextDisabled: { color: '#9ca3af' },
  declineButton: { alignItems: 'center', paddingVertical: 12 },
  declineButtonText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
});
