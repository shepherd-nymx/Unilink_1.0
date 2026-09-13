import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { A } from '@/lib/admin-theme';
import { STATUS_LABELS, type ShopOrder, type Driver } from '@/lib/shop-types';
import {
  CircleCheck as CheckCircle,
  Circle as XCircle,
  Truck,
  X,
  CircleAlert as AlertCircle,
  Star,
  Bike,
  MessageSquare,
} from 'lucide-react-native';

const VEHICLE_BADGES: Record<string, { label: string; color: string }> = {
  bicycle: { label: 'Bicycle', color: A.green },
  motorcycle: { label: 'Motorbike', color: A.cyan },
  car: { label: 'Car', color: A.blue },
  scooter: { label: 'Scooter', color: A.orange },
};

export function OrderDetailModal({
  visible,
  order,
  drivers,
  assigningDriver,
  assignError,
  onClose,
  onUpdateStatus,
  onAssignDriver,
  onChat,
}: {
  visible: boolean;
  order: ShopOrder | null;
  drivers: Driver[];
  assigningDriver: boolean;
  assignError: string;
  onClose: () => void;
  onUpdateStatus: (order: ShopOrder, status: string) => void;
  onAssignDriver: (driverId: string) => void;
  onChat?: (order: ShopOrder) => void;
}) {
  if (!order) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order #{order.id.slice(0, 8)}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={A.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 400 }}>
            <Text style={styles.modalSectionLabel}>Customer</Text>
            <Text style={styles.modalText}>{order.customer_name || '—'}</Text>
            {order.customer_phone ? <Text style={styles.modalText}>{order.customer_phone}</Text> : null}

            <Text style={styles.modalSectionLabel}>Delivery Location</Text>
            <Text style={styles.modalText}>{order.delivery_location || '—'}</Text>

            <Text style={styles.modalSectionLabel}>Items</Text>
            {(Array.isArray(order.products) ? order.products : []).map((item: any, i: number) => (
              <View key={i} style={styles.modalItemRow}>
                <Text style={styles.modalItemName}>{item.name} ×{item.qty || 1}</Text>
                <Text style={styles.modalItemPrice}>${Number(item.price || 0).toFixed(2)}</Text>
              </View>
            ))}

            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotalLabel}>Items Subtotal</Text>
              <Text style={styles.modalTotalValue}>${(Number(order.total_amount) - Number(order.delivery_fee || 0) - Number((order as any).ecocash_fee_amount || 0)).toFixed(2)}</Text>
            </View>
            {Number((order as any).ecocash_fee_amount || 0) > 0 ? (
              <View style={styles.modalTotalRow}>
                <Text style={styles.modalTotalLabel}>EcoCash Fee</Text>
                <Text style={styles.modalTotalValue}>${Number((order as any).ecocash_fee_amount || 0).toFixed(2)}</Text>
              </View>
            ) : null}
            {Number(order.delivery_fee || 0) > 0 ? (
              <View style={styles.modalTotalRow}>
                <Text style={styles.modalTotalLabel}>Delivery Fee</Text>
                <Text style={styles.modalTotalValue}>${Number(order.delivery_fee || 0).toFixed(2)}</Text>
              </View>
            ) : null}
            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotalLabel}>Grand Total</Text>
              <Text style={styles.modalTotalValue}>${Number(order.total_amount).toFixed(2)}</Text>
            </View>

            <Text style={styles.modalSectionLabel}>Payment Method</Text>
            <Text style={styles.modalText}>{order.payment_method}</Text>
          </ScrollView>

          {onChat && order.customer_id && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: A.blue, marginBottom: 10 }]}
              onPress={() => onChat(order)}
              activeOpacity={0.8}
            >
              <MessageSquare size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Chat with Customer</Text>
            </TouchableOpacity>
          )}

          <View style={styles.modalActions}>
            {order.status === 'pending' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: A.green }]}
                  onPress={() => onUpdateStatus(order, 'confirmed')}
                >
                  <CheckCircle size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: A.red }]}
                  onPress={() => onUpdateStatus(order, 'cancelled')}
                >
                  <XCircle size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </>
            )}
            {order.status === 'confirmed' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: A.blue }]}
                onPress={() => onUpdateStatus(order, 'preparing')}
              >
                <Text style={styles.actionBtnText}>Start Preparing</Text>
              </TouchableOpacity>
            )}
            {order.status === 'preparing' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: A.cyan }]}
                onPress={() => onUpdateStatus(order, 'ready')}
              >
                <Text style={styles.actionBtnText}>Mark Ready</Text>
              </TouchableOpacity>
            )}
            {order.status === 'ready' && (
              <View style={{ width: '100%' }}>
                <Text style={styles.assignLabel}>Assign a Messenger (Required):</Text>
                {assignError ? (
                  <View style={styles.assignErrorBox}>
                    <AlertCircle size={14} color={A.red} />
                    <Text style={{ color: A.red, fontSize: 12, flex: 1 }}>{assignError}</Text>
                  </View>
                ) : null}
                {assigningDriver ? (
                  <View style={styles.driverLoadingRow}>
                    <ActivityIndicator size="small" color={A.cyan} />
                    <Text style={styles.driverLoadingText}>Assigning driver…</Text>
                  </View>
                ) : drivers.length === 0 ? (
                  <View style={styles.noDriversBox}>
                    <Truck size={20} color={A.textMuted} />
                    <Text style={styles.noDriversTitle}>No eligible drivers</Text>
                    <Text style={styles.noDriversSub}>
                      All approved drivers are currently unavailable, suspended, or lack an active subscription. Please check back shortly.
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={{ maxHeight: 220 }}>
                    {drivers.map((d) => {
                      const vBadge = d.vehicle_type ? VEHICLE_BADGES[d.vehicle_type] : null;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[styles.driverRow, styles.driverRowProminent]}
                          onPress={() => onAssignDriver(d.id)}
                          disabled={assigningDriver}
                          activeOpacity={0.85}
                        >
                          <View style={styles.driverRowLeft}>
                            <View style={styles.driverRowIcon}>
                              <Truck size={16} color={A.cyan} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.driverName}>{d.full_name}</Text>
                              <Text style={styles.driverPhone}>{d.phone_number}</Text>
                              <View style={styles.driverBadges}>
                                {d.rating != null && Number(d.rating) > 0 && (
                                  <View style={styles.driverBadge}>
                                    <Star size={9} color={A.amber} fill={A.amber} />
                                    <Text style={[styles.driverBadgeText, { color: A.amber }]}>
                                      {Number(d.rating).toFixed(1)}
                                    </Text>
                                  </View>
                                )}
                                {d.completed_deliveries != null && (
                                  <View style={styles.driverBadge}>
                                    <CheckCircle size={9} color={A.green} />
                                    <Text style={[styles.driverBadgeText, { color: A.green }]}>
                                      {d.completed_deliveries} done
                                    </Text>
                                  </View>
                                )}
                                {vBadge && (
                                  <View style={[styles.driverBadge, { borderColor: vBadge.color }]}>
                                    <Bike size={9} color={vBadge.color} />
                                    <Text style={[styles.driverBadgeText, { color: vBadge.color }]}>
                                      {vBadge.label}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                          <View style={styles.driverRowAssignBtn}>
                            <Text style={styles.driverRowAssignBtnText}>Assign</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
            {order.status === 'picked_up' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: A.orange }]}
                onPress={() => onUpdateStatus(order, 'out_for_delivery')}
              >
                <Text style={styles.actionBtnText}>Out for Delivery</Text>
              </TouchableOpacity>
            )}
            {order.status === 'out_for_delivery' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: A.green }]}
                onPress={() => onUpdateStatus(order, 'delivered')}
              >
                <CheckCircle size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Mark Delivered</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: A.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: A.text },
  modalSectionLabel: { fontSize: 11, fontWeight: '700', color: A.textSub, textTransform: 'uppercase' as any, letterSpacing: 0.5, marginTop: 14, marginBottom: 4 },
  modalText: { fontSize: 14, color: A.text, lineHeight: 20 },
  modalItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  modalItemName: { fontSize: 13, color: A.text, flex: 1 },
  modalItemPrice: { fontSize: 13, color: A.green, fontWeight: '600' },
  modalTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: A.border, marginTop: 8,
  },
  modalTotalLabel: { fontSize: 15, fontWeight: '700', color: A.text },
  modalTotalValue: { fontSize: 17, fontWeight: '800', color: A.green },
  modalActions: {
    flexDirection: 'row', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: A.border, marginTop: 10,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 10, paddingVertical: 14,
  },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  assignLabel: { fontSize: 13, fontWeight: '600', color: A.text, marginBottom: 8 },
  assignErrorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: A.redDim, borderRadius: 8, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: A.red,
  },
  driverLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, justifyContent: 'center' },
  driverLoadingText: { color: A.cyan, fontSize: 13, fontWeight: '600' },
  noDriversBox: { alignItems: 'center', gap: 8, paddingVertical: 20, paddingHorizontal: 12 },
  noDriversTitle: { fontSize: 14, fontWeight: '700', color: A.text },
  noDriversSub: { fontSize: 12, color: A.textSub, textAlign: 'center', lineHeight: 18 },
  driverRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14, backgroundColor: A.card,
    borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: A.border,
  },
  driverRowProminent: {
    borderWidth: 1.5, borderColor: A.cyan,
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } : { elevation: 2 }),
  },
  driverRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  driverRowIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: A.cyanDim,
    justifyContent: 'center', alignItems: 'center',
  },
  driverRowAssignBtn: {
    backgroundColor: A.cyan, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  driverRowAssignBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  driverName: { fontSize: 14, fontWeight: '600', color: A.text },
  driverPhone: { fontSize: 12, color: A.textSub, marginTop: 2 },
  driverBadges: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  driverBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: A.inputBg, borderWidth: 1, borderColor: A.border,
  },
  driverBadgeText: { fontSize: 9, fontWeight: '700' },
});
