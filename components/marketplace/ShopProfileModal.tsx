import { Modal, View, Text, ScrollView, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { X, MapPin, Store, CreditCard, Plus, Minus, BadgeCheck, Clock, PackageCheck, CircleAlert as AlertCircle, Star, Tag } from 'lucide-react-native';
import { Linking } from 'react-native';
import { Shop, Product, ThemePalette, computeShopOpen, formatOperatingHours, formatPaymentMethod, getAcceptedMethods } from './types';

type Props = {
  shop: Shop | null;
  visible: boolean;
  onClose: () => void;
  products: Product[];
  cartQty: (id: string) => number;
  onAdd: (p: Product) => void;
  onRemove: (id: string) => void;
  palette: ThemePalette;
};

export function ShopProfileModal({ shop, visible, onClose, products, cartQty, onAdd, onRemove, palette }: Props) {
  if (!shop) return null;
  const open = computeShopOpen(shop);
  const hoursRows = formatOperatingHours(shop.operating_hours);
  const acceptedMethods = getAcceptedMethods(shop);
  const hasCoords = shop.latitude != null && shop.longitude != null;
  const shopProducts = products.filter(p => p.shop_id === shop.id);
  const unavailable = !shop.is_available;

  const openMaps = () => {
    if (!hasCoords) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: palette.cardBg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.textPrimary }]} numberOfLines={1}>{shop.name}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }}>
            {shop.logo_url && Platform.OS === 'web' ? (
              <img src={shop.logo_url} style={{ width: '100%', height: 160, borderRadius: 12, objectFit: 'cover' as any, marginBottom: 16 }} alt={shop.name} />
            ) : null}

            <View style={styles.statusRow}>
              <View style={[styles.statusPill, { backgroundColor: open ? `${palette.success}22` : `${palette.error}22` }]}>
                <View style={[styles.dot, { backgroundColor: open ? palette.success : palette.error }]} />
                <Text style={[styles.statusText, { color: open ? palette.success : palette.error }]}>{open ? 'Open now' : 'Closed'}</Text>
              </View>
              {shop.location_verified ? (
                <View style={[styles.verifiedPill, { backgroundColor: `${palette.primary}18` }]}>
                  <BadgeCheck size={13} color={palette.primary} />
                  <Text style={[styles.statusText, { color: palette.primary }]}>Verified Shop</Text>
                </View>
              ) : null}
              {shop.category ? (
                <View style={[styles.verifiedPill, { backgroundColor: `${palette.accent}18` }]}>
                  <Tag size={13} color={palette.accent} />
                  <Text style={[styles.statusText, { color: palette.accent }]}>{shop.category}</Text>
                </View>
              ) : null}
            </View>

            {unavailable ? (
              <View style={[styles.unavailBox, { backgroundColor: `${palette.error}15`, borderColor: `${palette.error}55` }]}>
                <AlertCircle size={14} color={palette.error} />
                <Text style={[styles.unavailBoxText, { color: palette.error }]}>This shop is currently unavailable for ordering.</Text>
              </View>
            ) : null}

            {shop.description ? (
              <Text style={[styles.description, { color: palette.textPrimary }]}>{shop.description}</Text>
            ) : null}

            {shop.address ? (
              <View style={styles.infoBlock}>
                <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>ADDRESS</Text>
                <Text style={[styles.addressText, { color: palette.textPrimary }]}>{shop.address}</Text>
                {shop.location ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <MapPin size={12} color={palette.primary} />
                    <Text style={{ color: palette.primary, fontSize: 13, fontWeight: '600' }}>{shop.location}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.mapBtn, { backgroundColor: hasCoords ? palette.success : palette.inputBg, borderColor: hasCoords ? palette.success : palette.cardBorder }]}
              onPress={openMaps}
              disabled={!hasCoords}
              activeOpacity={0.85}
            >
              <MapPin size={16} color={hasCoords ? '#fff' : palette.placeholderColor} />
              <Text style={[styles.mapBtnText, { color: hasCoords ? '#fff' : palette.placeholderColor }]}>
                {hasCoords ? 'View Shop Location' : 'Location not available'}
              </Text>
            </TouchableOpacity>

            {hoursRows.length > 0 ? (
              <View style={styles.infoBlock}>
                <View style={styles.infoHeaderRow}>
                  <Clock size={14} color={palette.primary} />
                  <Text style={[styles.infoLabel, { color: palette.textSecondary, marginBottom: 0 }]}>OPERATING HOURS</Text>
                </View>
                {hoursRows.map(r => (
                  <View key={r.day} style={styles.hoursRow}>
                    <Text style={[styles.hoursDay, { color: palette.textPrimary }]}>{r.day}</Text>
                    <Text style={[styles.hoursLabel, { color: palette.textSecondary }]}>{r.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.infoBlock}>
              <View style={styles.infoHeaderRow}>
                <CreditCard size={14} color={palette.primary} />
                <Text style={[styles.infoLabel, { color: palette.textSecondary, marginBottom: 0 }]}>PAYMENT METHODS</Text>
              </View>
              <View style={styles.payRow}>
                {acceptedMethods.map(m => (
                  <View key={m} style={[styles.payBadge, { backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}40` }]}>
                    <Text style={[styles.payBadgeText, { color: palette.primary }]}>{formatPaymentMethod(m)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {shop.completed_orders_count != null && shop.completed_orders_count > 0 ? (
              <View style={[styles.ordersPill, { backgroundColor: `${palette.accent}15` }]}>
                <PackageCheck size={14} color={palette.accent} />
                <Text style={[styles.ordersPillText, { color: palette.accent }]}>{shop.completed_orders_count} completed orders</Text>
              </View>
            ) : null}

            {shop.average_rating != null && Number(shop.average_rating) > 0 ? (
              <View style={[styles.ordersPill, { backgroundColor: '#FFD70015' }]}>
                <Star size={14} color="#FFD700" fill="#FFD700" />
                <Text style={[styles.ordersPillText, { color: '#FFD700' }]}>
                  {Number(shop.average_rating).toFixed(1)} ({shop.total_ratings || 0} reviews)
                </Text>
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: palette.textSecondary, marginTop: 16 }]}>PRODUCTS</Text>
            {shopProducts.length === 0 ? (
              <Text style={{ color: palette.textSecondary, fontSize: 13, paddingVertical: 16 }}>No products available</Text>
            ) : (
              shopProducts.map(p => {
                const qty = cartQty(p.id);
                const pOutOfStock = p.stock <= 0;
                const pDisabled = pOutOfStock || unavailable;
                return (
                  <View key={p.id} style={[styles.productRow, { borderBottomColor: palette.cardBorder }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.textPrimary, fontSize: 14 }}>{p.name}</Text>
                      <Text style={{ color: palette.primary, fontSize: 14, fontWeight: '700' }}>${Number(p.price).toFixed(2)}</Text>
                      {pOutOfStock ? <Text style={{ color: palette.error, fontSize: 11, marginTop: 2 }}>Out of stock</Text> : null}
                    </View>
                    {pDisabled ? (
                      <Text style={{ color: palette.textSecondary, fontSize: 11 }}>{pOutOfStock ? 'Unavailable' : 'Shop closed'}</Text>
                    ) : qty > 0 ? (
                      <View style={styles.qtyControl}>
                        <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: palette.accent }]} onPress={() => onRemove(p.id)}>
                          <Minus size={14} color="#fff" />
                        </TouchableOpacity>
                        <Text style={[styles.qtyText, { color: palette.textPrimary }]}>{qty}</Text>
                        <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: palette.accent }]} onPress={() => onAdd(p)} disabled={qty >= p.stock}>
                          <Plus size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={[styles.addBtn, { backgroundColor: palette.primary }]} onPress={() => onAdd(p)}>
                        <Plus size={14} color="#fff" />
                        <Text style={styles.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  content: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  unavailBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  unavailBoxText: { fontSize: 12, fontWeight: '600', flex: 1 },
  description: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  infoBlock: { marginBottom: 14 },
  infoHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  infoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  addressText: { fontSize: 14, lineHeight: 20 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 14 },
  mapBtnText: { fontSize: 14, fontWeight: '700' },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.15)' },
  hoursDay: { fontSize: 13, fontWeight: '500' },
  hoursLabel: { fontSize: 13 },
  payRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  payBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  payBadgeText: { fontSize: 12, fontWeight: '600' },
  ordersPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start' },
  ordersPillText: { fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 26, height: 26, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 13, fontWeight: '700', minWidth: 16, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
