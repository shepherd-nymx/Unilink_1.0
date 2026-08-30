import { useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { A } from '@/lib/admin-theme';
import {
  STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  type ShopOrder,
  type ShopProduct,
} from '@/lib/shop-types';
import { TrendingUp, TrendingDown, ShoppingBag, Users, Package, Truck, Lightbulb, TriangleAlert as AlertTriangle } from 'lucide-react-native';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <View style={[styles.statCard, { borderColor: `${color}40` }]}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RevenueBar({
  label,
  amount,
  maxAmount,
}: {
  label: string;
  amount: number;
  maxAmount: number;
}) {
  const heightPct = maxAmount > 0 ? Math.max((amount / maxAmount) * 100, 4) : 4;
  return (
    <View style={styles.barCol}>
      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { height: `${heightPct}%`, backgroundColor: amount > 0 ? A.cyan : A.border }]}
        />
      </View>
      <Text style={styles.barLabel}>{label}</Text>
      <Text style={styles.barAmt}>{amount > 0 ? fmtMoney(amount) : '—'}</Text>
    </View>
  );
}

export function AnalyticsTab({ orders, products }: { orders: ShopOrder[]; products: ShopProduct[] }) {
  const analytics = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const completed = orders.filter((o) => o.status === 'delivered');
    const cancelled = orders.filter((o) => o.status === 'cancelled');
    const pending = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));

    const sumIn = (list: ShopOrder[]) => list.reduce((s, o) => s + Number(o.total_amount), 0);

    const todayRev = sumIn(completed.filter((o) => inRange(o.created_at, todayStart, todayEnd)));
    const yesterdayRev = sumIn(completed.filter((o) => inRange(o.created_at, yesterdayStart, todayStart)));
    const weekRev = sumIn(completed.filter((o) => new Date(o.created_at) >= weekStart));
    const monthRev = sumIn(completed.filter((o) => new Date(o.created_at) >= monthStart));

    const dayTrend = yesterdayRev > 0 ? ((todayRev - yesterdayRev) / yesterdayRev) * 100 : todayRev > 0 ? 100 : 0;

    // last 7 days revenue
    const last7: { label: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dStart = new Date(todayStart.getTime() - i * 86400000);
      const dEnd = new Date(dStart.getTime() + 86400000);
      const dayLabel = dStart.toLocaleDateString([], { weekday: 'short' }).slice(0, 2);
      last7.push({
        label: dayLabel,
        amount: sumIn(completed.filter((o) => inRange(o.created_at, dStart, dEnd))),
      });
    }
    const maxDay = Math.max(...last7.map((d) => d.amount), 1);

    // customers
    const uniqueCustomers = new Set(orders.map((o) => o.customer_phone || o.customer_email || o.id));
    const customerCounts: Record<string, number> = {};
    orders.forEach((o) => {
      const key = o.customer_phone || o.customer_email || o.id;
      customerCounts[key] = (customerCounts[key] || 0) + 1;
    });
    const returning = Object.values(customerCounts).filter((c) => c > 1).length;
    const newCust = Object.keys(customerCounts).length - returning;

    // products
    const productQty: Record<string, number> = {};
    const productRev: Record<string, number> = {};
    completed.forEach((o) => {
      (Array.isArray(o.products) ? o.products : []).forEach((p: any) => {
        const name = p.name || 'Unknown';
        productQty[name] = (productQty[name] || 0) + (Number(p.qty) || 1);
        productRev[name] = (productRev[name] || 0) + Number(p.price) * (Number(p.qty) || 1);
      });
    });
    const bestSelling = Object.entries(productQty).sort((a, b) => b[1] - a[1])[0];
    const mostRevenue = Object.entries(productRev).sort((a, b) => b[1] - a[1])[0];
    const lowStock = products.filter((p) => p.stock <= 3);

    // delivery times
    const deliveredWithTime = completed.filter((o) => o.picked_up_at && o.delivered_at);
    const avgDeliveryMin = deliveredWithTime.length
      ? deliveredWithTime.reduce((s, o) => {
          const mins = (new Date(o.delivered_at!).getTime() - new Date(o.picked_up_at!).getTime()) / 60000;
          return s + mins;
        }, 0) / deliveredWithTime.length
      : 0;

    // payment distribution
    const payCounts: Record<string, number> = {};
    orders.forEach((o) => {
      payCounts[o.payment_method] = (payCounts[o.payment_method] || 0) + 1;
    });
    const totalOrders = orders.length || 1;
    const payEntries = Object.entries(payCounts).sort((a, b) => b[1] - a[1]);
    const topPayment = payEntries[0];

    return {
      todayRev,
      yesterdayRev,
      weekRev,
      monthRev,
      dayTrend,
      last7,
      maxDay,
      totalOrders: orders.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      cancelledCount: cancelled.length,
      totalCustomers: uniqueCustomers.size,
      returning,
      newCust,
      bestSelling,
      mostRevenue,
      lowStock,
      avgDeliveryMin,
      deliveredCount: completed.length,
      pendingDelivery: orders.filter((o) => ['assigned', 'picked_up', 'out_for_delivery'].includes(o.status)).length,
      payEntries,
      topPayment,
      totalOrdersForPay: totalOrders,
    };
  }, [orders, products]);

  const a = analytics;
  const hasData = a.totalOrders > 0;

  const insights: string[] = [];
  if (a.bestSelling) insights.push(`Your best-selling product is ${a.bestSelling[0]} (${a.bestSelling[1]} sold).`);
  if (a.mostRevenue) insights.push(`${a.mostRevenue[0]} generates the most revenue (${fmtMoney(a.mostRevenue[1])}).`);
  if (a.topPayment) {
    const label = PAYMENT_METHOD_LABELS[a.topPayment[0]] || a.topPayment[0];
    const pct = Math.round((a.topPayment[1] / a.totalOrdersForPay) * 100);
    insights.push(`${label} is your most-used payment method (${pct}% of orders).`);
  }
  if (a.lowStock.length > 0) {
    const names = a.lowStock.slice(0, 3).map((p) => p.name).join(', ');
    insights.push(`Low stock alert: ${names} ${a.lowStock.length > 3 ? 'and more' : ''} need restocking.`);
  }
  if (a.returning > a.newCust && a.returning > 0) {
    insights.push(`Great retention! ${a.returning} returning customers vs ${a.newCust} new.`);
  }
  if (a.avgDeliveryMin > 0) insights.push(`Average delivery time: ${Math.round(a.avgDeliveryMin)} minutes.`);

  return (
    <View style={{ gap: 18 }}>
      {/* Revenue cards */}
      <View>
        <Text style={styles.sectionTitle}>Revenue</Text>
        <View style={styles.statsRow}>
          <View style={styles.revCard}>
            <View style={styles.revTop}>
              <TrendingUp size={16} color={A.green} />
              <Text style={styles.revLabel}>Today</Text>
            </View>
            <Text style={styles.revValue}>{fmtMoney(a.todayRev)}</Text>
            {a.yesterdayRev > 0 && (
              <View style={styles.trendRow}>
                {a.dayTrend >= 0 ? (
                  <TrendingUp size={11} color={A.green} />
                ) : (
                  <TrendingDown size={11} color={A.red} />
                )}
                <Text style={[styles.trendText, { color: a.dayTrend >= 0 ? A.green : A.red }]}>
                  {a.dayTrend >= 0 ? '+' : ''}
                  {a.dayTrend.toFixed(0)}% vs yesterday
                </Text>
              </View>
            )}
          </View>
          <View style={styles.revCard}>
            <View style={styles.revTop}>
              <TrendingUp size={16} color={A.cyan} />
              <Text style={styles.revLabel}>This Week</Text>
            </View>
            <Text style={styles.revValue}>{fmtMoney(a.weekRev)}</Text>
          </View>
          <View style={styles.revCard}>
            <View style={styles.revTop}>
              <TrendingUp size={16} color={A.blue} />
              <Text style={styles.revLabel}>This Month</Text>
            </View>
            <Text style={styles.revValue}>{fmtMoney(a.monthRev)}</Text>
          </View>
        </View>
      </View>

      {/* 7-day revenue chart */}
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Revenue — Last 7 Days</Text>
        <View style={styles.barChart}>
          {a.last7.map((d, i) => (
            <RevenueBar key={i} label={d.label} amount={d.amount} maxAmount={a.maxDay} />
          ))}
        </View>
      </View>

      {/* Orders */}
      <View>
        <Text style={styles.sectionTitle}>Orders</Text>
        <View style={styles.statsRow}>
          <StatCard label="Total" value={String(a.totalOrders)} color={A.cyan} icon={<ShoppingBag size={16} color={A.cyan} />} />
          <StatCard label="Completed" value={String(a.completedCount)} color={A.green} icon={<ShoppingBag size={16} color={A.green} />} />
          <StatCard label="Pending" value={String(a.pendingCount)} color={A.amber} icon={<ShoppingBag size={16} color={A.amber} />} />
          <StatCard label="Cancelled" value={String(a.cancelledCount)} color={A.red} icon={<ShoppingBag size={16} color={A.red} />} />
        </View>
      </View>

      {/* Customers */}
      <View>
        <Text style={styles.sectionTitle}>Customers</Text>
        <View style={styles.statsRow}>
          <StatCard label="Total Served" value={String(a.totalCustomers)} color={A.cyan} icon={<Users size={16} color={A.cyan} />} />
          <StatCard label="Returning" value={String(a.returning)} color={A.green} icon={<Users size={16} color={A.green} />} />
          <StatCard label="New" value={String(a.newCust)} color={A.blue} icon={<Users size={16} color={A.blue} />} />
        </View>
      </View>

      {/* Delivery */}
      <View>
        <Text style={styles.sectionTitle}>Delivery</Text>
        <View style={styles.statsRow}>
          <StatCard label="Avg Time" value={a.avgDeliveryMin > 0 ? `${Math.round(a.avgDeliveryMin)}m` : '—'} color={A.orange} icon={<Truck size={16} color={A.orange} />} />
          <StatCard label="Completed" value={String(a.deliveredCount)} color={A.green} icon={<Truck size={16} color={A.green} />} />
          <StatCard label="In Transit" value={String(a.pendingDelivery)} color={A.amber} icon={<Truck size={16} color={A.amber} />} />
        </View>
      </View>

      {/* Products */}
      <View>
        <Text style={styles.sectionTitle}>Products</Text>
        <View style={styles.productInsightRow}>
          <View style={[styles.insightCard, { borderColor: `${A.green}40` }]}>
            <Package size={16} color={A.green} />
            <Text style={styles.insightTitle}>Best-Selling</Text>
            <Text style={styles.insightValue}>{a.bestSelling ? a.bestSelling[0] : '—'}</Text>
            {a.bestSelling && <Text style={styles.insightSub}>{a.bestSelling[1]} sold</Text>}
          </View>
          <View style={[styles.insightCard, { borderColor: `${A.cyan}40` }]}>
            <Package size={16} color={A.cyan} />
            <Text style={styles.insightTitle}>Most Revenue</Text>
            <Text style={styles.insightValue}>{a.mostRevenue ? a.mostRevenue[0] : '—'}</Text>
            {a.mostRevenue && <Text style={styles.insightSub}>{fmtMoney(a.mostRevenue[1])}</Text>}
          </View>
        </View>
        {a.lowStock.length > 0 && (
          <View style={[styles.lowStockCard, { borderColor: A.amber }]}>
            <AlertTriangle size={16} color={A.amber} />
            <Text style={[styles.insightValue, { flex: 1 }]}>
              {a.lowStock.length} product(s) low on stock:{' '}
              {a.lowStock.slice(0, 4).map((p) => `${p.name} (${p.stock})`).join(', ')}
              {a.lowStock.length > 4 ? '…' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Payment distribution */}
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Payment Methods</Text>
        {a.payEntries.length === 0 ? (
          <Text style={styles.noData}>No payment data yet</Text>
        ) : (
          a.payEntries.map(([method, count]) => {
            const pct = (count / a.totalOrdersForPay) * 100;
            const label = PAYMENT_METHOD_LABELS[method] || method;
            const color = method === 'paynow' ? A.cyan : method === 'pay_on_delivery' ? A.green : A.blue;
            return (
              <View key={method} style={styles.payRow}>
                <View style={styles.payRowTop}>
                  <Text style={styles.payLabel}>{label}</Text>
                  <Text style={styles.payCount}>
                    {count} ({pct.toFixed(0)}%)
                  </Text>
                </View>
                <View style={styles.payBarTrack}>
                  <Animated.View style={[styles.payBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Insights */}
      {hasData && insights.length > 0 && (
        <View style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
            <Lightbulb size={18} color={A.amber} />
            <Text style={styles.insightsTitle}>Insights</Text>
          </View>
          {insights.map((t, i) => (
            <View key={i} style={styles.insightBulletRow}>
              <View style={[styles.insightDot, { backgroundColor: A.amber }]} />
              <Text style={styles.insightBulletText}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {!hasData && (
        <View style={styles.empty}>
          <ShoppingBag size={40} color={A.textMuted} />
          <Text style={styles.emptyText}>No data yet — insights appear once you have orders</Text>
        </View>
      )}
    </View>
  );
}

function inRange(orderDate: string, start: Date, end: Date): boolean {
  const t = new Date(orderDate).getTime();
  return t >= start.getTime() && t < end.getTime();
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: '700', color: A.text, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: A.card,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: A.border,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: A.text },
  statLabel: { fontSize: 10, color: A.textSub },
  revCard: {
    flex: 1,
    backgroundColor: A.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: A.border,
    gap: 6,
  },
  revTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  revLabel: { fontSize: 11, color: A.textSub, fontWeight: '600' },
  revValue: { fontSize: 17, fontWeight: '800', color: A.text },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendText: { fontSize: 10, fontWeight: '600' },
  chartCard: { backgroundColor: A.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: A.border },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, marginTop: 10, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barTrack: { flex: 1, width: '100%', backgroundColor: A.inputBg, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 9, color: A.textSub, fontWeight: '600' },
  barAmt: { fontSize: 8, color: A.textMuted },
  productInsightRow: { flexDirection: 'row', gap: 8 },
  insightCard: {
    flex: 1,
    backgroundColor: A.card,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: A.border,
  },
  insightTitle: { fontSize: 10, color: A.textSub, fontWeight: '600', textTransform: 'uppercase' as any, letterSpacing: 0.5 },
  insightValue: { fontSize: 13, color: A.text, fontWeight: '600' },
  insightSub: { fontSize: 11, color: A.textSub },
  lowStockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: A.amberDim,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: A.amber,
  },
  payRow: { marginBottom: 12 },
  payRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  payLabel: { fontSize: 12, color: A.text, fontWeight: '600' },
  payCount: { fontSize: 11, color: A.textSub },
  payBarTrack: { height: 8, backgroundColor: A.inputBg, borderRadius: 4, overflow: 'hidden' },
  payBarFill: { height: '100%', borderRadius: 4 },
  insightsCard: { backgroundColor: A.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: `${A.amber}40` },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  insightsTitle: { fontSize: 15, fontWeight: '700', color: A.text },
  insightBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  insightDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  insightBulletText: { fontSize: 13, color: A.textSub, flex: 1, lineHeight: 18 },
  noData: { fontSize: 13, color: A.textSub, paddingVertical: 16, textAlign: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: A.textSub, fontSize: 14, textAlign: 'center' },
});
