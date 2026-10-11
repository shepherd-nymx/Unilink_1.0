import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X, Info, TriangleAlert, Siren } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type Urgency = 'info' | 'warning' | 'critical';

type Announcement = {
  id: string;
  message: string;
  urgency: Urgency;
  updated_at: string;
};

const URGENCY_STYLES: Record<
  Urgency,
  { label: string; color: string; dim: string; icon: typeof Info }
> = {
  info: { label: 'Announcement', color: '#1A73E8', dim: '#EBF3FF', icon: Info },
  warning: { label: 'Warning', color: '#B45309', dim: '#FEF3C7', icon: TriangleAlert },
  critical: { label: 'Critical Alert', color: '#B91C1C', dim: '#FEE2E2', icon: Siren },
};

const DISMISSED_KEY = 'dismissed_announcement';

export default function AnnouncementPopup({ visible }: { visible: boolean }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!visible) return;

    const loadAnnouncement = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('id, message, urgency, updated_at')
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          setAnnouncement(null);
          setDismissed(true);
          return;
        }

        const next = data as Announcement;
        setAnnouncement(next);

        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(DISMISSED_KEY);
          setDismissed(stored === `${next.id}:${next.updated_at}`);
        }
      } catch (err) {
        console.error('Failed to load announcement:', err);
        setAnnouncement(null);
        setDismissed(true);
      }
    };

    loadAnnouncement();

    const channel = supabase
      .channel(`announcements-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, loadAnnouncement)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible]);

  if (!visible || !announcement || dismissed) return null;

  const meta = URGENCY_STYLES[announcement.urgency] || URGENCY_STYLES.info;
  const Icon = meta.icon;

  const handleDismiss = () => {
    if (typeof window !== 'undefined' && announcement) {
      localStorage.setItem(DISMISSED_KEY, `${announcement.id}:${announcement.updated_at}`);
    }
    setDismissed(true);
  };

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(5,13,26,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 20,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 16,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: meta.dim },
    headerIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: meta.color, justifyContent: 'center', alignItems: 'center' },
    headerLabel: { flex: 1, fontSize: 13, fontWeight: '800', color: meta.color, letterSpacing: 1, textTransform: 'uppercase' },
    message: { fontSize: 15, lineHeight: 22, color: '#0A1628', padding: 20 },
    dismissRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
    dismissButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: meta.color,
      paddingVertical: 13,
      borderRadius: 12,
    },
    dismissButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  });

  return (
    <Modal visible animationType="fade" transparent onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Icon size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.headerLabel}>{meta.label}</Text>
            <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={meta.color} />
            </TouchableOpacity>
          </View>

          <Text style={styles.message}>{announcement.message}</Text>

          <View style={styles.dismissRow}>
            <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss} activeOpacity={0.85}>
              <X size={16} color="#FFFFFF" />
              <Text style={styles.dismissButtonText}>Got it, dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
