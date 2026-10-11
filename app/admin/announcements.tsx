import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Megaphone,
  Plus,
  Trash2,
  Pencil,
  X,
  Info,
  TriangleAlert,
  Siren,
  Check,
  Users,
  Truck,
  UsersRound,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { A } from '@/lib/admin-theme';

type Urgency = 'info' | 'warning' | 'critical';
type Audience = 'customers' | 'drivers' | 'all';

type Announcement = {
  id: string;
  message: string;
  urgency: Urgency;
  audience: Audience;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const URGENCY_META: Record<Urgency, { label: string; description: string; color: string; dim: string; icon: typeof Info }> = {
  info: {
    label: 'Info',
    description: 'General notice — updates and news',
    color: A.cyan,
    dim: A.cyanDim,
    icon: Info,
  },
  warning: {
    label: 'Warning',
    description: 'Important — delays, price changes',
    color: A.amber,
    dim: A.amberDim,
    icon: TriangleAlert,
  },
  critical: {
    label: 'Critical',
    description: 'Urgent — service outage, emergency',
    color: A.red,
    dim: A.redDim,
    icon: Siren,
  },
};

const AUDIENCE_META: Record<Audience, { label: string; description: string; color: string; icon: typeof Users }> = {
  customers: { label: 'Customers', description: 'Shoppers only', color: A.blue, icon: Users },
  drivers: { label: 'Drivers', description: 'Messengers only', color: A.green, icon: Truck },
  all: { label: 'Everyone', description: 'Customers and drivers', color: A.cyan, icon: UsersRound },
};

export default function AdminAnnouncements() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('info');
  const [audience, setAudience] = useState<Audience>('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (dbError) throw dbError;
      setAnnouncements((data || []) as Announcement[]);
    } catch {
      setError('Could not load announcements. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const openComposer = (announcement?: Announcement) => {
    if (announcement) {
      setEditingId(announcement.id);
      setMessage(announcement.message);
      setUrgency(announcement.urgency);
      setAudience(announcement.audience || 'customers');
    } else {
      setEditingId(null);
      setMessage('');
      setUrgency('info');
      setAudience('all');
    }
    setError('');
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingId(null);
    setMessage('');
    setUrgency('info');
    setAudience('all');
    setError('');
  };

  const handleSave = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Please write a message');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editingId) {
        const { error: dbError } = await supabase
          .from('announcements')
          .update({ message: trimmed, urgency, audience, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase
          .from('announcements')
          .insert({ message: trimmed, urgency, audience, is_active: true, created_by: 'Admin' });
        if (dbError) throw dbError;
      }
      closeComposer();
      await loadAnnouncements();
    } catch {
      setError('Could not save the announcement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (announcement: Announcement) => {
    try {
      const { error: dbError } = await supabase
        .from('announcements')
        .update({ is_active: !announcement.is_active })
        .eq('id', announcement.id);
      if (dbError) throw dbError;
      await loadAnnouncements();
    } catch {
      setError('Could not update the announcement. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error: dbError } = await supabase
        .from('announcements')
        .delete()
        .eq('id', deleteTarget.id);
      if (dbError) throw dbError;
      setDeleteTarget(null);
      await loadAnnouncements();
    } catch {
      setError('Could not delete the announcement. Please try again.');
      setDeleteTarget(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const activeCount = announcements.filter((a) => a.is_active).length;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: A.bg },
    header: {
      backgroundColor: A.surface,
      paddingTop: 60,
      paddingBottom: 20,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: A.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerBadge: {
      backgroundColor: A.cyanDim,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: 'flex-start',
      marginBottom: 6,
    },
    headerBadgeText: { color: A.cyan, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
    title: { fontSize: 28, fontWeight: '800', color: A.text },
    subtitle: { fontSize: 13, color: A.textSub, marginTop: 2 },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: A.card,
      borderWidth: 1,
      borderColor: A.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: { flex: 1 },
    content: { padding: 20, gap: 12 },
    summaryRow: { flexDirection: 'row', gap: 10 },
    summaryCard: {
      flex: 1,
      backgroundColor: A.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: A.border,
      padding: 14,
    },
    summaryValue: { fontSize: 24, fontWeight: '800', color: A.text },
    summaryLabel: { fontSize: 11, color: A.textSub, fontWeight: '600', marginTop: 2 },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: A.cyan,
      paddingVertical: 14,
      borderRadius: 12,
    },
    addButtonText: { color: A.bg, fontSize: 15, fontWeight: '800' },
    empty: {
      backgroundColor: A.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: A.border,
      padding: 32,
      alignItems: 'center',
      gap: 10,
    },
    emptyText: { color: A.textSub, fontSize: 14, textAlign: 'center' },
    card: {
      backgroundColor: A.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: A.border,
      padding: 16,
      gap: 10,
    },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    urgencyPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    urgencyPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
    inactivePill: {
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: A.border,
    },
    inactivePillText: { fontSize: 11, fontWeight: '700', color: A.textSub, letterSpacing: 0.5 },
    cardDate: { fontSize: 12, color: A.textMuted, marginLeft: 'auto' },
    messageText: { fontSize: 15, color: A.text, lineHeight: 22 },
    cardActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: A.border,
      backgroundColor: A.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    actionButtonText: { fontSize: 13, fontWeight: '700', color: A.textSub },
    toggleOn: { borderColor: A.green, backgroundColor: A.greenDim },
    toggleOnText: { color: A.green },
    toggleOff: { borderColor: A.amber, backgroundColor: A.amberDim },
    toggleOffText: { color: A.amber },
    deleteText: { color: A.red },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    composer: {
      backgroundColor: A.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: A.border,
      padding: 24,
      width: '100%',
      maxWidth: 520,
    },
    composerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    composerTitle: { fontSize: 20, fontWeight: '800', color: A.text },
    composerSubtitle: { fontSize: 13, color: A.textSub, marginBottom: 20, lineHeight: 19 },
    label: { fontSize: 13, fontWeight: '700', color: A.textSub, marginBottom: 8, letterSpacing: 0.5 },
    messageInput: {
      backgroundColor: A.card,
      borderWidth: 1,
      borderColor: A.border,
      borderRadius: 10,
      padding: 14,
      fontSize: 15,
      color: A.text,
      minHeight: 110,
      textAlignVertical: 'top',
      marginBottom: 20,
    },
    urgencyRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    urgencyOption: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: A.border,
      backgroundColor: A.card,
      padding: 12,
      gap: 6,
      alignItems: 'center',
    },
    urgencyOptionLabel: { fontSize: 13, fontWeight: '800', color: A.textSub },
    urgencyOptionDesc: { fontSize: 10, color: A.textMuted, textAlign: 'center' },
    counter: { fontSize: 11, color: A.textMuted, textAlign: 'right', marginTop: 6 },
    composerError: {
      backgroundColor: A.redDim,
      borderWidth: 1,
      borderColor: A.red,
      borderRadius: 8,
      padding: 10,
      marginBottom: 14,
    },
    composerErrorText: { color: A.red, fontSize: 13, textAlign: 'center' },
    composerButtons: { flexDirection: 'row', gap: 12 },
    composerButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: { backgroundColor: A.card, borderWidth: 1, borderColor: A.border },
    cancelButtonText: { color: A.textSub, fontSize: 15, fontWeight: '700' },
    saveButton: { backgroundColor: A.cyan, flexDirection: 'row', gap: 8 },
    saveButtonText: { color: A.bg, fontSize: 15, fontWeight: '800' },
    confirmOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    confirmBox: {
      backgroundColor: A.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: A.border,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      gap: 8,
    },
    confirmTitle: { fontSize: 18, fontWeight: '800', color: A.text },
    confirmText: { fontSize: 14, color: A.textSub, lineHeight: 21, marginBottom: 12 },
    confirmButtons: { flexDirection: 'row', gap: 12 },
    confirmDelete: { backgroundColor: A.red, flex: 1 },
    confirmDeleteText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <View style={s.headerBadge}>
            <Text style={s.headerBadgeText}>CONTROL PANEL</Text>
          </View>
          <Text style={s.title}>Announcements</Text>
          <Text style={s.subtitle}>Broadcast messages to every customer</Text>
        </View>
        <TouchableOpacity style={s.backButton} onPress={() => router.back()}>
          <X size={20} color={A.textSub} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{activeCount}</Text>
            <Text style={s.summaryLabel}>Live now</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{announcements.length}</Text>
            <Text style={s.summaryLabel}>Total</Text>
          </View>
        </View>

        <TouchableOpacity style={s.addButton} onPress={() => openComposer()} activeOpacity={0.8}>
          <Plus size={18} color={A.bg} />
          <Text style={s.addButtonText}>New Announcement</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={A.cyan} style={{ marginTop: 30 }} />
        ) : announcements.length === 0 ? (
          <View style={s.empty}>
            <Megaphone size={32} color={A.textMuted} />
            <Text style={s.emptyText}>
              No announcements yet. Write one and it will pop up for every customer.
            </Text>
          </View>
        ) : (
          announcements.map((item) => {
            const meta = URGENCY_META[item.urgency] || URGENCY_META.info;
            const Icon = meta.icon;
            return (
              <View key={item.id} style={s.card}>
                <View style={s.cardTopRow}>
                  <View style={[s.urgencyPill, { backgroundColor: meta.dim }]}>
                    <Icon size={12} color={meta.color} />
                    <Text style={[s.urgencyPillText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  {!item.is_active && (
                    <View style={s.inactivePill}>
                      <Text style={s.inactivePillText}>HIDDEN</Text>
                    </View>
                  )}
                  {(() => {
                    const audMeta = AUDIENCE_META[item.audience] || AUDIENCE_META.all;
                    const AudIcon = audMeta.icon;
                    return (
                      <View style={[s.urgencyPill, { backgroundColor: A.blueDim }]}>
                        <AudIcon size={12} color={A.blue} />
                        <Text style={[s.urgencyPillText, { color: A.blue }]}>{audMeta.label}</Text>
                      </View>
                    );
                  })()}
                  <Text style={s.cardDate}>{formatDate(item.created_at)}</Text>
                </View>

                <Text style={s.messageText}>{item.message}</Text>

                <View style={s.cardActions}>
                  <TouchableOpacity
                    style={[s.actionButton, item.is_active ? s.toggleOn : s.toggleOff]}
                    onPress={() => handleToggleActive(item)}
                  >
                    {item.is_active ? (
                      <>
                        <Check size={14} color={A.green} />
                        <Text style={[s.actionButtonText, s.toggleOnText]}>Live</Text>
                      </>
                    ) : (
                      <>
                        <Megaphone size={14} color={A.amber} />
                        <Text style={[s.actionButtonText, s.toggleOffText]}>Show</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionButton} onPress={() => openComposer(item)}>
                    <Pencil size={14} color={A.textSub} />
                    <Text style={s.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionButton, { marginLeft: 'auto' }]}
                    onPress={() => setDeleteTarget(item)}
                  >
                    <Trash2 size={14} color={A.red} />
                    <Text style={[s.actionButtonText, s.deleteText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={composerOpen} animationType="fade" transparent onRequestClose={closeComposer}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <Pressable style={{ flex: 1, width: '100%' }} onPress={closeComposer}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Pressable onPress={(e) => e.stopPropagation()} style={s.composer}>
                <View style={s.composerHeader}>
                  <Text style={s.composerTitle}>{editingId ? 'Edit Announcement' : 'New Announcement'}</Text>
                  <TouchableOpacity onPress={closeComposer}>
                    <X size={22} color={A.textSub} />
                  </TouchableOpacity>
                </View>
                <Text style={s.composerSubtitle}>
                  Pops up for the audience you pick. Hiding or editing it stops or refreshes the pop-up.
                </Text>

                <Text style={s.label}>MESSAGE</Text>
                <TextInput
                  style={s.messageInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="e.g. Scheduled maintenance tonight from 22:00 to 23:00."
                  placeholderTextColor={A.textMuted}
                  multiline
                  maxLength={1000}
                />
                <Text style={s.counter}>{message.length}/1000</Text>

                <Text style={s.label}>URGENCY LEVEL</Text>
                <View style={s.urgencyRow}>
                  {(['info', 'warning', 'critical'] as Urgency[]).map((level) => {
                    const meta = URGENCY_META[level];
                    const Icon = meta.icon;
                    const selected = urgency === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[s.urgencyOption, selected && { borderColor: meta.color, backgroundColor: meta.dim }]}
                        onPress={() => setUrgency(level)}
                      >
                        <Icon size={18} color={selected ? meta.color : A.textMuted} />
                        <Text style={s.urgencyOptionLabel}>{meta.label}</Text>
                        <Text style={s.urgencyOptionDesc}>{meta.description}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={s.label}>AUDIENCE</Text>
                <View style={s.urgencyRow}>
                  {(['customers', 'drivers', 'all'] as Audience[]).map((level) => {
                    const meta = AUDIENCE_META[level];
                    const Icon = meta.icon;
                    const selected = audience === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[s.urgencyOption, selected && { borderColor: meta.color, backgroundColor: meta.color + '1f' }]}
                        onPress={() => setAudience(level)}
                      >
                        <Icon size={18} color={selected ? meta.color : A.textMuted} />
                        <Text style={s.urgencyOptionLabel}>{meta.label}</Text>
                        <Text style={s.urgencyOptionDesc}>{meta.description}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {error ? (
                  <View style={s.composerError}>
                    <Text style={s.composerErrorText}>{error}</Text>
                  </View>
                ) : null}

                <View style={s.composerButtons}>
                  <TouchableOpacity style={[s.composerButton, s.cancelButton]} onPress={closeComposer}>
                    <Text style={s.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.composerButton, s.saveButton]} onPress={handleSave} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color={A.bg} />
                    ) : (
                      <>
                        <Megaphone size={16} color={A.bg} />
                        <Text style={s.saveButtonText}>{editingId ? 'Save Changes' : 'Publish'}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!deleteTarget} animationType="fade" transparent onRequestClose={() => setDeleteTarget(null)}>
        <View style={s.confirmOverlay}>
          <View style={s.confirmBox}>
            <Text style={s.confirmTitle}>Delete announcement?</Text>
            <Text style={s.confirmText}>
              Customers will stop seeing it immediately. This cannot be undone.
            </Text>
            <View style={s.confirmButtons}>
              <TouchableOpacity style={[s.composerButton, s.cancelButton]} onPress={() => setDeleteTarget(null)}>
                <Text style={s.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.composerButton, s.confirmDelete]} onPress={handleDelete}>
                <Text style={s.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
