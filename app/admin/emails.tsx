import PageSkeleton from '@/components/PageSkeleton';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { A } from '@/lib/admin-theme';
import { loadUserDataAsync } from '@/lib/storage-service';
import { ArrowLeft, Search, X, Mail, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react-native';
import {
  fetchEmailLogs,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  statusColor,
  typeLabel,
  type EmailLogRow,
} from '@/lib/admin-email-logs-service';

export default function AdminEmailLogs() {
  const router = useRouter();
  const [logs, setLogs] = useState<EmailLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const result = await fetchEmailLogs({
      status: statusFilter,
      type: typeFilter,
      page,
      perPage,
    });
    setLogs(result.rows);
    setTotal(result.total);
    setLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [statusFilter, typeFilter, page, perPage]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  const filtered = search
    ? logs.filter(
        (l) =>
          l.recipient_email.toLowerCase().includes(search.toLowerCase()) ||
          (l.subject || '').toLowerCase().includes(search.toLowerCase()) ||
          (l.resend_id || '').toLowerCase().includes(search.toLowerCase()),
      )
    : logs;

  const formatDate = (ts: string | null) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const user = await loadUserDataAsync();
      if (!user || user.type !== 'admin') return;
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const res = await fetch(`${base}/functions/v1/admin-email-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ adminId: user.id, action: 'retry', emailId: id }),
      });
      if (res.ok) {
        await loadLogs();
      }
    } catch {
    } finally {
      setRetryingId(null);
    }
  };

  const currentStatusLabel = STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label || 'All Status';
  const currentTypeLabel = TYPE_OPTIONS.find((t) => t.value === typeFilter)?.label || 'All Types';

  return (
    <View style={{ flex: 1, backgroundColor: A.bg }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: A.surface,
          paddingTop: 56,
          paddingBottom: 16,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: A.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: A.cyanDim,
            borderWidth: 1,
            borderColor: A.cyan + '44',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={18} color={A.cyan} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted }}>
            TRANSACTIONAL
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: A.text }}>Email Logs</Text>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: A.cyanDim,
            borderWidth: 1,
            borderColor: A.cyan + '33',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: A.cyan }}>{total}</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 10 }}>
        {/* Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: A.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: A.border,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Search size={15} color={A.textSub} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: A.text, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
            placeholder="Search recipient, subject, or Resend ID..."
            placeholderTextColor={A.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color={A.textSub} />
            </TouchableOpacity>
          )}
        </View>

        {/* Status + Type dropdowns */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Status dropdown */}
          <View style={{ flex: 1, position: 'relative' as any }}>
            <TouchableOpacity
              onPress={() => {
                setShowStatusDropdown(!showStatusDropdown);
                setShowTypeDropdown(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: A.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: A.border,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: statusFilter !== 'all' ? A.cyan : A.textSub }}>
                {currentStatusLabel}
              </Text>
              {showStatusDropdown ? <ChevronUp size={14} color={A.textSub} /> : <ChevronDown size={14} color={A.textSub} />}
            </TouchableOpacity>
            {showStatusDropdown && (
              <View
                style={{
                  position: 'absolute' as any,
                  top: 44,
                  left: 0,
                  right: 0,
                  backgroundColor: A.card,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: A.borderBright,
                  zIndex: 100,
                  maxHeight: 280,
                  overflow: 'hidden',
                }}
              >
                <ScrollView style={{ maxHeight: 280 }}>
                  {STATUS_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        setStatusFilter(opt.value);
                        setShowStatusDropdown(false);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: statusFilter === opt.value ? A.cyanDim : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: statusFilter === opt.value ? '700' : '500',
                          color: statusFilter === opt.value ? A.cyan : A.textSub,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Type dropdown */}
          <View style={{ flex: 1, position: 'relative' as any }}>
            <TouchableOpacity
              onPress={() => {
                setShowTypeDropdown(!showTypeDropdown);
                setShowStatusDropdown(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: A.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: A.border,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: typeFilter !== 'all' ? A.cyan : A.textSub }}>
                {currentTypeLabel}
              </Text>
              {showTypeDropdown ? <ChevronUp size={14} color={A.textSub} /> : <ChevronDown size={14} color={A.textSub} />}
            </TouchableOpacity>
            {showTypeDropdown && (
              <View
                style={{
                  position: 'absolute' as any,
                  top: 44,
                  left: 0,
                  right: 0,
                  backgroundColor: A.card,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: A.borderBright,
                  zIndex: 100,
                  maxHeight: 280,
                  overflow: 'hidden',
                }}
              >
                <ScrollView style={{ maxHeight: 280 }}>
                  {TYPE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        setTypeFilter(opt.value);
                        setShowTypeDropdown(false);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: typeFilter === opt.value ? A.cyanDim : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: typeFilter === opt.value ? '700' : '500',
                          color: typeFilter === opt.value ? A.cyan : A.textSub,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {/* Refresh */}
        <TouchableOpacity
          onPress={loadLogs}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: A.card,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: A.border,
            paddingVertical: 8,
          }}
        >
          <RefreshCw size={13} color={A.textSub} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: A.textSub }}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? <PageSkeleton page="admin/emails" embedded fill/> : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 40 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: A.cyanDim,
              borderWidth: 1,
              borderColor: A.border,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Mail size={30} color={A.cyan} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: A.textSub }}>No emails found</Text>
          <Text style={{ fontSize: 13, color: A.textMuted, textAlign: 'center' }}>
            Try adjusting your filters or check back after emails are sent.
          </Text>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {filtered.map((log) => {
              const sc = statusColor(log.status);
              return (
                <View
                  key={log.id}
                  style={{
                    backgroundColor: A.card,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: A.border,
                    padding: 14,
                    gap: 8,
                  }}
                >
                  {/* Top row: type badge + status badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor: A.blueDim,
                        borderWidth: 1,
                        borderColor: A.blue + '33',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: A.blue }}>
                        {typeLabel(log.type).toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor: sc + '22',
                        borderWidth: 1,
                        borderColor: sc + '44',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: sc }}>{log.status.toUpperCase()}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: A.textMuted, marginLeft: 'auto' as any }}>
                      {formatDate(log.created_at)}
                    </Text>
                  </View>

                  {/* Subject */}
                  {log.subject && (
                    <Text style={{ fontSize: 14, fontWeight: '700', color: A.text }}>{log.subject}</Text>
                  )}

                  {/* Recipient */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Mail size={12} color={A.textSub} />
                    <Text style={{ fontSize: 12, color: A.textSub }}>{log.recipient_email}</Text>
                  </View>

                  {/* Order id */}
                  {log.order_id && (
                    <Text style={{ fontSize: 11, color: A.textMuted }}>
                      Order: {log.order_id.slice(0, 8)}
                    </Text>
                  )}

                  {/* Error */}
                  {log.error_message && (
                    <View
                      style={{
                        backgroundColor: A.redDim,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: A.red + '44',
                        padding: 8,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: A.red }}>{log.error_message}</Text>
                    </View>
                  )}

                  {/* Bottom row: resend id + retry button */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    {log.resend_id && (
                      <Text style={{ fontSize: 10, color: A.textMuted, flex: 1 }} numberOfLines={1}>
                        Resend ID: {log.resend_id.slice(0, 16)}…
                      </Text>
                    )}
                    {(log.status === 'failed' || log.status === 'pending') && (
                      <TouchableOpacity
                        onPress={() => handleRetry(log.id)}
                        disabled={retryingId === log.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          backgroundColor: A.cyanDim,
                          borderWidth: 1,
                          borderColor: A.cyan + '44',
                        }}
                      >
                        {retryingId === log.id ? (
                          <ActivityIndicator size={11} color={A.cyan} />
                        ) : (
                          <RefreshCw size={11} color={A.cyan} />
                        )}
                        <Text style={{ fontSize: 11, fontWeight: '700', color: A.cyan }}>Retry</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Pagination */}
            {total > perPage && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, paddingTop: 12, paddingBottom: 24 }}>
                <TouchableOpacity
                  onPress={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: page > 1 ? A.card : 'transparent',
                    borderWidth: 1,
                    borderColor: page > 1 ? A.border : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: page > 1 ? A.textSub : A.textMuted }}>
                    Prev
                  </Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 13, color: A.textSub, fontWeight: '600' }}>
                  {page} / {Math.ceil(total / perPage)}
                </Text>
                <TouchableOpacity
                  onPress={() => setPage(page + 1)}
                  disabled={page * perPage >= total}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: page * perPage < total ? A.card : 'transparent',
                    borderWidth: 1,
                    borderColor: page * perPage < total ? A.border : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: page * perPage < total ? A.textSub : A.textMuted }}>
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}
