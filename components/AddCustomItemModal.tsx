import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type CustomItem = {
  id: string;
  name: string;
  quantity: number;
  approximate_price: number;
  is_custom: boolean;
};

type AddCustomItemModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: CustomItem) => void;
};

export default function AddCustomItemModal({
  visible,
  onClose,
  onAdd,
}: AddCustomItemModalProps) {
  const { colors } = useTheme();
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [approximatePrice, setApproximatePrice] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    setError('');

    if (!itemName.trim()) {
      setError('Please enter an item name');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      setError('Please enter a valid quantity (minimum 1)');
      return;
    }

    const price = parseFloat(approximatePrice);
    if (isNaN(price) || price < 0) {
      setError('Please enter a valid approximate price');
      return;
    }

    const newItem: CustomItem = {
      id: `custom_${Date.now()}`,
      name: itemName.trim(),
      quantity: qty,
      approximate_price: price,
      is_custom: true,
    };

    onAdd(newItem);

    setItemName('');
    setQuantity('1');
    setApproximatePrice('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setItemName('');
    setQuantity('1');
    setApproximatePrice('');
    setError('');
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 500,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textTertiary,
      marginBottom: 24,
      lineHeight: 20,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    required: {
      color: colors.error,
    },
    input: {
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 14,
      fontSize: 15,
      color: colors.text,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    halfWidth: {
      flex: 1,
    },
    errorContainer: {
      backgroundColor: colors.errorLight,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      textAlign: 'center',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: colors.disabled,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addButton: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      gap: 8,
    },
    cancelButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    addButtonText: {
      color: colors.surface,
      fontSize: 15,
      fontWeight: '600',
    },
    hint: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
      fontStyle: 'italic',
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={{ flex: 1, width: '100%' }}
          activeOpacity={1}
          onPress={handleClose}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={styles.modal}
            >
              <View style={styles.header}>
                <Text style={styles.title}>Add Custom Item</Text>
                <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                  <X size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.subtitle}>
                Add a specific item you want the driver to purchase. You can specify the item name, quantity, and approximate price.
              </Text>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Item Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="e.g., Fresh Milk, Bread, etc."
                  placeholderTextColor={colors.placeholder}
                  maxLength={100}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>
                    Quantity <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="1"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>

                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>
                    Approx. Price ($) <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={approximatePrice}
                    onChangeText={setApproximatePrice}
                    placeholder="0.00"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="decimal-pad"
                    maxLength={8}
                  />
                  <Text style={styles.hint}>Per item</Text>
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleClose}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.addButton]}
                  onPress={handleAdd}
                >
                  <Plus size={18} color={colors.surface} />
                  <Text style={styles.addButtonText}>Add Item</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
