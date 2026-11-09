import PageSkeleton from '@/components/PageSkeleton';
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, TextInput, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { A } from '@/lib/admin-theme';
import { ArrowLeft, Shield, FileText, Mail, Phone, MapPin, Database, Building2, TriangleAlert as AlertTriangle, Clock, CircleCheck as CheckCircle, Circle as XCircle, ChevronRight, Plus, Save, Trash2, CreditCard as Edit3, Bell, Lock, Download } from 'lucide-react-native';

type PrivacyRequest = {
  id: string; customer_id: string; request_type: string; status: string;
  description: string | null; requested_at: string; completed_at: string | null;
  admin_notes: string | null; created_at: string;
  customers?: { full_name: string } | null;
};

type Tab = 'requests' | 'dpo' | 'processing' | 'processors' | 'incidents' | 'retention' | 'policies';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'requests', label: 'Privacy Requests', icon: Shield },
  { key: 'dpo', label: 'DPO Details', icon: Mail },
  { key: 'policies', label: 'Policies', icon: FileText },
  { key: 'processing', label: 'Processing Register', icon: Database },
  { key: 'processors', label: 'Processors', icon: Building2 },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'retention', label: 'Retention', icon: Clock },
];

const REQUEST_STATUS_COLORS: Record<string, string> = {
  pending: A.amber, in_review: A.cyan, completed: A.green, rejected: A.red, cancelled: A.textMuted,
};

