import { TouchableOpacity, View, Text, Platform, StyleSheet } from 'react-native';
import { Plus, Minus, Package, CircleAlert as AlertCircle, Lock } from 'lucide-react-native';
import { Product, Shop, ThemePalette, computeShopOpen } from './types';

type Props = {
  product: Product;
  shop?: Shop;
  qty: number;
  onAdd: (p: Product) => void;
  onRemove: (id: string) => void;
  palette: ThemePalette;
};

export function ProductCard({ product, shop, qty, onAdd, onRemove, palette }: Props) {
  const outOfStock = product.stock <= 0;
  const shopUnavailable = shop ? !shop.is_available : false;
  const shopClosed = shop && shop.is_available && shop.operating_hours ? !computeShopOpen(shop) : false;
  const disabled = outOfStock || shopUnavailable || shopClosed;

  return (
    <View style={[styles.productCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
      <View style={styles.imageWrap}>
        {product.image_url && Platform.OS === 'web' ? (
          <img src={product.image_url} style={{ width: '100%', height: 90, borderRadius: 8, objectFit: 'cover' as any }} alt={product.name} />
        ) : (
          <View style={[styles.productImagePlaceholder, { backgroundColor: palette.inputBg }]}>
            <Package size={24} color={palette.placeholderColor} />
          </View>
        )}
        {outOfStock ? (
          <View style={styles.oosOverlay}>
            <Text style={styles.oosText}>OUT OF STOCK</Text>
          </View>
        ) : null}
      </View>

      {shopUnavailable ? (
        <View style={[styles.unavailBanner, { backgroundColor: `${palette.error}18`, borderColor: `${palette.error}55` }]}>
          <AlertCircle size={11} color={palette.error} />
          <Text style={[styles.unavailText, { color: palette.error }]}>Currently unavailable</Text>
        </View>
      ) : null}

      {shopClosed ? (
        <View style={[styles.unavailBanner, { backgroundColor: `${palette.warning}18`, borderColor: `${palette.warning}55` }]}>
          <Lock size={11} color={palette.warning} />
          <Text style={[styles.unavailText, { color: palette.warning }]}>Shop closed</Text>
        </View>
      ) : null}

      <Text style={[styles.productName, { color: palette.textPrimary }]} numberOfLines={2}>{product.name}</Text>
      {shop ? <Text style={[styles.productShop, { color: palette.textSecondary }]} numberOfLines={1}>{shop.name}</Text> : null}

      <View style={styles.productBottom}>
        <Text style={[styles.productPrice, { color: palette.primary }]}>${Number(product.price).toFixed(2)}</Text>
        {disabled ? (
          <Text style={{ color: palette.error, fontSize: 11, fontWeight: '600' }}>{outOfStock ? 'Out of stock' : shopClosed ? 'Closed' : 'Unavailable'}</Text>
        ) : qty > 0 ? (
          <View style={styles.qtyControl}>
            <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: palette.accent }]} onPress={() => onRemove(product.id)}>
              <Minus size={14} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.qtyText, { color: palette.textPrimary }]}>{qty}</Text>
            <TouchableOpacity
              style={[styles.qtyBtn, { backgroundColor: palette.accent }]}
              onPress={() => onAdd(product)}
              disabled={qty >= product.stock}
            >
              <Plus size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: palette.primary }]} onPress={() => onAdd(product)}>
            <Plus size={14} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  productCard: { width: 160, borderRadius: 12, borderWidth: 1, padding: 10, gap: 6 },
  imageWrap: { position: 'relative' as any, width: '100%', height: 90 },
  productImagePlaceholder: { width: '100%', height: 90, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  oosOverlay: { position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  oosText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  unavailBanner: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  unavailText: { fontSize: 10, fontWeight: '700' },
  productName: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  productShop: { fontSize: 10 },
  productBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  productPrice: { fontSize: 14, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 13, fontWeight: '700', minWidth: 16, textAlign: 'center' },
});
