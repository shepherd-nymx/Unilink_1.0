import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { S } from '@/lib/shop-theme';
import { STATUS_LABELS, STATUS_FLOW, type ShopOrder, type Driver } from '@/lib/shop-types';
import {
  CircleCheck as CheckCircle,
  Circle as XCircle,
  Truck,
  X,
  CircleAlert as AlertCircle,
  Star,
  Bike,
  MessageSquare,
  Smartphone,
  MessageCircle,
  Clock,
  Package,
  MapPin,
} from 'lucide-react-native';

const VEHICLE_BADGES: Record<string, { label: string; color: string }> = {
  bicycle: { label: 'Bicycle', color: S.green },
  motorcycle: { label: 'Motorbike', color: S.cyan },
  car: { label: 'Car', color: S.blue },
  scooter: { label: 'Scooter', color: S.orange },
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
              <X size={22} color={S.textSub} />
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

            {order.payment_method === 'ecocash' && order.ecocash_pop ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.modalSectionLabel}>Proof of Payment (Customer)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: S.greenDim, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: S.green }}>
                  <Smartphone size={14} color={S.green} />
                  <Text style={{ fontSize: 13, color: S.text, flex: 1 }}>{order.ecocash_pop}</Text>
                </View>
              </View>
            ) : null}

            {/* Order tracking flow */}
            <Text style={styles.modalSectionLabel}>Order Tracking</Text>
            <View style={styles.trackerContainer}>
              {STATUS_FLOW.map((step, i) => {
                const currentStepIndex = STATUS_FLOW.indexOf(order.status as any);
                const isCancelled = order.status === 'cancelled';
                const isActive = !isCancelled && i <= currentStepIndex;
                const isCurrent = !isCancelled && i === currentStepIndex;
                const stepColor = isActive ? (isCurrent ? S.cyan : S.green) : S.border;
                const isLast = i === STATUS_FLOW.length - 1;
                const stepIcons: Record<string, any> = {
                  pending: Clock,
                  confirmed: CheckCircle,
                  preparing: Package,
                  ready: Package,
                  assigned: Truck,
                  picked_up: Truck,
                  out_for_delivery: Truck,
                  delivered: CheckCircle,
                };
                const StepIcon = stepIcons[step] || Clock;
                return (
                  <View key={step} style={styles.trackerStep}>
                    <View style={styles.trackerStepLeft}>
                      <View style={[styles.trackerDot, { backgroundColor: isActive ? stepColor : S.inputBg, borderColor: stepColor }]}>
                        <StepIcon size={10} color={isActive ? '#fff' : S.textMuted} />
                      </View>
                      {!isLast && (
                        <View style={[styles.trackerLine, { backgroundColor: !isCancelled && i < currentStepIndex ? S.green : S.border }]} />
                      )}
                    </View>
                    <View style={styles.trackerStepRight}>
                      <Text style={[styles.trackerLabel, { color: isActive ? S.text : S.textMuted, fontWeight: isCurrent ? '700' as any : '500' }]}>
                        {STATUS_LABELS[step] || step}
                      </Text>
                      {isCurrent && (
                        <Text style={styles.trackerCurrent}>Current status</Text>
                      )}
                    </View>
                  </View>
                );
              })}
              {order.status === 'cancelled' && (
                <View style={[styles.cancelledBox, { backgroundColor: S.redDim, borderColor: S.red }]}>
                  <XCircle size={14} color={S.red} />
                  <Text style={[styles.cancelledText, { color: S.red }]}>This order was cancelled</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {onChat && order.customer_id && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: S.blue, marginBottom: 10 }]}
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
                  style={[styles.actionBtn, { backgroundColor: S.green }]}
                  onPress={() => onUpdateStatus(order, 'confirmed')}
                >
                  <CheckCircle size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: S.red }]}
                  onPress={() => onUpdateStatus(order, 'cancelled')}
                >
                  <XCircle size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </>
            )}
            {order.status === 'confirmed' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: S.blue }]}
                onPress={() => onUpdateStatus(order, 'preparing')}
              >
                <Text style={styles.actionBtnText}>Start Preparing</Text>
              </TouchableOpacity>
            )}
            {order.status === 'preparing' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: S.cyan }]}
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
                    <AlertCircle size={14} color={S.red} />
                    <Text style={{ color: S.red, fontSize: 12, flex: 1 }}>{assignError}</Text>
                  </View>
                ) : null}
                {assigningDriver ? (
                  <View style={styles.driverLoadingRow}>
                    <ActivityIndicator size="small" color={S.cyan} />
                    <Text style={styles.driverLoadingText}>Assigning driver…</Text>
                  </View>
                ) : drivers.length === 0 ? (
                  <View style={styles.noDriversBox}>
                    <Truck size={20} color={S.textMuted} />
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
                              <Truck size={16} color={S.cyan} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.driverName}>{d.full_name}</Text>
                              <Text style={styles.driverPhone}>{d.phone_number}</Text>
                              <View style={styles.driverBadges}>
                                {d.rating != null && Number(d.rating) > 0 && (
                                  <View style={styles.driverBadge}>
                                    <Star size={9} color={S.amber} fill={S.amber} />
                                    <Text style={[styles.driverBadgeText, { color: S.amber }]}>
                                      {Number(d.rating).toFixed(1)}
                                    </Text>
                                  </View>
                                )}
                                {d.completed_deliveries != null && (
                                  <View style={styles.driverBadge}>
                                    <CheckCircle size={9} color={S.green} />
                                    <Text style={[styles.driverBadgeText, { color: S.green }]}>
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {(() => {
                              const waNum = (d.whatsapp_number || d.phone_number || '').replace(/[^0-9]/g, '');
                              if (!waNum) return null;
                              return (
                                <TouchableOpacity
                                  style={styles.driverRowWhatsAppBtn}
                                  onPress={() => {
                                    const orderRef = order.id.slice(0, 8);
                                    const msg = encodeURIComponent(`Hi ${d.full_name}, I have an order (#${orderRef}) from ${order.customer_name || 'a customer'} ready for delivery to ${order.delivery_location || 'the customer'}. Are you available to pick it up?`);
                                    Linking.openURL(`https://wa.me/${waNum}?text=${msg}`).catch(() => {});
                                  }}
                                >
                                  <MessageCircle size={13} color="#fff" />
                                  <Text style={styles.driverRowWhatsAppBtnText}>WhatsApp</Text>
                                </TouchableOpacity>
                              );
                            })()}
                            <TouchableOpacity
                              style={styles.driverRowAssignBtn}
                              onPress={() => onAssignDriver(d.id)}
                              disabled={assigningDriver}
                            >
                              <Text style={styles.driverRowAssignBtnText}>Assign</Text>
                            </TouchableOpacity>
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
                style={[styles.actionBtn, { backgroundColor: S.orange }]}
                onPress={() => onUpdateStatus(order, 'out_for_delivery')}
              >
                <Text style={styles.actionBtnText}>Out for Delivery</Text>
              </TouchableOpacity>
            )}
            {order.status === 'out_for_delivery' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: S.green }]}
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
  modalOverlay: { flex: 1, backgroundColor: S.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: S.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: S.text },
  modalSectionLabel: { fontSize: 11, fontWeight: '700', color: S.textSub, textTransform: 'uppercase' as any, letterSpacing: 0.5, marginTop: 14, marginBottom: 4 },
  modalText: { fontSize: 14, color: S.text, lineHeight: 20 },
  modalItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  modalItemName: { fontSize: 13, color: S.text, flex: 1 },
  modalItemPrice: { fontSize: 13, color: S.green, fontWeight: '600' },
  modalTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: S.border, marginTop: 8,
  },
  modalTotalLabel: { fontSize: 15, fontWeight: '700', color: S.text },
  modalTotalValue: { fontSize: 17, fontWeight: '800', color: S.green },
  modalActions: {
    flexDirection: 'row', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: S.border, marginTop: 10,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 10, paddingVertical: 14,
  },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  assignLabel: { fontSize: 13, fontWeight: '600', color: S.text, marginBottom: 8 },
  assignErrorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: S.redDim, borderRadius: 8, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: S.red,
  },
  driverLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, justifyContent: 'center' },
  driverLoadingText: { color: S.cyan, fontSize: 13, fontWeight: '600' },
  noDriversBox: { alignItems: 'center', gap: 8, paddingVertical: 20, paddingHorizontal: 12 },
  noDriversTitle: { fontSize: 14, fontWeight: '700', color: S.text },
  noDriversSub: { fontSize: 12, color: S.textSub, textAlign: 'center', lineHeight: 18 },
  driverRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14, backgroundColor: S.card,
    borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: S.border,
  },
  driverRowProminent: {
    borderWidth: 1.5, borderColor: S.cyan,
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } : { elevation: 2 }),
  },
  driverRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  driverRowIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: S.cyanDim,
    justifyContent: 'center', alignItems: 'center',
  },
  driverRowAssignBtn: {
    backgroundColor: S.cyan, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  driverRowAssignBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  driverRowWhatsAppBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#25D366', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },
  driverRowWhatsAppBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  driverName: { fontSize: 14, fontWeight: '600', color: S.text },
  driverPhone: { fontSize: 12, color: S.textSub, marginTop: 2 },
  driverBadges: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  driverBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: S.inputBg, borderWidth: 1, borderColor: S.border,
  },
  driverBadgeText: { fontSize: 9, fontWeight: '700' },
  trackerContainer: { marginTop: 4, marginBottom: 8 },
  trackerStep: { flexDirection: 'row', minHeight: 44 },
  trackerStepLeft: { alignItems: 'center', width: 28 },
  trackerDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  trackerLine: { flex: 1, width: 2, minHeight: 24, marginTop: 2 },
  trackerStepRight: { flex: 1, paddingBottom: 12 },
  trackerLabel: { fontSize: 13 },
  trackerCurrent: { fontSize: 10, color: S.cyan, fontWeight: '600', marginTop: 2 },
  cancelledBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 8 },
  cancelledText: { fontSize: 12, fontWeight: '600' },
});
