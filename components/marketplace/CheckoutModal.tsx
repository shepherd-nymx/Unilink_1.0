import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import { X, Truck, CreditCard, CircleAlert as AlertCircle, Lock, ExternalLink, Zap, MessageCircle } from 'lucide-react-native';
import { CartByShop, Shop, ThemePalette, formatPaymentMethod, getAcceptedMethods, computeShopOpen } from './types';

type Props = {
  visible: boolean;
  palette: ThemePalette;
  cartByShop: CartByShop[];
  shops: Shop[];
  cartTotal: number;
  placingOrder: boolean;
  error: string;
  onClose: () => void;
  onPlaceOrder: (deliveryLocation: string, lat: number | null, lng: number | null, paymentMethod: string, deliveryFee: number, ecocashFeeAmount: number) => void;
  customerId?: string;
};

const ALL_PAYMENT_METHODS = ['pay_on_delivery', 'ecocash', 'paynow', 'card', 'bank_transfer'];

export function CheckoutModal({
  visible, palette, cartByShop, shops, cartTotal, placingOrder, error, onClose, onPlaceOrder, customerId,
}: Props) {
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pay_on_delivery');
  const [deliveryFee, setDeliveryFee] = useState('2.00');
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false);

  useEffect(() => {
    if (visible) setWhatsappConfirmed(false);
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
      return shop ? new Set(getAcceptedMethods(shop)) : new Set(['pay_on_delivery', 'paynow']);
    });
    return ALL_PAYMENT_METHODS.filter(m => sets.every(s => s.has(m)));
  })();

  useEffect(() => {
    if (acceptedIntersection.length > 0 && !acceptedIntersection.includes(paymentMethod)) {
      setPaymentMethod(acceptedIntersection[0]);
    }
  }, [acceptedIntersection, paymentMethod]);

  const isEcocash = paymentMethod === 'ecocash';

  const shopsWithEcocash = cartByShop.filter(sc => {
    const shop = shops.find(s => s.id === sc.shopId);
    return shop ? getAcceptedMethods(shop).includes('ecocash') : false;
  });
  const totalEcocashFee = isEcocash
    ? shopsWithEcocash.reduce((sum, sc) => {
        const shop = shops.find(s => s.id === sc.shopId);
        return sum + (shop?.ecocash_fee || 0);
      }, 0)
    : 0;

  const shopDeliveryFee = cartByShop.length > 0
    ? (() => {
        const shop = shops.find(s => s.id === cartByShop[0].shopId);
        return shop?.delivery_fee != null ? String(shop.delivery_fee) : null;
      })()
    : null;

  const shopsWithWhatsapp = cartByShop.filter(sc => {
    const shop = shops.find(s => s.id === sc.shopId);
    return !!shop?.whatsapp_number;
  });
  const requiresWhatsapp = shopsWithWhatsapp.length > 0;
  const whatsappShopNames = shopsWithWhatsapp.map(sc => {
    const shop = shops.find(s => s.id === sc.shopId);
    return shop?.name || '';
  }).filter(Boolean);
  const firstWhatsappShop = shopsWithWhatsapp[0] ? shops.find(s => s.id === shopsWithWhatsapp[0].shopId) : null;
  const whatsappNumber = firstWhatsappShop?.whatsapp_number || '';

  const effectiveDeliveryFee = shopDeliveryFee != null ? shopDeliveryFee : deliveryFee;

  const handlePlace = () => {
    if (!deliveryLocation.trim()) return;
    if (anyBlocked) return;
    if (requiresWhatsapp && !whatsappConfirmed) return;
    onPlaceOrder(deliveryLocation.trim(), null, null, paymentMethod, parseFloat(effectiveDeliveryFee) || 0, totalEcocashFee);
  };

  const canPlace = !!deliveryLocation.trim() && !placingOrder && !anyBlocked && (!requiresWhatsapp || whatsappConfirmed);

  const openShopWhatsApp = () => {
    const num = (whatsappNumber || '').replace(/[^0-9]/g, '');
    if (!num) return;
    const msg = encodeURIComponent(
      `Hi ${whatsappShopNames.join(', ')}, I'd like to place an order through UniLink marketplace.`
    );
    Linking.openURL(`https://wa.me/${num}?text=${msg}`).then(() => setWhatsappConfirmed(true)).catch(() => {});
  };
  const isPaynow = paymentMethod === 'paynow';
  const numericDeliveryFee = parseFloat(effectiveDeliveryFee) || 0;
  const grandTotal = cartTotal + numericDeliveryFee + totalEcocashFee;

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

          <View style={[styles.infoBox, { backgroundColor: `${palette.primary}10`, borderColor: `${palette.primary}30` }]}>
            <Truck size={16} color={palette.primary} />
            <Text style={[styles.infoText, { color: palette.textSecondary }]}>
              The shop will assign a messenger to deliver your order. No need to select one yourself.
            </Text>
          </View>

          {requiresWhatsapp && !anyBlocked ? (
            <View style={{ marginTop: 12, gap: 6 }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  paddingVertical: 14, borderRadius: 12,
                  backgroundColor: whatsappConfirmed ? `${palette.success}15` : '#25D366',
                  borderWidth: whatsappConfirmed ? 1.5 : 0,
                  borderColor: '#25D366',
                }}
                onPress={openShopWhatsApp}
                activeOpacity={0.8}
              >
                <MessageCircle size={16} color={whatsappConfirmed ? '#25D366' : '#fff'} />
                <Text style={{
                  fontSize: 13, fontWeight: '800',
                  color: whatsappConfirmed ? '#25D366' : '#fff',
                }}>
                  {whatsappConfirmed ? 'WhatsApp Sent' : 'Send WhatsApp to Shop (Required)'}
                </Text>
              </TouchableOpacity>
              {!whatsappConfirmed && (
                <Text style={{
                  fontSize: 11, color: palette.warning,
                  textAlign: 'center', lineHeight: 16,
                }}>
                  {whatsappShopNames.join(', ')} requires you to send a WhatsApp message confirming your order before placing it.
                </Text>
              )}
            </View>
          ) : null}

          <Text style={[styles.label, { color: palette.textSecondary, marginTop: 16 }]}>DELIVERY FEE</Text>
          {shopDeliveryFee != null ? (
            <View style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, flexDirection: 'row', alignItems: 'center' }]}>
              <Text style={{ color: palette.textPrimary, fontSize: 15, flex: 1 }}>${parseFloat(shopDeliveryFee).toFixed(2)}</Text>
              <Text style={{ color: palette.textSecondary, fontSize: 11 }}>Set by shop</Text>
            </View>
          ) : (
            <TextInput
              style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.textPrimary }]}
              value={deliveryFee}
              onChangeText={setDeliveryFee}
              placeholder="2.00"
              placeholderTextColor={palette.placeholderColor}
              keyboardType="decimal-pad"
              editable={!anyBlocked}
            />
          )}

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
            {isEcocash && totalEcocashFee > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={{ color: palette.textSecondary, fontSize: 13 }}>EcoCash fee</Text>
                <Text style={{ color: palette.warning, fontSize: 13 }}>${totalEcocashFee.toFixed(2)}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={{ color: palette.textSecondary, fontSize: 13 }}>Delivery fee</Text>
              <Text style={{ color: palette.textPrimary, fontSize: 13 }}>${numericDeliveryFee.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ color: palette.textPrimary, fontSize: 15, fontWeight: '700' }}>Grand Total</Text>
              <Text style={{ color: palette.primary, fontSize: 17, fontWeight: '800' }}>${grandTotal.toFixed(2)}</Text>
            </View>
          </View>

          <Text style={{ color: palette.textSecondary, fontSize: 11, marginTop: 8 }}>Note: {cartByShop.length} separate order(s) will be created, one per shop.</Text>

          {isEcocash && canPlace ? (
            <View style={[styles.paynowInfoBox, { backgroundColor: `${palette.warning}15`, borderColor: `${palette.warning}40` }]}>
              <Text style={[styles.paynowInfoText, { color: palette.warning }]}>
                An EcoCash surcharge of ${totalEcocashFee.toFixed(2)} has been added to your total by the shop(s). You will complete payment via EcoCash on delivery.
              </Text>
            </View>
          ) : null}

          {isPaynow && canPlace ? (
            <View style={[styles.paynowInfoBox, { backgroundColor: `${palette.primary}10`, borderColor: `${palette.primary}40` }]}>
              <Zap size={14} color={palette.primary} />
              <Text style={[styles.paynowInfoText, { color: palette.primary }]}>
                You'll be redirected to Paynow to complete payment of ${grandTotal.toFixed(2)} after placing your order. Paynow supports EcoCash, OneMoney, Visa/Mastercard, and bank transfers.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: '#ef4444', marginTop: 12 }]}>
              <AlertCircle size={14} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 12, flex: 1 }}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <TouchableOpacity
          style={[styles.placeOrderBtn, { backgroundColor: canPlace ? (isPaynow ? '#1a73e8' : palette.primary) : (isDarkBorder(palette.inputBorder) ? '#2a3a5c' : '#cbd5e1'), opacity: placingOrder ? 0.6 : 1 }]}
          onPress={handlePlace}
          disabled={!canPlace}
          activeOpacity={0.85}
        >
          {placingOrder ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isPaynow && <ExternalLink size={16} color="#fff" />}
              <Text style={styles.placeOrderBtnText}>
                {anyUnavailable ? 'Shop Unavailable' : anyClosed ? 'Shop Closed — No Orders' : requiresWhatsapp && !whatsappConfirmed ? 'Send WhatsApp First' : isPaynow ? `Pay ${grandTotal.toFixed(2)} via Paynow` : 'Place Order(s)'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function isDarkBorder(borderColor: string): boolean {
  return borderColor !== '#cbd5e1';
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
  paymentMethod: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5 },
  summary: { marginTop: 20, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  placeOrderBtn: { borderRadius: 14, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  placeOrderBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  paynowInfoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 12 },
  paynowInfoText: { fontSize: 11, fontWeight: '600', flex: 1, lineHeight: 16 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  infoText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
});
