import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { X, Truck, ChevronRight, CreditCard, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Star, Car, Bike, MessageCircle, Lock } from 'lucide-react-native';
import { CartByShop, Driver, Shop, ThemePalette, formatPaymentMethod, getAcceptedMethods, computeShopOpen } from './types';

type Props = {
  visible: boolean;
  palette: ThemePalette;
  cartByShop: CartByShop[];
  shops: Shop[];
  cartTotal: number;
  placingOrder: boolean;
  error: string;
  onClose: () => void;
  onPlaceOrder: (deliveryLocation: string, lat: number | null, lng: number | null, paymentMethod: string, deliveryFee: number) => void;
  customerId?: string;
  selectedDriver: Driver | null;
  availableDrivers: Driver[];
  loadingDrivers: boolean;
  onOpenDriverPicker: () => void;
  onSelectDriver: (d: Driver) => void;
  showDriverPicker: boolean;
  onCloseDriverPicker: () => void;
};

const ALL_PAYMENT_METHODS = ['pay_on_delivery', 'ecocash', 'paynow', 'card', 'bank_transfer'];

export function CheckoutModal({
  visible, palette, cartByShop, shops, cartTotal, placingOrder, error, onClose, onPlaceOrder, customerId,
  selectedDriver, availableDrivers, loadingDrivers, onOpenDriverPicker, onSelectDriver,
  showDriverPicker, onCloseDriverPicker,
}: Props) {
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pay_on_delivery');
  const [deliveryFee, setDeliveryFee] = useState('2.00');
  const [whatsappSent, setWhatsappSent] = useState(false);

  const openWhatsApp = (driver: Driver) => {
    const num = (driver.whatsapp_number || '').replace(/[^0-9]/g, '');
    if (!num) return;
    const msg = encodeURIComponent(
      `Hi ${driver.full_name}, I'd like to place a delivery order through UniLink. Are you available?`
    );
    Linking.openURL(`https://wa.me/${num}?text=${msg}`).then(() => setWhatsappSent(true)).catch(() => {});
  };

  useEffect(() => {
    if (visible) setWhatsappSent(false);
  }, [visible]);

  const unavailableShops = cartByShop.filter(sc => {
    const shop = shops.find(s => s.id === sc.shopId);
    return shop ? !shop.is_available : false;
  });
  const closedShops = cartByShop.filter(sc => {
    const shop = shops.find(s => s.id === sc.shopId);
    return shop && shop.is_available && shop.operating_hours ? !computeShopOpen(shop) : false;
  });
  const anyUnavailable = unavailableShops.length > 0;
  const anyClosed = closedShops.length > 0;
  const anyBlocked = anyUnavailable || anyClosed;

  const acceptedIntersection: string[] = (() => {
    if (cartByShop.length === 0) return ALL_PAYMENT_METHODS;
    const sets = cartByShop.map(sc => {
      const shop = shops.find(s => s.id === sc.shopId);
      return shop ? new Set(getAcceptedMethods(shop)) : new Set(['pay_on_delivery', 'ecocash']);
    });
    return ALL_PAYMENT_METHODS.filter(m => sets.every(s => s.has(m)));
  })();

  useEffect(() => {
    if (acceptedIntersection.length > 0 && !acceptedIntersection.includes(paymentMethod)) {
      setPaymentMethod(acceptedIntersection[0]);
    }
  }, [acceptedIntersection, paymentMethod]);

  const handlePlace = () => {
    if (!deliveryLocation.trim()) return;
    if (!selectedDriver) return;
    if (anyBlocked) return;
    onPlaceOrder(deliveryLocation.trim(), null, null, paymentMethod, parseFloat(deliveryFee) || 2);
  };

  const needsWhatsapp = !!selectedDriver?.whatsapp_number && !whatsappSent;
  const canPlace = deliveryLocation.trim() && selectedDriver && !placingOrder && !anyBlocked && !needsWhatsapp;

  return (
    <View style={styles.overlay}>
      <View style={[styles.content, { backgroundColor: palette.cardBg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>Checkout</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={22} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 400 }}>
          {anyUnavailable ? (
            <View style={[styles.blockBox, { backgroundColor: `${palette.error}15`, borderColor: palette.error }]}>
              <AlertCircle size={16} color={palette.error} />
              <Text style={[styles.blockText, { color: palette.error }]}>This shop is currently unavailable. Remove its items from your cart to continue.</Text>
            </View>
          ) : null}

          {anyClosed ? (
            <View style={[styles.blockBox, { backgroundColor: `${palette.warning}15`, borderColor: palette.warning }]}>
              <Lock size={16} color={palette.warning} />
              <Text style={[styles.blockText, { color: palette.warning }]}>One or more shops in your cart are currently closed. Orders and payments are blocked until they reopen. Please remove their items or try again later.</Text>
            </View>
          ) : null}

          <Text style={[styles.label, { color: palette.textSecondary }]}>DELIVERY LOCATION *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.textPrimary }]}
            value={deliveryLocation}
            onChangeText={setDeliveryLocation}
            placeholder="Enter delivery address"
            placeholderTextColor={palette.placeholderColor}
            multiline
            editable={!anyBlocked}
          />

          <Text style={[styles.label, { color: palette.textSecondary, marginTop: 16 }]}>SELECT A DRIVER / MESSENGER *</Text>
          <TouchableOpacity
            style={[styles.driverSelectBtn, {
              backgroundColor: selectedDriver ? `${palette.primary}15` : palette.primary,
              borderColor: selectedDriver ? palette.primary : 'transparent',
              borderWidth: selectedDriver ? 2 : 0,
            }]}
            onPress={onOpenDriverPicker}
            activeOpacity={0.85}
            disabled={anyBlocked}
          >
            {selectedDriver ? (
              <>
                <View style={styles.driverSelectLeft}>
                  <View style={[styles.driverSelectAvatar, { backgroundColor: `${palette.primary}25` }]}>
                    <Truck size={18} color={palette.primary} />
                  </View>
                  <View>
                    <Text style={[styles.driverSelectName, { color: palette.textPrimary }]}>{selectedDriver.full_name}</Text>
                    <Text style={[styles.driverSelectPhone, { color: palette.textSecondary }]}>{selectedDriver.phone_number}</Text>
                  </View>
                </View>
                <View style={styles.driverSelectChange}>
                  <Text style={styles.driverSelectChangeText}>Change</Text>
                  <ChevronRight size={16} color={palette.primary} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.driverSelectIconWrap}>
                  <Truck size={20} color="#fff" />
                </View>
                <Text style={styles.driverSelectBtnText}>Choose Your Driver</Text>
                <View style={styles.driverSelectArrow}>
                  <ChevronRight size={20} color="#fff" />
                </View>
              </>
            )}
          </TouchableOpacity>
          {!selectedDriver && !anyBlocked ? (
            <Text style={styles.driverRequiredHint}>A driver must be selected before placing your order</Text>
          ) : null}

          {selectedDriver?.whatsapp_number ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  paddingVertical: 12, borderRadius: 12,
                  backgroundColor: whatsappSent ? `${palette.success}15` : '#25D366',
                  borderWidth: whatsappSent ? 1.5 : 0,
                  borderColor: '#25D366',
                }}
                onPress={() => openWhatsApp(selectedDriver)}
                activeOpacity={0.8}
              >
                <MessageCircle size={16} color={whatsappSent ? '#25D366' : '#fff'} />
                <Text style={{
                  fontSize: 13, fontWeight: '800',
                  color: whatsappSent ? '#25D366' : '#fff',
                }}>
                  {whatsappSent ? 'WhatsApp Sent ✓' : 'Send WhatsApp Message (Required)'}
                </Text>
              </TouchableOpacity>
              {!whatsappSent && (
                <Text style={{
                  fontSize: 11, color: palette.warning,
                  textAlign: 'center', lineHeight: 16,
                }}>
                  You must send a WhatsApp message to this messenger before placing your order.
                </Text>
              )}
            </View>
          ) : null}

          {showDriverPicker ? (
            <View style={[styles.driverPickerSheet, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
              <View style={styles.driverPickerHeader}>
                <Text style={[styles.driverPickerTitle, { color: palette.textPrimary }]}>Eligible Drivers</Text>
                <TouchableOpacity onPress={onCloseDriverPicker}>
                  <X size={18} color={palette.textSecondary} />
                </TouchableOpacity>
              </View>
              {loadingDrivers ? (
                <View style={styles.driverPickerLoading}>
                  <ActivityIndicator size="small" color={palette.primary} />
                  <Text style={{ color: palette.textSecondary, fontSize: 13, marginTop: 8 }}>Finding eligible drivers...</Text>
                </View>
              ) : availableDrivers.length === 0 ? (
                <View style={styles.driverPickerEmptyWrap}>
                  <Truck size={28} color={palette.placeholderColor} />
                  <Text style={[styles.driverPickerEmptyTitle, { color: palette.textPrimary }]}>No eligible drivers</Text>
                  <Text style={[styles.driverPickerEmptyText, { color: palette.textSecondary }]}>
                    There are no drivers available for your delivery area right now. Please check back shortly or try again later.
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 240 }}>
                  {availableDrivers.map((d: Driver) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.driverPickerItem, { borderBottomColor: palette.inputBorder }, selectedDriver?.id === d.id && { backgroundColor: `${palette.primary}10` }]}
                      onPress={() => onSelectDriver(d)}
                    >
                      <View style={[styles.driverPickerAvatar, { backgroundColor: `${palette.primary}15` }]}>
                        <VehicleIcon type={d.vehicle_type} color={palette.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.driverPickerItemName, { color: palette.textPrimary }]}>{d.full_name}</Text>
                        <Text style={[styles.driverPickerItemPhone, { color: palette.textSecondary }]}>{d.phone_number}</Text>
                        <View style={styles.driverStatsRow}>
                          {d.rating != null && d.rating !== undefined ? (
                            <View style={styles.driverStat}>
                              <Star size={10} color={palette.warning} fill={palette.warning} />
                              <Text style={[styles.driverStatText, { color: palette.textSecondary }]}>{Number(d.rating).toFixed(1)}</Text>
                            </View>
                          ) : null}
                          {d.completed_deliveries != null && d.completed_deliveries !== undefined ? (
                            <View style={styles.driverStat}>
                              <CheckCircle size={10} color={palette.success} />
                              <Text style={[styles.driverStatText, { color: palette.textSecondary }]}>{d.completed_deliveries} done</Text>
                            </View>
                          ) : null}
                          {d.vehicle_type ? (
                            <View style={styles.driverStat}>
                              <VehicleIcon type={d.vehicle_type} color={palette.textSecondary} size={10} />
                              <Text style={[styles.driverStatText, { color: palette.textSecondary }]}>{d.vehicle_type}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      {selectedDriver?.id === d.id ? <CheckCircle size={18} color={palette.primary} /> : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}

          <Text style={[styles.label, { color: palette.textSecondary, marginTop: 16 }]}>DELIVERY FEE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.textPrimary }]}
            value={deliveryFee}
            onChangeText={setDeliveryFee}
            placeholder="2.00"
            placeholderTextColor={palette.placeholderColor}
            keyboardType="decimal-pad"
            editable={!anyBlocked}
          />

          <Text style={[styles.label, { color: palette.textSecondary, marginTop: 16 }]}>PAYMENT METHOD</Text>
          {acceptedIntersection.length === 0 ? (
            <View style={[styles.blockBox, { backgroundColor: `${palette.warning}15`, borderColor: palette.warning, marginTop: 8 }]}>
              <AlertCircle size={14} color={palette.warning} />
              <Text style={[styles.blockText, { color: palette.warning }]}>No common payment method accepted by all shops in your cart.</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {acceptedIntersection.map(method => (
                <TouchableOpacity
                  key={method}
                  style={[styles.paymentMethod, { backgroundColor: paymentMethod === method ? palette.primary : palette.inputBg, borderColor: paymentMethod === method ? palette.primary : palette.inputBorder }]}
                  onPress={() => setPaymentMethod(method)}
                  disabled={anyBlocked}
                >
                  <Text style={{ color: paymentMethod === method ? '#fff' : palette.textSecondary, fontSize: 12, fontWeight: '600' }}>
                    {formatPaymentMethod(method)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.summary, { borderTopColor: palette.cardBorder, borderBottomColor: palette.cardBorder }]}>
            <View style={styles.summaryRow}>
              <Text style={{ color: palette.textSecondary, fontSize: 13 }}>Items total</Text>
              <Text style={{ color: palette.textPrimary, fontSize: 13 }}>${cartTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ color: palette.textSecondary, fontSize: 13 }}>Delivery fee</Text>
              <Text style={{ color: palette.textPrimary, fontSize: 13 }}>${(parseFloat(deliveryFee) || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ color: palette.textPrimary, fontSize: 15, fontWeight: '700' }}>Grand Total</Text>
              <Text style={{ color: palette.primary, fontSize: 17, fontWeight: '800' }}>${(cartTotal + (parseFloat(deliveryFee) || 0)).toFixed(2)}</Text>
            </View>
          </View>

          <Text style={{ color: palette.textSecondary, fontSize: 11, marginTop: 8 }}>Note: {cartByShop.length} separate order(s) will be created, one per shop.</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: '#ef4444', marginTop: 12 }]}>
              <AlertCircle size={14} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 12, flex: 1 }}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <TouchableOpacity
          style={[styles.placeOrderBtn, { backgroundColor: canPlace ? palette.primary : (isDarkBorder(palette.inputBorder) ? '#2a3a5c' : '#cbd5e1'), opacity: placingOrder ? 0.6 : 1 }]}
          onPress={handlePlace}
          disabled={!canPlace}
          activeOpacity={0.85}
        >
          {placingOrder ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.placeOrderBtnText}>
              {anyUnavailable ? 'Shop Unavailable' : anyClosed ? 'Shop Closed — No Orders' : !selectedDriver ? 'Select a Driver to Continue' : needsWhatsapp ? 'Send WhatsApp First' : 'Place Order(s)'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function isDarkBorder(borderColor: string): boolean {
  return borderColor !== '#cbd5e1';
}

function VehicleIcon({ type, color, size = 16 }: { type?: string | null; color: string; size?: number }) {
  const t = (type || '').toLowerCase();
  if (t.includes('bike') || t.includes('motor') || t.includes('cycle')) return <Bike size={size} color={color} />;
  return <Car size={size} color={color} />;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  content: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  blockBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  blockText: { fontSize: 12, fontWeight: '600', flex: 1 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 48 },
  driverSelectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, minHeight: 60 },
  driverSelectBtnText: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 12 },
  driverSelectIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  driverSelectArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  driverSelectLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  driverSelectAvatar: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  driverSelectName: { fontSize: 15, fontWeight: '700' },
  driverSelectPhone: { fontSize: 12, marginTop: 2 },
  driverSelectChange: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  driverSelectChangeText: { fontSize: 13, fontWeight: '600', color: '#0066ff' },
  driverRequiredHint: { fontSize: 12, fontWeight: '600', color: '#f59e0b', marginTop: 8, textAlign: 'center' },
  driverPickerSheet: { marginTop: 8, borderRadius: 14, borderWidth: 1.5, overflow: 'hidden' },
  driverPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  driverPickerTitle: { fontSize: 15, fontWeight: '700' },
  driverPickerLoading: { alignItems: 'center', paddingVertical: 24 },
  driverPickerEmptyWrap: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, gap: 8 },
  driverPickerEmptyTitle: { fontSize: 15, fontWeight: '700' },
  driverPickerEmptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  driverPickerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  driverPickerAvatar: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  driverPickerItemName: { fontSize: 14, fontWeight: '600' },
  driverPickerItemPhone: { fontSize: 12, marginTop: 2 },
  driverStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  driverStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  driverStatText: { fontSize: 11 },
  paymentMethod: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5 },
  summary: { marginTop: 20, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  placeOrderBtn: { borderRadius: 14, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  placeOrderBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
