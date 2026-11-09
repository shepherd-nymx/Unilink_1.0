import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Linking,
  Image,
  Switch,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LogOut, ShoppingCart, ShoppingBag, Car, User, CircleAlert as AlertCircle, History, ChevronDown, ChevronUp, Plus, X, Package, Search, Star, CircleCheck as CheckCircle, Camera, Image as ImageIcon, MessageCircle, Circle as HelpCircle, Bell, Truck, CreditCard, Share2, Mail, Link2, Smartphone, Home, ChevronRight } from 'lucide-react-native';
import { Share as RNShare } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import AddCustomItemModal from '@/components/AddCustomItemModal';
import LocationSelector from '@/components/LocationSelector';
import { useTermsGuard } from '@/hooks/useTermsGuard';
import { useHardwareBackExit } from '@/hooks/useHardwareBackExit';
import { useNotifications } from '@/contexts/NotificationContext';
import { setCurrentUser, registerForPushNotificationsOnLogin } from '@/lib/notification-service';
import { saveUserData, clearUserData, loadUserData } from '@/lib/storage-service';
import { startPaynowPayment, generateReference } from '@/lib/paynow-service';
import { validateUpload } from '@/lib/upload-validation';
import NotificationPermissionModal from '@/components/NotificationPermissionModal';
import CustomerNavigation from '@/components/CustomerNavigation';
import InAppNotificationBanner from '@/components/InAppNotificationBanner';
import DriverSelectionModal from '@/components/DriverSelectionModal';
import OpenRequestWaitingModal from '@/components/OpenRequestWaitingModal';
import CustomerTutorial from '@/components/CustomerTutorial';
import AnnouncementPopup from '@/components/AnnouncementPopup';
import AnimatedDeliveryBackground from '@/components/AnimatedDeliveryBackground';
import { CustomerDashboardLightHeader, CustomerGroceryBanner, customerLightOverrides, lightDashboard } from '@/components/CustomerDashboardLight';

const CACHE_PREFIX = 'cache_customer_';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function saveCache<T>(key: string, data: T): void {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() } as CacheEntry<T>));
  } catch {}
}

function loadCache<T>(key: string): T | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return entry?.data ?? null;
  } catch {
    return null;
  }
}

