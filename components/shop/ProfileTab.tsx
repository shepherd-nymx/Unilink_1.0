import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { A } from '@/lib/admin-theme';
import { supabase } from '@/lib/supabase';
import {
  DAYS,
  type ShopData,
  type OperatingHours,
  type DaySchedule,
} from '@/lib/shop-types';
import { Store, LogOut, MapPin, Navigation, Globe, Clock, CreditCard, DollarSign, BadgeCheck, TriangleAlert as AlertTriangle, X, Check, MessageCircle } from 'lucide-react-native';
import * as Location from 'expo-location';

const PAYMENT_OPTIONS: { key: string; label: string }[] = [
  { key: 'pay_on_delivery', label: 'Pay on Delivery' },
  { key: 'ecocash', label: 'EcoCash' },
  { key: 'paynow', label: 'PayNow' },
  { key: 'bank_transfer', label: 'Bank Transfer' },
];

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

function emptyHours(): OperatingHours {
  const h: OperatingHours = {};
  DAYS.forEach((d) => (h[d] = { open: '08:00', close: '18:00', closed: d === 'sunday' }));
  return h;
}

export function ProfileTab({
  shop,
  onLogout,
  onShopUpdated,
}: {
  shop: ShopData;
  onLogout: () => void;
  onShopUpdated: (s: ShopData) => void;
}) {
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [addrInput, setAddrInput] = useState(shop.address || '');
  const [latInput, setLatInput] = useState(shop.latitude != null ? String(shop.latitude) : '');
  const [lngInput, setLngInput] = useState(shop.longitude != null ? String(shop.longitude) : '');
  const [locating, setLocating] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);

  const [savingAvail, setSavingAvail] = useState(false);
  const [hours, setHours] = useState<OperatingHours>(shop.operating_hours || emptyHours());
  const [savingHours, setSavingHours] = useState(false);
  const [payMethods, setPayMethods] = useState<string[]>(shop.accepted_payment_methods || ['pay_on_delivery', 'ecocash']);
  const [savingPay, setSavingPay] = useState(false);
  const [ecocashFee, setEcocashFee] = useState(shop.ecocash_fee != null ? String(shop.ecocash_fee) : '0');
  const [deliveryFee, setDeliveryFee] = useState(shop.delivery_fee != null ? String(shop.delivery_fee) : '0');
  const [savingFees, setSavingFees] = useState(false);
  const [whatsappInput, setWhatsappInput] = useState(shop.whatsapp_number || '');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [msg, setMsg] = useState('');

  const useGps = async () => {
    setLocating(true);
    setMsg('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMsg('Location permission denied');
        setLocating(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatInput(String(pos.coords.latitude.toFixed(6)));
      setLngInput(String(pos.coords.longitude.toFixed(6)));
    } catch (e: any) {
      setMsg(e.message || 'Could not get location');
    } finally {
      setLocating(false);
    }
  };

  const saveLocation = async () => {
    setSavingLoc(true);
    setMsg('');
    const lat = latInput.trim() ? parseFloat(latInput) : null;
    const lng = lngInput.trim() ? parseFloat(lngInput) : null;
    const { error } = await supabase
      .from('shops')
      .update({ address: addrInput.trim() || null, latitude: lat, longitude: lng })
      .eq('id', shop.id);
    setSavingLoc(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    onShopUpdated({ ...shop, address: addrInput.trim() || null, latitude: lat, longitude: lng });
    setShowLocationEditor(false);
  };

  const toggleAvailability = async () => {
    setSavingAvail(true);
    const next = !shop.is_available;
    const { error } = await supabase.from('shops').update({ is_available: next }).eq('id', shop.id);
    setSavingAvail(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    onShopUpdated({ ...shop, is_available: next });
  };

  const updateDay = (day: string, patch: Partial<DaySchedule>) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const saveHours = async () => {
    setSavingHours(true);
    setMsg('');
    const { error } = await supabase
      .from('shops')
      .update({ operating_hours: hours })
      .eq('id', shop.id);
    setSavingHours(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    onShopUpdated({ ...shop, operating_hours: hours });
    setMsg('Operating hours saved');
  };

  const togglePay = (key: string) => {
    setPayMethods((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  const savePay = async () => {
    setSavingPay(true);
    setMsg('');
    const { error } = await supabase
      .from('shops')
      .update({ accepted_payment_methods: payMethods })
      .eq('id', shop.id);
    setSavingPay(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    onShopUpdated({ ...shop, accepted_payment_methods: payMethods });
    setMsg('Payment methods saved');
  };

  const saveFees = async () => {
    setSavingFees(true);
    setMsg('');
    const ecFee = parseFloat(ecocashFee) || 0;
    const delFee = parseFloat(deliveryFee) || 0;
    const { error } = await supabase
      .from('shops')
      .update({ ecocash_fee: ecFee, delivery_fee: delFee })
      .eq('id', shop.id);
    setSavingFees(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    onShopUpdated({ ...shop, ecocash_fee: ecFee, delivery_fee: delFee });
    setMsg('Fees saved');
  };

  const saveWhatsapp = async () => {
    setSavingWhatsapp(true);
    setMsg('');
    const cleaned = whatsappInput.trim().replace(/[^0-9+]/g, '');
    const { error } = await supabase
      .from('shops')
      .update({ whatsapp_number: cleaned || null })
      .eq('id', shop.id);
    setSavingWhatsapp(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    onShopUpdated({ ...shop, whatsapp_number: cleaned || null });
    setMsg('WhatsApp number saved');
  };

  const openMaps = () => {
    if (shop.latitude == null || shop.longitude == null) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;
    Linking.openURL(url);
  };

  const locIncomplete = shop.latitude == null || shop.longitude == null;

  return (
    <View style={{ gap: 16 }}>
      {msg ? (
        <View style={[styles.msgBar, { backgroundColor: msg.includes('saved') ? A.greenDim : A.redDim }]}>
          <Text style={{ color: msg.includes('saved') ? A.green : A.red, fontSize: 12, flex: 1 }}>{msg}</Text>
          <TouchableOpacity onPress={() => setMsg('')}>
            <X size={14} color={msg.includes('saved') ? A.green : A.red} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Shop Information */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Store size={16} color={A.cyan} />
          <Text style={styles.cardTitle}>Shop Information</Text>
          {shop.location_verified && (
            <View style={styles.verifiedBadge}>
              <BadgeCheck size={12} color={A.green} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{shop.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{shop.contact_email}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{shop.contact_phone}</Text>
        </View>
        {shop.description ? (
          <View style={styles.row}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.value}>{shop.description}</Text>
          </View>
        ) : null}
      </View>

      {/* Business Location */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MapPin size={16} color={A.orange} />
          <Text style={styles.cardTitle}>Business Location</Text>
        </View>
        {locIncomplete && (
          <View style={[styles.warnBox, { borderColor: A.amber }]}>
            <AlertTriangle size={14} color={A.amber} />
            <Text style={[styles.warnText, { color: A.amber }]}>Location setup incomplete — add your address and coordinates.</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{shop.address || 'Not set'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Latitude</Text>
          <Text style={styles.value}>{shop.latitude != null ? shop.latitude.toFixed(6) : 'Not set'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Longitude</Text>
          <Text style={styles.value}>{shop.longitude != null ? shop.longitude.toFixed(6) : 'Not set'}</Text>
        </View>
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, { borderColor: A.cyan }]} onPress={() => setShowLocationEditor(true)}>
            <Text style={[styles.btnText, { color: A.cyan }]}>Edit Location</Text>
          </TouchableOpacity>
          {!locIncomplete && (
            <TouchableOpacity style={[styles.btn, { borderColor: A.blue }]} onPress={openMaps}>
              <Globe size={14} color={A.blue} />
              <Text style={[styles.btnText, { color: A.blue }]}>View on Maps</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Availability */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Store size={16} color={shop.is_available ? A.green : A.red} />
          <Text style={styles.cardTitle}>Shop Availability</Text>
        </View>
        <TouchableOpacity
          style={[styles.availToggle, { backgroundColor: shop.is_available ? A.greenDim : A.redDim, borderColor: shop.is_available ? A.green : A.red }]}
          onPress={toggleAvailability}
          disabled={savingAvail}
          activeOpacity={0.8}
        >
          {savingAvail ? (
            <ActivityIndicator size="small" color={shop.is_available ? A.green : A.red} />
          ) : (
            <>
              <View style={[styles.availDot, { backgroundColor: shop.is_available ? A.green : A.red }]} />
              <Text style={[styles.availText, { color: shop.is_available ? A.green : A.red }]}>
                {shop.is_available ? 'AVAILABLE' : 'UNAVAILABLE'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.availHint}>Toggle whether your shop accepts new orders.</Text>
      </View>

      {/* Operating Hours */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Clock size={16} color={A.blue} />
          <Text style={styles.cardTitle}>Operating Hours</Text>
        </View>
        {DAYS.map((day) => {
          const sch = hours[day] || { open: '08:00', close: '18:00', closed: false };
          return (
            <View key={day} style={styles.dayRow}>
              <TouchableOpacity
                style={styles.dayCheck}
                onPress={() => updateDay(day, { closed: !sch.closed })}
              >
                <View style={[styles.checkbox, sch.closed && { backgroundColor: A.red, borderColor: A.red }]}>
                  {!sch.closed && <Check size={12} color="#000" />}
                </View>
                <Text style={[styles.dayLabel, { color: sch.closed ? A.textSub : A.text }]}>{DAY_LABELS[day]}</Text>
              </TouchableOpacity>
              {sch.closed ? (
                <Text style={styles.closedText}>Closed</Text>
              ) : (
                <View style={styles.timeRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={sch.open}
                    onChangeText={(v) => updateDay(day, { open: v })}
                    placeholder="HH:MM"
                    placeholderTextColor={A.textMuted}
                    keyboardType={Platform.OS === 'web' ? ('default' as any) : ('number-pad' as any)}
                  />
                  <Text style={styles.timeDash}>–</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={sch.close}
                    onChangeText={(v) => updateDay(day, { close: v })}
                    placeholder="HH:MM"
                    placeholderTextColor={A.textMuted}
                    keyboardType={Platform.OS === 'web' ? ('default' as any) : ('number-pad' as any)}
                  />
                </View>
              )}
            </View>
          );
        })}
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: A.blue }]} onPress={saveHours} disabled={savingHours}>
          {savingHours ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Hours</Text>}
        </TouchableOpacity>
      </View>

      {/* Payment Methods */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <CreditCard size={16} color={A.cyan} />
          <Text style={styles.cardTitle}>Accepted Payment Methods</Text>
        </View>
        {PAYMENT_OPTIONS.map((opt) => {
          const on = payMethods.includes(opt.key);
          return (
            <TouchableOpacity key={opt.key} style={styles.payRow} onPress={() => togglePay(opt.key)} activeOpacity={0.7}>
              <View style={[styles.checkbox, on && { backgroundColor: A.cyan, borderColor: A.cyan }]}>
                {on && <Check size={12} color="#000" />}
              </View>
              <Text style={[styles.payLabel, { color: on ? A.text : A.textSub }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: A.cyan }]} onPress={savePay} disabled={savingPay}>
          {savingPay ? <ActivityIndicator size="small" color="#000" /> : <Text style={[styles.saveBtnText, { color: '#000' }]}>Save Payment Methods</Text>}
        </TouchableOpacity>
      </View>

      {/* Fees */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <DollarSign size={16} color={A.amber} />
          <Text style={styles.cardTitle}>Fees & Surcharges</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>EcoCash Surcharge (USD)</Text>
          <TextInput
            style={styles.feeInput}
            value={ecocashFee}
            onChangeText={setEcocashFee}
            placeholder="0.00"
            placeholderTextColor={A.textMuted}
            keyboardType="decimal-pad"
          />
          <Text style={styles.feeHint}>Extra fee added to customer's total when they pay via EcoCash.</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Delivery Fee (USD)</Text>
          <TextInput
            style={styles.feeInput}
            value={deliveryFee}
            onChangeText={setDeliveryFee}
            placeholder="0.00"
            placeholderTextColor={A.textMuted}
            keyboardType="decimal-pad"
          />
          <Text style={styles.feeHint}>Default delivery fee charged to customers based on their GPS location.</Text>
        </View>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: A.amber }]} onPress={saveFees} disabled={savingFees}>
          {savingFees ? <ActivityIndicator size="small" color="#000" /> : <Text style={[styles.saveBtnText, { color: '#000' }]}>Save Fees</Text>}
        </TouchableOpacity>
      </View>

      {/* WhatsApp Number */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MessageCircle size={16} color="#25D366" />
          <Text style={styles.cardTitle}>WhatsApp Order Notifications</Text>
        </View>
        <Text style={styles.whatsappDesc}>
          Add a WhatsApp number to receive order notifications and require customers to confirm their order via WhatsApp before checkout. This builds trust and reduces fake orders.
        </Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>WhatsApp Number</Text>
          <TextInput
            style={styles.feeInput}
            value={whatsappInput}
            onChangeText={setWhatsappInput}
            placeholder="e.g. +263771234567"
            placeholderTextColor={A.textMuted}
            keyboardType="phone-pad"
          />
          <Text style={styles.feeHint}>Include country code. Leave empty to disable WhatsApp order confirmation.</Text>
        </View>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#25D366' }]} onPress={saveWhatsapp} disabled={savingWhatsapp}>
          {savingWhatsapp ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.saveBtnText, { color: '#fff' }]}>Save WhatsApp Number</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutCard} onPress={onLogout}>
        <LogOut size={18} color={A.red} />
        <Text style={{ color: A.red, fontSize: 15, fontWeight: '600' }}>Logout</Text>
      </TouchableOpacity>

      {/* Location Editor Modal */}
      <Modal visible={showLocationEditor} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Location</Text>
              <TouchableOpacity onPress={() => setShowLocationEditor(false)}>
                <X size={22} color={A.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.textInput}
                value={addrInput}
                onChangeText={setAddrInput}
                placeholder="Shop street address"
                placeholderTextColor={A.textMuted}
                multiline
              />
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Latitude</Text>
                  <TextInput
                    style={styles.textInput}
                    value={latInput}
                    onChangeText={setLatInput}
                    placeholder="e.g. -17.8252"
                    placeholderTextColor={A.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Longitude</Text>
                  <TextInput
                    style={styles.textInput}
                    value={lngInput}
                    onChangeText={setLngInput}
                    placeholder="e.g. 31.0335"
                    placeholderTextColor={A.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.gpsBtn} onPress={useGps} disabled={locating}>
                {locating ? (
                  <ActivityIndicator size="small" color={A.green} />
                ) : (
                  <>
                    <Navigation size={16} color={A.green} />
                    <Text style={[styles.btnText, { color: A.green }]}>Use GPS</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: A.cyan, marginTop: 16 }]} onPress={saveLocation} disabled={savingLoc}>
                {savingLoc ? <ActivityIndicator size="small" color="#000" /> : <Text style={[styles.saveBtnText, { color: '#000' }]}>Save Location</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: A.card, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: A.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: A.text, flex: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: A.greenDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: A.green },
  verifiedText: { fontSize: 10, fontWeight: '700', color: A.green },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  label: { fontSize: 11, color: A.textSub, fontWeight: '600', textTransform: 'uppercase' as any, letterSpacing: 0.5 },
  value: { fontSize: 14, color: A.text, marginTop: 4 },
  warnBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: A.amberDim, borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1 },
  warnText: { fontSize: 12, flex: 1, lineHeight: 16 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, backgroundColor: A.card },
  btnText: { fontSize: 13, fontWeight: '600' },
  availToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 12, paddingVertical: 18, borderWidth: 1.5 },
  availDot: { width: 12, height: 12, borderRadius: 6 },
  availText: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  availHint: { fontSize: 12, color: A.textSub, marginTop: 8, textAlign: 'center' },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: A.border },
  dayCheck: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: A.border, justifyContent: 'center', alignItems: 'center' },
  dayLabel: { fontSize: 13, fontWeight: '600' },
  closedText: { fontSize: 12, color: A.red, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: { width: 64, backgroundColor: A.inputBg, borderRadius: 6, borderWidth: 1, borderColor: A.inputBorder, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: A.text, textAlign: 'center' },
  timeDash: { color: A.textSub, fontSize: 14 },
  saveBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  saveBtnText: { fontSize: 14, fontWeight: '700' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: A.border },
  payLabel: { fontSize: 14, flex: 1 },
  fieldGroup: { gap: 6, marginBottom: 14 },
  feeInput: { backgroundColor: A.inputBg, borderRadius: 10, borderWidth: 1, borderColor: A.inputBorder, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: A.text, minHeight: 48 },
  feeHint: { fontSize: 11, color: A.textSub, marginTop: 4, lineHeight: 16 },
  whatsappDesc: { fontSize: 12, color: A.textSub, lineHeight: 17, marginBottom: 14 },
  logoutCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: A.redDim, borderRadius: 12, paddingVertical: 16, borderWidth: 1, borderColor: A.red },
  msgBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: A.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: A.text },
  inputLabel: { fontSize: 12, fontWeight: '600', color: A.textSub, marginBottom: 6, marginTop: 12 },
  textInput: { backgroundColor: A.inputBg, borderRadius: 10, borderWidth: 1, borderColor: A.inputBorder, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: A.text, minHeight: 48 },
  inputRow: { flexDirection: 'row', gap: 12 },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: A.greenDim, borderRadius: 10, paddingVertical: 14, borderWidth: 1, borderColor: A.green, marginTop: 16 },
});
