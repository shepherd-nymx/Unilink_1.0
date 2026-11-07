import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { S } from '@/lib/shop-theme';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  type ShopOrder,
} from '@/lib/shop-types';
import { Search, Calendar } from 'lucide-react-native';

type FilterKey = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'all', label: 'All' },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inRange(orderDate: string, start: Date, end: Date): boolean {
  const t = new Date(orderDate).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function HistoryTab({ orders }: { orders: ShopOrder[] }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let result = orders;
    if (filter === 'today') result = orders.filter((o) => inRange(o.created_at, todayStart, todayEnd));
    else if (filter === 'yesterday') result = orders.filter((o) => inRange(o.created_at, yesterdayStart, todayStart));
    else if (filter === 'this_week') result = orders.filter((o) => new Date(o.created_at) >= weekStart);
    else if (filter === 'this_month') result = orders.filter((o) => new Date(o.created_at) >= monthStart);

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          (o.customer_name || '').toLowerCase().includes(q) ||
          (o.customer_phone || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [orders, filter, query]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchRow}>
        <Search size={16} color={S.textSub} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search order ID, customer name, phone..."
          placeholderTextColor={S.textMuted}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 0 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && { backgroundColor: S.cyanDim, borderColor: S.cyan }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, { color: active ? S.cyan : S.textSub }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Calendar size={40} color={S.textMuted} />
          <Text style={styles.emptyText}>No orders match your filters</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((order) => {
            const color = STATUS_COLORS[order.status] || S.textSub;
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
                  <View style={[styles.badge, { backgroundColor: `${color}20`, borderColor: color }]}>
                    <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[order.status] || order.status}</Text>
                  </View>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Customer</Text>
                  <Text style={styles.cardValue}>{order.customer_name || '—'}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Items</Text>
                  <Text style={styles.cardValue}>
                    {Array.isArray(order.products) ? `${order.products.length} item(s)` : '—'}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Total</Text>
                  <Text style={[styles.cardValue, { color: S.green, fontWeight: '700' }]}>
                    ${Number(order.total_amount).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Payment</Text>
                  <Text style={styles.cardValue}>
                    {PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method}
                  </Text>
                </View>
                {(order.driver_name || order.messenger_id) && (
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Driver</Text>
                    <Text style={styles.cardValue}>{order.driver_name || 'Assigned'}</Text>
                  </View>
                )}
                <View style={styles.cardFooter}>
                  <Text style={styles.cardTime}>
                    {new Date(order.created_at).toLocaleDateString()}{' '}
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {order.delivered_at && (
                    <Text style={[styles.cardTime, { color: S.green }]}>
                      Completed {new Date(order.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: S.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: S.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: S.text, fontSize: 14, paddingVertical: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: S.border,
    backgroundColor: S.card,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: S.textSub, fontSize: 14 },
  card: {
    backgroundColor: S.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: S.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: '700', color: S.text },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  cardLabel: { fontSize: 12, color: S.textSub },
  cardValue: { fontSize: 13, color: S.text },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: S.border,
  },
  cardTime: { fontSize: 11, color: S.textMuted },
});
