import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import {
  X, Truck, CreditCard, CircleAlert as AlertCircle, Lock, ExternalLink, Zap,
  MessageCircle, Store, MapPin, Phone, Navigation, Package, CircleCheck as CheckCircle,
  CircleAlert as AlertTriangle, FileText, ChevronRight, ChevronDown, ChevronUp, Crosshair, Home,
} from 'lucide-react-native';
import { CartByShop, Shop, ThemePalette, formatPaymentMethod, getAcceptedMethods, computeShopOpen, formatOperatingHours, DeliveryFeeTier, computeTierDeliveryFee } from './types';
import * as Location from 'expo-location';

type Props = {
  visible: boolean;
  palette: ThemePalette;
  cartByShop: CartByShop[];
  shops: Shop[];
  cartTotal: number;
  placingOrder: boolean;
  error: string;
  onClose: () => void;
  onPlaceOrder: (deliveryLocation: string, lat: number | null, lng: number | null, paymentMethod: string, deliveryFee: number, ecocashFeeAmount: number, ecocashPop: string | null) => void;
  customerId?: string;
  customerAddress?: { formatted_address: string | null; latitude: number | null; longitude: number | null } | null;
  deliveryFeeTiers?: Record<string, DeliveryFeeTier[]>;
};

const ALL_PAYMENT_METHODS = ['pay_on_delivery', 'ecocash', 'paynow', 'card', 'bank_transfer'];