function isOnline(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

type Category = {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
};

type GroceryItem = {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
  quantity: number;
  category_id: string | null;
  categories?: Category;
};

type CustomItem = {
  id: string;
  name: string;
  quantity: number;
  approximate_price: number;
  is_custom: boolean;
};

type Driver = {
  id: string;
  full_name: string;
  phone_number: string;
  delivery_type: string[];
  payment_methods: string[];
  is_available: boolean;
  location: string;
  fee_up_to_10: number;
  fee_up_to_20: number;
  fee_up_to_30: number;
  fee_up_to_40: number;
  fee_up_to_50: number;
  fee_up_to_100: number;
  fee_up_to_200: number;
  fee_up_to_300: number;
  fee_up_to_400: number;
  fee_up_to_500: number;
  average_rating: number;
  total_ratings: number;
  profile_picture_url?: string;
  availability_start_time?: string;
  availability_end_time?: string;
  availability_days?: string[];
};

export default function CustomerDashboard() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [resolvedCustomerId] = useState<string | undefined>(() => {
    const fromParams = params.customerId as string;
    if (fromParams) return fromParams;
    const stored = loadUserData();
    return stored?.type === 'customer' ? stored.id : undefined;
  });
  const customerId = resolvedCustomerId;
  const customerName = params.customerName as string;
  const { colors, isDark } = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const desktopLight = !isDark && viewportWidth >= 1000;
  const contentRef = useRef<ScrollView>(null);
  const { isChecking, isAccepted } = useTermsGuard('customer');
  useHardwareBackExit();
  const { unreadMessageCount, shopOrderUpdatesCount, inAppMessage, clearInAppMessage, requestNotificationPermission } = useNotifications();
  // Preset catalog selections were removed; retain the existing order payload shape.
  const groceryItems: GroceryItem[] = [];
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentOption, setPaymentOption] = useState<'pay_on_delivery' | 'paynow'>('pay_on_delivery');
  const [deliveryMethod, setDeliveryMethod] = useState<'walking' | 'vehicle'>('vehicle');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [customerCoords, setCustomerCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [preferredShops, setPreferredShops] = useState('');
  const [notificationDot, setNotificationDot] = useState<'yellow' | 'green' | null>(null);
  const [expiredNotification, setExpiredNotification] = useState<string | null>(null);
  const expiredOrderIds = useRef<Set<string>>(new Set());
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [acceptedOrder, setAcceptedOrder] = useState<any>(null);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [selectedDriverForReviews, setSelectedDriverForReviews] = useState<Driver | null>(null);
  const [driverReviews, setDriverReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [scheduleOrder, setScheduleOrder] = useState(false);
  const [itemImage, setItemImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [confirmedLocation, setConfirmedLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<'direct' | 'open_request'>('direct');
  const [showDriverSelectionModal, setShowDriverSelectionModal] = useState(false);
  const [showOpenRequestWaiting, setShowOpenRequestWaiting] = useState(false);
  const [openRequestDeliveryId, setOpenRequestDeliveryId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(true);
  const [fetchedName, setFetchedName] = useState<string | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shopUpdatesBaseline, setShopUpdatesBaseline] = useState(0);
  const scrollHintAnim = useRef(new Animated.Value(0)).current;
  const scrollHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SHARE_URL = 'https://unilinkbase.com';
  const SHARE_MESSAGE = 'Check out UniLink — get groceries and deliveries brought straight to you: ' + SHARE_URL;

  const handleShare = () => {
    if (Platform.OS !== 'web') {
      RNShare.share({ message: SHARE_MESSAGE }).catch(() => {});
      return;
    }
    setShowShareModal(true);
  };

  const shareViaWhatsApp = () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(SHARE_MESSAGE), '_blank');
    setShowShareModal(false);
  };

  const shareViaSMS = () => {
    window.open('sms:?&body=' + encodeURIComponent(SHARE_MESSAGE), '_self');
    setShowShareModal(false);
  };

  const shareViaEmail = () => {
    window.open('mailto:?subject=' + encodeURIComponent('Check out UniLink') + '&body=' + encodeURIComponent(SHARE_MESSAGE));
    setShowShareModal(false);
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {}
  };

  const tryNativeShare = async () => {
    setShowShareModal(false);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'UniLink', text: SHARE_MESSAGE, url: SHARE_URL });
      } else {
        await copyShareLink();
      }
    } catch {}
  };

  useEffect(() => {
    if (!customerId) {
      router.replace('/customer/login');
      return;
    }

    setCurrentUser(customerId, 'customer');
    saveUserData({ id: customerId, type: 'customer' });
    registerForPushNotificationsOnLogin(customerId, 'customer').catch(() => {});
    void loadCustomerData().finally(() => setLoading(false));
    loadDrivers();
    loadNotificationStatus();
    checkExpiredOrders();

    const tutorialKey = `tutorial_seen_${customerId}`;
    const seen = typeof window !== 'undefined' ? localStorage.getItem(tutorialKey) : null;
    if (!seen) {
      setTimeout(() => setShowTutorial(true), 1200);
    }

    const expirationInterval = setInterval(() => {
      checkExpiredOrders();
    }, 30000);

    const channel = supabase
      .channel(`customer-dashboard-updates-${customerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `customer_id=eq.${customerId}`,
        },
        async (payload) => {
          loadNotificationStatus();

          if (payload.eventType === 'UPDATE' && payload.new.status === 'accepted') {
            if (payload.new.delivery_mode === 'open_request') {
              return;
            }
            const { data: orderData } = await supabase
              .from('deliveries')
              .select(`
                *,
                drivers (
                  full_name,
                  phone_number
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (orderData) {
              setAcceptedOrder(orderData);
              setShowPaymentModal(true);
            }
          }

          if (payload.eventType === 'UPDATE' && payload.new.status === 'declined') {
            setNotificationDot('yellow');
            setExpiredNotification('Your order was declined by the driver. Please select another driver or place a new order.');
            setTimeout(() => {
              setNotificationDot(null);
              setExpiredNotification(null);
            }, 10000);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(expirationInterval);
      supabase.removeChannel(channel);
    };
  }, [customerId, requestNotificationPermission]);

  useFocusEffect(
    useCallback(() => {
      if (customerId) loadDrivers();
    }, [customerId])
  );

  useEffect(() => {
    setSelectedDriver(null);
  }, [deliveryMethod, paymentOption]);

  const loadCustomerData = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('customers')
        .select('latitude, longitude, full_name')
        .eq('id', customerId!)
        .single();

      if (dbError) throw dbError;

      if (data?.full_name) setFetchedName(data.full_name);

      if (data?.latitude && data?.longitude) {
        setCustomerCoords({
          latitude: data.latitude,
          longitude: data.longitude,
        });
      }

      saveCache(`customer_${customerId}`, data);
    } catch (err: any) {
      console.error('Failed to load customer data:', err);
      const cached = loadCache<{ latitude: number; longitude: number; full_name: string }>(`customer_${customerId}`);
      if (cached) {
        if (cached.full_name) setFetchedName(cached.full_name);
        if (cached.latitude && cached.longitude) {
          setCustomerCoords({ latitude: cached.latitude, longitude: cached.longitude });
        }
      }
    }
  };

  const loadDrivers = async () => {
    try {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('university_id')
        .eq('id', customerId!)
        .single();

      if (customerError) throw customerError;

      const { data, error: dbError } = await supabase
        .from('drivers')
        .select('id, full_name, phone_number, delivery_type, payment_methods, is_available, address, fee_up_to_10, fee_up_to_20, fee_up_to_30, fee_up_to_40, fee_up_to_50, fee_up_to_100, fee_up_to_200, fee_up_to_300, fee_up_to_400, fee_up_to_500, average_rating, total_ratings, profile_picture_url, approval_status, university_id, active_university_id, availability_start_time, availability_end_time, availability_days, whatsapp_number')
        .eq('is_available', true)
        .eq('approval_status', 'approved')
        .gt('key_expires_at', new Date().toISOString())
        .or(`active_university_id.eq.${customer.university_id},and(active_university_id.is.null,university_id.eq.${customer.university_id})`)
        .order('average_rating', { ascending: false });

      if (dbError) throw dbError;

      const driversWithLocation = data?.map(driver => ({
        ...driver,
        location: driver.address || 'Not specified'
      })) || [];

      setDrivers(driversWithLocation);
      saveCache(`drivers_${customerId}`, driversWithLocation);
    } catch (err: any) {
      console.error('Failed to load drivers:', err);
      const cachedDrivers = loadCache<Driver[]>(`drivers_${customerId}`);
      if (cachedDrivers) {
        setDrivers(cachedDrivers);
      }
    }
  };

  const checkExpiredOrders = async () => {
    try {
      const { data: pendingOrders } = await supabase
        .from('deliveries')
        .select('id, created_at')
        .eq('customer_id', customerId!)
        .eq('status', 'pending');

      if (pendingOrders && pendingOrders.length > 0) {
        const now = new Date().getTime();
        const expiredOrders = pendingOrders.filter(order => {
          const orderTime = new Date(order.created_at).getTime();
          const minutesPassed = (now - orderTime) / (1000 * 60);
          return minutesPassed >= 10 && !expiredOrderIds.current.has(order.id);
        });

        if (expiredOrders.length > 0) {
          for (const order of expiredOrders) {
            expiredOrderIds.current.add(order.id);
            const { error: expiryError } = await supabase
              .from('deliveries')
              .update({ status: 'cancelled' })
              .eq('id', order.id)
              .eq('status', 'pending');
            if (expiryError) {
              expiredOrderIds.current.delete(order.id);
              continue;
            }
          }

          if (expiredOrders.some(order => expiredOrderIds.current.has(order.id))) {
            setExpiredNotification('Your order expired after 10 minutes without being accepted. Please place a new order.');
            setTimeout(() => setExpiredNotification(null), 8000);
            loadNotificationStatus();
          }
        }
      }
    } catch (err: any) {
      console.error('Error checking expired orders:', err);
    }
  };

  const loadNotificationStatus = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('deliveries')
        .select('status')
        .eq('customer_id', customerId!)
        .in('status', ['pending', 'accepted', 'in_progress']);

      if (dbError) throw dbError;

      if (!data || data.length === 0) {
        setNotificationDot(null);
        return;
      }

      const hasPending = data.some(delivery => delivery.status === 'pending');
      const hasAcceptedOrInProgress = data.some(
        delivery => delivery.status === 'accepted' || delivery.status === 'in_progress'
      );

      if (hasPending) {
        setNotificationDot('yellow');
      } else if (hasAcceptedOrInProgress) {
        setNotificationDot('green');
      } else {
        setNotificationDot(null);
      }
    } catch (err: any) {
      console.error('Failed to load notification status:', err);
    }
  };

  const loadDriverReviews = async (driverId: string) => {
    try {
      setLoadingReviews(true);
      const { data, error: dbError } = await supabase
        .from('driver_ratings')
        .select(`
          id,
          rating,
          review_text,
          created_at,
          customers (
            full_name
          )
        `)
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setDriverReviews(data || []);
    } catch (err: any) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleViewReviews = (driver: Driver) => {
    setSelectedDriverForReviews(driver);
    setShowReviewsModal(true);
    loadDriverReviews(driver.id);
  };

  const calculateTotal = () => {
    const groceryTotal = groceryItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const customTotal = customItems.reduce((sum, item) => sum + item.approximate_price * item.quantity, 0);
    return groceryTotal + customTotal;
  };

  const totalItems = groceryItems.reduce((sum, i) => sum + i.quantity, 0) + customItems.length;

  const addCustomItem = (item: CustomItem) => {
    setCustomItems(prev => [...prev, item]);
  };

  const removeCustomItem = (id: string) => {
    setCustomItems(prev => prev.filter(item => item.id !== id));
  };

  const getDeliveryFee = (total: number, driver?: Driver) => {
    if (!driver) {
      return 0;
    }

    if (total <= 10) return driver.fee_up_to_10;
    if (total <= 20) return driver.fee_up_to_20;
    if (total <= 30) return driver.fee_up_to_30;
    if (total <= 40) return driver.fee_up_to_40;
    if (total <= 50) return driver.fee_up_to_50;
    if (total <= 100) return driver.fee_up_to_100;
    if (total <= 200) return driver.fee_up_to_200;
    if (total <= 300) return driver.fee_up_to_300;
    if (total <= 400) return driver.fee_up_to_400;
    if (total <= 500) return driver.fee_up_to_500;
    return driver.fee_up_to_500;
  };

  const getCommissionTier = (total: number) => {
    if (total <= 10) return 'Up to $10';
    if (total <= 20) return '$10 - $20';
    if (total <= 30) return '$20 - $30';
    if (total <= 40) return '$30 - $40';
    if (total <= 50) return '$40 - $50';
    if (total <= 100) return '$50 - $100';
    if (total <= 200) return '$100 - $200';
    if (total <= 300) return '$200 - $300';
    if (total <= 400) return '$300 - $400';
    if (total <= 500) return '$400 - $500';
    return 'Over $500';
  };

  const isDriverWithinAvailableWindow = (driver: Driver): boolean => {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()];

    if (driver.availability_days && driver.availability_days.length > 0) {
      if (!driver.availability_days.includes(todayName)) return false;
    }

    if (driver.availability_start_time && driver.availability_end_time) {
      const [startH, startM] = driver.availability_start_time.split(':').map(Number);
      const [endH, endM] = driver.availability_end_time.split(':').map(Number);
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;
      if (nowMins < startMins || nowMins > endMins) return false;
    } else if (driver.availability_start_time) {
      const [startH, startM] = driver.availability_start_time.split(':').map(Number);
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const startMins = startH * 60 + startM;
      if (nowMins < startMins) return false;
    } else if (driver.availability_end_time) {
      const [endH, endM] = driver.availability_end_time.split(':').map(Number);
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const endMins = endH * 60 + endM;
      if (nowMins > endMins) return false;
    }

    return true;
  };

  const getFilteredDrivers = () => {
    return drivers.filter(driver => {
      const supportsDeliveryMethod = driver.delivery_type?.includes(deliveryMethod);
      const supportsPaymentMethod = driver.payment_methods?.includes(paymentOption);
      const matchesSearch = driverSearchQuery.trim() === '' ||
        driver.full_name.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
        driver.location.toLowerCase().includes(driverSearchQuery.toLowerCase());
      const withinWindow = isDriverWithinAvailableWindow(driver);
      return supportsDeliveryMethod && supportsPaymentMethod && matchesSearch && withinWindow;
    });
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        setError('Permission to access gallery is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setItemImage(result.assets[0].uri);
      }
    } catch (err: any) {
      console.error('Failed to pick image:', err);
      setError('Could not pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        setError('Permission to access camera is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setItemImage(result.assets[0].uri);
      }
    } catch (err: any) {
      console.error('Failed to take photo:', err);
      setError('Could not take photo. Please try again.');
    }
  };

  const uploadItemImage = async (): Promise<string | null> => {
    if (!itemImage) return null;

    try {
      setUploadingImage(true);

      let fileData: Blob | File;
      const fileName = `${customerId}-${Date.now()}.jpg`;
      const filePath = `${customerId}/${fileName}`;

      if (Platform.OS === 'web') {
        const response = await fetch(itemImage);
        fileData = await response.blob();
      } else {
        const response = await fetch(itemImage);
        fileData = await response.blob();
      }

      const check = await validateUpload({ blob: fileData, fileNameOrUri: itemImage });
      if (!check.ok) {
        setError(check.reason);
        return null;
      }

      const { data, error: uploadError } = await supabase.storage
        .from('delivery-item-images')
        .upload(filePath, fileData, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('delivery-item-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      console.error('Failed to upload image:', err);
      setError('Could not upload image. Please try again.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLocationConfirm = (location: { latitude: number; longitude: number; address?: string; source: string }) => {
    setConfirmedLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
    });
    setError('');
  };

  const initiateOrderPlacement = () => {
    const selectedItems = groceryItems.filter(item => item.quantity > 0);

    if (selectedItems.length === 0 && customItems.length === 0) {
      setError('Please select at least one item or add a custom item');
      return;
    }

    if (deliveryMode === 'direct' && !selectedDriver) {
      setError('Please select a driver or choose Open Request');
      return;
    }

    setShowLocationSelector(true);
  };

  const placeOrder = async () => {
    if (!confirmedLocation) {
      setError('Please confirm your delivery location');
      return;
    }

    const selectedItems = groceryItems.filter(item => item.quantity > 0);

    if (selectedItems.length === 0 && customItems.length === 0) {
      setError('Please select at least one item or add a custom item');
      return;
    }

    if (deliveryMode === 'direct' && !selectedDriver) {
      setError('Please select a driver or choose Open Request');
      return;
    }

    setPlacingOrder(true);
    setError('');

    try {
      const latitude = confirmedLocation.latitude;
      const longitude = confirmedLocation.longitude;

      const total = calculateTotal();
      const selectedDriverData = drivers.find(d => d.id === selectedDriver);
      const deliveryFee = getDeliveryFee(total, selectedDriverData);

      const groceryOrderItems = selectedItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        is_custom: false,
      }));

      const customOrderItems = customItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.approximate_price,
        quantity: item.quantity,
        is_custom: true,
      }));

      const orderItems = [...groceryOrderItems, ...customOrderItems];

      let scheduledFor = null;
      if (scheduleOrder && selectedDriverData) {
        const now = new Date();
        const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];

        if (selectedDriverData.availability_start_time) {
          const [hours, minutes] = selectedDriverData.availability_start_time.split(':');
          const nextAvailableTime = new Date(now);
          nextAvailableTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          if (nextAvailableTime <= now || !selectedDriverData.availability_days?.includes(currentDay)) {
            let daysToAdd = 1;
            while (daysToAdd <= 7) {
              const checkDate = new Date(now);
              checkDate.setDate(checkDate.getDate() + daysToAdd);
              const checkDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][checkDate.getDay()];

              if (selectedDriverData.availability_days?.includes(checkDay)) {
                nextAvailableTime.setDate(nextAvailableTime.getDate() + daysToAdd);
                break;
              }
              daysToAdd++;
            }
          }

          scheduledFor = nextAvailableTime.toISOString();
        }
      }

      let imageUrl = null;
      if (itemImage) {
        imageUrl = await uploadItemImage();
        if (!imageUrl && itemImage) {
          setPlacingOrder(false);
          return;
        }
      }

      const isOpenRequest = deliveryMode === 'open_request';
      const openRequestExpiry = isOpenRequest
        ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
        : null;

      const { data, error: dbError } = await supabase
        .from('deliveries')
        .insert({
          customer_id: customerId!,
          driver_id: isOpenRequest ? null : selectedDriver,
          items: orderItems,
          total_amount: total,
          delivery_fee: deliveryFee,
          payment_option: paymentOption,
          preferred_delivery_method: deliveryMethod,
          customer_latitude: latitude,
          customer_longitude: longitude,
          preferred_shops: preferredShops || null,
          status: 'pending',
          is_scheduled: scheduleOrder,
          scheduled_for: scheduledFor,
          item_image_url: imageUrl,
          delivery_mode: deliveryMode,
          open_request_expires_at: openRequestExpiry,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      if (paymentOption === 'paynow') {
        // Launch Paynow checkout immediately — user pays on the Paynow site now.
        const { startPaynowPayment, generateReference } = await import('@/lib/paynow-service');
        const ref = generateReference('delivery_request', data.id);
        const result = await startPaynowPayment({
          paymentType: 'delivery_request',
          entityId: data.id,
          amount: total + deliveryFee,
          reference: ref,
          description: `UniLink Grocery Order - ${fetchedName || customerName || 'Customer'}`,
          metadata: { delivery_id: data.id },
        });

        if (!result.success) {
          setError('Order placed, but we could not open Paynow. Please pay from your orders page.');
        }

        if (isOpenRequest) {
          setOpenRequestDeliveryId(data.id);
          setShowOpenRequestWaiting(true);
          setShowLocationSelector(false);
        } else if (result.success) {
          // Redirect already happened to the Paynow site; no ticket redirect needed.
          return;
        } else {
          router.push({
            pathname: '/customer/ticket',
            params: {
              deliveryId: data.id,
              customerName: customerName,
              total: total.toFixed(2),
              deliveryFee: deliveryFee.toFixed(2),
              paymentOption: paymentOption,
            },
          });
        }
        return;
      }

      if (isOpenRequest) {
        setOpenRequestDeliveryId(data.id);
        setShowOpenRequestWaiting(true);
        setShowLocationSelector(false);
      } else {
        router.push({
          pathname: '/customer/ticket',
          params: {
            deliveryId: data.id,
            customerName: customerName,
            total: total.toFixed(2),
            deliveryFee: deliveryFee.toFixed(2),
            paymentOption: paymentOption,
          },
        });
      }
    } catch (err: any) {
      console.error('Failed to place order:', err);
      setError('Could not place your order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const P = '#1A73E8';
  const PL = '#4A9EFF';
  const ACCENT = '#00e5ff';
  const BG = isDark ? '#050D1A' : '#F0F4FF';
  const CARD = isDark ? '#0D1B2E' : '#FFFFFF';
  const CARD_B = isDark ? '#1A3A5C' : '#DDE8FF';
  const TX = isDark ? '#E8F4FF' : '#0A1628';
  const TX2 = isDark ? '#7AA3CC' : '#5A7A9A';
  const TX3 = isDark ? '#3A6A8A' : '#9AB0CC';
  const INPUT = isDark ? '#0A1828' : '#F5F8FF';
  const INPUT_B = isDark ? '#1E3A5C' : '#C8D8F0';
  const SUCCESS = '#10B981';
  const WARN = '#F59E0B';
  const ERR = '#EF4444';

  const baseStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#050D1A' : '#050D1A' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'column',
      justifyContent: 'flex-start',
      width: '100%',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      backgroundColor: '#070f1c',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,229,255,0.18)',
      gap: 4,
      shadowColor: '#00e5ff',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerActions: {
      flexDirection: 'row',
      gap: 6,
    },
    requestDeliveryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 7,
      alignSelf: 'center',
      paddingHorizontal: 24,
      borderRadius: 999,
      backgroundColor: '#00e5ff',
      shadowColor: '#00e5ff',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 14,
      elevation: 6,
    },
    requestDeliveryBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#050D1A',
      letterSpacing: 0.3,
    },
    logoImageWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    logoCartArea: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    logoSpeedLines: {
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 4,
      marginRight: 2,
    },
    logoSpeedLine: {
      height: 3,
      borderRadius: 2,
      backgroundColor: '#38bdf8',
    },
    logoCart: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
    },
    logoCartBasket: {
      width: 30,
      height: 22,
      borderWidth: 2.5,
      borderColor: '#1A73E8',
      borderRadius: 4,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-evenly',
      paddingBottom: 2,
      paddingHorizontal: 2,
      overflow: 'visible',
    },
    logoCartItem1: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#EF4444',
      marginBottom: 2,
    },
    logoCartItem2: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#F59E0B',
    },
    logoCartItem3: {
      width: 7,
      height: 6,
      borderRadius: 2,
      backgroundColor: '#10B981',
      marginBottom: 1,
    },
    logoCartWheelsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    logoCartWheel: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#1e293b',
      borderWidth: 1.5,
      borderColor: '#94a3b8',
    },
    logoWordmark: {
      fontSize: 12,
      fontWeight: '900',
      color: '#00e5ff',
      letterSpacing: 2.5,
      textShadowColor: 'rgba(0,229,255,0.5)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerContent: { flex: 1, minWidth: 0, marginTop: 0, gap: 2 },
    deliveryFab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'center',
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 30,
      backgroundColor: isDark ? '#00e5ff' : '#1A73E8',
      marginBottom: 10,
      shadowColor: isDark ? '#00e5ff' : '#1A73E8',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
      elevation: 10,
    },
    deliveryFabText: {
      fontSize: 14,
      fontWeight: '800',
      color: isDark ? '#050D1A' : '#fff',
      letterSpacing: 0.3,
    },
    bottomNav: {
      flexDirection: 'row',
      alignSelf: 'center',
      width: '92%',
      maxWidth: 440,
      marginBottom: Platform.OS === 'ios' ? 14 : 10,
      marginTop: 8,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 26,
      backgroundColor: isDark ? 'rgba(13,25,42,0.96)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56,189,248,0.22)' : 'rgba(26,115,232,0.12)',
      shadowColor: '#050D1A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.45 : 0.18,
      shadowRadius: 20,
      elevation: 12,
    },
    bottomNavItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: 6,
      borderRadius: 20,
    },
    bottomNavIconWrap: {
      width: 44,
      height: 36,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    bottomNavLabel: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    bottomNavDot: {
      position: 'absolute',
      top: -3,
      right: -4,
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: isDark ? '#0D192A' : '#FFFFFF',
    },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff', letterSpacing: 0.3, marginTop: 0 },
    headerSubtitle: { fontSize: 10, color: '#00e5ff', marginTop: 2, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' as any },
    welcomeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(0,255,136,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(0,255,136,0.35)',
    },
    welcomeBadgeDot: {
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: '#00ff88',
    },
    welcomeBadgeText: {
      fontSize: 9, fontWeight: '800', color: '#00ff88', letterSpacing: 1.2,
    },
    tutorialBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      flex: 1,
      paddingVertical: 9,
      borderRadius: 999, borderWidth: 1,
      borderColor: 'rgba(0,229,255,0.35)',
      backgroundColor: 'rgba(0,229,255,0.08)',
    },
    tutorialBtnText: { fontSize: 11, fontWeight: '700', color: '#00e5ff', letterSpacing: 0.3 },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      flex: 1,
      paddingVertical: 9,
      borderRadius: 999, borderWidth: 1,
      borderColor: 'rgba(0,229,255,0.35)', backgroundColor: 'rgba(0,229,255,0.06)',
    },
    shareModalOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 100,
      alignItems: 'center', justifyContent: 'flex-start', paddingTop: 110,
    },
    shareModalCard: {
      backgroundColor: '#0b1c2c', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,229,255,0.25)',
      padding: 16, width: 280, gap: 12,
      shadowColor: '#00e5ff', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
    },
    shareModalTitle: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
    shareModalOptions: { flexDirection: 'row', justifyContent: 'space-between' },
    shareOption: { alignItems: 'center', gap: 5, flex: 1 },
    shareOptionText: { fontSize: 10, fontWeight: '700', color: '#cbd5e1' },
    copyLinkRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(0,229,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,255,0.25)',
      borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    },
    copyLinkText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#e2e8f0' },
    copyLinkAction: { fontSize: 11, fontWeight: '800', color: '#00e5ff' },
    content: { flex: 1 },
    searchContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    searchInputWrapper: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: CARD, borderRadius: 14, borderWidth: 1.5,
      borderColor: INPUT_B, paddingHorizontal: 14, height: 48, gap: 10,
    },
    searchIcon: { marginRight: 2 },
    searchInput: { flex: 1, fontSize: 15, color: TX, padding: 0 },
    clearSearchButton: { padding: 4 },
    noResultsText: { fontSize: 13, color: TX3, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
    itemsList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 12 },
    categorySection: {
      backgroundColor: CARD, borderRadius: 16, borderWidth: 1,
      borderColor: isDark ? 'rgba(0,229,255,0.15)' : CARD_B,
      overflow: 'hidden',
      shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.12 : 0.06, shadowRadius: 12, elevation: 3,
    },
    categoryHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: isDark ? 'rgba(0,229,255,0.06)' : INPUT,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(0,229,255,0.1)' : 'transparent',
    },
    categoryHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    categoryEmoji: { fontSize: 22 },
    categoryName: { fontSize: 16, fontWeight: '800', color: TX, letterSpacing: 0.2 },
    categoryBadge: {
      backgroundColor: P, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
      minWidth: 24, alignItems: 'center',
    },
    categoryBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    categoryItems: { padding: 12, gap: 8 },
    itemCard: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: INPUT, paddingHorizontal: 14, paddingVertical: 12,
      borderRadius: 12, borderWidth: 1, borderColor: INPUT_B,
    },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '700', color: TX },
    itemPrice: { fontSize: 13, color: P, marginTop: 2, fontWeight: '600' },
    quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    quantityButton: {
      width: 34, height: 34, borderRadius: 10, backgroundColor: P,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: P, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
    },
    quantityButtonText: { fontSize: 18, fontWeight: '800', color: '#fff' },
    quantityText: { fontSize: 16, fontWeight: '700', color: TX, minWidth: 28, textAlign: 'center' },
    orderSummary: {
      backgroundColor: CARD, padding: 20, marginHorizontal: 16, marginTop: 4, marginBottom: 8,
      borderRadius: 20, borderWidth: 1, borderColor: CARD_B,
      shadowColor: P, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
    },
    summaryTitle: { fontSize: 18, fontWeight: '800', color: TX, marginBottom: 16, letterSpacing: 0.3 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    summaryLabel: { fontSize: 14, color: TX2 },
    summaryValue: { fontSize: 14, fontWeight: '700', color: TX },
    summaryTotal: { borderTopWidth: 1, borderTopColor: CARD_B, paddingTop: 12, marginTop: 8 },
    totalLabel: { fontSize: 17, fontWeight: '800', color: TX },
    totalValue: { fontSize: 17, fontWeight: '800', color: P },
    paymentTitle: { fontSize: 13, fontWeight: '800', color: TX2, marginTop: 20, marginBottom: 10, letterSpacing: 1.2, textTransform: 'uppercase' as any },
    shopsInput: {
      backgroundColor: INPUT, borderWidth: 1.5, borderColor: INPUT_B,
      borderRadius: 12, padding: 12, fontSize: 14, color: TX, minHeight: 60, textAlignVertical: 'top',
    },
    shopsHelperText: { fontSize: 12, color: TX3, marginTop: 6, marginBottom: 8, fontStyle: 'italic' },
    paymentOptions: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    paymentOption: {
      flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
      borderColor: INPUT_B, alignItems: 'center', backgroundColor: INPUT,
    },
    paymentOptionActive: { borderColor: P, backgroundColor: isDark ? 'rgba(26,115,232,0.12)' : '#EBF3FF' },
    paymentOptionText: { fontSize: 13, fontWeight: '700', color: TX2 },
    paymentOptionTextActive: { color: P },
    deliveryOption: {
      flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5,
      borderColor: INPUT_B, alignItems: 'center', gap: 6, backgroundColor: INPUT,
    },
    deliveryOptionActive: { borderColor: P, backgroundColor: isDark ? 'rgba(26,115,232,0.12)' : '#EBF3FF' },
    deliveryOptionText: { fontSize: 13, fontWeight: '700', color: TX2 },
    deliveryOptionTextActive: { color: P },
    deliveryOptionSubtext: { fontSize: 11, color: TX3 },
    placeOrderButton: {
      flexDirection: 'row', backgroundColor: P, paddingVertical: 16,
      borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden',
      shadowColor: P, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
    },
    placeOrderButtonDisabled: { opacity: 0.55 },
    placeOrderButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

    scrollHintBanner: {
      position: 'absolute',
      bottom: 90,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: 'rgba(26,115,232,0.92)',
      shadowColor: '#1A73E8',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
    },
    scrollHintText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    driverSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    driverNudgePill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: '#1A73E8', borderRadius: 12,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    driverNudgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    errorText: {
      color: ERR, fontSize: 13, textAlign: 'center',
      marginHorizontal: 16, marginTop: 10, padding: 12,
      backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FFF5F5',
      borderRadius: 12, borderWidth: 1, borderColor: ERR,
    },
    driversList: { gap: 10, marginBottom: 16 },
    driverCard: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14,
      borderRadius: 14, borderWidth: 1.5, borderColor: INPUT_B, backgroundColor: INPUT, gap: 12,
    },
    driverCardActive: { borderColor: P, backgroundColor: isDark ? 'rgba(26,115,232,0.1)' : '#EBF3FF' },
    driverProfilePicture: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
    driverAvatar: { width: '100%', height: '100%' },
    driverAvatarPlaceholder: {
      width: '100%', height: '100%',
      backgroundColor: INPUT_B, justifyContent: 'center', alignItems: 'center', borderRadius: 28,
    },
    driverInfo: { flex: 1 },
    driverNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
    driverName: { fontSize: 15, fontWeight: '800', color: TX },
    ratingBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 10, borderWidth: 1, borderColor: '#FBBF24',
    },
    ratingBadgeExcellent: { backgroundColor: '#DCFCE7', borderColor: '#22C55E' },
    ratingText: { fontSize: 12, fontWeight: '800', color: '#854D0E' },
    ratingTextExcellent: { color: '#166534' },
    ratingCount: { fontSize: 11, fontWeight: '600', color: '#92400E' },
    ratingCountExcellent: { color: '#166534' },
    noRatingBadge: { backgroundColor: INPUT_B, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    noRatingText: { fontSize: 11, color: TX2, fontStyle: 'italic' },
    driverDetail: { fontSize: 12, color: TX2, marginTop: 2 },
    driverSearchContainer: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: INPUT, borderWidth: 1.5, borderColor: INPUT_B,
      borderRadius: 12, paddingHorizontal: 12, marginBottom: 14,
    },
    driverSearchInput: { flex: 1, padding: 11, fontSize: 14, color: TX },
    radioButton: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 2,
      borderColor: P, justifyContent: 'center', alignItems: 'center', marginLeft: 8,
    },
    radioButtonSelected: { width: 10, height: 10, borderRadius: 5, backgroundColor: P },
    noDriversContainer: {
      padding: 14, borderRadius: 12, marginBottom: 16,
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB',
      borderWidth: 1, borderColor: WARN,
    },
    noDriversText: { fontSize: 13, color: WARN, textAlign: 'center' },
    feeBreakdown: {
      backgroundColor: isDark ? 'rgba(26,115,232,0.1)' : '#EBF3FF',
      padding: 12, borderRadius: 10, marginBottom: 12,
      borderWidth: 1, borderColor: isDark ? 'rgba(26,115,232,0.3)' : '#BFDBFE',
    },
    feeBreakdownTitle: { fontSize: 12, fontWeight: '700', color: P, marginBottom: 4, letterSpacing: 0.5 },
    feeBreakdownText: { fontSize: 11, color: P, lineHeight: 17 },
    selectDriverNotice: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB',
      padding: 10, borderRadius: 10, marginBottom: 10,
      borderWidth: 1, borderColor: WARN,
    },
    selectDriverNoticeText: { fontSize: 12, color: WARN, textAlign: 'center', fontWeight: '600' },
    communicationNotice: {
      flexDirection: 'row', backgroundColor: isDark ? 'rgba(26,115,232,0.1)' : '#EBF3FF',
      padding: 12, borderRadius: 10, marginBottom: 14, gap: 10,
      borderWidth: 1, borderColor: isDark ? 'rgba(26,115,232,0.3)' : '#BFDBFE',
    },
    communicationNoticeText: { flex: 1, fontSize: 12, color: P, lineHeight: 18 },
    scheduleSection: {
      marginBottom: 14, padding: 14, backgroundColor: INPUT,
      borderRadius: 12, borderWidth: 1, borderColor: INPUT_B,
    },
    scheduleSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    scheduleTextContainer: { flex: 1, marginRight: 12 },
    scheduleTitle: { fontSize: 14, fontWeight: '700', color: TX, marginBottom: 3 },
    scheduleSubtext: { fontSize: 12, color: TX2 },
    locationNotice: {
      flexDirection: 'row', backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB',
      padding: 10, borderRadius: 10, marginBottom: 10, gap: 8,
      borderWidth: 1, borderColor: WARN, alignItems: 'center',
    },
    locationNoticeText: { flex: 1, fontSize: 12, color: WARN, lineHeight: 17 },
    notificationDot: {
      position: 'absolute', top: -2, right: -2,
      width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: CARD,
    },
    notificationDotYellow: { backgroundColor: WARN },
    notificationDotGreen: { backgroundColor: SUCCESS },
    expiredNotification: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: WARN, padding: 14, marginHorizontal: 16, marginTop: 10,
      marginBottom: 6, borderRadius: 12,
    },
    expiredNotificationText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#fff', lineHeight: 19 },
    customItemsSection: {
      backgroundColor: CARD, padding: 16, marginHorizontal: 16, marginVertical: 10,
      borderRadius: 16, borderWidth: 1, borderColor: CARD_B,
      shadowColor: P, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
    },
    customItemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    customItemsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    customItemsTitle: { fontSize: 15, fontWeight: '800', color: TX },
    addCustomItemButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
      shadowColor: P, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
    },
    addCustomItemButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    customItemsHint: { fontSize: 13, color: TX2, fontStyle: 'italic', lineHeight: 18 },
    customItemsList: { gap: 8 },
    customItemCard: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: INPUT, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: INPUT_B,
    },
    customItemInfo: { flex: 1 },
    customItemName: { fontSize: 14, fontWeight: '700', color: TX, marginBottom: 3 },
    customItemDetails: { fontSize: 12, color: TX2 },
    removeCustomItemButton: { padding: 4 },
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    modalContent: {
      backgroundColor: CARD, borderRadius: 20, padding: 24,
      width: '100%', maxWidth: 500, maxHeight: '90%',
      borderWidth: 1, borderColor: CARD_B,
      shadowColor: P, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 20,
    },
    modalHeader: { alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: TX, marginTop: 12 },
    modalSubtitle: { fontSize: 14, color: TX2, marginTop: 6, textAlign: 'center' },
    welcomeGuideCard: {
      borderRadius: 20, padding: 28, width: '100%', maxWidth: 440,
      borderWidth: 1.5, alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3, shadowRadius: 30, elevation: 20,
    },
    welcomeGuideIcon: {
      width: 72, height: 72, borderRadius: 36,
      justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    welcomeGuideTitle: { fontSize: 22, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
    welcomeGuideText: { fontSize: 14, lineHeight: 22, marginBottom: 22 },
    welcomeGuideBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: '100%',
      marginBottom: 10,
    },
    welcomeGuideBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    welcomeGuideSecondaryBtn: {
      paddingVertical: 12, borderRadius: 12, width: '100%',
      borderWidth: 1.5, alignItems: 'center',
    },
    welcomeGuideSecondaryText: { fontSize: 14, fontWeight: '600' },
    paymentCodeSection: { marginBottom: 18 },
    paymentLabel: { fontSize: 14, fontWeight: '700', color: TX, marginBottom: 10 },
    paynowPayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#1A73E8',
      borderRadius: 12,
      paddingVertical: 14,
      marginBottom: 12,
      shadowColor: '#1A73E8',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    paynowPayButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    paymentCodeBox: {
      backgroundColor: isDark ? 'rgba(26,115,232,0.12)' : '#EBF3FF',
      padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: P, marginBottom: 10,
    },
    paymentCodeLabel: { fontSize: 11, color: P, marginBottom: 4, fontWeight: '700', letterSpacing: 0.5 },
    paymentCode: { fontSize: 22, fontWeight: '800', color: TX, letterSpacing: 2 },
    amountBox: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#F0FDF9',
      padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: SUCCESS, marginBottom: 14,
    },
    amountLabel: { fontSize: 11, color: SUCCESS, marginBottom: 4, fontWeight: '700', letterSpacing: 0.5 },
    amountValue: { fontSize: 26, fontWeight: '800', color: SUCCESS },
    paymentInstructions: {
      fontSize: 13, color: TX2, lineHeight: 20,
      backgroundColor: INPUT, padding: 12, borderRadius: 10,
    },
    cashInfoBox: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB',
      padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: WARN,
    },
    cashInfoTitle: { fontSize: 16, fontWeight: '800', color: WARN, marginBottom: 6 },
    cashInfoText: { fontSize: 13, color: isDark ? '#FCD34D' : '#92400E', marginTop: 3 },
    orderInfoBox: { backgroundColor: INPUT, padding: 14, borderRadius: 12, marginBottom: 18 },
    orderInfoLabel: { fontSize: 13, fontWeight: '700', color: TX2, marginBottom: 8 },
    phoneButton: {
      backgroundColor: SUCCESS, padding: 12, borderRadius: 10, alignItems: 'center',
      shadowColor: SUCCESS, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    },
    phoneButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    modalActions: { gap: 10 },
    chatButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: P, padding: 14, borderRadius: 12, overflow: 'hidden',
      shadowColor: P, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
    },
    chatButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    closeButton: {
      padding: 14, borderRadius: 12, alignItems: 'center',
      borderWidth: 1.5, borderColor: INPUT_B, backgroundColor: INPUT,
    },
    closeButtonText: { fontSize: 15, fontWeight: '700', color: TX2 },
    viewReviewsButton: {
      paddingHorizontal: 14, paddingVertical: 7, backgroundColor: INPUT,
      borderWidth: 1, borderColor: P, borderRadius: 8,
      marginTop: -6, marginBottom: 10, marginHorizontal: 14, alignItems: 'center',
    },
    viewReviewsText: { fontSize: 13, fontWeight: '700', color: P },
    reviewsModalContent: {
      backgroundColor: CARD, borderRadius: 20, maxHeight: '80%', width: '90%',
      overflow: 'hidden', borderWidth: 1, borderColor: CARD_B,
    },
    reviewsModalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 18, borderBottomWidth: 1, borderBottomColor: CARD_B,
    },
    reviewsDriverInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    reviewsDriverAvatar: { width: 52, height: 52, borderRadius: 26 },
    reviewsDriverAvatarPlaceholder: {
      width: 52, height: 52, borderRadius: 26, backgroundColor: INPUT_B,
      justifyContent: 'center', alignItems: 'center',
    },
    reviewsDriverDetails: { flex: 1 },
    reviewsDriverName: { fontSize: 17, fontWeight: '800', color: TX, marginBottom: 4 },
    reviewsRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    reviewsAverageRating: { fontSize: 14, fontWeight: '700', color: TX },
    reviewsTotalCount: { fontSize: 13, color: TX2 },
    reviewsCloseButton: { padding: 6 },
    reviewsList: { maxHeight: '100%' },
    reviewsLoadingContainer: { padding: 36, alignItems: 'center', gap: 12 },
    reviewsLoadingText: { fontSize: 13, color: TX2 },
    noReviewsContainer: { padding: 36, alignItems: 'center', gap: 10 },
    noReviewsText: { fontSize: 17, fontWeight: '700', color: TX },
    noReviewsSubtext: { fontSize: 13, color: TX2, textAlign: 'center' },
    reviewCard: { padding: 14, borderBottomWidth: 1, borderBottomColor: CARD_B },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
    reviewAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reviewAuthorAvatar: {
      width: 30, height: 30, borderRadius: 15, backgroundColor: INPUT_B,
      justifyContent: 'center', alignItems: 'center',
    },
    reviewAuthorName: { fontSize: 13, fontWeight: '700', color: TX },
    reviewRating: { flexDirection: 'row', gap: 2 },
    reviewText: { fontSize: 13, color: TX, lineHeight: 19, marginBottom: 6 },
    reviewDate: { fontSize: 11, color: TX3 },
    imageUploadSection: { marginTop: 14, marginBottom: 6, gap: 10 },
    imageUploadHint: { fontSize: 12, color: TX2, lineHeight: 17, marginTop: -4 },
    imageUploadButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
    imageUploadButton: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: INPUT, borderWidth: 1.5, borderColor: P,
      borderRadius: 12, paddingVertical: 14, paddingHorizontal: 10,
      borderStyle: 'dashed',
    },
    imageUploadButtonText: { fontSize: 13, fontWeight: '700', color: P },
    imagePreviewContainer: { position: 'relative', marginTop: 8, borderRadius: 12, overflow: 'hidden' },
    imagePreview: { width: '100%', height: 180, borderRadius: 12, backgroundColor: INPUT_B },
    removeImageButton: {
      position: 'absolute', top: 8, right: 8,
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 18, padding: 7,
    },
    uploadingContainer: {
      flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10,
      backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#F0FDF9',
      borderRadius: 10, marginTop: 6,
    },
    uploadingText: { fontSize: 13, color: SUCCESS, fontWeight: '600' },
    confirmedLocationBox: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#F0FDF9',
      padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: SUCCESS, marginBottom: 14,
    },
    confirmedLocationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    confirmedLocationTitle: { fontSize: 14, fontWeight: '700', color: SUCCESS },
    confirmedLocationText: { fontSize: 13, color: SUCCESS, lineHeight: 19, marginBottom: 6 },
    changeLocationButton: {
      alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12,
      backgroundColor: INPUT, borderRadius: 8, borderWidth: 1, borderColor: SUCCESS,
    },
    changeLocationText: { fontSize: 12, fontWeight: '700', color: SUCCESS },
    driverSelectCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
      backgroundColor: INPUT, borderRadius: 14, borderWidth: 1.5, marginBottom: 12,
    },
    driverSelectAvatar: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    driverSelectInfo: { flex: 1 },
    driverSelectName: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
    driverSelectSub: { fontSize: 12 },
  });

  const overrides = customerLightOverrides(viewportWidth);
  const styles = isDark ? baseStyles : Object.fromEntries(
    Object.entries(baseStyles).map(([key, value]) => [key, StyleSheet.flatten([value, overrides[key]])])
  ) as typeof baseStyles;

  if (isChecking) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={P} />
        <Text style={{ color: TX2, marginTop: 16, fontSize: 14 }}>
          Verifying Terms Acceptance...
        </Text>
      </View>
    );
  }

  if (!isAccepted) {
    return null;
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={P} />
      </View>
    );
  }

  const selectedCount = groceryItems.filter(item => item.quantity > 0).length;
  const total = calculateTotal();
  const selectedDriverData = drivers.find(d => d.id === selectedDriver);
  const deliveryFee = getDeliveryFee(total, selectedDriverData);
  const filteredDrivers = getFilteredDrivers();
  const commissionTier = getCommissionTier(total);

  return (
    <View style={styles.container}>
      {isDark && <AnimatedDeliveryBackground />}
      <NotificationPermissionModal userType="customer" />
      <InAppNotificationBanner
        visible={!!inAppMessage}
        title={inAppMessage?.title || ''}
        body={inAppMessage?.body || ''}
        onPress={() => {
          clearInAppMessage();
          router.push({ pathname: '/customer/chat', params: { customerId, customerName } });
        }}
        onDismiss={clearInAppMessage}
      />
      {!isDark ? <CustomerDashboardLightHeader
        name={customerName || fetchedName || 'there'} desktop={desktopLight} copied={shareCopied}
        onShare={handleShare} onTutorial={() => setShowTutorial(true)}
      /> : (
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.logoWordmark, { color: '#00e5ff' }]}>UNILINK</Text>
          <View style={styles.welcomeBadge}>
            <View style={styles.welcomeBadgeDot} />
            <Text style={styles.welcomeBadgeText}>ACTIVE</Text>
          </View>
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            Hi, {customerName || fetchedName || 'there'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
            Select your groceries
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleShare}
            style={styles.shareBtn}
            activeOpacity={0.75}
            accessibilityLabel="Share UniLink with friends"
          >
            <Share2 size={11} color="#00e5ff" />
            <Text style={styles.tutorialBtnText}>{shareCopied ? 'Link copied!' : 'Share'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowTutorial(true)}
            style={styles.tutorialBtn}
            activeOpacity={0.75}
          >
            <HelpCircle size={11} color="#00e5ff" />
            <Text style={styles.tutorialBtnText}>How it works</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}

      {showShareModal && (
        <View style={styles.shareModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowShareModal(false)} />
          <View style={styles.shareModalCard}>
            <Text style={styles.shareModalTitle}>Share UniLink with friends</Text>
            <View style={styles.shareModalOptions}>
              <TouchableOpacity style={styles.shareOption} onPress={shareViaWhatsApp} activeOpacity={0.7}>
                <Smartphone size={20} color="#25D366" />
                <Text style={styles.shareOptionText}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareOption} onPress={shareViaSMS} activeOpacity={0.7}>
                <MessageCircle size={20} color="#00e5ff" />
                <Text style={styles.shareOptionText}>SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareOption} onPress={shareViaEmail} activeOpacity={0.7}>
                <Mail size={20} color="#F59E0B" />
                <Text style={styles.shareOptionText}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareOption} onPress={tryNativeShare} activeOpacity={0.7}>
                <Share2 size={20} color="#8B5CF6" />
                <Text style={styles.shareOptionText}>More</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.copyLinkRow} onPress={copyShareLink} activeOpacity={0.7}>
              <Link2 size={14} color="#00e5ff" />
              <Text style={styles.copyLinkText} numberOfLines={1}>unilinkbase.com</Text>
              <Text style={styles.copyLinkAction}>{shareCopied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {expiredNotification && (
        <View style={styles.expiredNotification}>
          <AlertCircle size={20} color={colors.surface} />
          <Text style={styles.expiredNotificationText}>{expiredNotification}</Text>
        </View>
      )}

      <ScrollView ref={contentRef} style={styles.content} contentContainerStyle={!isDark ? { paddingBottom: 28 } : undefined}>
        {!isDark && <CustomerGroceryBanner desktop={desktopLight}/>}
        {!isDark && <TouchableOpacity style={lightDashboard.nearby} accessibilityRole="button" onPress={() => router.push('/customer/marketplace')}>
          <View style={lightDashboard.nearbyIcon}><ShoppingBag size={22} color="#0057ff"/></View>
          <Text style={lightDashboard.nearbyLabel}>Nearby shops</Text><ChevronRight size={20} color="#384e6f"/>
        </TouchableOpacity>}
        <TouchableOpacity
          accessibilityRole="button" accessibilityLabel="Request delivery"
          onPress={() => router.push({ pathname: '/customer/delivery-request', params: { customerId, customerName } } as any)}
          style={[styles.customItemsSection, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
          activeOpacity={0.8}
        >
          <View style={[lightDashboard.nearbyIcon, { backgroundColor: isDark ? '#16314c' : '#e6efff' }]}><Truck size={22} color={P}/></View>
          <Text style={[styles.customItemsTitle, { flex: 1 }]}>Request delivery</Text>
          <ChevronRight size={20} color={TX2}/>
        </TouchableOpacity>
        <View style={styles.customItemsSection}>
          <View style={styles.customItemsHeader}>
            <View style={styles.customItemsHeaderLeft}>
              <Package size={20} color={colors.primary} />
              <Text style={styles.customItemsTitle}>Custom Items</Text>
            </View>
            <TouchableOpacity
              style={styles.addCustomItemButton}
              onPress={() => setShowAddItemModal(true)}
            >
              <Plus size={18} color={colors.surface} />
              <Text style={styles.addCustomItemButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {customItems.length === 0 ? (
            <Text style={styles.customItemsHint}>
              Add specific items you want the driver to purchase with approximate prices
            </Text>
          ) : (
            <View style={styles.customItemsList}>
              {customItems.map((item) => (
                <View key={item.id} style={styles.customItemCard}>
                  <View style={styles.customItemInfo}>
                    <Text style={styles.customItemName}>{item.name}</Text>
                    <Text style={styles.customItemDetails}>
                      Qty: {item.quantity} × ${item.approximate_price.toFixed(2)} ≈ ${(item.quantity * item.approximate_price).toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeCustomItemButton}
                    onPress={() => removeCustomItem(item.id)}
                  >
                    <X size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {(selectedCount > 0 || customItems.length > 0) && (
          <View style={styles.orderSummary}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items ({selectedCount + customItems.length})</Text>
              <Text style={styles.summaryValue}>${total.toFixed(2)}</Text>
            </View>
            {selectedDriverData && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee ({commissionTier})</Text>
                  <Text style={styles.summaryValue}>${deliveryFee.toFixed(2)}</Text>
                </View>
                <View style={styles.feeBreakdown}>
                  <Text style={styles.feeBreakdownTitle}>Driver Fee Structure:</Text>
                  <Text style={styles.feeBreakdownText}>
                    Up to $10: ${selectedDriverData.fee_up_to_10.toFixed(2)} • $10-$20: ${selectedDriverData.fee_up_to_20.toFixed(2)} • $20-$30: ${selectedDriverData.fee_up_to_30.toFixed(2)}
                  </Text>
                  <Text style={styles.feeBreakdownText}>
                    $30-$40: ${selectedDriverData.fee_up_to_40.toFixed(2)} • $40-$50: ${selectedDriverData.fee_up_to_50.toFixed(2)}
                  </Text>
                  {selectedDriverData.delivery_type?.includes('vehicle') && (
                    <Text style={styles.feeBreakdownText}>
                      $50-$100: ${selectedDriverData.fee_up_to_100.toFixed(2)} • $100-$200: ${selectedDriverData.fee_up_to_200.toFixed(2)} • $200-$300: ${selectedDriverData.fee_up_to_300.toFixed(2)} • $300-$400: ${selectedDriverData.fee_up_to_400.toFixed(2)} • $400-$500: ${selectedDriverData.fee_up_to_500.toFixed(2)}
                    </Text>
                  )}
                </View>
              </>
            )}
            {!selectedDriverData && (
              <View style={styles.selectDriverNotice}>
                <Text style={styles.selectDriverNoticeText}>
                  Select a driver to see delivery fee
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${(total + deliveryFee).toFixed(2)}</Text>
            </View>

            <Text style={styles.paymentTitle}>Delivery Method</Text>
            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[
                  styles.deliveryOption,
                  deliveryMethod === 'vehicle' && styles.deliveryOptionActive,
                ]}
                onPress={() => setDeliveryMethod('vehicle')}
              >
                <Car size={24} color={deliveryMethod === 'vehicle' ? colors.primary : colors.textTertiary} />
                <Text
                  style={[
                    styles.deliveryOptionText,
                    deliveryMethod === 'vehicle' && styles.deliveryOptionTextActive,
                  ]}
                >
                  Vehicle Delivery
                </Text>
                <Text style={styles.deliveryOptionSubtext}>Faster delivery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deliveryOption,
                  deliveryMethod === 'walking' && styles.deliveryOptionActive,
                ]}
                onPress={() => setDeliveryMethod('walking')}
              >
                <User size={24} color={deliveryMethod === 'walking' ? colors.primary : colors.textTertiary} />
                <Text
                  style={[
                    styles.deliveryOptionText,
                    deliveryMethod === 'walking' && styles.deliveryOptionTextActive,
                  ]}
                >
                  Walking Delivery
                </Text>
                <Text style={styles.deliveryOptionSubtext}>Eco-friendly</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.paymentTitle}>Payment Option</Text>
            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentOption === 'pay_on_delivery' && styles.paymentOptionActive,
                ]}
                onPress={() => setPaymentOption('pay_on_delivery')}
              >
                <Text
                  style={[
                    styles.paymentOptionText,
                    paymentOption === 'pay_on_delivery' && styles.paymentOptionTextActive,
                  ]}
                >
                  Pay on Delivery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentOption === 'paynow' && styles.paymentOptionActive,
                ]}
                onPress={() => setPaymentOption('paynow')}
              >
                <Text
                  style={[
                    styles.paymentOptionText,
                    paymentOption === 'paynow' && styles.paymentOptionTextActive,
                  ]}
                >
                  Paynow
                </Text>
              </TouchableOpacity>
            </View>

            {paymentOption === 'paynow' && (
              <View style={styles.paymentCodeBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <AlertCircle size={20} color={colors.info} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: P }}>Paynow Payment Notice</Text>
                </View>
                <Text style={{ fontSize: 12, color: TX2, lineHeight: 17 }}>
                  After placing your order you will be taken straight to the Paynow website to pay. Groceries will be purchased after payment is confirmed.
                </Text>
              </View>
            )}

            <Text style={styles.paymentTitle}>Preferred Shops (Optional)</Text>
            <TextInput
              style={styles.shopsInput}
              value={preferredShops}
              onChangeText={setPreferredShops}
              placeholder="e.g., OK Zimbabwe, Pick n Pay, TM Supermarket"
              multiline
              numberOfLines={2}
            />

            <View style={styles.imageUploadSection}>
              <Text style={styles.paymentTitle}>Item Image (Optional)</Text>
              <Text style={styles.imageUploadHint}>
                Upload a photo of the item you want to purchase to help your driver identify it
              </Text>

              {itemImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: itemImage }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setItemImage(null)}
                  >
                    <X size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.imageUploadButtons}>
                  <TouchableOpacity
                    style={styles.imageUploadButton}
                    onPress={pickImage}
                    disabled={uploadingImage}
                  >
                    <ImageIcon size={24} color={colors.primary} />
                    <Text style={styles.imageUploadButtonText}>Choose from Gallery</Text>
                  </TouchableOpacity>

                  {Platform.OS !== 'web' && (
                    <TouchableOpacity
                      style={styles.imageUploadButton}
                      onPress={takePhoto}
                      disabled={uploadingImage}
                    >
                      <Camera size={24} color={colors.primary} />
                      <Text style={styles.imageUploadButtonText}>Take Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {uploadingImage && (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.uploadingText}>Uploading image...</Text>
                </View>
              )}
            </View>
            <Text style={styles.shopsHelperText}>
              Let the driver know which shops you prefer for your groceries
            </Text>

            <View style={styles.driverSectionHeader}>
              <Text style={styles.paymentTitle}>Driver Selection</Text>
              {totalItems > 0 && !selectedDriver && deliveryMode === 'direct' && (
                <View style={styles.driverNudgePill}>
                  <ChevronDown size={11} color="#fff" strokeWidth={3} />
                  <Text style={styles.driverNudgeText}>Select here</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.driverSelectCard,
                { borderColor: deliveryMode === 'open_request' ? '#00b894' : (selectedDriver ? P : INPUT_B) }
              ]}
              onPress={() => setShowDriverSelectionModal(true)}
            >
              {deliveryMode === 'open_request' ? (
                <>
                  <View style={[styles.driverSelectAvatar, { backgroundColor: 'rgba(0,184,148,0.15)' }]}>
                    <User size={22} color="#00b894" />
                  </View>
                  <View style={styles.driverSelectInfo}>
                    <Text style={[styles.driverSelectName, { color: '#00b894' }]}>Open Request</Text>
                    <Text style={[styles.driverSelectSub, { color: TX2 }]}>Broadcast to all available drivers</Text>
                  </View>
                  <ChevronDown size={20} color="#00b894" />
                </>
              ) : selectedDriverData ? (
                <>
                  <View style={[styles.driverSelectAvatar, { backgroundColor: INPUT_B }]}>
                    {selectedDriverData.profile_picture_url ? (
                      <Image source={{ uri: selectedDriverData.profile_picture_url }} style={{ width: '100%', height: '100%', borderRadius: 22 }} resizeMode="cover" />
                    ) : (
                      <User size={22} color={TX2} />
                    )}
                  </View>
                  <View style={styles.driverSelectInfo}>
                    <Text style={[styles.driverSelectName, { color: TX }]}>{selectedDriverData.full_name}</Text>
                    <Text style={[styles.driverSelectSub, { color: TX2 }]}>
                      {selectedDriverData.total_ratings > 0
                        ? `★ ${selectedDriverData.average_rating.toFixed(1)} · Direct`
                        : 'New Driver · Direct'}
                    </Text>
                  </View>
                  <ChevronDown size={20} color={P} />
                </>
              ) : (
                <>
                  <View style={[styles.driverSelectAvatar, { backgroundColor: INPUT_B }]}>
                    <User size={22} color={TX3} />
                  </View>
                  <View style={styles.driverSelectInfo}>
                    <Text style={[styles.driverSelectName, { color: TX3 }]}>No driver selected</Text>
                    <Text style={[styles.driverSelectSub, { color: TX3 }]}>Tap to choose a driver or open request</Text>
                  </View>
                  <ChevronDown size={20} color={TX3} />
                </>
              )}
            </TouchableOpacity>

            {deliveryMode === 'direct' && selectedDriver && (
              <View style={styles.communicationNotice}>
                <MessageCircle size={20} color={colors.info} />
                <Text style={styles.communicationNoticeText}>
                  After placing your order, use the chat feature to communicate with your driver about order details, delivery instructions, or any special requests.
                </Text>
              </View>
            )}

            {deliveryMode === 'direct' && selectedDriver && (() => {
              const driver = filteredDrivers.find(d => d.id === selectedDriver);
              return driver?.availability_start_time && driver?.availability_end_time ? (
                <View style={styles.scheduleSection}>
                  <View style={styles.scheduleSwitchRow}>
                    <View style={styles.scheduleTextContainer}>
                      <Text style={styles.scheduleTitle}>Schedule for Driver Availability</Text>
                      <Text style={styles.scheduleSubtext}>
                        {scheduleOrder
                          ? `Order will pend until ${driver.availability_start_time.substring(0, 5)}`
                          : 'Place order immediately'}
                      </Text>
                    </View>
                    <Switch
                      value={scheduleOrder}
                      onValueChange={setScheduleOrder}
                      trackColor={{ false: colors.disabled, true: colors.primary }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>
              ) : null;
            })()}

            {confirmedLocation && (
              <View style={styles.confirmedLocationBox}>
                <View style={styles.confirmedLocationHeader}>
                  <CheckCircle size={20} color={colors.success} />
                  <Text style={styles.confirmedLocationTitle}>Delivery Location Confirmed</Text>
                </View>
                <Text style={styles.confirmedLocationText}>
                  {confirmedLocation.address || `${confirmedLocation.latitude.toFixed(6)}, ${confirmedLocation.longitude.toFixed(6)}`}
                </Text>
                <TouchableOpacity
                  style={styles.changeLocationButton}
                  onPress={() => setShowLocationSelector(true)}
                >
                  <Text style={styles.changeLocationText}>Change Location</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.placeOrderButton,
                (deliveryMode === 'direct' && !selectedDriver) && styles.placeOrderButtonDisabled,
              ]}
              onPress={confirmedLocation ? placeOrder : initiateOrderPlacement}
              disabled={placingOrder || (deliveryMode === 'direct' && !selectedDriver)}
            >
              <ShoppingCart size={20} color={colors.surface} />
              <Text style={styles.placeOrderButtonText}>
                {placingOrder ? 'Placing Order...' : confirmedLocation ? 'Confirm & Place Order' : 'Continue to Location'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Scroll-down hint */}
      {showScrollHint && (
        <Animated.View
          style={[
            styles.scrollHintBanner,
            {
              opacity: scrollHintAnim,
              transform: [{ translateY: scrollHintAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            },
          ]}
          pointerEvents="none"
        >
          <ChevronDown size={15} color="#fff" strokeWidth={2.5} />
          <Text style={styles.scrollHintText}>Scroll down to select a driver</Text>
          <ChevronDown size={15} color="#fff" strokeWidth={2.5} />
        </Animated.View>
      )}

      {/* Shop Groceries FAB (light theme uses the same action in the content) */}
      {isDark && <TouchableOpacity
        style={styles.deliveryFab}
        onPress={() => router.push('/customer/marketplace')}
        activeOpacity={0.85}
      >
        <ShoppingBag size={20} color="#fff" strokeWidth={2.5} />
        <Text style={styles.deliveryFabText}>Nearby Shops</Text>
      </TouchableOpacity>}

      <CustomerNavigation dashboard customerId={customerId || undefined} customerName={customerName || fetchedName || undefined}
        desktopSidebar={desktopLight} notice={notificationDot} shopUpdatesBaseline={shopUpdatesBaseline}
        onOrdersPress={() => { setNotificationDot(null); setShopUpdatesBaseline(shopOrderUpdatesCount); }}
        onHomePress={() => contentRef.current?.scrollTo({ y: 0, animated: true })}/>

      <CustomerTutorial
        visible={showTutorial}
        onClose={() => {
          setShowTutorial(false);
          const tutorialKey = `tutorial_seen_${customerId}`;
          if (typeof window !== 'undefined') {
            localStorage.setItem(tutorialKey, '1');
          }
        }}
      />

      <Modal
        visible={showWelcomeGuide}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWelcomeGuide(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.welcomeGuideCard, { backgroundColor: CARD, borderColor: isDark ? '#1E3A5F' : '#E2E8F0' }]}>
            <View style={[styles.welcomeGuideIcon, { backgroundColor: 'rgba(26,115,232,0.12)' }]}>
              <ShoppingBag size={34} color={P} />
            </View>
            <Text style={[styles.welcomeGuideTitle, { color: isDark ? '#E2F0FF' : '#0F172A' }]}>
              Welcome to UniLink!
            </Text>
            <Text style={[styles.welcomeGuideText, { color: isDark ? '#8FB4D4' : '#475569' }]}>
              {'There are two ways to get what you need:\n\n'}
              {'1. Marketplace \u2014 browse and shop directly from registered shops.\n\n'}
              {'2. List it yourself \u2014 simply list whatever you want with an approximate price, and a messenger will source it for you.\n\n'}
              {'Please note: the price you list is only an estimate. It may change as your messenger communicates with you while looking for the items \u2014 and some items may not be found.'}
            </Text>
            <TouchableOpacity
              style={[styles.welcomeGuideBtn, { backgroundColor: P }]}
              onPress={() => {
                setShowWelcomeGuide(false);
                router.push('/customer/marketplace');
              }}
              activeOpacity={0.85}
            >
              <ShoppingCart size={18} color="#fff" />
              <Text style={styles.welcomeGuideBtnText}>Explore the Marketplace</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.welcomeGuideSecondaryBtn, { borderColor: isDark ? '#1E3A5F' : '#E2E8F0' }]}
              onPress={() => setShowWelcomeGuide(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.welcomeGuideSecondaryText, { color: isDark ? '#8FB4D4' : '#64748B' }]}>
                Got it
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AnnouncementPopup visible={isChecking === false && isAccepted} audience="customers" />

      <AddCustomItemModal
        visible={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onAdd={addCustomItem}
      />

      <LocationSelector
        visible={showLocationSelector}
        onClose={() => setShowLocationSelector(false)}
        onLocationConfirm={(location) => {
          handleLocationConfirm(location);
          setShowLocationSelector(false);
        }}
        savedLocation={customerCoords}
        customerName={customerName as string}
      />

      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <CheckCircle size={48} color="#10b981" />
              <Text style={styles.modalTitle}>Order Accepted!</Text>
              <Text style={styles.modalSubtitle}>
                {acceptedOrder?.drivers?.full_name} has accepted your order
              </Text>
            </View>

            {acceptedOrder?.payment_option === 'paynow' && (
              <View style={styles.paymentCodeSection}>
                <Text style={styles.paymentLabel}>Pay with Paynow</Text>
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>Total Amount</Text>
                  <Text style={styles.amountValue}>
                    ${(acceptedOrder.total_amount + acceptedOrder.delivery_fee).toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.paynowPayButton}
                  onPress={async () => {
                    try {
                      const ref = generateReference('delivery_request', acceptedOrder.id);
                      const result = await startPaynowPayment({
                        paymentType: 'delivery_request',
                        entityId: acceptedOrder.id,
                        amount: acceptedOrder.total_amount + acceptedOrder.delivery_fee,
                        reference: ref,
                        description: `UniLink Grocery Order - ${acceptedOrder?.drivers?.full_name || 'Driver'}`,
                        metadata: { delivery_id: acceptedOrder.id },
                      });
                      if (!result.success || !result.paymentUrl) {
                        setError(`Could not open Paynow: ${result.error || 'unknown error'}`);
                        setShowPaymentModal(false);
                      }
                    } catch (e: any) {
                      setError(`Could not open Paynow: ${e?.message || 'unknown error'}`);
                      setShowPaymentModal(false);
                    }
                  }}
                >
                  <CreditCard size={20} color="#fff" />
                  <Text style={styles.paynowPayButtonText}>Pay Now on Paynow Website</Text>
                </TouchableOpacity>
                <Text style={styles.paymentInstructions}>
                  Tap the button above and you will be taken to the Paynow website to complete payment securely.
                </Text>
              </View>
            )}

            {acceptedOrder?.payment_option === 'pay_on_delivery' && (
              <View style={styles.paymentCodeSection}>
                <View style={styles.cashInfoBox}>
                  <Text style={styles.cashInfoTitle}>Cash on Delivery</Text>
                  <Text style={styles.cashInfoText}>
                    Prepare cash payment of ${(acceptedOrder.total_amount + acceptedOrder.delivery_fee).toFixed(2)}
                  </Text>
                  <Text style={styles.cashInfoText}>
                    Pay the driver when your order arrives
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.orderInfoBox}>
              <Text style={styles.orderInfoLabel}>Driver Contact</Text>
              <TouchableOpacity
                style={styles.phoneButton}
                onPress={() => Linking.openURL(`tel:${acceptedOrder?.drivers?.phone_number}`)}
              >
                <Text style={styles.phoneButtonText}>
                  📞 {acceptedOrder?.drivers?.phone_number}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => {
                  setShowPaymentModal(false);
                  router.push({
                    pathname: '/customer/chat',
                    params: {
                      customerId,
                      customerName,
                      deliveryId: acceptedOrder?.id,
                    },
                  });
                }}
              >
                <MessageCircle size={20} color="#fff" />
                <Text style={styles.chatButtonText}>Chat with Driver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DriverSelectionModal
        visible={showDriverSelectionModal}
        onClose={() => setShowDriverSelectionModal(false)}
        drivers={filteredDrivers}
        deliveryMethod={deliveryMethod}
        paymentOption={paymentOption}
        onSelectDirect={(driver) => {
          setSelectedDriver(driver.id);
          setDeliveryMode('direct');
          setShowDriverSelectionModal(false);
        }}
        onSelectOpenRequest={() => {
          setDeliveryMode('open_request');
          setSelectedDriver(null);
          setShowDriverSelectionModal(false);
        }}
        selectedDriverId={selectedDriver}
        deliveryMode={deliveryMode}
        onViewReviews={(driver) => {
          setShowDriverSelectionModal(false);
          handleViewReviews(driver);
        }}
        orderTotal={calculateTotal()}
      />

      <OpenRequestWaitingModal
        visible={showOpenRequestWaiting}
        deliveryId={openRequestDeliveryId}
        onDriverSelected={(driverId, driverName, deliveryData) => {
          setShowOpenRequestWaiting(false);
          setOpenRequestDeliveryId(null);
          if (deliveryData) {
            setAcceptedOrder(deliveryData);
            setShowPaymentModal(true);
          }
        }}
        onCancel={async () => {
          if (openRequestDeliveryId) {
            await supabase
              .from('deliveries')
              .update({ status: 'cancelled' })
              .eq('id', openRequestDeliveryId);
          }
          setShowOpenRequestWaiting(false);
          setOpenRequestDeliveryId(null);
        }}
        onOpenChat={(delivId) => {
          setShowOpenRequestWaiting(false);
          setOpenRequestDeliveryId(null);
          router.push({
            pathname: '/customer/chat',
            params: { customerId, customerName, deliveryId: delivId },
          });
        }}
      />

      <Modal
        visible={showReviewsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReviewsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reviewsModalContent}>
            <View style={styles.reviewsModalHeader}>
              <View style={styles.reviewsDriverInfo}>
                {selectedDriverForReviews?.profile_picture_url ? (
                  <Image
                    source={{ uri: selectedDriverForReviews.profile_picture_url }}
                    style={styles.reviewsDriverAvatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.reviewsDriverAvatarPlaceholder}>
                    <User size={32} color={colors.textTertiary} />
                  </View>
                )}
                <View style={styles.reviewsDriverDetails}>
                  <Text style={styles.reviewsDriverName}>
                    {selectedDriverForReviews?.full_name}
                  </Text>
                  {selectedDriverForReviews && selectedDriverForReviews.total_ratings > 0 && (
                    <View style={styles.reviewsRatingRow}>
                      <Star
                        size={20}
                        color="#fbbf24"
                        fill="#fbbf24"
                      />
                      <Text style={styles.reviewsAverageRating}>
                        {selectedDriverForReviews.average_rating.toFixed(1)}
                      </Text>
                      <Text style={styles.reviewsTotalCount}>
                        ({selectedDriverForReviews.total_ratings} reviews)
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.reviewsCloseButton}
                onPress={() => setShowReviewsModal(false)}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.reviewsList}>
              {loadingReviews ? (
                <View style={styles.reviewsLoadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.reviewsLoadingText}>Loading reviews...</Text>
                </View>
              ) : driverReviews.length === 0 ? (
                <View style={styles.noReviewsContainer}>
                  <Star size={48} color={colors.textTertiary} />
                  <Text style={styles.noReviewsText}>No reviews yet</Text>
                  <Text style={styles.noReviewsSubtext}>
                    Be the first to review this driver
                  </Text>
                </View>
              ) : (
                driverReviews.map((review: any) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewAuthor}>
                        <View style={styles.reviewAuthorAvatar}>
                          <User size={16} color={colors.textTertiary} />
                        </View>
                        <Text style={styles.reviewAuthorName}>
                          {review.customers?.full_name || 'Anonymous'}
                        </Text>
                      </View>
                      <View style={styles.reviewRating}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={14}
                            color={star <= review.rating ? '#fbbf24' : '#d1d5db'}
                            fill={star <= review.rating ? '#fbbf24' : 'none'}
                          />
                        ))}
                      </View>
                    </View>
                    {review.review_text && (
                      <Text style={styles.reviewText}>{review.review_text}</Text>
                    )}
                    <Text style={styles.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
