import PageSkeleton from '@/components/PageSkeleton';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, UserCog, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { A } from '@/lib/admin-theme';

type Admin = {
  id: string;
  username: string;
  created_at: string;
};

export default function ManageAdmins() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [adding, setAdding] = useState(false);

  const [formData, setFormData] = useState({
    adminId: '',
    username: '',
    password: '',
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadAdmins();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadAdmins = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('admins')
        .select('id, username, created_at')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;
      setAdmins(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const addAdmin = async () => {
    if (!formData.adminId || !formData.username || !formData.password) {
      setError('Please fill in all fields including Admin ID');
      return;
    }

    setAdding(true);
    setError('');

    try {
      const insertData: any = {
        username: formData.username,
        password_hash: formData.password,
      };

      if (formData.adminId.trim()) {
        insertData.id = formData.adminId.trim();
      }

      const { error: dbError } = await supabase.from('admins').insert(insertData);

      if (dbError) throw dbError;

      setShowModal(false);
      setFormData({ adminId: '', username: '', password: '' });
      loadAdmins();
    } catch (err: any) {
      setError(err.message || 'Failed to add admin');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return <PageSkeleton page="admin/admins"/>;
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
            ACCESS CONTROL
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: A.text }}>Manage Admins</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: A.amberDim,
            borderWidth: 1,
            borderColor: A.amber,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Plus size={18} color={A.amber} />
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error ? (
        <View style={{ marginHorizontal: 20, marginTop: 12, padding: 12, backgroundColor: A.redDim, borderRadius: 8, borderWidth: 1, borderColor: A.red }}>
          <Text style={{ color: A.red, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }}>
        {/* Section title */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted }}>
            ALL ADMINS ({admins.length})
          </Text>
        </View>

        {admins.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <UserCog size={40} color={A.textMuted} />
            <Text style={{ fontSize: 15, color: A.textSub, marginTop: 12 }}>No admins yet</Text>
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
            {admins.map(admin => (
              <View
                key={admin.id}
                style={{
                  backgroundColor: A.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: A.border,
                  overflow: 'hidden',
                  flexDirection: 'row',
                }}
              >
                {/* Left amber/orange accent bar */}
                <View style={{ width: 3, backgroundColor: A.orange }} />

                <View style={{ flex: 1, padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    {/* Icon */}
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: A.amberDim,
                        borderWidth: 1,
                        borderColor: A.amber,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <UserCog size={24} color={A.amber} />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: A.text }}>{admin.username}</Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: A.amber,
                          fontWeight: '600',
                          marginTop: 2,
                          fontFamily: 'monospace',
                        }}
                      >
                        ID: {admin.id}
                      </Text>
                      <Text style={{ fontSize: 12, color: A.textSub, marginTop: 2 }}>
                        Added: {new Date(admin.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </Animated.View>
        )}
      </ScrollView>

      {/* Add Admin Modal */}
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
              Add New Admin
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, marginBottom: 20 }}>
              GRANT SYSTEM ACCESS
            </Text>

            <View style={{ gap: 14, marginBottom: 20 }}>
              {/* Admin ID - highlighted with cyan border */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.cyan }}>
                  ADMIN ID (REGISTRATION NUMBER) *
                </Text>
                <TextInput
                  style={{
                    backgroundColor: A.inputBg,
                    borderWidth: 2,
                    borderColor: A.cyan,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 15,
                    color: A.text,
                  }}
                  value={formData.adminId}
                  onChangeText={text => setFormData({ ...formData, adminId: text })}
                  placeholder="e.g., 71-200200W83"
                  placeholderTextColor={A.textMuted}
                  autoCapitalize="none"
                />
                <Text style={{ fontSize: 11, color: A.cyan, fontStyle: 'italic' }}>
                  This is the admin's registration/ID number
                </Text>
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
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>PASSWORD</Text>
                <TextInput
                  style={{ backgroundColor: A.inputBg, borderWidth: 1, borderColor: A.inputBorder, borderRadius: 10, padding: 12, fontSize: 15, color: A.text }}
                  value={formData.password}
                  onChangeText={text => setFormData({ ...formData, password: text })}
                  placeholder="Enter password"
                  placeholderTextColor={A.textMuted}
                  secureTextEntry
                />
              </View>

              {/* Warning text box */}
              <View
                style={{
                  backgroundColor: A.redDim,
                  borderRadius: 10,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: A.red,
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <AlertTriangle size={18} color={A.red} style={{ marginTop: 1 }} />
                <Text style={{ fontSize: 13, color: A.red, flex: 1, lineHeight: 20 }}>
                  Admin will have full access to manage customers, drivers, and other admins.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: A.border, alignItems: 'center' }}
                onPress={() => {
                  setShowModal(false);
                  setFormData({ adminId: '', username: '', password: '' });
                  setError('');
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: A.textSub }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, backgroundColor: A.cyan, padding: 14, borderRadius: 10, alignItems: 'center', opacity: adding ? 0.6 : 1 }}
                onPress={addAdmin}
                disabled={adding}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: A.bg }}>
                  {adding ? 'Adding...' : 'Add Admin'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