export function CheckoutModal({
  visible, palette, cartByShop, shops, cartTotal, placingOrder, error, onClose, onPlaceOrder, customerId, customerAddress, deliveryFeeTiers = {},
}: Props) {
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [confirmedLatitude, setConfirmedLatitude] = useState<number | null>(null);
  const [confirmedLongitude, setConfirmedLongitude] = useState<number | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [confirmingLocation, setConfirmingLocation] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('pay_on_delivery');
  const [deliveryFee, setDeliveryFee] = useState('2.00');
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false);
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [ecocashPop, setEcocashPop] = useState('');
  const [locationMode, setLocationMode] = useState<'registered' | 'current' | 'manual'>('manual');
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    if (visible) {
      setWhatsappConfirmed(false);
      setLocationConfirmed(false);
      setConfirmedLatitude(null);
      setConfirmedLongitude(null);
      setShowOrderSummary(false);
      setExpandedShopId(null);
      setEcocashPop('');
      setLocationMode(customerAddress?.formatted_address ? 'registered' : 'manual');
      if (customerAddress?.formatted_address) {
        setDeliveryLocation(customerAddress.formatted_address);
        setConfirmedLatitude(customerAddress.latitude);
        setConfirmedLongitude(customerAddress.longitude);
        setLocationConfirmed(true);
      } else {
        setDeliveryLocation('');
        setConfirmedLatitude(null);
        setConfirmedLongitude(null);
        setLocationConfirmed(false);
      }
    }
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

  // Compute tier-based delivery fee: sum per-shop fees based on each shop's cart total
  const tierBasedDeliveryFee = cartByShop.reduce((sum, sc) => {
    const shop = shops.find(s => s.id === sc.shopId);
    const fallback = shop?.delivery_fee != null ? Number(shop.delivery_fee) : parseFloat(deliveryFee) || 0;
    return sum + computeTierDeliveryFee(sc.total, deliveryFeeTiers[sc.shopId] || [], fallback);
  }, 0);

  const shopHasOwnFee = cartByShop.some(sc => {
    const shop = shops.find(s => s.id === sc.shopId);
    return shop?.delivery_fee != null || (deliveryFeeTiers[sc.shopId] && deliveryFeeTiers[sc.shopId].length > 0);
  });

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

  const effectiveDeliveryFee = shopHasOwnFee ? String(tierBasedDeliveryFee.toFixed(2)) : deliveryFee;

  const detectMyLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDetectingLocation(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setConfirmedLatitude(pos.coords.latitude);
      setConfirmedLongitude(pos.coords.longitude);
      setDeliveryLocation(`Current location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
      setLocationConfirmed(true);
      setLocationMode('current');
    } catch {
    } finally {
      setDetectingLocation(false);
    }
  };

  const useRegisteredLocation = () => {
    if (!customerAddress?.formatted_address) return;
    setDeliveryLocation(customerAddress.formatted_address);
    setConfirmedLatitude(customerAddress.latitude);
    setConfirmedLongitude(customerAddress.longitude);
    setLocationConfirmed(true);
    setLocationMode('registered');
  };

  const switchToManual = () => {
    setLocationMode('manual');
    setDeliveryLocation('');
    setConfirmedLatitude(null);
    setConfirmedLongitude(null);
    setLocationConfirmed(false);
  };

  const confirmLocation = async () => {
    if (!deliveryLocation.trim()) return;
    setConfirmingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setConfirmedLatitude(pos.coords.latitude);
        setConfirmedLongitude(pos.coords.longitude);
      }
      setLocationConfirmed(true);
    } catch {
      setLocationConfirmed(true);
    } finally {
      setConfirmingLocation(false);
    }
  };

  const handlePlace = () => {
    if (!deliveryLocation.trim()) return;
    if (!locationConfirmed) return;
    if (anyBlocked) return;
    if (requiresWhatsapp && !whatsappConfirmed) return;
    onPlaceOrder(deliveryLocation.trim(), confirmedLatitude, confirmedLongitude, paymentMethod, parseFloat(effectiveDeliveryFee) || 0, totalEcocashFee, isEcocash ? ecocashPop.trim() || null : null);
  };

  const canPlace = !!deliveryLocation.trim() && locationConfirmed && !placingOrder && !anyBlocked && (!requiresWhatsapp || whatsappConfirmed);
  const isPaynow = paymentMethod === 'paynow';
  const numericDeliveryFee = parseFloat(effectiveDeliveryFee) || 0;
  const grandTotal = cartTotal + numericDeliveryFee + totalEcocashFee;

  const openShopWhatsApp = () => {
    const num = (whatsappNumber || '').replace(/[^0-9]/g, '');
    if (!num) return;
    const msg = encodeURIComponent(
      `Hi ${whatsappShopNames.join(', ')}, I'd like to place an order through UniLink marketplace.`
    );
    Linking.openURL(`https://wa.me/${num}?text=${msg}`).then(() => setWhatsappConfirmed(true)).catch(() => {});
  };

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

          {/* === SHOP DATA SHEETS — essential details of each shop === */}
          <Text style={[styles.label, { color: palette.textSecondary, marginTop: 4 }]}>SHOP DETAILS</Text>
          {cartByShop.map(sc => {
            const shop = shops.find(s => s.id === sc.shopId);
            if (!shop) return null;
            const expanded = expandedShopId === sc.shopId;
            const open = shop.operating_hours ? computeShopOpen(shop) : true;
            return (
              <View key={sc.shopId} style={[styles.shopSheet, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
                <TouchableOpacity
                  style={styles.shopSheetHeader}
                  onPress={() => setExpandedShopId(expanded ? null : sc.shopId)}
                >
                  <View style={[styles.shopSheetLogo, { backgroundColor: palette.cardBg }]}>
                    {shop.logo_url && Platform.OS === 'web' ? (
                      <img src={shop.logo_url} style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover' as any }} alt={shop.name} />
                    ) : (
                      <Store size={18} color={palette.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shopSheetName, { color: palette.textPrimary }]} numberOfLines={1}>{shop.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <View style={[styles.shopSheetBadge, { backgroundColor: open ? `${palette.success}22` : `${palette.error}22` }]}>
                        <View style={[styles.shopSheetDot, { backgroundColor: open ? palette.success : palette.error }]} />
                        <Text style={[styles.shopSheetBadgeText, { color: open ? palette.success : palette.error }]}>{open ? 'Open' : 'Closed'}</Text>
                      </View>
                      {shop.location ? (
                        <View style={[styles.shopSheetBadge, { backgroundColor: `${palette.primary}15` }]}>
                          <MapPin size={9} color={palette.primary} />
                          <Text style={[styles.shopSheetBadgeText, { color: palette.primary }]}>{shop.location}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {expanded ? <ChevronUp size={16} color={palette.textSecondary} /> : <ChevronDown size={16} color={palette.textSecondary} />}
                </TouchableOpacity>

                {expanded && (
                  <View style={{ paddingTop: 10, gap: 6 }}>
                    {shop.description ? (
                      <View style={styles.shopDetailRow}>
                        <FileText size={12} color={palette.textSecondary} />
                        <Text style={[styles.shopDetailText, { color: palette.textSecondary }]}>{shop.description}</Text>
                      </View>
                    ) : null}
                    {shop.address ? (
                      <View style={styles.shopDetailRow}>
                        <MapPin size={12} color={palette.textSecondary} />
                        <Text style={[styles.shopDetailText, { color: palette.textSecondary }]}>{shop.address}</Text>
                      </View>
                    ) : null}
                    {shop.latitude != null && shop.longitude != null ? (
                      <TouchableOpacity
                        style={styles.shopDetailRow}
                        onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`)}
                      >
                        <Navigation size={12} color={palette.primary} />
                        <Text style={[styles.shopDetailText, { color: palette.primary }]}>View Shop on Map</Text>
                      </TouchableOpacity>
                    ) : null}
                    {shop.operating_hours ? (
                      <View style={{ marginTop: 4 }}>
                        {formatOperatingHours(shop.operating_hours).map(row => (
                          <View key={row.day} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, color: palette.textSecondary }}>{row.day}</Text>
                            <Text style={{ fontSize: 11, color: palette.textSecondary }}>{row.label}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <View style={styles.shopItemsPreview}>
                      {sc.items.map(item => (
                        <View key={item.product.id} style={styles.shopItemPreviewRow}>
                          <Text style={[styles.shopItemPreviewName, { color: palette.textPrimary }]} numberOfLines={1}>
                            {item.product.name} ×{item.quantity}
                          </Text>
                          <Text style={[styles.shopItemPreviewPrice, { color: palette.textSecondary }]}>
                            ${(Number(item.product.price) * item.quantity).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                      <View style={[styles.shopItemPreviewTotal, { borderTopColor: palette.cardBorder }]}>
                        <Text style={{ fontSize: 12, color: palette.textSecondary }}>Shop subtotal</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.primary }}>${sc.total.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {/* === ORDER SUMMARY DATA SHEET === */}
          <TouchableOpacity
            style={[styles.summaryToggle, { backgroundColor: `${palette.primary}10`, borderColor: `${palette.primary}30` }]}
            onPress={() => setShowOrderSummary(!showOrderSummary)}
          >
            <FileText size={15} color={palette.primary} />
            <Text style={[styles.summaryToggleText, { color: palette.primary }]}>Order Summary</Text>
            {showOrderSummary ? <ChevronUp size={16} color={palette.primary} /> : <ChevronDown size={16} color={palette.primary} />}
          </TouchableOpacity>

          {showOrderSummary && (
            <View style={[styles.summarySheet, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
              {cartByShop.map(sc => (
                <View key={sc.shopId} style={{ marginBottom: 10 }}>
                  <Text style={[styles.summaryShopName, { color: palette.textPrimary }]}>{sc.shopName}</Text>
                  {sc.items.map(item => (
                    <View key={item.product.id} style={styles.summaryItemRow}>
                      <Text style={[styles.summaryItemName, { color: palette.textSecondary }]}>
                        {item.product.name} ×{item.quantity}
                      </Text>
                      <Text style={[styles.summaryItemPrice, { color: palette.textSecondary }]}>
                        ${(Number(item.product.price) * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
              <View style={[styles.summaryDivider, { borderTopColor: palette.cardBorder }]}>
                <View style={styles.summaryRow}>
                  <Text style={{ color: palette.textSecondary, fontSize: 13 }}>Items total ({cartByShop.length} shop(s))</Text>
                  <Text style={{ color: palette.textPrimary, fontSize: 13 }}>${cartTotal.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* === LOCATION CONFIRMATION — customer chooses registered, current, or manual === */}
          <Text style={[styles.label, { color: palette.textSecondary, marginTop: 16 }]}>DELIVERY LOCATION *</Text>

          {/* Location mode selector */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {customerAddress?.formatted_address ? (
              <TouchableOpacity
                style={[styles.locModeBtn, { backgroundColor: locationMode === 'registered' ? palette.primary : palette.inputBg, borderColor: locationMode === 'registered' ? palette.primary : palette.inputBorder }]}
                onPress={useRegisteredLocation}
                disabled={anyBlocked}
              >
                <Home size={13} color={locationMode === 'registered' ? '#fff' : palette.textSecondary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: locationMode === 'registered' ? '#fff' : palette.textSecondary }}>Registered</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.locModeBtn, { backgroundColor: locationMode === 'current' ? palette.primary : palette.inputBg, borderColor: locationMode === 'current' ? palette.primary : palette.inputBorder }]}
              onPress={detectMyLocation}
              disabled={anyBlocked || detectingLocation}
            >
              {detectingLocation ? <ActivityIndicator size="small" color={locationMode === 'current' ? '#fff' : palette.primary} /> : <Crosshair size={13} color={locationMode === 'current' ? '#fff' : palette.textSecondary} />}
              <Text style={{ fontSize: 11, fontWeight: '700', color: locationMode === 'current' ? '#fff' : palette.textSecondary }}>My Location</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.locModeBtn, { backgroundColor: locationMode === 'manual' ? palette.primary : palette.inputBg, borderColor: locationMode === 'manual' ? palette.primary : palette.inputBorder }]}
              onPress={switchToManual}
              disabled={anyBlocked}
            >
              <MapPin size={13} color={locationMode === 'manual' ? '#fff' : palette.textSecondary} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: locationMode === 'manual' ? '#fff' : palette.textSecondary }}>Enter Manually</Text>
            </TouchableOpacity>
          </View>

          {/* Manual text input — always visible so user can edit/override */}
          <TextInput
            style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.textPrimary }]}
            value={deliveryLocation}
            onChangeText={(v) => {
              setDeliveryLocation(v);
              if (locationMode !== 'manual') {
                setLocationMode('manual');
                setLocationConfirmed(false);
                setConfirmedLatitude(null);
                setConfirmedLongitude(null);
              } else {
                setLocationConfirmed(false);
                setConfirmedLatitude(null);
                setConfirmedLongitude(null);
              }
            }}
            placeholder="Enter delivery address or use buttons above"
            placeholderTextColor={palette.placeholderColor}
            multiline
            editable={!anyBlocked}
          />

          {!locationConfirmed && deliveryLocation.trim() && locationMode === 'manual' ? (
            <TouchableOpacity
              style={[styles.confirmLocBtn, { backgroundColor: palette.success, opacity: confirmingLocation ? 0.6 : 1 }]}
              onPress={confirmLocation}
              disabled={confirmingLocation || !deliveryLocation.trim() || anyBlocked}
            >
              {confirmingLocation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Navigation size={16} color="#fff" />
                  <Text style={styles.confirmLocBtnText}>Confirm Location</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {locationConfirmed ? (
            <View style={[styles.locConfirmedBox, { backgroundColor: `${palette.success}10`, borderColor: `${palette.success}30` }]}>
              <CheckCircle size={16} color={palette.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.locConfirmedTitle, { color: palette.success }]}>Location Confirmed</Text>
                <Text style={[styles.locConfirmedAddr, { color: palette.textSecondary }]} numberOfLines={2}>{deliveryLocation}</Text>
                {confirmedLatitude != null && confirmedLongitude != null ? (
                  <Text style={[styles.locConfirmedGps, { color: palette.textSecondary }]}>
                    GPS: {confirmedLatitude.toFixed(4)}, {confirmedLongitude.toFixed(4)}
                  </Text>
                ) : (
                  <Text style={[styles.locConfirmedGps, { color: palette.textSecondary }]}>GPS not captured (address only)</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => { setLocationConfirmed(false); setConfirmedLatitude(null); setConfirmedLongitude(null); setLocationMode('manual'); }}>
                <Text style={{ color: palette.warning, fontSize: 12, fontWeight: '600' }}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : null}

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
          {shopHasOwnFee ? (
            <View style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, flexDirection: 'row', alignItems: 'center' }]}>
              <Text style={{ color: palette.textPrimary, fontSize: 15, flex: 1 }}>${tierBasedDeliveryFee.toFixed(2)}</Text>
              <Text style={{ color: palette.textSecondary, fontSize: 11 }}>Based on order total</Text>
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
            <View style={{ marginTop: 12, gap: 10 }}>
              {shopsWithEcocash.map(sc => {
                const shop = shops.find(s => s.id === sc.shopId);
                if (!shop) return null;
                return (
                  <View key={sc.shopId} style={[styles.ecocashInfoBox, { backgroundColor: `${palette.warning}10`, borderColor: `${palette.warning}40` }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Phone size={13} color={palette.warning} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: palette.warning }}>{shop.name} — EcoCash Details</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: palette.textPrimary, fontWeight: '600' }}>
                      Name: {shop.ecocash_name || shop.contact_phone || 'Not set'}
                    </Text>
                    <Text style={{ fontSize: 13, color: palette.textPrimary, fontWeight: '600' }}>
                      Number: {shop.ecocash_number || shop.contact_phone || 'Not set'}
                    </Text>
                  </View>
                );
              })}
              <View style={[styles.paynowInfoBox, { backgroundColor: `${palette.warning}15`, borderColor: `${palette.warning}40` }]}>
                <Text style={[styles.paynowInfoText, { color: palette.warning }]}>  
                  Send money via EcoCash to the number(s) above, then enter the transaction reference or proof of payment below.
                </Text>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.textPrimary, minHeight: 60 }]}
                value={ecocashPop}
                onChangeText={setEcocashPop}
                placeholder="Enter EcoCash transaction reference / proof of payment"
                placeholderTextColor={palette.placeholderColor}
                multiline
              />
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
                {anyUnavailable ? 'Shop Unavailable' : anyClosed ? 'Shop Closed — No Orders' : requiresWhatsapp && !whatsappConfirmed ? 'Send WhatsApp First' : !locationConfirmed ? 'Confirm Location First' : isPaynow ? `Pay ${grandTotal.toFixed(2)} via Paynow` : 'Place Order(s)'}
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
  ecocashInfoBox: { padding: 12, borderRadius: 10, borderWidth: 1 },
  paynowInfoText: { fontSize: 11, fontWeight: '600', flex: 1, lineHeight: 16 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  infoText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  // Shop data sheet styles
  shopSheet: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  shopSheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shopSheetLogo: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  shopSheetName: { fontSize: 14, fontWeight: '700' },
  shopSheetBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  shopSheetBadgeText: { fontSize: 10, fontWeight: '700' },
  shopSheetDot: { width: 5, height: 5, borderRadius: 2.5 },
  shopDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  shopDetailText: { fontSize: 12, flex: 1 },
  shopItemsPreview: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.15)' },
  shopItemPreviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  shopItemPreviewName: { fontSize: 12, flex: 1 },
  shopItemPreviewPrice: { fontSize: 12, fontWeight: '600' },
  shopItemPreviewTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, marginTop: 4, borderTopWidth: 1 },
  // Order summary sheet styles
  summaryToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  summaryToggleText: { flex: 1, fontSize: 13, fontWeight: '700' },
  summarySheet: { borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 4 },
  summaryShopName: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  summaryItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  summaryItemName: { fontSize: 12, flex: 1 },
  summaryItemPrice: { fontSize: 12, fontWeight: '600' },
  summaryDivider: { borderTopWidth: 1, paddingTop: 8 },
  // Location confirmation styles
  confirmLocBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  confirmLocBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  locConfirmedBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  locConfirmedTitle: { fontSize: 13, fontWeight: '700' },
  locConfirmedAddr: { fontSize: 12, marginTop: 2 },
  locConfirmedGps: { fontSize: 10, marginTop: 2 },
  locModeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
});
