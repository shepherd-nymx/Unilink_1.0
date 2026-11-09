import PageSkeleton from '@/components/PageSkeleton';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, CreditCard as Edit2, Check, X, Power, School, MapPin } from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { A } from '@/lib/admin-theme';

interface Location {
  id: string;
  name: string;
  is_active: boolean;
  location_type: 'university' | 'place';
  created_at: string;
  updated_at: string;
}

type Tab = 'university' | 'place';

const RLS_FIX_SQL = `-- Run this once in your Supabase SQL Editor:
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'universities'
    AND policyname = 'Admins can insert universities'
  ) THEN
    CREATE POLICY "Admins can insert universities"
      ON universities FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'universities'
    AND policyname = 'Admins can update universities'
  ) THEN
    CREATE POLICY "Admins can update universities"
      ON universities FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'universities'
    AND policyname = 'Admins can delete universities'
  ) THEN
    CREATE POLICY "Admins can delete universities"
      ON universities FOR DELETE USING (true);
  END IF;
END $$;`;

export default function UniversitiesManagement() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('university');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showRlsFix, setShowRlsFix] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadLocations();
    checkWritePermission();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  async function checkWritePermission() {
    const { error } = await supabase
      .from('universities')
      .insert({ name: '__permission_check__', is_active: false, location_type: 'university' });
    if (error?.code === '42501' || error?.message?.includes('row-level security') || error?.message?.includes('policy')) {
      setShowRlsFix(true);
    } else if (!error) {
      await supabase.from('universities').delete().eq('name', '__permission_check__');
    }
  }

  async function loadLocations() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('universities')
        .select('*')
        .order('name');
      if (error) throw error;
      const rows = (data || []).map((r: any) => ({
        ...r,
        location_type: r.location_type ?? 'university',
      }));
      setLocations(rows);
    } catch (err: any) {
      setFormError(err.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    setFormError('');
    if (!newName.trim()) {
      setFormError(`Please enter a ${activeTab === 'university' ? 'university' : 'place'} name`);
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase
        .from('universities')
        .insert({ name: newName.trim(), is_active: true, location_type: activeTab });
      if (error) {
        if (error.message?.includes('location_type') || error.code === '42703') {
          const { error: e2 } = await supabase
            .from('universities')
            .insert({ name: newName.trim(), is_active: true });
          if (e2) throw e2;
        } else {
          throw error;
        }
      }
      setNewName('');
      setShowAddForm(false);
      setFormError('');
      await loadLocations();
    } catch (err: any) {
      if (err.code === '42501' || err.message?.includes('row-level security') || err.message?.includes('policy')) {
        setShowRlsFix(true);
        setFormError('Database permission missing. See fix instructions below.');
      } else {
        setFormError(err.message || 'Failed to add location');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) {
      setFormError('Please enter a name');
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase
        .from('universities')
        .update({ name: editName.trim() })
        .eq('id', id);
      if (error) throw error;
      setEditingId(null);
      setEditName('');
      setFormError('');
      await loadLocations();
    } catch (err: any) {
      if (err.code === '42501' || err.message?.includes('row-level security') || err.message?.includes('policy')) {
        setShowRlsFix(true);
        setFormError('Database permission missing. See fix instructions below.');
      } else {
        setFormError(err.message || 'Failed to update');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('universities')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      await loadLocations();
    } catch (err: any) {
      if (err.code === '42501' || err.message?.includes('row-level security') || err.message?.includes('policy')) {
        setShowRlsFix(true);
        setFormError('Database permission missing. See fix instructions below.');
      } else {
        setFormError(err.message || 'Failed to update status');
      }
    }
  }

  function startEdit(loc: Location) {
    setEditingId(loc.id);
    setEditName(loc.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  const filtered = locations.filter((l) => {
    if (activeTab === 'university') return l.location_type === 'university' || !l.location_type;
    return l.location_type === 'place';
  });

  const tabLabel = activeTab === 'university' ? 'Universities' : 'Other Places';
  const addLabel = activeTab === 'university' ? 'Add University' : 'Add Place';
  const placeholderText = activeTab === 'university' ? 'University name' : 'Place name (e.g. Guruve, Chinhoyi)';

  const headerContent = (
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
        style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.cyan, justifyContent: 'center', alignItems: 'center' }}
      >
        <ArrowLeft size={18} color={A.cyan} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted }}>LOCATION MANAGEMENT</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: A.text }}>Locations</Text>
      </View>
      {!showAddForm && (
        <TouchableOpacity
          style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.cyan, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowAddForm(true)}
        >
          <Plus size={18} color={A.cyan} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return <PageSkeleton page="admin/universities" onBack={() => router.back()}/>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: A.bg }}>
      {headerContent}

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 10 }}>
        {(['university', 'place'] as Tab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'university' ? 'Universities' : 'Other Places';
          const count = locations.filter((l) =>
            tab === 'university' ? (l.location_type === 'university' || !l.location_type) : l.location_type === 'place'
          ).length;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => { setActiveTab(tab); setShowAddForm(false); setNewName(''); setEditingId(null); setFormError(''); }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isActive ? A.cyan : A.border,
                backgroundColor: isActive ? A.cyanDim : A.card,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {tab === 'university' ? (
                <School size={14} color={isActive ? A.cyan : A.textMuted} />
              ) : (
                <MapPin size={14} color={isActive ? A.cyan : A.textMuted} />
              )}
              <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? A.cyan : A.textSub }}>
                {label}
              </Text>
              <View style={{
                backgroundColor: isActive ? A.cyan : A.border,
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 1,
                minWidth: 20,
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: isActive ? A.bg : A.textMuted }}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 16, gap: 12 }}>

          {formError ? (
            <View style={{ backgroundColor: 'rgba(255,51,102,0.1)', borderWidth: 1, borderColor: A.red, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <X size={14} color={A.red} />
              <Text style={{ flex: 1, color: A.red, fontSize: 13, fontWeight: '600' }}>{formError}</Text>
              <TouchableOpacity onPress={() => { setFormError(''); setShowRlsFix(false); }}>
                <X size={14} color={A.red} />
              </TouchableOpacity>
            </View>
          ) : null}

          {showRlsFix ? (
            <View style={{ backgroundColor: A.card, borderWidth: 1, borderColor: A.amber, borderRadius: 12, overflow: 'hidden' }}>
              <View style={{ width: '100%', height: 3, backgroundColor: A.amber }} />
              <View style={{ padding: 14, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: A.amber }}>DATABASE SETUP REQUIRED</Text>
                <Text style={{ fontSize: 13, color: A.text, lineHeight: 20 }}>
                  The locations table is missing write permissions. Run this SQL once in your{' '}
                  <Text style={{ color: A.cyan, fontWeight: '700' }}>Supabase Dashboard → SQL Editor</Text>:
                </Text>
                <View style={{ backgroundColor: A.bg, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: A.border }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 11, color: A.green, lineHeight: 18 }}>{RLS_FIX_SQL}</Text>
                </View>
                <Text style={{ fontSize: 12, color: A.textSub, lineHeight: 18 }}>
                  After running the SQL, refresh this page and try again. This only needs to be done once.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: A.amberDim, borderWidth: 1, borderColor: A.amber, borderRadius: 8, padding: 10, alignItems: 'center' }}
                  onPress={() => setShowRlsFix(false)}
                >
                  <Text style={{ color: A.amber, fontWeight: '700', fontSize: 13 }}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Add Form */}
          {showAddForm && (
            <View
              style={{
                backgroundColor: A.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: A.cyan,
                overflow: 'hidden',
                flexDirection: 'row',
              }}
            >
              <View style={{ width: 3, backgroundColor: A.cyan }} />
              <View style={{ flex: 1, padding: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, marginBottom: 12 }}>
                  {addLabel.toUpperCase()}
                </Text>
                <TextInput
                  style={{
                    backgroundColor: A.inputBg,
                    borderWidth: 1,
                    borderColor: A.cyan,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 15,
                    color: A.text,
                    marginBottom: 12,
                  }}
                  placeholder={placeholderText}
                  placeholderTextColor={A.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: A.cyan, padding: 12, borderRadius: 10, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
                    onPress={handleAdd}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={A.bg} size="small" />
                    ) : (
                      <Text style={{ color: A.bg, fontWeight: '700', fontSize: 14 }}>{addLabel}</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, borderWidth: 1, borderColor: A.border, padding: 12, borderRadius: 10, alignItems: 'center' }}
                    onPress={() => { setShowAddForm(false); setNewName(''); setFormError(''); }}
                    disabled={saving}
                  >
                    <Text style={{ color: A.textSub, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, paddingTop: 4 }}>
            {tabLabel.toUpperCase()} — {filtered.length}
          </Text>

          {filtered.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              {activeTab === 'university' ? (
                <School size={40} color={A.textMuted} />
              ) : (
                <MapPin size={40} color={A.textMuted} />
              )}
              <Text style={{ fontSize: 15, color: A.textSub, marginTop: 12, textAlign: 'center' }}>
                No {tabLabel.toLowerCase()} added yet.{'\n'}Click the + button to create one.
              </Text>
            </View>
          ) : (
            <Animated.View style={{ gap: 12, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              {filtered.map((loc) => (
                <View
                  key={loc.id}
                  style={{
                    backgroundColor: A.card,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: A.border,
                    overflow: 'hidden',
                    flexDirection: 'row',
                  }}
                >
                  <View style={{ width: 3, backgroundColor: loc.is_active ? A.green : A.red }} />
                  <View style={{ flex: 1, padding: 14 }}>
                    {editingId === loc.id ? (
                      <View>
                        <TextInput
                          style={{
                            backgroundColor: A.inputBg,
                            borderWidth: 1,
                            borderColor: A.cyan,
                            borderRadius: 10,
                            padding: 10,
                            fontSize: 15,
                            color: A.text,
                            marginBottom: 10,
                          }}
                          value={editName}
                          onChangeText={setEditName}
                          autoFocus
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: A.greenDim, borderWidth: 1, borderColor: A.green, padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            onPress={() => handleUpdate(loc.id)}
                            disabled={saving}
                          >
                            {saving ? (
                              <ActivityIndicator color={A.green} size="small" />
                            ) : (
                              <>
                                <Check size={14} color={A.green} />
                                <Text style={{ fontSize: 13, color: A.green, fontWeight: '700' }}>Save</Text>
                              </>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, borderWidth: 1, borderColor: A.border, padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            onPress={cancelEdit}
                            disabled={saving}
                          >
                            <X size={14} color={A.textSub} />
                            <Text style={{ fontSize: 13, color: A.textSub, fontWeight: '600' }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            backgroundColor: loc.is_active ? A.greenDim : A.redDim,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          {loc.location_type === 'place' ? (
                            <MapPin size={20} color={loc.is_active ? A.green : A.red} />
                          ) : (
                            <School size={20} color={loc.is_active ? A.green : A.red} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: A.text, marginBottom: 5 }}>
                            {loc.name}
                          </Text>
                          <View
                            style={{
                              backgroundColor: loc.is_active ? A.greenDim : A.redDim,
                              borderRadius: 20,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              alignSelf: 'flex-start',
                              borderWidth: 1,
                              borderColor: loc.is_active ? A.green : A.red,
                              marginBottom: 5,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: loc.is_active ? A.green : A.red, letterSpacing: 1 }}>
                              {loc.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 11, color: A.textMuted }}>
                            Added: {new Date(loc.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => startEdit(loc)}
                            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: A.blueDim, borderWidth: 1, borderColor: A.blue, justifyContent: 'center', alignItems: 'center' }}
                          >
                            <Edit2 size={15} color={A.blue} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleToggleActive(loc.id, loc.is_active)}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              backgroundColor: loc.is_active ? A.redDim : A.greenDim,
                              borderWidth: 1,
                              borderColor: loc.is_active ? A.red : A.green,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Power size={15} color={loc.is_active ? A.red : A.green} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
