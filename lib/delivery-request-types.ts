export type ServiceType = 'buy_and_deliver' | 'pickup_and_deliver';
export type RequestStatus = 'pending' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled' | 'expired';
export type PaymentMethod = 'pay_on_delivery' | 'ecocash' | 'paynow';
export type DeliveryMethod = 'vehicle' | 'walking';
export type DeliveryMode = 'direct' | 'open_request';

export interface GpsCoords {
  lat: number;
  lng: number;
  address: string;
}

export interface Driver {
  id: string;
  full_name: string;
  phone_number: string;
  delivery_type: string[];
  payment_methods: string[];
  is_available: boolean;
  location: string;
  fee_up_to_10: number;
  fee_up_to_20: number;
  fee_up_to_30: number;
  fee_up_to_40: number;
  fee_up_to_50: number;
  fee_up_to_100: number;
  fee_up_to_200: number;
  fee_up_to_300: number;
  fee_up_to_400: number;
  fee_up_to_500: number;
  average_rating: number;
  total_ratings: number;
  ecocash_code?: string;
  profile_picture_url?: string;
  availability_start_time?: string;
  availability_end_time?: string;
  availability_days?: string[];
}

export interface BuyAndDeliverForm {
  itemName: string;
  quantity: number;
  shopName: string;
  shopLocation: string;
  budgetEstimate: string;
  destination: GpsCoords | null;
  instructions: string;
}

export interface PickupAndDeliverForm {
  pickup: GpsCoords | null;
  pickupContactName: string;
  pickupContactPhone: string;
  pickupLandmark: string;
  pickupNotes: string;
  destination: GpsCoords | null;
  receiverName: string;
  receiverPhone: string;
  destinationNotes: string;
}

export interface DeliveryRequestRow {
  id: string;
  customer_id: string;
  driver_id: string | null;
  service_type: ServiceType;
  status: RequestStatus;
  payment_method: PaymentMethod;
  delivery_method: DeliveryMethod;
  delivery_mode: DeliveryMode;
  offer_fee: number | null;
  notes: string;
  estimated_distance_km: number | null;
  estimated_duration_mins: number | null;
  delivery_fee: number | null;
  expires_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  delivery_request_buy_details?: BuyDetailsRow[];
  delivery_request_pickup_details?: PickupDetailsRow[];
  customers?: { full_name: string; phone_number: string };
  drivers?: { full_name: string; phone_number: string; ecocash_code?: string };
}

export interface BuyDetailsRow {
  id: string;
  request_id: string;
  item_name: string;
  quantity: number;
  shop_name: string;
  shop_location: string;
  budget_estimate: number;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  instructions: string;
}

export interface PickupDetailsRow {
  id: string;
  request_id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  pickup_landmark: string;
  pickup_notes: string;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  receiver_name: string;
  receiver_phone: string;
  destination_notes: string;
}
