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
import { parseDMS, toDMS } from '@/lib/gps-utils';
import { ArrowLeft, Plus, User, MapPin, CreditCard as Edit2, Trash2, School } from 'lucide-react-native';
import { A } from '@/lib/admin-theme';

type Customer = {
  id: string;
  username: string;
  phone_number: string;
  full_name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  university_id?: string;
  universities?: { name: string };
};

export default function ManageCustomers() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [universities, setUniversities] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedUniversityFilter, setSelectedUniversityFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    phoneNumber: '',
    fullName: '',
    location: '',
    gpsCoordinates: '',
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadUniversities();
    loadCustomers();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [selectedUniversityFilter]);

  const loadCustomers = async () => {
    try {
      let query = supabase
        .from('customers')
        .select('*, universities(name)')
        .order('created_at', { ascending: false });

      if (selectedUniversityFilter) {
        query = query.eq('university_id', selectedUniversityFilter);
      }

      const { data, error: dbError } = await query;

      if (dbError) throw dbError;
      setCustomers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load customers');
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

  const addCustomer = async () => {
    if (!formData.username || !formData.phoneNumber || !formData.fullName || !formData.location) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.gpsCoordinates) {
      setError('Please provide GPS coordinates in DMS format');
      return;
    }

    setAdding(true);
    setError('');

    try {
      const coords = parseDMS(formData.gpsCoordinates);

      if (!coords) {
        setError('Invalid GPS coordinates format. Use DMS format like: 17°49\'45.6"S 31°02\'33.6"E or decimal format: -17.8293, 31.0427');
        setAdding(false);
        return;
      }

      const customerData = {
        username: formData.username,
        phone_number: formData.phoneNumber,
        full_name: formData.fullName,
        location: formData.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      const { error: dbError } = await supabase.from('customers').insert(customerData);

      if (dbError) throw dbError;

      setShowModal(false);
      setFormData({ username: '', phoneNumber: '', fullName: '', location: '', gpsCoordinates: '' });
      loadCustomers();
    } catch (err: any) {
      setError(err.message || 'Failed to add customer');
    } finally {
      setAdding(false);
    }
  };

  const updateCustomer = async () => {
    if (!editingCustomer || !formData.username || !formData.phoneNumber || !formData.fullName || !formData.location) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.gpsCoordinates) {
      setError('Please provide GPS coordinates in DMS format');
      return;
    }

    setAdding(true);
    setError('');

    try {
      const coords = parseDMS(formData.gpsCoordinates);

      if (!coords) {
        setError('Invalid GPS coordinates format. Use DMS format like: 17°49\'45.6"S 31°02\'33.6"E or decimal format: -17.8293, 31.0427');
        setAdding(false);
        return;
      }

      const customerData = {
        username: formData.username,
        phone_number: formData.phoneNumber,
        full_name: formData.fullName,
        location: formData.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      const { error: dbError } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', editingCustomer.id);

      if (dbError) throw dbError;

      setShowModal(false);
      setEditingCustomer(null);
      setFormData({ username: '', phoneNumber: '', fullName: '', location: '', gpsCoordinates: '' });
      loadCustomers();
    } catch (err: any) {
      setError(err.message || 'Failed to update customer');
    } finally {
      setAdding(false);
    }
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    const gpsString = customer.latitude && customer.longitude
      ? toDMS(customer.latitude, customer.longitude)
      : '';
    setFormData({
      username: customer.username,
      phoneNumber: customer.phone_number,
      fullName: customer.full_name,
      location: customer.location || '',
      gpsCoordinates: gpsString,
    });
    setShowModal(true);
  };

  const confirmDelete = (customer: Customer) => {
    setCustomerToDelete(customer);
    setShowDeleteConfirm(true);
  };

  const deleteCustomer = async () => {
    if (!customerToDelete) return;

    setDeleting(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id);

      if (dbError) throw dbError;

      setShowDeleteConfirm(false);
      setCustomerToDelete(null);
      loadCustomers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: A.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={A.cyan} />
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
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted }}>
            USER MANAGEMENT
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: A.text }}>Manage Customers</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setEditingCustomer(null);
            setFormData({ username: '', phoneNumber: '', fullName: '', location: '', gpsCoordinates: '' });
            setShowModal(true);
          }}
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
          <Plus size={18} color={A.cyan} />
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error ? (
        <View style={{ marginHorizontal: 20, marginTop: 12, padding: 12, backgroundColor: A.redDim, borderRadius: 8, borderWidth: 1, borderColor: A.red }}>
          <Text style={{ color: A.red, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

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
            ALL CUSTOMERS — {customers.length}
          </Text>
        </View>

        {customers.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <User size={40} color={A.textMuted} />
            <Text style={{ fontSize: 15, color: A.textSub, marginTop: 12 }}>No customers yet</Text>
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
            {customers.map(customer => (
              <View
                key={customer.id}
                style={{
                  backgroundColor: A.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: A.border,
                  overflow: 'hidden',
                  flexDirection: 'row',
                }}
              >
                {/* Left cyan accent bar */}
                <View style={{ width: 3, backgroundColor: A.cyan }} />

                <View style={{ flex: 1, padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    {/* Icon */}
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        backgroundColor: A.cyanDim,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <User size={22} color={A.cyan} />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: A.text }}>{customer.full_name}</Text>
                      <Text style={{ fontSize: 12, color: A.cyan, marginTop: 1 }}>@{customer.username}</Text>
                      <Text style={{ fontSize: 13, color: A.textSub, marginTop: 2 }}>{customer.phone_number}</Text>
                      {customer.universities && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <School size={12} color={A.cyan} />
                          <Text style={{ fontSize: 12, color: A.cyan, fontWeight: '500' }}>{customer.universities.name}</Text>
                        </View>
                      )}
                      {customer.location ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                          <MapPin size={13} color={A.green} />
                          <Text style={{ fontSize: 13, color: A.green, fontWeight: '500' }}>{customer.location}</Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 12, color: A.textMuted, fontStyle: 'italic', marginTop: 6 }}>
                          No location set
                        </Text>
                      )}
                      {customer.latitude && customer.longitude && (
                        <Text
                          style={{
                            fontSize: 11,
                            color: A.textMuted,
                            marginTop: 4,
                            fontFamily: 'monospace',
                            backgroundColor: A.surface,
                            padding: 4,
                            borderRadius: 4,
                          }}
                        >
                          GPS: {toDMS(customer.latitude, customer.longitude)}
                        </Text>
                      )}
                    </View>

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => openEditModal(customer)}
                        style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: A.blueDim, borderWidth: 1, borderColor: A.blue, justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Edit2 size={15} color={A.blue} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmDelete(customer)}
                        style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: A.redDim, borderWidth: 1, borderColor: A.red, justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Trash2 size={15} color={A.red} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </Animated.View>
        )}
      </ScrollView>

      {/* Add/Edit Customer Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: A.overlay, justifyContent: 'flex-end' }}>
          <ScrollView
            style={{
              backgroundColor: A.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTopWidth: 1,
              borderColor: A.border,
            }}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          >
            <Text style={{ fontSize: 22, fontWeight: '800', color: A.text, marginBottom: 4 }}>
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, marginBottom: 20 }}>
              {editingCustomer ? 'UPDATE CUSTOMER DETAILS' : 'REGISTER NEW CUSTOMER'}
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
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>USERNAME</Text>
                <TextInput
                  style={{ backgroundColor: A.inputBg, borderWidth: 1, borderColor: A.inputBorder, borderRadius: 10, padding: 12, fontSize: 15, color: A.text }}
                  value={formData.username}
                  onChangeText={text => setFormData({ ...formData, username: text })}
                  placeholder="Enter username"
                  placeholderTextColor={A.textMuted}
                  autoCapitalize="none"
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
                  Enter the area or neighborhood name where the customer is located
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>GPS COORDINATES (DMS)</Text>
                <TextInput
                  style={{ backgroundColor: A.inputBg, borderWidth: 1, borderColor: A.inputBorder, borderRadius: 10, padding: 12, fontSize: 14, color: A.cyan, fontFamily: 'monospace', minHeight: 60, textAlignVertical: 'top' }}
                  value={formData.gpsCoordinates}
                  onChangeText={text => setFormData({ ...formData, gpsCoordinates: text })}
                  placeholder="e.g., 17°49'45.6&quot;S 31°02'33.6&quot;E or -17.8293, 31.0427"
                  placeholderTextColor={A.textMuted}
                  multiline
                />
                <Text style={{ fontSize: 11, color: A.textSub, fontStyle: 'italic' }}>
                  Enter coordinates in DMS format (Degrees Minutes Seconds) or decimal format. These coordinates will be used if the customer doesn't share their current location.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: A.border, alignItems: 'center' }}
                onPress={() => {
                  setShowModal(false);
                  setEditingCustomer(null);
                  setFormData({ username: '', phoneNumber: '', fullName: '', location: '', gpsCoordinates: '' });
                  setError('');
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: A.textSub }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, backgroundColor: A.cyan, padding: 14, borderRadius: 10, alignItems: 'center', opacity: adding ? 0.6 : 1 }}
                onPress={editingCustomer ? updateCustomer : addCustomer}
                disabled={adding}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: A.bg }}>
                  {adding
                    ? editingCustomer ? 'Updating...' : 'Adding...'
                    : editingCustomer ? 'Update Customer' : 'Add Customer'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal visible={showDeleteConfirm} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: A.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: A.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: A.border }}>
            <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: A.redDim, borderWidth: 1, borderColor: A.red, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Trash2 size={22} color={A.red} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: A.text, marginBottom: 8 }}>Delete Customer?</Text>
            <Text style={{ fontSize: 14, color: A.textSub, marginBottom: 24, lineHeight: 22 }}>
              Are you sure you want to delete {customerToDelete?.full_name}? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: A.border, alignItems: 'center' }}
                onPress={() => { setShowDeleteConfirm(false); setCustomerToDelete(null); }}
                disabled={deleting}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: A.textSub }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: A.red, padding: 12, borderRadius: 10, alignItems: 'center', opacity: deleting ? 0.6 : 1 }}
                onPress={deleteCustomer}
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
    </View>
  );
}
