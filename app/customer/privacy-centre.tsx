import PageSkeleton from '@/components/PageSkeleton';
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, TextInput, Linking, RefreshControl, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Shield, Download, Trash2, CreditCard as Edit3, FileText, Mail, Phone, MapPin, CircleCheck as CheckCircle, Clock, Circle as XCircle, ChevronRight, Bell, BellOff, TriangleAlert as AlertTriangle, ExternalLink, Lock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type PrivacyRequest = {
  id: string;
  request_type: string;
  status: string;
  description: string | null;
  requested_at: string;
  completed_at: string | null;
  admin_notes: string | null;
  created_at: string;
};

type DpoSettings = {
  dpo_name: string;
  dpo_email: string;
  dpo_phone: string | null;
  dpo_address: string | null;
  privacy_contact_email: string;
};

type PolicyVersion = {
  id: string;
  version: string;
  title: string;
  content: string;
  effective_date: string;
};

const REQUEST_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  export_data: { label: 'Export My Data', icon: Download, color: '#1A73E8' },
  correct_data: { label: 'Correct My Data', icon: Edit3, color: '#FF6B00' },
  delete_data: { label: 'Delete My Data', icon: Trash2, color: '#EF4444' },
  restrict_processing: { label: 'Restrict Processing', icon: Lock, color: '#FFAA00' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: '#FFAA00', icon: Clock },
  in_review: { label: 'In Review', color: '#1A73E8', icon: Clock },
  completed: { label: 'Completed', color: '#10B981', icon: CheckCircle },
  rejected: { label: 'Rejected', color: '#EF4444', icon: XCircle },
  cancelled: { label: 'Cancelled', color: '#6A8FB0', icon: XCircle },
};

