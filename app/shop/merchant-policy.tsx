import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react-native';

type Policy = {
  id: string;
  version: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
};

export default function MerchantPolicy() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const P = '#0066ff';
  const BG = isDark ? '#050b16' : '#f0f4f8';
  const CARD = isDark ? '#0a1220' : '#ffffff';
  const BORDER = isDark ? '#1a2d4a' : '#e2e8f0';
  const TX = isDark ? '#e0eeff' : '#0a1929';
  const TX2 = isDark ? '#6a8fb0' : '#64748b';
  const TX3 = isDark ? '#3d5577' : '#94a3b8';

  useEffect(() => { loadPolicy(); }, []);

  const loadPolicy = async () => {
    try {
      const { data, error: err } = await supabase
        .from('merchant_policies')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .maybeSingle();
      if (err) throw err;
      setPolicy(data as Policy | null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const sections: { heading: string; body: string[] }[] = [];
    let current: { heading: string; body: string[] } | null = null;

    for (const line of lines) {
      if (/^\d+\.\s/.test(line.trim())) {
        if (current) sections.push(current);
        current = { heading: line.trim(), body: [] };
      } else if (current) {
        current.body.push(line);
      }
    }
    if (current) sections.push(current);

    return sections;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: BG, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={P} />
      </View>
    );
  }

  if (error || !policy) {
    return (
      <View style={[styles.container, { backgroundColor: BG }]}>
        <View style={[styles.header, { backgroundColor: CARD, borderBottomColor: BORDER }]}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: BORDER }]} onPress={() => router.back()}>
            <ArrowLeft size={18} color={TX} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: TX }]}>Merchant Policy</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <FileText size={40} color={TX3} />
          <Text style={{ color: TX2, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
            {error || 'No merchant policy found.'}
          </Text>
        </View>
      </View>
    );
  }

  const sections = renderContent(policy.content);

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.header, { backgroundColor: CARD, borderBottomColor: BORDER }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: BORDER }]} onPress={() => router.back()}>
          <ArrowLeft size={18} color={TX} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: TX }]}>Merchant Policy</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Hero banner */}
        <View style={[styles.heroBanner, { backgroundColor: CARD, borderColor: BORDER }]}>
          <View style={[styles.heroIcon, { backgroundColor: `${P}15` }]}>
            <ShieldCheck size={28} color={P} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: TX }]}>{policy.title}</Text>
            <Text style={[styles.heroVersion, { color: TX2 }]}>Version {policy.version}</Text>
          </View>
        </View>

        <View style={[styles.introBox, { backgroundColor: isDark ? 'rgba(0,102,255,0.08)' : 'rgba(0,102,255,0.05)', borderColor: `${P}30` }]}>
          <Text style={[styles.introText, { color: TX2 }]}>
            As a UniLink merchant, you are required to comply with the following policies.
            Failure to adhere may result in suspension or removal from the platform.
          </Text>
        </View>

        {/* Policy sections */}
        {sections.map((section, i) => (
          <View key={i} style={[styles.sectionCard, { backgroundColor: CARD, borderColor: BORDER }]}>
            <Text style={[styles.sectionHeading, { color: TX }]}>{section.heading}</Text>
            {section.body.map((line, j) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              const isSubItem = /^\(a\)|^\(b\)|^\(c\)|^\(d\)|^\(e\)|^\(f\)/.test(trimmed);
              const isSubSection = /^\d+\.\d+/.test(trimmed);
              return (
                <Text
                  key={j}
                  style={[
                    styles.sectionBody,
                    { color: TX2 },
                    isSubSection && { fontWeight: '600', color: TX, marginTop: 8 },
                    isSubItem && { paddingLeft: 16 },
                  ]}
                >
                  {trimmed}
                </Text>
              );
            })}
          </View>
        ))}

        <View style={{ height: 20 }} />
        <Text style={[styles.footerText, { color: TX3 }]}>
          Effective {new Date(policy.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  heroBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 14,
  },
  heroIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  heroTitle: { fontSize: 18, fontWeight: '800' },
  heroVersion: { fontSize: 12, marginTop: 3 },
  introBox: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  introText: { fontSize: 13, lineHeight: 20 },
  sectionCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionHeading: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  sectionBody: { fontSize: 13, lineHeight: 21, marginBottom: 2 },
  footerText: { fontSize: 11, textAlign: 'center', fontWeight: '600' },
});