export default function CompliancePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [dpoSettings, setDpoSettings] = useState<any>(null);
  const [processingRegister, setProcessingRegister] = useState<any[]>([]);
  const [processors, setProcessors] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [retentionRules, setRetentionRules] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);

  const [editingDpo, setEditingDpo] = useState(false);
  const [dpoForm, setDpoForm] = useState({ dpo_name: '', dpo_email: '', dpo_phone: '', dpo_address: '', privacy_contact_email: '' });
  const [savingDpo, setSavingDpo] = useState(false);

  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ incident_type: 'data_breach', severity: 'low', description: '', affected_individuals_count: '' });
  const [savingIncident, setSavingIncident] = useState(false);

  const [reviewingRequest, setReviewingRequest] = useState<PrivacyRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewStatus, setReviewStatus] = useState('completed');

  const showSuccessMsg = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const loadData = useCallback(async () => {
    try {
      const [reqRes, dpoRes, procRes, processorsRes, incRes, retRes, polRes] = await Promise.all([
        supabase.from('privacy_requests').select('*, customers(full_name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('dpo_settings').select('*').maybeSingle(),
        supabase.from('data_processing_register').select('*').order('created_at', { ascending: false }),
        supabase.from('third_party_processors').select('*').order('added_at', { ascending: false }),
        supabase.from('security_incidents').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('data_retention_rules').select('*').order('category_name'),
        supabase.from('privacy_policy_versions').select('*').order('created_at', { ascending: false }),
      ]);
      setRequests(reqRes.data || []);
      setDpoSettings(dpoRes.data);
      setProcessingRegister(procRes.data || []);
      setProcessors(processorsRes.data || []);
      setIncidents(incRes.data || []);
      setRetentionRules(retRes.data || []);
      setPolicies(polRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load compliance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const saveDpo = async () => {
    setSavingDpo(true);
    try {
      await supabase.from('dpo_settings').update({
        dpo_name: dpoForm.dpo_name, dpo_email: dpoForm.dpo_email,
        dpo_phone: dpoForm.dpo_phone || null, dpo_address: dpoForm.dpo_address || null,
        privacy_contact_email: dpoForm.privacy_contact_email,
        last_updated_at: new Date().toISOString(),
      }).eq('id', dpoSettings.id);
      setEditingDpo(false);
      showSuccessMsg('DPO details updated');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save DPO details');
    } finally {
      setSavingDpo(false);
    }
  };

  const submitReview = async () => {
    if (!reviewingRequest) return;
    try {
      await supabase.from('privacy_requests').update({
        status: reviewStatus,
        admin_notes: reviewNotes.trim() || null,
        reviewed_at: new Date().toISOString(),
        completed_at: reviewStatus === 'completed' || reviewStatus === 'rejected' ? new Date().toISOString() : null,
      }).eq('id', reviewingRequest.id);
      setReviewingRequest(null);
      setReviewNotes('');
      showSuccessMsg('Request updated');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update request');
    }
  };

  const submitIncident = async () => {
    setSavingIncident(true);
    try {
      await supabase.from('security_incidents').insert({
        incident_type: incidentForm.incident_type,
        severity: incidentForm.severity,
        description: incidentForm.description,
        affected_individuals_count: incidentForm.affected_individuals_count ? parseInt(incidentForm.affected_individuals_count) : null,
        detected_at: new Date().toISOString(),
        status: 'detected',
      });
      setShowIncidentModal(false);
      setIncidentForm({ incident_type: 'data_breach', severity: 'low', description: '', affected_individuals_count: '' });
      showSuccessMsg('Security incident logged');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to log incident');
    } finally {
      setSavingIncident(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return <PageSkeleton page="admin/compliance"/>;
  }

  return (
    <View style={[styles.container, { backgroundColor: A.bg }]}>
      <View style={[styles.header, { backgroundColor: A.surface, borderBottomColor: A.border }]}>
        <TouchableOpacity style={[styles.backBtn, { borderColor: A.border, backgroundColor: A.card }]} onPress={() => router.back()}>
          <ArrowLeft size={18} color={A.textSub} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Shield size={20} color={A.cyan} />
          <Text style={[styles.headerTitle, { color: A.text }]}>DPO & Compliance</Text>
        </View>
      </View>

      {error ? (
        <View style={[styles.alert, { backgroundColor: A.redDim, borderColor: A.red }]}>
          <Text style={[styles.alertText, { color: A.red }]}>{error}</Text>
        </View>
      ) : null}
      {success ? (
        <View style={[styles.alert, { backgroundColor: A.greenDim, borderColor: A.green }]}>
          <CheckCircle size={16} color={A.green} />
          <Text style={[styles.alertText, { color: A.green }]}>{success}</Text>
        </View>
      ) : null}

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50, backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 6, paddingVertical: 8 }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                  backgroundColor: activeTab === tab.key ? A.cyanDim : 'transparent',
                  borderWidth: 1, borderColor: activeTab === tab.key ? A.cyan : 'transparent',
                }}
              >
                <Icon size={14} color={activeTab === tab.key ? A.cyan : A.textSub} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: activeTab === tab.key ? A.cyan : A.textSub }}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={A.cyan} />}
      >
        {/* PRIVACY REQUESTS TAB */}
        {activeTab === 'requests' && (
          <>
            <Text style={[styles.tabTitle, { color: A.textSub }]}>
              {requests.filter(r => r.status === 'pending').length} pending · {requests.length} total
            </Text>
            {requests.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: A.card, borderColor: A.border }]}>
                <Shield size={32} color={A.textMuted} />
                <Text style={[styles.emptyText, { color: A.textSub }]}>No privacy requests</Text>
              </View>
            ) : (
              requests.map(req => (
                <View key={req.id} style={[styles.card, { backgroundColor: A.card, borderColor: A.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <View style={[styles.cardIcon, { backgroundColor: A.cyanDim }]}>
                      <Shield size={16} color={A.cyan} />
                    </View>
                    <Text style={[styles.cardTitle, { color: A.text }]}>{req.request_type.replace(/_/g, ' ')}</Text>
                    <View style={{ flex: 1 }} />
                    <View style={[styles.statusBadge, { backgroundColor: `${REQUEST_STATUS_COLORS[req.status] || A.textMuted}20` }]}>
                      <Text style={[styles.statusText, { color: REQUEST_STATUS_COLORS[req.status] || A.textMuted }]}>{req.status}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: A.cyan, marginBottom: 6 }}>
                    Requested by: {req.customers?.full_name || 'Unknown customer'}
                  </Text>
                  {req.description ? <Text style={[styles.cardDesc, { color: A.textSub }]}>{req.description}</Text> : null}
                  <Text style={[styles.cardDate, { color: A.textMuted }]}>{formatDate(req.created_at)}</Text>
                  {req.admin_notes ? (
                    <View style={[styles.noteBox, { backgroundColor: A.blueDim, borderColor: A.blue }]}>
                      <Text style={[styles.noteLabel, { color: A.blue }]}>Admin Notes</Text>
                      <Text style={[styles.noteText, { color: A.textSub }]}>{req.admin_notes}</Text>
                    </View>
                  ) : null}
                  {(req.status === 'pending' || req.status === 'in_review') && (
                    <TouchableOpacity
                      style={[styles.reviewBtn, { backgroundColor: A.cyanDim, borderColor: A.cyan }]}
                      onPress={() => { setReviewingRequest(req); setReviewNotes(req.admin_notes || ''); setReviewStatus('completed'); }}
                    >
                      <Edit3 size={14} color={A.cyan} />
                      <Text style={[styles.reviewBtnText, { color: A.cyan }]}>Review Request</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {/* DPO DETAILS TAB */}
        {activeTab === 'dpo' && dpoSettings && (
          <View style={[styles.card, { backgroundColor: A.card, borderColor: A.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={[styles.cardTitle, { color: A.text }]}>DPO Contact Information</Text>
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: A.cyanDim, borderColor: A.cyan }]}
                onPress={() => {
                  setDpoForm({
                    dpo_name: dpoSettings.dpo_name, dpo_email: dpoSettings.dpo_email,
                    dpo_phone: dpoSettings.dpo_phone || '', dpo_address: dpoSettings.dpo_address || '',
                    privacy_contact_email: dpoSettings.privacy_contact_email,
                  });
                  setEditingDpo(true);
                }}
              >
                <Edit3 size={14} color={A.cyan} />
                <Text style={[styles.editBtnText, { color: A.cyan }]}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 12 }}>
              {[
                { label: 'Name', value: dpoSettings.dpo_name, icon: Shield },
                { label: 'Email', value: dpoSettings.dpo_email, icon: Mail },
                { label: 'Phone', value: dpoSettings.dpo_phone || 'Not set', icon: Phone },
                { label: 'Address', value: dpoSettings.dpo_address || 'Not set', icon: MapPin },
                { label: 'Privacy Contact', value: dpoSettings.privacy_contact_email, icon: Mail },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <View key={item.label} style={[styles.infoRow, { borderColor: A.border }]}>
                    <Icon size={16} color={A.textSub} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.infoLabel, { color: A.textMuted }]}>{item.label}</Text>
                      <Text style={[styles.infoValue, { color: A.text }]}>{item.value}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* POLICIES TAB */}
        {activeTab === 'policies' && (
          <>
            <Text style={[styles.tabTitle, { color: A.textSub }]}>Privacy Policy Versions</Text>
            {policies.map(p => (
              <View key={p.id} style={[styles.card, { backgroundColor: A.card, borderColor: A.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <FileText size={18} color={A.cyan} />
                  <Text style={[styles.cardTitle, { color: A.text, flex: 1 }]}>{p.title}</Text>
                  {p.is_active && <View style={[styles.activeBadge, { backgroundColor: A.greenDim }]}><Text style={[styles.activeBadgeText, { color: A.green }]}>ACTIVE</Text></View>}
                </View>
                <Text style={[styles.cardDesc, { color: A.textSub }]} numberOfLines={3}>{p.content}</Text>
                <Text style={[styles.cardDate, { color: A.textMuted }]}>v{p.version} · {formatDate(p.effective_date)}</Text>
              </View>
            ))}
          </>
        )}

        {/* PROCESSING REGISTER TAB */}
        {activeTab === 'processing' && (
          <>
            <Text style={[styles.tabTitle, { color: A.textSub }]}>{processingRegister.length} processing activities</Text>
            {processingRegister.map(item => (
              <View key={item.id} style={[styles.card, { backgroundColor: A.card, borderColor: A.border }]}>
                <Text style={[styles.cardTitle, { color: A.text }]}>{item.activity_name}</Text>
                <Text style={[styles.cardDesc, { color: A.textSub, marginTop: 4 }]}>{item.purpose}</Text>
                {item.data_categories && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {item.data_categories.map((cat: string) => (
                      <View key={cat} style={[styles.tag, { backgroundColor: A.cyanDim }]}><Text style={[styles.tagText, { color: A.cyan }]}>{cat}</Text></View>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <Text style={[styles.cardDate, { color: A.textMuted }]}>Basis: {item.lawful_basis || 'N/A'}</Text>
                  <Text style={[styles.cardDate, { color: A.textMuted }]}>Risk: {item.risk_level}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* PROCESSORS TAB */}
        {activeTab === 'processors' && (
          <>
            <Text style={[styles.tabTitle, { color: A.textSub }]}>{processors.length} third-party processors</Text>
            {processors.map(p => (
              <View key={p.id} style={[styles.card, { backgroundColor: A.card, borderColor: A.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Building2 size={18} color={A.green} />
                  <Text style={[styles.cardTitle, { color: A.text, flex: 1 }]}>{p.processor_name}</Text>
                  {p.dpas_signed ? <CheckCircle size={16} color={A.green} /> : <XCircle size={16} color={A.red} />}
                </View>
                {p.service_description ? <Text style={[styles.cardDesc, { color: A.textSub }]}>{p.service_description}</Text> : null}
                <Text style={[styles.cardDate, { color: A.textMuted, marginTop: 6 }]}>{p.contact_email || 'No contact'}</Text>
                {p.cross_border && <Text style={[styles.cardDate, { color: A.amber, marginTop: 4 }]}>Cross-border transfers: Yes</Text>}
              </View>
            ))}
          </>
        )}

        {/* INCIDENTS TAB */}
        {activeTab === 'incidents' && (
          <>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: A.redDim, borderColor: A.red }]}
              onPress={() => setShowIncidentModal(true)}
            >
              <Plus size={18} color={A.red} />
              <Text style={[styles.addBtnText, { color: A.red }]}>Log Security Incident</Text>
            </TouchableOpacity>
            {incidents.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: A.card, borderColor: A.border }]}>
                <CheckCircle size={32} color={A.green} />
                <Text style={[styles.emptyText, { color: A.textSub }]}>No security incidents recorded</Text>
              </View>
            ) : (
              incidents.map(inc => (
                <View key={inc.id} style={[styles.card, { backgroundColor: A.card, borderColor: A.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <AlertTriangle size={18} color={A.red} />
                    <Text style={[styles.cardTitle, { color: A.text, flex: 1 }]}>{inc.incident_type.replace(/_/g, ' ')}</Text>
                    <View style={[styles.severityBadge, { backgroundColor: `${inc.severity === 'critical' ? A.red : inc.severity === 'high' ? A.orange : inc.severity === 'medium' ? A.amber : A.green}20` }]}>
                      <Text style={[styles.severityText, { color: inc.severity === 'critical' ? A.red : inc.severity === 'high' ? A.orange : inc.severity === 'medium' ? A.amber : A.green }]}>{inc.severity}</Text>
                    </View>
                  </View>
                  <Text style={[styles.cardDesc, { color: A.textSub }]}>{inc.description}</Text>
                  <Text style={[styles.cardDate, { color: A.textMuted, marginTop: 6 }]}>Status: {inc.status} · {formatDate(inc.detected_at)}</Text>
                </View>
              ))
            )}
          </>
        )}

        {/* RETENTION TAB */}
        {activeTab === 'retention' && (
          <>
            <Text style={[styles.tabTitle, { color: A.textSub }]}>Data Retention Rules</Text>
            {retentionRules.map(rule => (
              <View key={rule.id} style={[styles.card, { backgroundColor: A.card, borderColor: A.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Clock size={18} color={A.amber} />
                  <Text style={[styles.cardTitle, { color: A.text, flex: 1 }]}>{rule.category_name}</Text>
                  {rule.auto_delete && <View style={[styles.tag, { backgroundColor: A.redDim }]}><Text style={[styles.tagText, { color: A.red }]}>AUTO-DELETE</Text></View>}
                </View>
                {rule.description ? <Text style={[styles.cardDesc, { color: A.textSub }]}>{rule.description}</Text> : null}
                <Text style={[styles.cardDate, { color: A.textMuted, marginTop: 6 }]}>{rule.retention_days} days retention</Text>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* DPO Edit Modal */}
      <Modal visible={editingDpo} transparent animationType="slide" onRequestClose={() => setEditingDpo(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: A.card, borderColor: A.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: A.border }]}>
              <Text style={[styles.modalTitle, { color: A.text }]}>Edit DPO Details</Text>
              <TouchableOpacity style={[styles.modalClose, { backgroundColor: A.inputBg, borderColor: A.inputBorder }]} onPress={() => setEditingDpo(false)}>
                <XCircle size={18} color={A.textSub} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 14 }}>
              {[
                { key: 'dpo_name', label: 'DPO Name', value: dpoForm.dpo_name },
                { key: 'dpo_email', label: 'DPO Email', value: dpoForm.dpo_email },
                { key: 'dpo_phone', label: 'DPO Phone', value: dpoForm.dpo_phone },
                { key: 'dpo_address', label: 'DPO Address', value: dpoForm.dpo_address },
                { key: 'privacy_contact_email', label: 'Privacy Contact Email', value: dpoForm.privacy_contact_email },
              ].map(field => (
                <View key={field.key} style={{ gap: 6 }}>
                  <Text style={[styles.label, { color: A.textSub }]}>{field.label}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: A.inputBg, borderColor: A.inputBorder, color: A.text }]}
                    value={field.value}
                    onChangeText={(t) => setDpoForm({ ...dpoForm, [field.key]: t })}
                    placeholder={field.label}
                    placeholderTextColor={A.textMuted}
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: A.cyan, opacity: savingDpo ? 0.6 : 1 }]}
                onPress={saveDpo}
                disabled={savingDpo}
              >
                {savingDpo ? <ActivityIndicator size="small" color={A.bg} /> : <Save size={18} color={A.bg} />}
                <Text style={[styles.saveBtnText, { color: A.bg }]}>{savingDpo ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Incident Modal */}
      <Modal visible={showIncidentModal} transparent animationType="slide" onRequestClose={() => setShowIncidentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: A.card, borderColor: A.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: A.border }]}>
              <Text style={[styles.modalTitle, { color: A.text }]}>Log Security Incident</Text>
              <TouchableOpacity style={[styles.modalClose, { backgroundColor: A.inputBg, borderColor: A.inputBorder }]} onPress={() => setShowIncidentModal(false)}>
                <XCircle size={18} color={A.textSub} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: A.textSub }]}>INCIDENT TYPE</Text>
                {['data_breach', 'unauthorized_access', 'system_compromise', 'other'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.optionRow, { borderColor: incidentForm.incident_type === type ? A.red : A.inputBorder, backgroundColor: incidentForm.incident_type === type ? A.redDim : A.inputBg }]}
                    onPress={() => setIncidentForm({ ...incidentForm, incident_type: type })}
                  >
                    <Text style={[styles.optionText, { color: A.text }]}>{type.replace(/_/g, ' ')}</Text>
                    {incidentForm.incident_type === type && <CheckCircle size={16} color={A.red} />}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: A.textSub }]}>SEVERITY</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['low', 'medium', 'high', 'critical'].map(sev => (
                    <TouchableOpacity
                      key={sev}
                      style={[styles.sevOption, { borderColor: incidentForm.severity === sev ? A.cyan : A.inputBorder, backgroundColor: incidentForm.severity === sev ? A.cyanDim : A.inputBg }]}
                      onPress={() => setIncidentForm({ ...incidentForm, severity: sev })}
                    >
                      <Text style={[styles.optionText, { color: incidentForm.severity === sev ? A.cyan : A.textSub, fontSize: 12 }]}>{sev}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: A.textSub }]}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: A.inputBg, borderColor: A.inputBorder, color: A.text }]}
                  value={incidentForm.description}
                  onChangeText={(t) => setIncidentForm({ ...incidentForm, description: t })}
                  placeholder="Describe the incident..."
                  placeholderTextColor={A.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: A.textSub }]}>AFFECTED INDIVIDUALS (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: A.inputBg, borderColor: A.inputBorder, color: A.text }]}
                  value={incidentForm.affected_individuals_count}
                  onChangeText={(t) => setIncidentForm({ ...incidentForm, affected_individuals_count: t })}
                  placeholder="Number"
                  placeholderTextColor={A.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: A.red, opacity: savingIncident ? 0.6 : 1 }]}
                onPress={submitIncident}
                disabled={savingIncident}
              >
                {savingIncident ? <ActivityIndicator size="small" color="#fff" /> : <AlertTriangle size={18} color="#fff" />}
                <Text style={[styles.saveBtnText, { color: '#fff' }]}>{savingIncident ? 'Logging...' : 'Log Incident'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Review Request Modal */}
      <Modal visible={!!reviewingRequest} transparent animationType="slide" onRequestClose={() => setReviewingRequest(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: A.card, borderColor: A.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: A.border }]}>
              <Text style={[styles.modalTitle, { color: A.text }]}>Review Privacy Request</Text>
              <TouchableOpacity style={[styles.modalClose, { backgroundColor: A.inputBg, borderColor: A.inputBorder }]} onPress={() => setReviewingRequest(null)}>
                <XCircle size={18} color={A.textSub} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 14 }}>
              <Text style={[styles.cardTitle, { color: A.text }]}>{reviewingRequest?.request_type.replace(/_/g, ' ')}</Text>
              {reviewingRequest?.customers?.full_name ? (
                <Text style={{ fontSize: 13, fontWeight: '600', color: A.cyan, marginBottom: 6 }}>
                  Requested by: {reviewingRequest.customers.full_name}
                </Text>
              ) : null}
              {reviewingRequest?.description ? <Text style={[styles.cardDesc, { color: A.textSub }]}>{reviewingRequest.description}</Text> : null}
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: A.textSub }]}>STATUS</Text>
                {['completed', 'rejected', 'in_review'].map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.optionRow, { borderColor: reviewStatus === st ? A.cyan : A.inputBorder, backgroundColor: reviewStatus === st ? A.cyanDim : A.inputBg }]}
                    onPress={() => setReviewStatus(st)}
                  >
                    <Text style={[styles.optionText, { color: A.text }]}>{st.replace(/_/g, ' ')}</Text>
                    {reviewStatus === st && <CheckCircle size={16} color={A.cyan} />}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: A.textSub }]}>ADMIN NOTES</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: A.inputBg, borderColor: A.inputBorder, color: A.text }]}
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                  placeholder="Add notes for the customer..."
                  placeholderTextColor={A.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: A.cyan }]} onPress={submitReview}>
                <Save size={18} color={A.bg} />
                <Text style={[styles.saveBtnText, { color: A.bg }]}>Update Request</Text>
              </TouchableOpacity>
            </View>
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
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  tabTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' as any, marginBottom: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardDate: { fontSize: 12, marginTop: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  severityText: { fontSize: 11, fontWeight: '700' },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeBadgeText: { fontSize: 10, fontWeight: '800' },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontWeight: '600' },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  reviewBtnText: { fontSize: 13, fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  editBtnText: { fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  infoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  addBtnText: { fontSize: 14, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 12, borderWidth: 1, borderRadius: 14 },
  emptyText: { fontSize: 14, fontWeight: '600' },
  noteBox: { marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  noteLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  noteText: { fontSize: 13, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalClose: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' as any },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 15, fontWeight: '500' },
  textArea: { borderWidth: 1.5, borderRadius: 12, padding: 14, minHeight: 100, fontSize: 14, fontWeight: '500' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: 10, padding: 12 },
  optionText: { fontSize: 14, fontWeight: '600' },
  sevOption: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: 8, paddingVertical: 10 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12 },
  saveBtnText: { fontSize: 15, fontWeight: '700' },
});
