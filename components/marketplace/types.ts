export type Shop = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  address: string | null;
  hours: string | null;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  is_available: boolean;
  operating_hours: Record<string, any> | null;
  accepted_payment_methods: string[] | null;
  location_verified: boolean | null;
  completed_orders_count: number | null;
};

export type Product = {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  stock: number;
  category: string | null;
  status: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type CartByShop = {
  shopId: string;
  shopName: string;
  items: CartItem[];
  total: number;
};

export type Driver = {
  id: string;
  full_name: string;
  phone_number: string;
  whatsapp_number?: string | null;
  rating?: number | null;
  vehicle_type?: string | null;
  completed_deliveries?: number | null;
};

export type ThemePalette = {
  bg: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  inputBg: string;
  inputBorder: string;
  placeholderColor: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function computeShopOpen(shop: Shop): boolean {
  if (!shop.is_available) return false;
  const oh = shop.operating_hours;
  if (!oh || typeof oh !== 'object') return true;
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const dayEntry = (oh as any)[dayName] ?? (oh as any)[String(now.getDay())];
  if (dayEntry == null) return true;
  if (dayEntry === false || (typeof dayEntry === 'object' && dayEntry.closed === true)) return false;
  const openStr = typeof dayEntry === 'string' ? dayEntry : dayEntry.open;
  const closeStr = typeof dayEntry === 'string' ? null : dayEntry.close;
  if (!openStr) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  const parse = (s: string): number => {
    const parts = s.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };
  const openMin = parse(openStr);
  const closeMin = closeStr ? parse(closeStr) : 24 * 60 - 1;
  if (closeMin <= openMin) return cur >= openMin;
  return cur >= openMin && cur < closeMin;
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function formatOperatingHours(oh: Record<string, any> | null): { day: string; label: string }[] {
  if (!oh || typeof oh !== 'object') return [];
  const rows: { day: string; label: string }[] = [];
  for (const day of DAY_ORDER) {
    const entry = (oh as any)[day];
    if (entry == null) continue;
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    if (entry === false || (typeof entry === 'object' && entry.closed === true)) {
      rows.push({ day: dayLabel, label: 'Closed' });
      continue;
    }
    if (typeof entry === 'string') {
      rows.push({ day: dayLabel, label: entry });
      continue;
    }
    const o = entry.open;
    const c = entry.close;
    if (o && c) rows.push({ day: dayLabel, label: `${o} - ${c}` });
    else if (o) rows.push({ day: dayLabel, label: `From ${o}` });
  }
  return rows;
}

export function formatPaymentMethod(method: string): string {
  switch (method) {
    case 'pay_on_delivery': return 'Pay on Delivery';
    case 'ecocash': return 'EcoCash';
    case 'paynow': return 'PayNow';
    case 'card': return 'Card';
    case 'bank_transfer': return 'Bank Transfer';
    case 'cash': return 'Cash';
    default:
      return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function getAcceptedMethods(shop: Shop): string[] {
  return shop.accepted_payment_methods && shop.accepted_payment_methods.length > 0
    ? shop.accepted_payment_methods
    : ['pay_on_delivery', 'ecocash'];
}
