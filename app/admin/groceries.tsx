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
  Switch,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, ShoppingBag, CreditCard as Edit2, Trash2, Tag, ChevronDown } from 'lucide-react-native';
import { A } from '@/lib/admin-theme';

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
  created_at: string;
  category_id: string | null;
  categories?: Category;
};

export default function ManageGroceries() {
  const router = useRouter();
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingGrocery, setEditingGrocery] = useState<GroceryItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groceryToDelete, setGroceryToDelete] = useState<GroceryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    isAvailable: true,
    categoryId: '',
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadCategories();
    loadGroceries();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (dbError) throw dbError;
      setCategories(data || []);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadGroceries = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('grocery_items')
        .select(`
          *,
          categories (
            id,
            name,
            icon,
            sort_order
          )
        `)
        .order('name', { ascending: true });

      if (dbError) throw dbError;
      setGroceries(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load groceries');
    } finally {
      setLoading(false);
    }
  };

  const addGrocery = async () => {
    if (!formData.name || !formData.price || !formData.categoryId) {
      setError('Please fill in all fields including category');
      return;
    }

    const priceValue = parseFloat(formData.price);
    if (isNaN(priceValue) || priceValue <= 0) {
      setError('Please enter a valid price greater than 0');
      return;
    }

    setAdding(true);
    setError('');

    try {
      const { error: dbError } = await supabase.from('grocery_items').insert({
        name: formData.name,
        price: priceValue,
        is_available: formData.isAvailable,
        category_id: formData.categoryId,
      });

      if (dbError) throw dbError;

      setShowModal(false);
      setFormData({ name: '', price: '', isAvailable: true, categoryId: '' });
      loadGroceries();
    } catch (err: any) {
      setError(err.message || 'Failed to add grocery item');
    } finally {
      setAdding(false);
    }
  };

  const updateGrocery = async () => {
    if (!editingGrocery || !formData.name || !formData.price || !formData.categoryId) {
      setError('Please fill in all required fields including category');
      return;
    }

    const priceValue = parseFloat(formData.price);
    if (isNaN(priceValue) || priceValue <= 0) {
      setError('Please enter a valid price greater than 0');
      return;
    }

    setAdding(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('grocery_items')
        .update({
          name: formData.name,
          price: priceValue,
          is_available: formData.isAvailable,
          category_id: formData.categoryId,
        })
        .eq('id', editingGrocery.id);

      if (dbError) throw dbError;

      setShowModal(false);
      setEditingGrocery(null);
      setFormData({ name: '', price: '', isAvailable: true, categoryId: '' });
      loadGroceries();
    } catch (err: any) {
      setError(err.message || 'Failed to update grocery item');
    } finally {
      setAdding(false);
    }
  };

  const openEditModal = (grocery: GroceryItem) => {
    setEditingGrocery(grocery);
    setFormData({
      name: grocery.name,
      price: grocery.price.toString(),
      isAvailable: grocery.is_available,
      categoryId: grocery.category_id || '',
    });
    setShowModal(true);
  };

  const confirmDelete = (grocery: GroceryItem) => {
    setGroceryToDelete(grocery);
    setShowDeleteConfirm(true);
  };

  const deleteGrocery = async () => {
    if (!groceryToDelete) return;

    setDeleting(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('grocery_items')
        .delete()
        .eq('id', groceryToDelete.id);

      if (dbError) throw dbError;

      setShowDeleteConfirm(false);
      setGroceryToDelete(null);
      loadGroceries();
    } catch (err: any) {
      setError(err.message || 'Failed to delete grocery item');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageSkeleton page="admin/groceries"/>;
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
            INVENTORY CONTROL
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: A.text }}>Manage Groceries</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setEditingGrocery(null);
            setFormData({ name: '', price: '', isAvailable: true, categoryId: '' });
            setShowModal(true);
          }}
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
            ALL ITEMS — {groceries.length}
          </Text>
        </View>

        {groceries.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ShoppingBag size={40} color={A.textMuted} />
            <Text style={{ fontSize: 15, color: A.textSub, marginTop: 12 }}>No grocery items yet</Text>
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
            {groceries.map(grocery => (
              <View
                key={grocery.id}
                style={{
                  backgroundColor: A.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: A.border,
                  overflow: 'hidden',
                  flexDirection: 'row',
                }}
              >
                {/* Left amber accent bar */}
                <View style={{ width: 3, backgroundColor: A.amber }} />

                <View style={{ flex: 1, padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    {/* Icon */}
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        backgroundColor: A.amberDim,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <ShoppingBag size={22} color={A.amber} />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: A.text }}>{grocery.name}</Text>

                      {/* Category badge */}
                      {grocery.categories && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            marginTop: 4,
                            backgroundColor: A.amberDim,
                            borderRadius: 20,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            alignSelf: 'flex-start',
                          }}
                        >
                          <Text style={{ fontSize: 12 }}>{grocery.categories.icon}</Text>
                          <Text style={{ fontSize: 11, color: A.amber, fontWeight: '600' }}>{grocery.categories.name}</Text>
                        </View>
                      )}

                      {/* Price */}
                      <Text style={{ fontSize: 16, color: A.green, fontWeight: '700', marginTop: 4 }}>
                        ${grocery.price.toFixed(2)}
                      </Text>

                      {/* Available/Unavailable status badge */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 4,
                          backgroundColor: grocery.is_available ? A.greenDim : A.redDim,
                          borderRadius: 20,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          alignSelf: 'flex-start',
                          borderWidth: 1,
                          borderColor: grocery.is_available ? A.green : A.red,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: grocery.is_available ? A.green : A.red, fontWeight: '600' }}>
                          {grocery.is_available ? 'Available' : 'Unavailable'}
                        </Text>
                      </View>
                    </View>

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => openEditModal(grocery)}
                        style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: A.blueDim, borderWidth: 1, borderColor: A.blue, justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Edit2 size={15} color={A.blue} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmDelete(grocery)}
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

      {/* Add/Edit Grocery Modal */}
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
              {editingGrocery ? 'Edit Grocery Item' : 'Add New Grocery Item'}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, marginBottom: 20 }}>
              {editingGrocery ? 'UPDATE ITEM DETAILS' : 'ADD NEW ITEM'}
            </Text>

            <View style={{ gap: 14, marginBottom: 20 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>ITEM NAME</Text>
                <TextInput
                  style={{ backgroundColor: A.inputBg, borderWidth: 1, borderColor: A.inputBorder, borderRadius: 10, padding: 12, fontSize: 15, color: A.text }}
                  value={formData.name}
                  onChangeText={text => setFormData({ ...formData, name: text })}
                  placeholder="Enter item name"
                  placeholderTextColor={A.textMuted}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>PRICE ($)</Text>
                <TextInput
                  style={{ backgroundColor: A.inputBg, borderWidth: 1, borderColor: A.inputBorder, borderRadius: 10, padding: 12, fontSize: 15, color: A.green }}
                  value={formData.price}
                  onChangeText={text => setFormData({ ...formData, price: text })}
                  placeholder="Enter price"
                  placeholderTextColor={A.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>CATEGORY</Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: A.inputBg,
                    borderWidth: 1,
                    borderColor: formData.categoryId ? A.amber : A.inputBorder,
                    borderRadius: 10,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  {formData.categoryId ? (
                    <>
                      <Text style={{ fontSize: 16 }}>
                        {categories.find(c => c.id === formData.categoryId)?.icon}
                      </Text>
                      <Text style={{ fontSize: 15, color: A.text, flex: 1 }}>
                        {categories.find(c => c.id === formData.categoryId)?.name}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Tag size={18} color={A.textMuted} />
                      <Text style={{ fontSize: 15, color: A.textMuted, flex: 1 }}>Select category</Text>
                    </>
                  )}
                  <ChevronDown size={16} color={A.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: A.textMuted }}>AVAILABLE FOR PURCHASE</Text>
                  <Switch
                    value={formData.isAvailable}
                    onValueChange={value => setFormData({ ...formData, isAvailable: value })}
                    trackColor={{ false: A.redDim, true: A.greenDim }}
                    thumbColor={formData.isAvailable ? A.green : A.red}
                  />
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: A.border, alignItems: 'center' }}
                onPress={() => {
                  setShowModal(false);
                  setEditingGrocery(null);
                  setFormData({ name: '', price: '', isAvailable: true, categoryId: '' });
                  setError('');
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: A.textSub }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, backgroundColor: A.cyan, padding: 14, borderRadius: 10, alignItems: 'center', opacity: adding ? 0.6 : 1 }}
                onPress={editingGrocery ? updateGrocery : addGrocery}
                disabled={adding}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: A.bg }}>
                  {adding
                    ? editingGrocery ? 'Updating...' : 'Adding...'
                    : editingGrocery ? 'Update Item' : 'Add Item'}
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
            <Text style={{ fontSize: 20, fontWeight: '800', color: A.text, marginBottom: 8 }}>Delete Grocery Item?</Text>
            <Text style={{ fontSize: 14, color: A.textSub, marginBottom: 24, lineHeight: 22 }}>
              Are you sure you want to delete {groceryToDelete?.name}? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: A.border, alignItems: 'center' }}
                onPress={() => { setShowDeleteConfirm(false); setGroceryToDelete(null); }}
                disabled={deleting}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: A.textSub }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: A.red, padding: 12, borderRadius: 10, alignItems: 'center', opacity: deleting ? 0.6 : 1 }}
                onPress={deleteGrocery}
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

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: A.overlay, justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: A.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTopWidth: 1,
              borderColor: A.border,
              maxHeight: '60%',
            }}
          >
            {/* Picker header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: A.border,
              }}
            >
              <View>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted, marginBottom: 2 }}>
                  SELECT
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: A.text }}>Category</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCategoryPicker(false)}
                style={{
                  backgroundColor: A.cyanDim,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: A.cyan,
                }}
              >
                <Text style={{ fontSize: 13, color: A.cyan, fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {categories.map(category => {
                const isSelected = formData.categoryId === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor: isSelected ? A.amberDim : A.card,
                      borderWidth: isSelected ? 1 : 1,
                      borderColor: isSelected ? A.amber : A.border,
                    }}
                    onPress={() => {
                      setFormData({ ...formData, categoryId: category.id });
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{category.icon}</Text>
                    <Text style={{ fontSize: 15, color: isSelected ? A.amber : A.text, fontWeight: isSelected ? '700' : '500', flex: 1 }}>
                      {category.name}
                    </Text>
                    {isSelected && (
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: A.amber, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: A.bg, fontSize: 12, fontWeight: '800' }}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
