import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  LogOut, Users, Truck, Package, UserCog, ShoppingBag, School, ChevronRight, Star,
  Mail, Store, ScrollText, Shield, CircleAlert as AlertCircle, CircleCheck as CheckCircle,
  DollarSign,
} from 'lucide-react-native';
import { useNotifications } from '@/contexts/NotificationContext';
import { clearUserData } from '@/lib/storage-service';
import { supabase } from '@/lib/supabase';
import { A } from '@/lib/admin-theme';

type StatItem = { label: string; value: number | null; icon: typeof Users; color: string; dimColor: string };
type AlertItem = { message: string; route: string; color: string; dimColor: string };
type Stats = {
  customers: number | null; activeShops: number | null; activeDrivers: number | null;
  eligibleDrivers: number | null; ordersToday: number | null; expiredSubs: number | null;
  totalCommissionOwed: number | null; overdueShops: number | null;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { requestNotificationPermission } = useNotifications();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [stats, setStats] = useState<Stats>({
    customers: null, activeShops: null, activeDrivers: null,
    eligibleDrivers: null, ordersToday: null, expiredSubs: null,
    totalCommissionOwed: null, overdueShops: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [incompleteShops, setIncompleteShops] = useState<number | null>(null);
  const [expiredDrivers, setExpiredDrivers] = useState<number | null>(null);

  useEffect(() => {
    requestNotificationPermission();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    loadStats();
  }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartISO = todayStart.toISOString();

      const [
        customersRes, activeShopsRes, activeDriversRes, eligibleDriversRes,
        ordersTodayRes, expiredSubsRes, incompleteShopsRes, expiredDriversRes,
        commissionRes,
      ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('shops').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('drivers').select('*', { count: 'exact', head: true })
          .eq('approval_status', 'approved').eq('suspended', false),
        supabase.from('drivers').select('*', { count: 'exact', head: true })
          .eq('approval_status', 'approved').eq('suspended', false).eq('subscription_status', 'active'),
        supabase.from('shop_orders').select('*', { count: 'exact', head: true }).gte('created_at', todayStartISO),
        supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('subscription_status', 'expired'),
        supabase.from('shops').select('*', { count: 'exact', head: true })
          .or('location_verified.is.null,location_verified.eq.false'),
        supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('subscription_status', 'expired'),
        supabase.from('shops').select('commission_deadline, commission_paid').eq('status', 'active'),
      ]);

      const now = new Date().toISOString();
      const overdueCount = (commissionRes.data || []).filter((s: any) =>
        s.commission_deadline &&
        new Date(s.commission_deadline).toISOString() < now &&
        Number(s.commission_paid) === 0
      ).length;

      setStats({
        customers: customersRes.count ?? 0, activeShops: activeShopsRes.count ?? 0,
        activeDrivers: activeDriversRes.count ?? 0, eligibleDrivers: eligibleDriversRes.count ?? 0,
        ordersToday: ordersTodayRes.count ?? 0, expiredSubs: expiredSubsRes.count ?? 0,
        totalCommissionOwed: null, overdueShops: overdueCount,
      });
      setIncompleteShops(incompleteShopsRes.count ?? 0);
      setExpiredDrivers(expiredDriversRes.count ?? 0);
    } catch {
    } finally {
      setStatsLoading(false);
    }
  };

  const statItems: StatItem[] = [
    { label: 'Total Customers', value: stats.customers, icon: Users, color: A.cyan, dimColor: A.cyanDim },
    { label: 'Active Shops', value: stats.activeShops, icon: Store, color: A.green, dimColor: A.greenDim },
    { label: 'Active Drivers', value: stats.activeDrivers, icon: Truck, color: A.blue, dimColor: A.blueDim },
    { label: 'Eligible Drivers', value: stats.eligibleDrivers, icon: UserCog, color: A.amber, dimColor: A.amberDim },
    { label: 'Orders Today', value: stats.ordersToday, icon: Package, color: A.orange, dimColor: A.orangeDim },
    { label: 'Commission Overdue', value: stats.overdueShops, icon: DollarSign, color: A.red, dimColor: A.redDim },
  ];

  const alerts: AlertItem[] = [];
  if (stats.overdueShops !== null && stats.overdueShops > 0) {
    alerts.push({
      message: `${stats.overdueShops} shop${stats.overdueShops > 1 ? 's' : ''} with overdue commission payments`,
      route: '/admin/shops', color: A.amber, dimColor: A.amberDim,
    });
  }
  if (incompleteShops !== null && incompleteShops > 0) {
    alerts.push({
      message: `${incompleteShops} shop${incompleteShops > 1 ? 's' : ''} with incomplete profiles (location not verified)`,
      route: '/admin/shops', color: A.amber, dimColor: A.amberDim,
    });
  }
  if (expiredDrivers !== null && expiredDrivers > 0) {
    alerts.push({
      message: `${expiredDrivers} driver${expiredDrivers > 1 ? 's' : ''} with expired subscriptions`,
      route: '/admin/drivers', color: A.red, dimColor: A.redDim,
    });
  }

  const menuItems = [
    { label: 'Customers', description: 'Add and view customers', icon: Users, color: A.cyan, dimColor: A.cyanDim, route: '/admin/customers' },
    { label: 'Drivers', description: 'Add and view drivers', icon: Truck, color: A.green, dimColor: A.greenDim, route: '/admin/drivers' },
    { label: 'Admins', description: 'Add and view admins', icon: UserCog, color: A.red, dimColor: A.redDim, route: '/admin/admins' },
    { label: 'Deliveries', description: 'Track all orders', icon: Package, color: A.orange, dimColor: A.orangeDim, route: '/admin/deliveries' },
    { label: 'Groceries', description: 'Add and edit items', icon: ShoppingBag, color: A.amber, dimColor: A.amberDim, route: '/admin/groceries' },
    { label: 'Universities', description: 'Add and edit locations', icon: School, color: '#00ccff', dimColor: 'rgba(0,204,255,0.12)', route: '/admin/universities' },
    { label: 'Reviews', description: 'View and moderate driver reviews', icon: Star, color: '#FFD700', dimColor: 'rgba(255,215,0,0.12)', route: '/admin/reviews' },
    { label: 'Email Logs', description: 'View transactional email history', icon: Mail, color: A.cyan, dimColor: A.cyanDim, route: '/admin/emails' },
    { label: 'Shops', description: 'Approve shops, set fees, view orders', icon: Store, color: '#10b981', dimColor: 'rgba(16,185,129,0.12)', route: '/admin/shops' },
    { label: 'DPO & Compliance', description: 'Privacy requests, DPO, data register, incidents', icon: Shield, color: A.cyan, dimColor: A.cyanDim, route: '/admin/compliance' },
    { label: 'Audit Logs', description: 'View system audit trail', icon: ScrollText, color: A.amber, dimColor: A.amberDim, route: '/admin/audit-logs' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: A.bg }}>
      <View
        style={{
          backgroundColor: A.surface, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20,
          borderBottomWidth: 1, borderBottomColor: A.border, flexDirection: 'row',
          justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <View>
          <View
            style={{
              backgroundColor: A.cyanDim, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3,
              alignSelf: 'flex-start', marginBottom: 6,
            }}
          >
            <Text style={{ color: A.cyan, fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>CONTROL PANEL</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: A.text }}>Admin Dashboard</Text>
          <Text style={{ fontSize: 13, color: A.textSub, marginTop: 2 }}>Manage users and deliveries</Text>
        </View>
        <TouchableOpacity
          onPress={() => { clearUserData(); router.replace('/'); }}
          style={{
            width: 40, height: 40, borderRadius: 10, backgroundColor: A.redDim,
            borderWidth: 1, borderColor: A.red, justifyContent: 'center', alignItems: 'center',
          }}
        >
          <LogOut size={20} color={A.red} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], gap: 12 }}>
          <View>
            <Text
              style={{
                fontSize: 11, fontWeight: '700', color: A.textSub, letterSpacing: 1.5,
                textTransform: 'uppercase', marginBottom: 10,
              }}
            >
              Platform Monitoring
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
              {statItems.map((stat) => {
                const Icon = stat.icon;
                return (
                  <View
                    key={stat.label}
                    style={{ width: '48%', backgroundColor: A.card, borderRadius: 12, borderWidth: 1, borderColor: A.border, padding: 14 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <View
                        style={{
                          width: 32, height: 32, borderRadius: 8, backgroundColor: stat.dimColor,
                          justifyContent: 'center', alignItems: 'center',
                        }}
                      >
                        <Icon size={16} color={stat.color} />
                      </View>
                      <Text style={{ fontSize: 11, color: A.textSub, fontWeight: '600', flex: 1 }} numberOfLines={2}>
                        {stat.label}
                      </Text>
                    </View>
                    {statsLoading ? (
                      <ActivityIndicator size="small" color={A.cyan} />
                    ) : (
                      <Text style={{ fontSize: 24, fontWeight: '800', color: A.text }}>{stat.value ?? 0}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View>
            <Text
              style={{
                fontSize: 11, fontWeight: '700', color: A.textSub, letterSpacing: 1.5,
                textTransform: 'uppercase', marginBottom: 10,
              }}
            >
              Alerts
            </Text>
            {statsLoading ? null : alerts.length === 0 ? (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: A.greenDim,
                  borderRadius: 10, borderWidth: 1, borderColor: A.green, padding: 12,
                }}
              >
                <CheckCircle size={16} color={A.green} />
                <Text style={{ color: A.green, fontSize: 13, fontWeight: '600' }}>All systems operational</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {alerts.map((alert, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => router.push(alert.route as any)}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: alert.dimColor,
                      borderRadius: 10, borderWidth: 1, borderColor: alert.color, padding: 12,
                    }}
                  >
                    <AlertCircle size={16} color={alert.color} />
                    <Text style={{ flex: 1, color: alert.color, fontSize: 12, fontWeight: '600' }}>{alert.message}</Text>
                    <ChevronRight size={16} color={alert.color} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.route}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.75}
                style={{
                  backgroundColor: A.card, borderRadius: 14, borderWidth: 1, borderColor: A.border,
                  flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
                }}
              >
                <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: item.color }} />
                <View
                  style={{
                    width: 56, height: 56, borderRadius: 12, backgroundColor: item.dimColor,
                    margin: 16, justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  <Icon size={26} color={item.color} />
                </View>
                <View style={{ flex: 1, paddingVertical: 16 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: A.text }}>{item.label}</Text>
                  <Text style={{ fontSize: 13, color: A.textSub, marginTop: 2 }}>{item.description}</Text>
                </View>
                <View style={{ paddingRight: 16 }}>
                  <ChevronRight size={20} color={A.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