export default function PrivacyCentre() {
  const router = useRouter();
  const { customerId } = useLocalSearchParams();
  const { isDark } = useTheme();

  const P = '#1A73E8';
  const BG = isDark ? '#050D1A' : '#F0F4FF';
  const CARD = isDark ? '#0D1B2E' : '#FFFFFF';
  const CARD_B = isDark ? '#1A3A5C' : '#DDE8FF';
  const TX = isDark ? '#E8F4FF' : '#0A1628';
  const TX2 = isDark ? '#7AA3CC' : '#5A7A9A';
  const TX3 = isDark ? '#3A6A8A' : '#9AB0CC';
  const INPUT = isDark ? '#0A1828' : '#F5F8FF';
  const INPUT_B = isDark ? '#1E3A5C' : '#C8D8F0';
  const SUCCESS = '#10B981';
  const ERR = '#EF4444';
  const WARN = '#FFAA00';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [dpoSettings, setDpoSettings] = useState<DpoSettings | null>(null);
  const [privacyPolicy, setPrivacyPolicy] = useState<PolicyVersion | null>(null);
  const [termsPolicy, setTermsPolicy] = useState<PolicyVersion | null>(null);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [consentHistory, setConsentHistory] = useState<any[]>([]);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState('export_data');
  const [requestDesc, setRequestDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyContent, setPolicyContent] = useState<{ title: string; content: string } | null>(null);

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      const [reqRes, dpoRes, ppRes, tpRes, mcRes, consentRes] = await Promise.all([
        supabase.from('privacy_requests').select('*').eq('customer_id', customerId as string).order('created_at', { ascending: false }),
        supabase.from('dpo_settings').select('dpo_name, dpo_email, dpo_phone, dpo_address, privacy_contact_email').maybeSingle(),
        supabase.from('privacy_policy_versions').select('id, version, title, content, effective_date').eq('is_active', true).maybeSingle(),
        supabase.from('terms_policy_versions').select('id, version, title, content, effective_date').eq('is_active', true).maybeSingle(),
        supabase.from('marketing_consents').select('opted_in').eq('customer_id', customerId as string).maybeSingle(),
        supabase.from('consent_records').select('*').eq('user_id', customerId as string).order('created_at', { ascending: false }).limit(20),
      ]);

      setRequests(reqRes.data || []);
      setDpoSettings(dpoRes.data as DpoSettings || null);
      setPrivacyPolicy(ppRes.data as PolicyVersion || null);
      setTermsPolicy(tpRes.data as PolicyVersion || null);
      setMarketingOptIn(mcRes.data?.opted_in ?? false);
      setConsentHistory(consentRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load privacy data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const toggleMarketing = async (optIn: boolean) => {
    try {
      await supabase.from('marketing_consents').upsert({
        customer_id: customerId as string,
        opted_in: optIn,
        consent_date: optIn ? new Date().toISOString() : null,
        opt_out_date: optIn ? null : new Date().toISOString(),
        consent_method: 'profile_toggle',
      });
      await supabase.from('consent_records').insert({
        user_id: customerId as string,
        user_type: 'customer',
        consent_type: 'marketing',
        action: optIn ? 'granted' : 'withdrawn',
        policy_type: 'marketing',
      });
      setMarketingOptIn(optIn);
      showSuccessMsg(optIn ? 'Marketing emails enabled' : 'Marketing emails disabled');
    } catch (err: any) {
      setError(err.message || 'Failed to update marketing preference');
    }
  };

  const submitRequest = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('privacy_requests').insert({
        customer_id: customerId as string,
        request_type: requestType,
        description: requestDesc.trim() || null,
        status: 'pending',
      });
      if (insertError) throw insertError;
      await supabase.from('consent_records').insert({
        user_id: customerId as string,
        user_type: 'customer',
        consent_type: 'privacy_request',
        action: 'granted',
        policy_type: 'privacy_request',
      });
      setShowRequestModal(false);
      setRequestDesc('');
      showSuccessMsg('Your privacy request has been submitted');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (id: string) => {
    try {
      await supabase.from('privacy_requests').update({ status: 'cancelled' }).eq('id', id);
      loadData();
      showSuccessMsg('Request cancelled');
    } catch (err: any) {
      setError(err.message || 'Failed to cancel request');
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return <PageSkeleton page="customer/privacy-centre"/>;
  }

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.header, { backgroundColor: CARD, borderBottomColor: CARD_B }]}>
        <TouchableOpacity style={[styles.backBtn, { borderColor: CARD_B, backgroundColor: BG }]} onPress={() => router.back()}>
          <ArrowLeft size={18} color={TX2} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Shield size={20} color={P} />
          <Text style={[styles.headerTitle, { color: TX }]}>Privacy Centre</Text>
        </View>
      </View>

      {error ? (
        <View style={[styles.alert, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderColor: ERR }]}>
          <Text style={[styles.alertText, { color: ERR }]}>{error}</Text>
        </View>
      ) : null}
      {success ? (
        <View style={[styles.alert, { backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)', borderColor: SUCCESS }]}>
          <CheckCircle size={16} color={SUCCESS} />
          <Text style={[styles.alertText, { color: SUCCESS }]}>{success}</Text>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P} />}
      >
        {/* Your Rights section */}
        <View style={[styles.section, { backgroundColor: CARD, borderColor: CARD_B }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: CARD_B, backgroundColor: isDark ? 'rgba(26,115,232,0.06)' : 'rgba(26,115,232,0.03)' }]}>
            <Shield size={14} color={P} />
            <Text style={[styles.sectionHeaderText, { color: P }]}>Your Data Rights</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={[styles.bodyText, { color: TX2 }]}>
              You have the right to access, export, correct, or request deletion of your personal data. You can also restrict how your data is processed.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: P }]}
              onPress={() => setShowRequestModal(true)}
              activeOpacity={0.85}
            >
              <Shield size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Submit a Privacy Request</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Marketing consent */}
        <View style={[styles.section, { backgroundColor: CARD, borderColor: CARD_B }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: CARD_B, backgroundColor: isDark ? 'rgba(26,115,232,0.06)' : 'rgba(26,115,232,0.03)' }]}>
            <Bell size={14} color={P} />
            <Text style={[styles.sectionHeaderText, { color: P }]}>Marketing Preferences</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={[styles.toggleRow, { borderColor: CARD_B }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: TX }]}>Marketing Emails</Text>
                <Text style={[styles.toggleDesc, { color: TX3 }]}>
                  {marketingOptIn ? 'You will receive promotional emails' : 'You will not receive promotional emails'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleSwitch, { backgroundColor: marketingOptIn ? SUCCESS : (isDark ? '#1A3A5C' : '#DDE8FF') }]}
                onPress={() => toggleMarketing(!marketingOptIn)}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleKnob, { transform: [{ translateX: marketingOptIn ? 22 : 0 }] }]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Your Privacy Requests */}
        <View style={[styles.section, { backgroundColor: CARD, borderColor: CARD_B }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: CARD_B, backgroundColor: isDark ? 'rgba(26,115,232,0.06)' : 'rgba(26,115,232,0.03)' }]}>
            <FileText size={14} color={P} />
            <Text style={[styles.sectionHeaderText, { color: P }]}>Your Privacy Requests</Text>
          </View>
          <View style={styles.sectionBody}>
            {requests.length === 0 ? (
              <View style={styles.emptyState}>
                <FileText size={32} color={TX3} />
                <Text style={[styles.emptyText, { color: TX3 }]}>No privacy requests yet</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {requests.map((req) => {
                  const typeConf = REQUEST_TYPE_LABELS[req.request_type] || REQUEST_TYPE_LABELS.export_data;
                  const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const TypeIcon = typeConf.icon;
                  const StatusIcon = statusConf.icon;
                  return (
                    <View key={req.id} style={[styles.requestCard, { backgroundColor: INPUT, borderColor: INPUT_B }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <View style={[styles.requestIcon, { backgroundColor: `${typeConf.color}15` }]}>
                          <TypeIcon size={16} color={typeConf.color} />
                        </View>
                        <Text style={[styles.requestType, { color: TX }]}>{typeConf.label}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <StatusIcon size={12} color={statusConf.color} />
                        <Text style={[styles.requestStatus, { color: statusConf.color }]}>{statusConf.label}</Text>
                        <Text style={[styles.requestDate, { color: TX3 }]}>· {formatDate(req.created_at)}</Text>
                      </View>
                      {req.description ? (
                        <Text style={[styles.requestDesc, { color: TX2 }]} numberOfLines={3}>{req.description}</Text>
                      ) : null}
                      {req.admin_notes ? (
                        <View style={[styles.adminNote, { backgroundColor: isDark ? 'rgba(26,115,232,0.08)' : 'rgba(26,115,232,0.05)', borderColor: CARD_B }]}>
                          <Text style={[styles.adminNoteLabel, { color: P }]}>Admin Response</Text>
                          <Text style={[styles.adminNoteText, { color: TX2 }]}>{req.admin_notes}</Text>
                        </View>
                      ) : null}
                      {req.status === 'pending' && (
                        <TouchableOpacity
                          style={[styles.cancelBtn, { borderColor: CARD_B }]}
                          onPress={() => cancelRequest(req.id)}
                        >
                          <Text style={[styles.cancelBtnText, { color: TX2 }]}>Cancel Request</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Consent History */}
        {consentHistory.length > 0 && (
          <View style={[styles.section, { backgroundColor: CARD, borderColor: CARD_B }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: CARD_B, backgroundColor: isDark ? 'rgba(26,115,232,0.06)' : 'rgba(26,115,232,0.03)' }]}>
              <CheckCircle size={14} color={P} />
              <Text style={[styles.sectionHeaderText, { color: P }]}>Consent History</Text>
            </View>
            <View style={styles.sectionBody}>
              {consentHistory.map((c) => (
                <View key={c.id} style={[styles.consentRow, { borderBottomColor: CARD_B }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.consentType, { color: TX }]}>{c.consent_type}</Text>
                    <Text style={[styles.consentDate, { color: TX3 }]}>{formatDate(c.created_at)}</Text>
                  </View>
                  <View style={[styles.consentBadge, { backgroundColor: c.action === 'granted' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                    <Text style={[styles.consentBadgeText, { color: c.action === 'granted' ? SUCCESS : ERR }]}>
                      {c.action === 'granted' ? 'Granted' : 'Withdrawn'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Policies */}
        <View style={[styles.section, { backgroundColor: CARD, borderColor: CARD_B }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: CARD_B, backgroundColor: isDark ? 'rgba(26,115,232,0.06)' : 'rgba(26,115,232,0.03)' }]}>
            <FileText size={14} color={P} />
            <Text style={[styles.sectionHeaderText, { color: P }]}>Policies & Documents</Text>
          </View>
          <View style={styles.sectionBody}>
            {privacyPolicy && (
              <TouchableOpacity
                style={[styles.policyBtn, { borderColor: CARD_B }]}
                onPress={() => { setPolicyContent({ title: privacyPolicy.title, content: privacyPolicy.content }); setShowPolicyModal(true); }}
              >
                <FileText size={18} color={P} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.policyTitle, { color: TX }]}>Privacy Policy</Text>
                  <Text style={[styles.policyVersion, { color: TX3 }]}>Version {privacyPolicy.version}</Text>
                </View>
                <ChevronRight size={18} color={TX3} />
              </TouchableOpacity>
            )}
            {termsPolicy && (
              <TouchableOpacity
                style={[styles.policyBtn, { borderColor: CARD_B }]}
                onPress={() => { setPolicyContent({ title: termsPolicy.title, content: termsPolicy.content }); setShowPolicyModal(true); }}
              >
                <FileText size={18} color={P} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.policyTitle, { color: TX }]}>Terms & Conditions</Text>
                  <Text style={[styles.policyVersion, { color: TX3 }]}>Version {termsPolicy.version}</Text>
                </View>
                <ChevronRight size={18} color={TX3} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* DPO Contact */}
        {dpoSettings && (
          <View style={[styles.section, { backgroundColor: CARD, borderColor: CARD_B }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: CARD_B, backgroundColor: isDark ? 'rgba(26,115,232,0.06)' : 'rgba(26,115,232,0.03)' }]}>
              <Mail size={14} color={P} />
              <Text style={[styles.sectionHeaderText, { color: P }]}>Data Protection Officer</Text>
            </View>
            <View style={styles.sectionBody}>
              <Text style={[styles.dpoName, { color: TX }]}>{dpoSettings.dpo_name}</Text>
              <TouchableOpacity
                style={[styles.dpoContactRow, { borderColor: CARD_B }]}
                onPress={() => Linking.openURL(`mailto:${dpoSettings.dpo_email}`)}
              >
                <Mail size={16} color={P} />
                <Text style={[styles.dpoContactText, { color: P }]}>{dpoSettings.dpo_email}</Text>
              </TouchableOpacity>
              {dpoSettings.dpo_phone ? (
                <TouchableOpacity
                  style={[styles.dpoContactRow, { borderColor: CARD_B }]}
                  onPress={() => Linking.openURL(`tel:${dpoSettings.dpo_phone}`)}
                >
                  <Phone size={16} color={P} />
                  <Text style={[styles.dpoContactText, { color: P }]}>{dpoSettings.dpo_phone}</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={[styles.dpoNote, { color: TX3 }]}>
                Contact our DPO for any privacy-related enquiries, data requests, or complaints.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Request Modal */}
      <Modal visible={showRequestModal} transparent animationType="slide" onRequestClose={() => setShowRequestModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: CARD, borderColor: CARD_B }]}>
            <View style={[styles.modalHeader, { borderBottomColor: CARD_B }]}>
              <Text style={[styles.modalTitle, { color: TX }]}>New Privacy Request</Text>
              <TouchableOpacity style={[styles.modalClose, { backgroundColor: INPUT, borderColor: INPUT_B }]} onPress={() => setShowRequestModal(false)}>
                <XCircle size={18} color={TX2} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 16 }}>
              <View style={{ gap: 8 }}>
                <Text style={[styles.label, { color: TX3 }]}>REQUEST TYPE</Text>
                {Object.entries(REQUEST_TYPE_LABELS).map(([key, conf]) => {
                  const Icon = conf.icon;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.requestTypeOption,
                        { borderColor: requestType === key ? conf.color : INPUT_B, backgroundColor: requestType === key ? `${conf.color}10` : INPUT },
                      ]}
                      onPress={() => setRequestType(key)}
                    >
                      <Icon size={18} color={conf.color} />
                      <Text style={[styles.requestTypeLabel, { color: TX }]}>{conf.label}</Text>
                      {requestType === key && <CheckCircle size={18} color={conf.color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ gap: 8 }}>
                <Text style={[styles.label, { color: TX3 }]}>DESCRIPTION (OPTIONAL)</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: INPUT, borderColor: INPUT_B, color: TX }]}
                  value={requestDesc}
                  onChangeText={setRequestDesc}
                  placeholder="Provide details about your request..."
                  placeholderTextColor={TX3}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: P, opacity: submitting ? 0.6 : 1 }]}
                onPress={submitRequest}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Shield size={18} color="#fff" />}
                <Text style={styles.primaryBtnText}>{submitting ? 'Submitting...' : 'Submit Request'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Policy Viewer Modal */}
      <Modal visible={showPolicyModal} transparent animationType="slide" onRequestClose={() => setShowPolicyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: CARD, borderColor: CARD_B, maxHeight: '85%' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: CARD_B }]}>
              <Text style={[styles.modalTitle, { color: TX }]}>{policyContent?.title || 'Policy'}</Text>
              <TouchableOpacity style={[styles.modalClose, { backgroundColor: INPUT, borderColor: INPUT_B }]} onPress={() => setShowPolicyModal(false)}>
                <XCircle size={18} color={TX2} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }}>
              <Text style={[styles.policyContent, { color: TX2 }]}>{policyContent?.content}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  alert: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 14, padding: 12,
    borderRadius: 12, borderWidth: 1,
  },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  section: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 18,
    borderWidth: 1, overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  sectionHeaderText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' as any },
  sectionBody: { padding: 20, gap: 14 },
  bodyText: { fontSize: 14, lineHeight: 22 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 12, marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  toggleTitle: { fontSize: 15, fontWeight: '700' },
  toggleDesc: { fontSize: 12, marginTop: 2 },
  toggleSwitch: {
    width: 50, height: 28, borderRadius: 14, padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '600' },
  requestCard: {
    borderWidth: 1, borderRadius: 14, padding: 16,
  },
  requestIcon: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  requestType: { fontSize: 15, fontWeight: '700', flex: 1 },
  requestStatus: { fontSize: 12, fontWeight: '700' },
  requestDate: { fontSize: 12 },
  requestDesc: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  adminNote: {
    marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1,
  },
  adminNoteLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  adminNoteText: { fontSize: 13, lineHeight: 18 },
  cancelBtn: {
    marginTop: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600' },
  consentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  consentType: { fontSize: 14, fontWeight: '600' },
  consentDate: { fontSize: 12, marginTop: 2 },
  consentBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  consentBadgeText: { fontSize: 11, fontWeight: '700' },
  policyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  policyTitle: { fontSize: 15, fontWeight: '700' },
  policyVersion: { fontSize: 12, marginTop: 2 },
  dpoName: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  dpoContactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 10, padding: 12,
  },
  dpoContactText: { fontSize: 14, fontWeight: '600' },
  dpoNote: { fontSize: 12, marginTop: 10, lineHeight: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalClose: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' as any },
  requestTypeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderRadius: 12, padding: 14,
  },
  requestTypeLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  textArea: {
    borderWidth: 1.5, borderRadius: 12, padding: 14, minHeight: 100,
    fontSize: 14, fontWeight: '500',
  },
  policyContent: { fontSize: 14, lineHeight: 22 },
});
