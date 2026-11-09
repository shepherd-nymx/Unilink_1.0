import PageSkeleton from '@/components/PageSkeleton';
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { A } from '@/lib/admin-theme';
import { ArrowLeft, ScrollText, Search } from 'lucide-react-native';

type AuditLog = {
  id: string;
  user_id: string | null;
  role: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
};

const ROLE_COLORS: Record<string, string> = {
  customer: A.cyan,
  shop_owner: A.green,
  driver: A.orange,
  admin: A.red,
};

const ACTION_COLORS: Record<string, string> = {
  shop_availability_changed: A.amber,
  payment_methods_changed: A.blue,
  driver_assigned: A.cyan,
  driver_unassigned: A.orange,
  product_price_changed: A.green,
  shop_profile_changed: A.cyan,
  shop_suspended: A.red,
  driver_suspended: A.red,
  order_status_changed: A.amber,
};

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const loadLogs = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) { setError(err.message); return; }
    setLogs(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      await loadLogs();
      setLoading(false);
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const filteredLogs = logs.filter(l => {
    if (filter !== 'all' && l.role !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.action.toLowerCase().includes(q) ||
        (l.entity_type || '').toLowerCase().includes(q) ||
        (l.entity_id || '').toLowerCase().includes(q);
    }
    return true;
  });

  const filters = ['all', 'customer', 'shop_owner', 'driver', 'admin'];

  if (loading) {
    return <PageSkeleton page="admin/audit-logs" onBack={() => router.back()}/>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={A.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ScrollText size={18} color={A.amber} />
          <Text style={s.headerTitle}>Audit Logs</Text>
        </View>
      </View>

      {error ? (
        <View style={s.errorBar}>
          <Text style={{ color: A.red, fontSize: 12 }}>{error}</Text>
        </View>
      ) : null}

      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Search size={14} color={A.textSub} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search actions..."
            placeholderTextColor={A.textMuted}
          />
        </View>
      </View>

      <View style={s.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, filter === f && { backgroundColor: A.amberDim, borderColor: A.amber }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, { color: filter === f ? A.amber : A.textSub }]}>
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={A.amber} />}
      >
        {filteredLogs.length === 0 ? (
          <View style={s.emptyState}>
            <ScrollText size={40} color={A.textMuted} />
            <Text style={s.emptyText}>No audit logs yet</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {filteredLogs.map(log => {
              const roleColor = ROLE_COLORS[log.role] || A.textSub;
              const actionColor = ACTION_COLORS[log.action] || A.textSub;
              return (
                <View key={log.id} style={s.logCard}>
                  <View style={[s.logAccent, { backgroundColor: actionColor }]} />
                  <View style={{ flex: 1 }}>
                    <View style={s.logTopRow}>
                      <Text style={s.logAction}>{formatAction(log.action)}</Text>
                      <View style={[s.roleBadge, { backgroundColor: `${roleColor}20`, borderColor: roleColor }]}>
                        <Text style={[s.roleText, { color: roleColor }]}>{log.role.replace('_', ' ')}</Text>
                      </View>
                    </View>
                    {log.entity_type && (
                      <Text style={s.logEntity}>Entity: {log.entity_type}</Text>
                    )}
                    {log.details && (
                      <Text style={s.logDetails} numberOfLines={2}>
                        {JSON.stringify(log.details)}
                      </Text>
                    )}
                    <Text style={s.logTime}>{formatTime(log.created_at)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

import { TextInput } from 'react-native';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: A.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14,
    backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: A.card,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: A.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: A.text },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: A.redDim },
  searchRow: { paddingHorizontal: 16, paddingTop: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: A.inputBg, borderRadius: 10, borderWidth: 1, borderColor: A.inputBorder,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: A.text, fontSize: 14 },
  filterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: A.card, borderWidth: 1, borderColor: A.border,
  },
  filterText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: A.textSub, fontSize: 14 },
  logCard: {
    flexDirection: 'row', backgroundColor: A.card, borderRadius: 10,
    borderWidth: 1, borderColor: A.border, overflow: 'hidden',
  },
  logAccent: { width: 3 },
  logTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logAction: { fontSize: 14, fontWeight: '600', color: A.text, flex: 1 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  roleText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  logEntity: { fontSize: 12, color: A.textSub, marginTop: 4 },
  logDetails: { fontSize: 11, color: A.textMuted, marginTop: 4 },
  logTime: { fontSize: 11, color: A.textMuted, marginTop: 6 },
});
