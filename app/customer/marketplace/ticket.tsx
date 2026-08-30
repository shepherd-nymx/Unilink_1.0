import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, Download, Share as ShareIcon, Store, MapPin, Phone, Clock, CreditCard, Package, Smartphone, FileText } from 'lucide-react-native';

type ShopOrderDetails = {
  id: string;
  shop_id: string;
  products: any[];
  total_amount: number;
  delivery_fee: number;
  delivery_location: string | null;
  payment_method: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  order_note: string | null;
  created_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
  shops: {
    name: string;
    address: string | null;
    contact_phone: string;
    contact_email: string;
    ecocash_number: string | null;
    logo_url: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

export default function OrderTicket() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const { isDark } = useTheme();

  const [order, setOrder] = useState<ShopOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const P = '#0066ff';
  const BG = isDark ? '#050b16' : '#f0f4f8';
  const CARD = isDark ? '#0a1220' : '#ffffff';
  const BORDER = isDark ? '#1a2d4a' : '#e2e8f0';
  const TX = isDark ? '#e0eeff' : '#0a1929';
  const TX2 = isDark ? '#6a8fb0' : '#64748b';
  const TX3 = isDark ? '#3d5577' : '#94a3b8';
  const ACCENT = '#00e5ff';
  const GREEN = '#00c853';
  const AMBER = '#ffa726';

  useEffect(() => { loadOrder(); }, []);

  const loadOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select(`
          id, shop_id, products, total_amount, delivery_fee, delivery_location,
          payment_method, status, customer_name, customer_phone, customer_email,
          order_note, created_at, confirmed_at, delivered_at,
          shops!shop_orders_shop_id_fkey (
            name, address, contact_phone, contact_email, ecocash_number, logo_url,
            latitude, longitude
          )
        `)
        .eq('id', orderId as string)
        .maybeSingle();
      if (error) throw error;
      setOrder(data as unknown as ShopOrderDetails);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const generateTicketHTML = (): string => {
    if (!order || !order.shops) return '';
    const shop = order.shops;
    const items = (Array.isArray(order.products) ? order.products : [])
      .map((item: any) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;">${item.name || 'Item'}</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${item.qty || 1}</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">$${Number(item.price || 0).toFixed(2)}</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$${(Number(item.price || 0) * (item.qty || 1)).toFixed(2)}</td></tr>`)
      .join('');

    const ecocashSection = order.payment_method === 'ecocash'
      ? `<div style="background:#fff8e1;border:2px dashed #ffa726;border-radius:12px;padding:20px;margin:20px 0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <div style="width:36px;height:36px;border-radius:8px;background:#ffa72622;display:flex;align-items:center;justify-content:center;">
              <span style="font-size:18px;">📱</span>
            </div>
            <div>
              <div style="font-size:14px;font-weight:800;color:#e65100;letter-spacing:0.5px;">ECOCASH PAYMENT</div>
              <div style="font-size:11px;color:#888;">Send money to the shop's EcoCash number below</div>
            </div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:16px;border:1px solid #ffe0b2;">
            <div style="font-size:11px;color:#888;font-weight:600;letter-spacing:1px;margin-bottom:6px;">SHOP ECOCASH NUMBER</div>
            <div style="font-size:24px;font-weight:800;color:#e65100;letter-spacing:1px;">${shop.ecocash_number || 'Not configured'}</div>
            ${shop.ecocash_number ? `<div style="font-size:11px;color:#aaa;margin-top:6px;">Reference: Order #${order.id.slice(0, 8).toUpperCase()}</div>` : ''}
          </div>
        </div>`
      : '';

    const mapsLink = shop.latitude && shop.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`
      : '#';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Order Ticket - ${shop.name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f0f4f8; padding:20px; color:#0a1929; }
  .ticket { max-width:520px; margin:0 auto; background:#fff; border-radius:20px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .ticket-header { background:linear-gradient(135deg,#0066ff,#00e5ff); padding:28px 24px; color:#fff; }
  .ticket-header h1 { font-size:22px; font-weight:800; }
  .ticket-header .sub { font-size:13px; opacity:0.85; margin-top:4px; }
  .ticket-body { padding:24px; }
  .shop-section { display:flex; align-items:center; gap:14px; margin-bottom:20px; }
  .shop-logo { width:56px; height:56px; border-radius:14px; background:#0066ff15; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; }
  .shop-info h2 { font-size:18px; font-weight:800; }
  .shop-info p { font-size:12px; color:#64748b; margin-top:2px; }
  .section-title { font-size:11px; font-weight:800; letter-spacing:1.5px; color:#64748b; text-transform:uppercase; margin:20px 0 10px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .info-item { background:#f8fafc; border-radius:10px; padding:12px; border:1px solid #e2e8f0; }
  .info-label { font-size:10px; font-weight:700; color:#94a3b8; letter-spacing:0.5px; }
  .info-value { font-size:13px; font-weight:600; color:#0a1929; margin-top:3px; }
  table { width:100%; border-collapse:collapse; margin:8px 0; }
  th { text-align:left; padding:10px 12px; background:#f8fafc; font-size:11px; font-weight:700; color:#64748b; letter-spacing:0.5px; border-bottom:2px solid #e2e8f0; }
  th.center { text-align:center; }
  th.right { text-align:right; }
  .summary-row { display:flex; justify-content:space-between; padding:6px 0; font-size:14px; }
  .summary-total { display:flex; justify-content:space-between; padding:14px 0 0; border-top:2px solid #e2e8f0; margin-top:8px; font-size:18px; font-weight:800; color:#0066ff; }
  .status-badge { display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700; }
  .barcode { text-align:center; padding:16px; background:#f8fafc; border-radius:10px; margin-top:16px; }
  .barcode-text { font-family:'Courier New',monospace; font-size:20px; font-weight:700; letter-spacing:4px; color:#0a1929; }
  .footer { text-align:center; padding:16px; font-size:11px; color:#94a3b8; }
  .payment-method { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:700; }
  @media print { body { background:#fff; padding:0; } .ticket { box-shadow:none; max-width:100%; } .no-print { display:none !important; } }
</style>
</head>
<body>
  <div class="ticket">
    <div class="ticket-header">
      <h1>Order Ticket</h1>
      <div class="sub">${shop.name} · UniLink Marketplace</div>
    </div>
    <div class="ticket-body">
      <div class="shop-section">
        <div class="shop-logo">🏪</div>
        <div class="shop-info">
          <h2>${shop.name}</h2>
          <p>${shop.address || 'Address not available'}</p>
          <p>📞 ${shop.contact_phone}</p>
        </div>
      </div>

      <div class="status-badge" style="background:${order.status === 'delivered' ? '#00c85322' : '#0066ff22'};color:${order.status === 'delivered' ? '#00c853' : '#0066ff'};">
        <span>${order.status === 'delivered' ? '✓' : '⏱'}</span>
        ${order.status.charAt(0).toUpperCase() + order.status.slice(1).replace(/_/g, ' ')}
      </div>

      <div class="section-title">Order Details</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">ORDER ID</div>
          <div class="info-value">#${order.id.slice(0, 8).toUpperCase()}</div>
        </div>
        <div class="info-item">
          <div class="info-label">DATE</div>
          <div class="info-value">${formatDate(order.created_at)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">CUSTOMER</div>
          <div class="info-value">${order.customer_name || 'N/A'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">PHONE</div>
          <div class="info-value">${order.customer_phone || 'N/A'}</div>
        </div>
      </div>

      ${order.delivery_location ? `
      <div class="section-title">Delivery Location</div>
      <div class="info-item">
        <div class="info-value">📍 ${order.delivery_location}</div>
      </div>` : ''}

      ${ecocashSection}

      <div class="section-title">Items</div>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th class="center">Qty</th>
            <th class="right">Price</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items}
        </tbody>
      </table>

      <div class="summary-row"><span style="color:#64748b;">Subtotal</span><span>$${Number(order.total_amount - order.delivery_fee).toFixed(2)}</span></div>
      <div class="summary-row"><span style="color:#64748b;">Delivery Fee</span><span>$${Number(order.delivery_fee).toFixed(2)}</span></div>
      <div class="summary-total"><span>Total</span><span>$${Number(order.total_amount).toFixed(2)}</span></div>

      <div class="section-title">Payment Method</div>
      <div class="payment-method" style="background:${order.payment_method === 'ecocash' ? '#ffa72622' : '#00c85322'};color:${order.payment_method === 'ecocash' ? '#e65100' : '#00c853'};">
        ${order.payment_method === 'ecocash' ? '📱 EcoCash' : '💵 Cash on Delivery'}
      </div>

      ${shop.latitude && shop.longitude ? `
      <div class="section-title">Shop Location</div>
      <a href="${mapsLink}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;background:#00c85322;color:#00c853;text-decoration:none;font-size:13px;font-weight:700;">📍 View on Google Maps</a>` : ''}

      <div class="barcode">
        <div class="barcode-text">*${order.id.slice(0, 12).toUpperCase()}*</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:6px;">Show this code at the shop</div>
      </div>
    </div>
    <div class="footer">
      UniLink Marketplace · Generated on ${formatDate(new Date().toISOString())}<br>
      This ticket is proof of your order. Present it at the shop or to your messenger.
    </div>
  </div>
  <div class="no-print" style="text-align:center;margin-top:16px;">
    <button onclick="window.print()" style="padding:12px 28px;border-radius:12px;background:#0066ff;color:#fff;border:none;font-size:15px;font-weight:700;cursor:pointer;">Print / Save as PDF</button>
  </div>
</body>
</html>`;
  };

  const downloadTicket = () => {
    const html = generateTicketHTML();
    if (!html) return;
    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-${order?.id.slice(0, 8) || 'order'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const printTicket = () => {
    const html = generateTicketHTML();
    if (!html) return;
    if (Platform.OS === 'web') {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => printWin.print(), 500);
      }
    }
  };

  const shareTicket = async () => {
    if (!order || !order.shops) return;
    const shop = order.shops;
    const itemsList = (Array.isArray(order.products) ? order.products : [])
      .map((item: any) => `${item.name} x${item.qty || 1} - $${(Number(item.price || 0) * (item.qty || 1)).toFixed(2)}`)
      .join('\n');
    const text = `UniLink Order Ticket\n\nShop: ${shop.name}\nAddress: ${shop.address || 'N/A'}\nPhone: ${shop.contact_phone}\n\nOrder #: ${order.id.slice(0, 8).toUpperCase()}\nDate: ${formatDate(order.created_at)}\n\nItems:\n${itemsList}\n\nSubtotal: $${Number(order.total_amount - order.delivery_fee).toFixed(2)}\nDelivery: $${Number(order.delivery_fee).toFixed(2)}\nTotal: $${Number(order.total_amount).toFixed(2)}\n\nPayment: ${order.payment_method === 'ecocash' ? 'EcoCash' : 'Cash on Delivery'}${order.payment_method === 'ecocash' && shop.ecocash_number ? `\nEcoCash Number: ${shop.ecocash_number}` : ''}`;
    try {
      await Share.share({ message: text });
    } catch {}
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: BG, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={P} />
      </View>
    );
  }

  if (!order || !order.shops) {
    return (
      <View style={[styles.container, { backgroundColor: BG, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: TX3, fontSize: 14 }}>Order not found</Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: `${P}15`, borderColor: `${P}40` }]} onPress={() => router.back()}>
          <Text style={{ color: P, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const shop = order.shops;
  const items = Array.isArray(order.products) ? order.products : [];
  const subtotal = Number(order.total_amount) - Number(order.delivery_fee);

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={[styles.header, { backgroundColor: CARD, borderBottomColor: BORDER }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: BORDER }]} onPress={() => router.back()}>
          <ArrowLeft size={18} color={TX} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: TX }]}>Order Ticket</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Ticket card */}
        <View style={[styles.ticketCard, { backgroundColor: CARD, borderColor: BORDER }]}>
          {/* Header strip */}
          <View style={styles.ticketHeader}>
            <View style={styles.ticketHeaderLeft}>
              <FileText size={22} color="#fff" />
              <View>
                <Text style={styles.ticketHeaderTitle}>Order Ticket</Text>
                <Text style={styles.ticketHeaderSub}>{shop.name}</Text>
              </View>
            </View>
            <View style={styles.statusBadge2}>
              <Text style={styles.statusBadgeText2}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace(/_/g, ' ')}
              </Text>
            </View>
          </View>

          <View style={{ padding: 20 }}>
            {/* Shop info */}
            <View style={styles.shopSection}>
              <View style={[styles.shopLogoBox, { backgroundColor: `${P}12` }]}>
                <Store size={24} color={P} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shopName, { color: TX }]} numberOfLines={1}>{shop.name}</Text>
                {shop.address ? (
                  <View style={styles.shopInfoRow}>
                    <MapPin size={12} color={TX2} />
                    <Text style={[styles.shopInfoText, { color: TX2 }]} numberOfLines={2}>{shop.address}</Text>
                  </View>
                ) : null}
                <View style={styles.shopInfoRow}>
                  <Phone size={12} color={TX2} />
                  <Text style={[styles.shopInfoText, { color: TX2 }]}>{shop.contact_phone}</Text>
                </View>
              </View>
            </View>

            {/* Order details */}
            <Text style={[styles.sectionTitle, { color: TX2 }]}>ORDER DETAILS</Text>
            <View style={styles.detailGrid}>
              <View style={[styles.detailBox, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: BORDER }]}>
                <Text style={[styles.detailLabel, { color: TX3 }]}>ORDER ID</Text>
                <Text style={[styles.detailValue, { color: TX }]}>#{order.id.slice(0, 8).toUpperCase()}</Text>
              </View>
              <View style={[styles.detailBox, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: BORDER }]}>
                <Text style={[styles.detailLabel, { color: TX3 }]}>DATE</Text>
                <Text style={[styles.detailValue, { color: TX }]}>{formatDate(order.created_at)}</Text>
              </View>
              <View style={[styles.detailBox, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: BORDER }]}>
                <Text style={[styles.detailLabel, { color: TX3 }]}>CUSTOMER</Text>
                <Text style={[styles.detailValue, { color: TX }]}>{order.customer_name || 'N/A'}</Text>
              </View>
              <View style={[styles.detailBox, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: BORDER }]}>
                <Text style={[styles.detailLabel, { color: TX3 }]}>PHONE</Text>
                <Text style={[styles.detailValue, { color: TX }]}>{order.customer_phone || 'N/A'}</Text>
              </View>
            </View>

            {/* Delivery location */}
            {order.delivery_location ? (
              <>
                <Text style={[styles.sectionTitle, { color: TX2, marginTop: 16 }]}>DELIVERY LOCATION</Text>
                <View style={[styles.detailBox, { backgroundColor: isDark ? '#0d1828' : '#f8fafc', borderColor: BORDER }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MapPin size={14} color={P} />
                    <Text style={[styles.detailValue, { color: TX, flex: 1 }]}>{order.delivery_location}</Text>
                  </View>
                </View>
              </>
            ) : null}

            {/* EcoCash payment section */}
            {order.payment_method === 'ecocash' ? (
              <View style={[styles.ecocashBox, { backgroundColor: isDark ? 'rgba(255,167,38,0.08)' : '#fff8e1', borderColor: AMBER }]}>
                <View style={styles.ecocashHeader}>
                  <View style={[styles.ecocashIcon, { backgroundColor: `${AMBER}22` }]}>
                    <Smartphone size={18} color={AMBER} />
                  </View>
                  <View>
                    <Text style={[styles.ecocashTitle, { color: '#e65100' }]}>ECOCASH PAYMENT</Text>
                    <Text style={[styles.ecocashSub, { color: TX2 }]}>Send money to the shop's EcoCash number</Text>
                  </View>
                </View>
                <View style={[styles.ecocashNumberBox, { backgroundColor: isDark ? '#0a1828' : '#fff', borderColor: `${AMBER}55` }]}>
                  <Text style={[styles.ecocashNumberLabel, { color: TX3 }]}>SHOP ECOCASH NUMBER</Text>
                  <Text style={[styles.ecocashNumber, { color: '#e65100' }]}>{shop.ecocash_number || 'Not configured'}</Text>
                  {shop.ecocash_number ? (
                    <Text style={[styles.ecocashRef, { color: TX3 }]}>Reference: Order #{order.id.slice(0, 8).toUpperCase()}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Items */}
            <Text style={[styles.sectionTitle, { color: TX2, marginTop: 16 }]}>ITEMS</Text>
            <View style={[styles.itemsTable, { borderColor: BORDER }]}>
              <View style={[styles.itemsHeader, { borderBottomColor: BORDER, backgroundColor: isDark ? '#0d1828' : '#f8fafc' }]}>
                <Text style={[styles.itemsHeaderCell, { color: TX2, flex: 2 }]}>Product</Text>
                <Text style={[styles.itemsHeaderCell, { color: TX2, flex: 1, textAlign: 'center' }]}>Qty</Text>
                <Text style={[styles.itemsHeaderCell, { color: TX2, flex: 1, textAlign: 'right' }]}>Total</Text>
              </View>
              {items.map((item: any, i: number) => (
                <View key={i} style={[styles.itemRow, { borderBottomColor: BORDER }]}>
                  <Text style={[styles.itemCellName, { color: TX, flex: 2 }]}>{item.name || 'Item'}</Text>
                  <Text style={[styles.itemCellQty, { color: TX2, flex: 1, textAlign: 'center' }]}>{item.qty || 1}</Text>
                  <Text style={[styles.itemCellTotal, { color: TX, flex: 1, textAlign: 'right' }]}>${(Number(item.price || 0) * (item.qty || 1)).toFixed(2)}</Text>
                </View>
              ))}
            </View>

            {/* Summary */}
            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: TX2 }]}>Subtotal</Text>
                <Text style={[styles.summaryValue, { color: TX }]}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: TX2 }]}>Delivery Fee</Text>
                <Text style={[styles.summaryValue, { color: TX }]}>${Number(order.delivery_fee).toFixed(2)}</Text>
              </View>
              <View style={[styles.summaryTotalRow, { borderTopColor: BORDER }]}>
                <Text style={[styles.summaryTotalLabel, { color: TX }]}>Total</Text>
                <Text style={[styles.summaryTotalValue, { color: P }]}>${Number(order.total_amount).toFixed(2)}</Text>
              </View>
            </View>

            {/* Payment method */}
            <View style={[styles.paymentRow, { borderColor: BORDER }]}>
              <CreditCard size={16} color={order.payment_method === 'ecocash' ? AMBER : GREEN} />
              <Text style={[styles.paymentLabel, { color: TX2 }]}>Payment Method:</Text>
              <View style={[styles.paymentBadge, { backgroundColor: order.payment_method === 'ecocash' ? `${AMBER}22` : `${GREEN}22` }]}>
                <Text style={[styles.paymentBadgeText, { color: order.payment_method === 'ecocash' ? AMBER : GREEN }]}>
                  {order.payment_method === 'ecocash' ? 'EcoCash' : 'Cash on Delivery'}
                </Text>
              </View>
            </View>

            {/* Barcode */}
            <View style={[styles.barcodeBox, { backgroundColor: isDark ? '#0d1828' : '#f8fafc' }]}>
              <Text style={[styles.barcodeText, { color: TX }]}>{order.id.slice(0, 12).toUpperCase()}</Text>
              <Text style={[styles.barcodeLabel, { color: TX3 }]}>Show this code at the shop</Text>
            </View>

            {/* Shop location link */}
            {shop.latitude && shop.longitude ? (
              <TouchableOpacity
                style={[styles.mapsBtn, { backgroundColor: `${GREEN}15`, borderColor: `${GREEN}40` }]}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`, '_blank');
                  }
                }}
              >
                <MapPin size={16} color={GREEN} />
                <Text style={[styles.mapsBtnText, { color: GREEN }]}>View Shop Location on Google Maps</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Footer */}
          <View style={[styles.ticketFooter, { borderTopColor: BORDER }]}>
            <Text style={[styles.footerText, { color: TX3 }]}>
              UniLink Marketplace · Generated {formatDate(new Date().toISOString())}
            </Text>
            <Text style={[styles.footerSubText, { color: TX3 }]}>
              Present this ticket at the shop or to your messenger
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: P }]} onPress={downloadTicket} activeOpacity={0.85}>
            <Download size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: `${P}15`, borderColor: `${P}40`, borderWidth: 1 }]} onPress={printTicket} activeOpacity={0.85}>
            <FileText size={18} color={P} />
            <Text style={[styles.actionBtnText, { color: P }]}>Print</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: `${P}15`, borderColor: `${P}40`, borderWidth: 1 }]} onPress={shareTicket} activeOpacity={0.85}>
            <ShareIcon size={18} color={P} />
            <Text style={[styles.actionBtnText, { color: P }]}>Share</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 16 },
  ticketCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  ticketHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0066ff', paddingVertical: 18, paddingHorizontal: 20,
  },
  ticketHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ticketHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  ticketHeaderSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statusBadge2: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  statusBadgeText2: { fontSize: 11, fontWeight: '700', color: '#fff' },
  shopSection: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  shopLogoBox: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  shopName: { fontSize: 17, fontWeight: '800' },
  shopInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  shopInfoText: { fontSize: 12, flex: 1 },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailBox: { width: '48%', borderRadius: 10, padding: 12, borderWidth: 1 },
  detailLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  detailValue: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  ecocashBox: { borderRadius: 14, borderWidth: 1.5, padding: 16, marginTop: 16, borderStyle: 'dashed' as any },
  ecocashHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  ecocashIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  ecocashTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  ecocashSub: { fontSize: 11, marginTop: 2 },
  ecocashNumberBox: { borderRadius: 12, padding: 16, borderWidth: 1 },
  ecocashNumberLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  ecocashNumber: { fontSize: 24, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
  ecocashRef: { fontSize: 11, marginTop: 6 },
  itemsTable: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  itemsHeader: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  itemsHeaderCell: { fontSize: 11, fontWeight: '700' },
  itemRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 0.5, alignItems: 'center' },
  itemCellName: { fontSize: 13 },
  itemCellQty: { fontSize: 13 },
  itemCellTotal: { fontSize: 13, fontWeight: '600' },
  summarySection: { marginTop: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 6, borderTopWidth: 2 },
  summaryTotalLabel: { fontSize: 16, fontWeight: '800' },
  summaryTotalValue: { fontSize: 20, fontWeight: '800' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 0.5 },
  paymentLabel: { fontSize: 13, flex: 1 },
  paymentBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  paymentBadgeText: { fontSize: 12, fontWeight: '700' },
  barcodeBox: { alignItems: 'center', padding: 16, borderRadius: 10, marginTop: 16 },
  barcodeText: { fontSize: 22, fontWeight: '800', letterSpacing: 4, fontFamily: 'monospace' as any },
  barcodeLabel: { fontSize: 10, marginTop: 6 },
  mapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, marginTop: 14 },
  mapsBtnText: { fontSize: 13, fontWeight: '700' },
  ticketFooter: { paddingVertical: 14, paddingHorizontal: 20, borderTopWidth: 1, alignItems: 'center' },
  footerText: { fontSize: 11, textAlign: 'center' },
  footerSubText: { fontSize: 10, textAlign: 'center', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
});
