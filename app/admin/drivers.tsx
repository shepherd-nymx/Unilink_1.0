import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Truck, CreditCard as Edit2, CreditCard, Trash2, CircleCheck as CheckCircle, Circle as XCircle, School, Key, RefreshCw } from 'lucide-react-native';
import { A } from '@/lib/admin-theme';
import { SkeletonList } from '@/components/Skeleton';
import { ConnectionBadge } from '@/components/ConnectionBadge';

type Driver = {
  id: string;
  phone_number: string;
  full_name: string;
  location: string;
  current_key: string | null;
  key_expires_at: string | null;
  is_available: boolean;
  delivery_type: string | string[];
  payment_methods: string[];
  created_at: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  email?: string;
  address?: string;
  vehicle_type?: string;
  vehicle_registration?: string;
  national_id?: string;
  national_id_photo_url?: string | null;
  rejection_reason?: string;
  university_id?: string;
  universities?: { name: string };
};

export default function ManageDrivers() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [universities, setUniversities] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedUniversityFilter, setSelectedUniversityFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connState, setConnState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [showModal, setShowModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [driverToApprove, setDriverToApprove] = useState<Driver | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showIdPhotoModal, setShowIdPhotoModal] = useState(false);
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    phoneNumber: '',
    fullName: '',
    location: '',
    deliveryTypes: [] as string[],
    paymentMethods: [] as string[],
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadUniversities();
    loadDrivers();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    const channel = supabase
      .channel('admin-drivers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => loadDrivers())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnState('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setConnState('error'); setTimeout(() => loadDrivers(), 2000); }
        else if (status === 'CLOSED') setConnState('disconnected');
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [activeTab, selectedUniversityFilter]);

  const loadDrivers = async () => {
    try {
      let query = supabase
        .from('drivers')
        .select('*, universities!drivers_university_id_fkey(name)')
        .order('created_at', { ascending: false });

      if (selectedUniversityFilter) {
        query = query.eq('university_id', selectedUniversityFilter);
      }

      const { data, error: dbError } = await query;

      if (dbError) throw dbError;
      setDrivers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const loadUniversities = async () => {
    try {
      const { data, error } = await supabase
        .from('universities')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setUniversities(data || []);
    } catch (err: any) {
      console.error('Failed to load universities:', err);
    }
  };

  const generateMonthlyKey = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const addDriver = async () => {
    if (!formData.phoneNumber || !formData.fullName || !formData.location) {
      setError('Please fill in all fields');
      return;
    }

    setAdding(true);
    setError('');

    try {
      const monthlyKey = generateMonthlyKey();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const { error: dbError } = await supabase.from('drivers').insert({
        phone_number: formData.phoneNumber,
        full_name: formData.fullName,
        location: formData.location,
        current_key: monthlyKey,
        key_expires_at: expiresAt.toISOString(),
        delivery_type: ['walking'],
        payment_methods: ['pay_on_delivery'],
      });

      if (dbError) throw dbError;

      setShowModal(false);
      setFormData({ phoneNumber: '', fullName: '', location: '', deliveryTypes: [], paymentMethods: [] });
      loadDrivers();
    } catch (err: any) {
      setError(err.message || 'Failed to add driver');
    } finally {
      setAdding(false);
    }
  };

  const updateDriver = async () => {
    if (!editingDriver || !formData.phoneNumber || !formData.fullName || !formData.location) {
      setError('Please fill in all required fields');
      return;
    }

    setAdding(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('drivers')
        .update({
          phone_number: formData.phoneNumber,
          full_name: formData.fullName,
          location: formData.location,
        })
        .eq('id', editingDriver.id);

      if (dbError) throw dbError;

      setShowModal(false);
      setEditingDriver(null);
      setFormData({ phoneNumber: '', fullName: '', location: '', deliveryTypes: [], paymentMethods: [] });
      loadDrivers();
    } catch (err: any) {
      setError(err.message || 'Failed to update driver');
    } finally {
      setAdding(false);
    }
  };

  const openEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      phoneNumber: driver.phone_number,
      fullName: driver.full_name,
      location: driver.location || '',
      deliveryTypes: Array.isArray(driver.delivery_type) ? driver.delivery_type : [driver.delivery_type].filter(Boolean),
      paymentMethods: driver.payment_methods || [],
    });
    setShowModal(true);
  };

  const confirmDelete = (driver: Driver) => {
    setDriverToDelete(driver);
    setShowDeleteConfirm(true);
  };

  const deleteDriver = async () => {
    if (!driverToDelete) return;

    setDeleting(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverToDelete.id);

      if (dbError) throw dbError;

      setShowDeleteConfirm(false);
      setDriverToDelete(null);
      loadDrivers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete driver');
    } finally {
      setDeleting(false);
    }
  };

  const renewKey = async (driverId: string) => {
    try {
      const newKey = generateMonthlyKey();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const { error: dbError } = await supabase
        .from('drivers')
        .update({
          current_key: newKey,
          key_expires_at: expiresAt.toISOString(),
        })
        .eq('id', driverId);

      if (dbError) throw dbError;
      loadDrivers();
    } catch (err: any) {
      setError(err.message || 'Failed to renew key');
    }
  };

  const approveDriver = async () => {
    if (!driverToApprove) return;

    setApproving(true);
    setError('');

    try {
      const monthlyKey = generateMonthlyKey();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const { error: dbError } = await supabase
        .from('drivers')
        .update({
          approval_status: 'approved',
          current_key: monthlyKey,
          key_expires_at: expiresAt.toISOString(),
          approved_at: new Date().toISOString(),
        })
        .eq('id', driverToApprove.id);

      if (dbError) throw dbError;

      setShowApprovalModal(false);
      setDriverToApprove(null);
      loadDrivers();
    } catch (err: any) {
      setError(err.message || 'Failed to approve driver');
    } finally {
      setApproving(false);
    }
  };

  const rejectDriver = async () => {
    if (!driverToApprove || !rejectionReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setApproving(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('drivers')
        .update({
          approval_status: 'rejected',
          rejection_reason: rejectionReason,
        })
        .eq('id', driverToApprove.id);

      if (dbError) throw dbError;

      setShowApprovalModal(false);
      setDriverToApprove(null);
      setRejectionReason('');
      loadDrivers();
    } catch (err: any) {
      setError(err.message || 'Failed to reject driver');
    } finally {
      setApproving(false);
    }
  };

  const filteredDrivers = drivers.filter(driver => driver.approval_status === activeTab);

  const pendingCount = drivers.filter(d => d.approval_status === 'pending').length;
  const approvedCount = drivers.filter(d => d.approval_status === 'approved').length;
  const rejectedCount = drivers.filter(d => d.approval_status === 'rejected').length;

  const tabColor = activeTab === 'approved' ? A.green : activeTab === 'pending' ? A.amber : A.red;

  const getCardBorderColor = (status: string) => {
    if (status === 'approved') return A.green;
    if (status === 'pending') return A.amber;
    return A.red;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: A.bg }}>
        <View style={{ backgroundColor: A.surface, paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: A.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.cyan, justifyContent: 'center', alignItems: 'center' }}>
            <ArrowLeft size={18} color={A.cyan} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, textTransform: 'uppercase' }}>FLEET MANAGEMENT</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: A.text }}>Manage Drivers</Text>
          </View>
        </View>
        <SkeletonList count={6} lines={4} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: A.bg }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: A.surface,
          paddingTop: 60,
          paddingBottom: 16,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: A.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: A.cyanDim,
            borderWidth: 1,
            borderColor: A.cyan,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={18} color={A.cyan} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, textTransform: 'uppercase' }}>
            FLEET MANAGEMENT
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: A.text }}>Manage Drivers</Text>
        </View>
        <ConnectionBadge state={connState} />
        <TouchableOpacity
          onPress={() => {
            setEditingDriver(null);
            setFormData({ phoneNumber: '', fullName: '', location: '', deliveryTypes: [], paymentMethods: [] });
            setShowModal(true);
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: A.greenDim,
            borderWidth: 1,
            borderColor: A.green,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Plus size={18} color={A.green} />
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error ? (
        <View style={{ marginHorizontal: 20, marginTop: 12, padding: 12, backgroundColor: A.redDim, borderRadius: 8, borderWidth: 1, borderColor: A.red }}>
          <Text style={{ color: A.red, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border }}>
        {([
          { key: 'pending', label: 'Pending', count: pendingCount, color: A.amber },
          { key: 'approved', label: 'Approved', count: approvedCount, color: A.green },
          { key: 'rejected', label: 'Rejected', count: rejectedCount, color: A.red },
        ] as const).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1,
              paddingVertical: 14,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? tab.color : 'transparent',
            }}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === tab.key ? tab.color : A.textSub }}>
              {tab.label}{' '}
              <Text style={{ fontSize: 11, color: activeTab === tab.key ? tab.color : A.textMuted }}>
                ({tab.count})
              </Text>
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* University Filter */}
      <View style={{ padding: 16, paddingBottom: 8, backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, marginBottom: 8 }}>
          FILTER BY UNIVERSITY
        </Text>
        {Platform.OS === 'web' ? (
          <select
            value={selectedUniversityFilter}
            onChange={(e: any) => setSelectedUniversityFilter(e.target.value)}
            style={{
              backgroundColor: A.inputBg,
              color: A.text,
              border: `1px solid ${A.inputBorder}`,
              borderRadius: 10,
              padding: '12px 16px',
              outline: 'none',
              width: '100%',
              fontFamily: 'system-ui',
            } as any}
          >
            <option value="">All Universities</option>
            {universities.map((uni) => (
              <option key={uni.id} value={uni.id}>{uni.name}</option>
            ))}
          </select>
        ) : (
          <View style={{ backgroundColor: A.inputBg, borderRadius: 10, borderWidth: 1, borderColor: A.inputBorder, padding: 12 }}>
            <Text style={{ color: A.textSub, fontSize: 14 }}>
              {selectedUniversityFilter
                ? universities.find(u => u.id === selectedUniversityFilter)?.name || 'Selected'
                : 'All Universities'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Section title */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted }}>
            {activeTab === 'pending' ? 'PENDING APPLICATIONS' : activeTab === 'approved' ? 'APPROVED DRIVERS' : 'REJECTED APPLICATIONS'} — {filteredDrivers.length}
          </Text>
        </View>

        {filteredDrivers.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Truck size={40} color={A.textMuted} />
            <Text style={{ fontSize: 15, color: A.textSub, marginTop: 12 }}>
              {activeTab === 'pending' ? 'No pending applications' : activeTab === 'approved' ? 'No approved drivers' : 'No rejected applications'}
            </Text>
          </View>
        ) : (
          <Animated.View
            style={{
              padding: 16,
              paddingTop: 0,
              gap: 12,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {filteredDrivers.map(driver => {
              const isExpired = driver.key_expires_at && new Date(driver.key_expires_at) < new Date();
              const isPending = driver.approval_status === 'pending';
              const accentColor = getCardBorderColor(driver.approval_status);

              return (
                <View
                  key={driver.id}
                  style={{
                    backgroundColor: A.card,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: A.border,
                    overflow: 'hidden',
                  }}
                >
                  {/* Left accent bar */}
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ width: 3, backgroundColor: accentColor, alignSelf: 'stretch' }} />
                    <View style={{ flex: 1, padding: 14 }}>
                      {/* Driver header row */}
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            backgroundColor: accentColor === A.green ? A.greenDim : accentColor === A.amber ? A.amberDim : A.redDim,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Truck size={22} color={accentColor} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 17, fontWeight: '700', color: A.text }}>{driver.full_name}</Text>
                          <Text style={{ fontSize: 13, color: A.textSub, marginTop: 2 }}>{driver.phone_number}</Text>
                          {driver.universities && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <School size={12} color={A.cyan} />
                              <Text style={{ fontSize: 12, color: A.cyan, fontWeight: '500' }}>{driver.universities.name}</Text>
                            </View>
                          )}
                        </View>

                        {/* Actions */}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => openEditModal(driver)}
                            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: A.blueDim, borderWidth: 1, borderColor: A.blue, justifyContent: 'center', alignItems: 'center' }}
                          >
                            <Edit2 size={15} color={A.blue} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => confirmDelete(driver)}
                            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: A.redDim, borderWidth: 1, borderColor: A.red, justifyContent: 'center', alignItems: 'center' }}
                          >
                            <Trash2 size={15} color={A.red} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Details */}
                      <View style={{ marginTop: 10, gap: 4 }}>
                        {driver.email && (
                          <Text style={{ fontSize: 12, color: A.textSub }}>Email: {driver.email}</Text>
                        )}
                        {driver.address && (
                          <Text style={{ fontSize: 12, color: A.textSub }}>Address: {driver.address}</Text>
                        )}
                        {driver.national_id && (
                          <Text style={{ fontSize: 12, color: A.textSub }}>ID: {driver.national_id}</Text>
                        )}
                        {driver.national_id_photo_url && (
                          <TouchableOpacity
                            style={{ marginTop: 6, backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.cyan, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
                            onPress={() => {
                              setIdPhotoUrl(driver.national_id_photo_url!);
                              setShowIdPhotoModal(true);
                            }}
                          >
                            <CreditCard size={14} color={A.cyan} />
                            <Text style={{ color: A.cyan, fontSize: 12, fontWeight: '600' }}>View ID Card Photo</Text>
                          </TouchableOpacity>
                        )}
                        <Text style={{ fontSize: 12, color: A.textSub }}>
                          Delivery: {typeof driver.delivery_type === 'string' ? driver.delivery_type : (driver.delivery_type || []).join(', ')}
                        </Text>
                        {driver.vehicle_type && (
                          <Text style={{ fontSize: 12, color: A.textSub }}>Vehicle: {driver.vehicle_type}</Text>
                        )}
                        {driver.vehicle_registration && (
                          <Text style={{ fontSize: 12, color: A.textSub }}>Reg: {driver.vehicle_registration}</Text>
                        )}

                        {/* Key info for approved drivers */}
                        {!isPending && driver.current_key && (
                          <View style={{ marginTop: 6, backgroundColor: A.surface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: A.border }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Key size={12} color={A.amber} />
                              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: A.amber }}>ACCESS KEY</Text>
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: isExpired ? A.red : A.text, fontFamily: 'monospace' }}>
                              {driver.current_key}
                              {isExpired && <Text style={{ color: A.red, fontWeight: '700' }}> (EXPIRED)</Text>}
                            </Text>
                            {driver.key_expires_at && (
                              <Text style={{ fontSize: 11, color: A.textSub, marginTop: 2 }}>
                                Expires: {new Date(driver.key_expires_at).toLocaleDateString()}
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Rejection reason */}
                        {driver.approval_status === 'rejected' && driver.rejection_reason && (
                          <View style={{ marginTop: 6, backgroundColor: A.redDim, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: A.red }}>
                            <Text style={{ fontSize: 12, color: A.red, fontWeight: '600' }}>
                              Reason: {driver.rejection_reason}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Pending approval actions */}
                      {isPending && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: A.greenDim, borderWidth: 1, borderColor: A.green, padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            onPress={() => {
                              setDriverToApprove(driver);
                              setShowApprovalModal(true);
                              setRejectionReason('');
                            }}
                          >
                            <CheckCircle size={16} color={A.green} />
                            <Text style={{ color: A.green, fontSize: 13, fontWeight: '700' }}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: A.redDim, borderWidth: 1, borderColor: A.red, padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            onPress={() => {
                              setDriverToApprove(driver);
                              setShowApprovalModal(true);
                              setRejectionReason('');
                            }}
                          >
                            <XCircle size={16} color={A.red} />
                            <Text style={{ color: A.red, fontSize: 13, fontWeight: '700' }}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Renew key for expired approved drivers */}
                      {!isPending && isExpired && (
                        <TouchableOpacity
                          style={{ marginTop: 10, backgroundColor: A.amberDim, borderWidth: 1, borderColor: A.amber, padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          onPress={() => renewKey(driver.id)}
                        >
                          <RefreshCw size={16} color={A.amber} />
                          <Text style={{ color: A.amber, fontSize: 13, fontWeight: '700' }}>Renew Key</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>

      {/* Add/Edit Driver Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: A.overlay, justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: A.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTopWidth: 1,
              borderColor: A.border,
              padding: 20,
              paddingBottom: 40,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: '800', color: A.text, marginBottom: 4 }}>
              {editingDriver ? 'Edit Driver' : 'Add New Driver'}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, marginBottom: 20 }}>
              {editingDriver ? 'UPDATE DRIVER DETAILS' : 'REGISTER NEW DRIVER'}
            </Text>

            <View style={{ gap: 14, marginBottom: 20 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>FULL NAME</Text>
                <TextInput
                  style={{ backgroundColor: A.inputBg, borderWidth: 1, borderColor: A.inputBorder, borderRadius: 10, padding: 12, fontSize: 15, color: A.text }}
                  value={formData.fullName}
                  onChangeText={text => setFormData({ ...formData, fullName: text })}
                  placeholder="Enter full name"
                  placeholderTextColor={A.textMuted}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>PHONE NUMBER</Text>
                <TextInput
                  style={{ backgroundColor: A.inputBg, borderWidth: 1, borderColor: A.inputBorder, borderRadius: 10, padding: 12, fontSize: 15, color: A.text }}
                  value={formData.phoneNumber}
                  onChangeText={text => setFormData({ ...formData, phoneNumber: text })}
                  placeholder="Enter phone number"
                  placeholderTextColor={A.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>LOCATION</Text>
                <TextInput
                  style={{ backgroundColor: A.inputBg, borderWidth: 1, borderColor: A.inputBorder, borderRadius: 10, padding: 12, fontSize: 15, color: A.text }}
                  value={formData.location}
                  onChangeText={text => setFormData({ ...formData, location: text })}
                  placeholder="e.g., Harare CBD, Avondale, Borrowdale"
                  placeholderTextColor={A.textMuted}
                />
                <Text style={{ fontSize: 11, color: A.textSub, fontStyle: 'italic' }}>
                  Enter the area where the driver operates
                </Text>
              </View>

              <Text style={{ fontSize: 11, color: A.textSub, fontStyle: 'italic' }}>
                Note: Delivery types, payment methods, and availability are controlled by the driver through their settings page.
              </Text>

              {!editingDriver && (
                <Text style={{ fontSize: 11, color: A.cyan, fontStyle: 'italic' }}>
                  A monthly key will be automatically generated for the driver.
                </Text>
              )}
              {editingDriver && (
                <Text style={{ fontSize: 11, color: A.cyan, fontStyle: 'italic' }}>
                  To update the driver's authentication key, use the "Renew Key" button.
                </Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: A.border, alignItems: 'center' }}
                onPress={() => {
                  setShowModal(false);
                  setEditingDriver(null);
                  setFormData({ phoneNumber: '', fullName: '', location: '', deliveryTypes: [], paymentMethods: [] });
                  setError('');
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: A.textSub }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, backgroundColor: A.cyan, padding: 14, borderRadius: 10, alignItems: 'center', opacity: adding ? 0.6 : 1 }}
                onPress={editingDriver ? updateDriver : addDriver}
                disabled={adding}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: A.bg }}>
                  {adding
                    ? editingDriver ? 'Updating...' : 'Adding...'
                    : editingDriver ? 'Update Driver' : 'Add Driver'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal visible={showDeleteConfirm} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: A.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: A.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: A.border }}>
            <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: A.redDim, borderWidth: 1, borderColor: A.red, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Trash2 size={22} color={A.red} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: A.text, marginBottom: 8 }}>Delete Driver?</Text>
            <Text style={{ fontSize: 14, color: A.textSub, marginBottom: 24, lineHeight: 22 }}>
              Are you sure you want to delete {driverToDelete?.full_name}? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: A.border, alignItems: 'center' }}
                onPress={() => { setShowDeleteConfirm(false); setDriverToDelete(null); }}
                disabled={deleting}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: A.textSub }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: A.red, padding: 12, borderRadius: 10, alignItems: 'center', opacity: deleting ? 0.6 : 1 }}
                onPress={deleteDriver}
                disabled={deleting}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Approval/Rejection Modal */}
      <Modal visible={showApprovalModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: A.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: A.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, borderWidth: 1, borderColor: A.border }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, marginBottom: 6 }}>DRIVER REVIEW</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: A.text, marginBottom: 8 }}>
              {driverToApprove ? `Review ${driverToApprove.full_name}` : 'Review Driver'}
            </Text>
            <Text style={{ fontSize: 14, color: A.textSub, marginBottom: 16, lineHeight: 22 }}>
              Would you like to approve or reject this driver registration?
            </Text>

            <View style={{ gap: 6, marginBottom: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>REJECTION REASON (if rejecting)</Text>
              <TextInput
                style={{ backgroundColor: A.inputBg, borderWidth: 1, borderColor: A.inputBorder, borderRadius: 10, padding: 12, fontSize: 14, color: A.text, minHeight: 80, textAlignVertical: 'top' }}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                placeholder="Enter reason for rejection..."
                placeholderTextColor={A.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: A.border, alignItems: 'center' }}
                onPress={() => { setShowApprovalModal(false); setDriverToApprove(null); setRejectionReason(''); }}
                disabled={approving}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: A.textSub }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: A.red, padding: 12, borderRadius: 10, alignItems: 'center', opacity: approving ? 0.6 : 1 }}
                onPress={rejectDriver}
                disabled={approving}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                  {approving ? 'Processing...' : 'Reject'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: A.green, padding: 12, borderRadius: 10, alignItems: 'center', opacity: approving ? 0.6 : 1 }}
                onPress={approveDriver}
                disabled={approving}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: A.bg }}>
                  {approving ? 'Processing...' : 'Approve'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ID Photo Viewer Modal */}
      <Modal visible={showIdPhotoModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: A.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 500, borderWidth: 1, borderColor: A.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: A.text }}>National ID Card</Text>
              <TouchableOpacity
                onPress={() => { setShowIdPhotoModal(false); setIdPhotoUrl(null); }}
                style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ color: A.textSub, fontSize: 18 }}>x</Text>
              </TouchableOpacity>
            </View>
            {idPhotoUrl && Platform.OS === 'web' ? (
              <img
                src={idPhotoUrl}
                style={{ width: '100%', maxHeight: 400, borderRadius: 10, objectFit: 'contain' as any }}
                alt="National ID Card"
              />
            ) : (
              <View style={{ height: 300, backgroundColor: A.card, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: A.textSub }}>Photo not available on this platform</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
