import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, Users, Truck, Package, UserCog, ShoppingBag, School, ChevronRight, Star, Mail } from 'lucide-react-native';
import { useNotifications } from '@/contexts/NotificationContext';
import { clearUserData } from '@/lib/storage-service';
import { A } from '@/lib/admin-theme';

export default function AdminDashboard() {
  const router = useRouter();
  const { requestNotificationPermission } = useNotifications();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    requestNotificationPermission();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const menuItems = [
    {
      label: 'Customers',
      description: 'Add and view customers',
      icon: Users,
      color: A.cyan,
      dimColor: A.cyanDim,
      route: '/admin/customers',
    },
    {
      label: 'Drivers',
      description: 'Add and view drivers',
      icon: Truck,
      color: A.green,
      dimColor: A.greenDim,
      route: '/admin/drivers',
    },
    {
      label: 'Admins',
      description: 'Add and view admins',
      icon: UserCog,
      color: A.red,
      dimColor: A.redDim,
      route: '/admin/admins',
    },
    {
      label: 'Deliveries',
      description: 'Track all orders',
      icon: Package,
      color: A.orange,
      dimColor: A.orangeDim,
      route: '/admin/deliveries',
    },
    {
      label: 'Groceries',
      description: 'Add and edit items',
      icon: ShoppingBag,
      color: A.amber,
      dimColor: A.amberDim,
      route: '/admin/groceries',
    },
    {
      label: 'Universities',
      description: 'Add and edit locations',
      icon: School,
      color: '#00ccff',
      dimColor: 'rgba(0,204,255,0.12)',
      route: '/admin/universities',
    },
    {
      label: 'Reviews',
      description: 'View and moderate driver reviews',
      icon: Star,
      color: '#FFD700',
      dimColor: 'rgba(255,215,0,0.12)',
      route: '/admin/reviews',
    },
    {
      label: 'Email Logs',
      description: 'View transactional email history',
      icon: Mail,
      color: A.cyan,
      dimColor: A.cyanDim,
      route: '/admin/emails',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: A.bg }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: A.surface,
          paddingTop: 60,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: A.border,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View>
          <View
            style={{
              backgroundColor: A.cyanDim,
              borderRadius: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              alignSelf: 'flex-start',
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                color: A.cyan,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 2,
              }}
            >
              CONTROL PANEL
            </Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: A.text }}>Admin Dashboard</Text>
          <Text style={{ fontSize: 13, color: A.textSub, marginTop: 2 }}>
            Manage users and deliveries
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            clearUserData();
            router.replace('/');
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: A.redDim,
            borderWidth: 1,
            borderColor: A.red,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <LogOut size={20} color={A.red} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            gap: 12,
          }}
        >
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.route}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.75}
                style={{
                  backgroundColor: A.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: A.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  overflow: 'hidden',
                }}
              >
                {/* Left accent bar */}
                <View
                  style={{
                    width: 3,
                    alignSelf: 'stretch',
                    backgroundColor: item.color,
                  }}
                />
                {/* Icon */}
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: item.dimColor,
                    margin: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Icon size={26} color={item.color} />
                </View>
                {/* Text */}
                <View style={{ flex: 1, paddingVertical: 16 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: A.text }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 13, color: A.textSub, marginTop: 2 }}>
                    {item.description}
                  </Text>
                </View>
                {/* Chevron */}
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
