export type ShopStatus =
  | 'pending_approval'
  | 'payment_required'
  | 'payment_submitted'
  | 'active'
  | 'suspended'
  | 'rejected';

export type ShopOrder = {
  id: string;
  customer_id?: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  products: any[];
  total_amount: number;
  delivery_fee: number;
  ecocash_fee_amount: number;
  ecocash_pop: string | null;
  delivery_location: string | null;
  payment_method: string;
  status: string;
  messenger_id: string | null;
  created_at: string;
  confirmed_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  assigned_at?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
};

export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  stock: number;
  category: string | null;
  status: string;
  is_available?: boolean;
};

export type Driver = {
  id: string;
  full_name: string;
  phone_number: string;
  whatsapp_number?: string | null;
  approval_status: string;
  is_available: boolean;
  rating?: number | null;
  completed_deliveries?: number;
  vehicle_type?: string | null;
};

export type DaySchedule = { open: string; close: string; closed: boolean };
export type OperatingHours = Record<string, DaySchedule>;

export type ShopData = {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  address?: string | null;
  description?: string | null;
  hours?: string | null;
  ecocash_number?: string | null;
  status: string;
  rejection_reason?: string | null;
  payment_proof?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_available?: boolean;
  operating_hours?: OperatingHours | null;
  accepted_payment_methods?: string[];
  location_verified?: boolean;
  completed_orders_count?: number;
  average_rating?: number | null;
  total_ratings?: number | null;
  ecocash_fee?: number;
  delivery_fee?: number;
  whatsapp_number?: string | null;
  ecocash_name?: string | null;
  commission_deadline?: string | null;
};

export const STATUS_FLOW = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'assigned',
  'picked_up',
  'out_for_delivery',
  'delivered',
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  assigned: 'Messenger Assigned',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: '#ffaa00',
  confirmed: '#0066ff',
  preparing: '#0066ff',
  ready: '#00e5ff',
  assigned: '#00e5ff',
  picked_up: '#ff6b00',
  out_for_delivery: '#ff6b00',
  delivered: '#00ff88',
  cancelled: '#ff3366',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pay_on_delivery: 'Pay on Delivery',
  ecocash: 'EcoCash',
  paynow: 'PayNow',
  bank_transfer: 'Bank Transfer',
};

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
