import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string;
          username: string;
          password_hash: string;
          created_at: string;
        };
      };
      customers: {
        Row: {
          id: string;
          username: string;
          phone_number: string;
          full_name: string;
          created_at: string;
          created_by_admin_id: string | null;
        };
      };
      drivers: {
        Row: {
          id: string;
          phone_number: string;
          full_name: string;
          current_key: string;
          key_expires_at: string;
          max_distance_km: number;
          fee_under_10: number;
          fee_10_to_30: number;
          fee_30_to_50: number;
          is_available: boolean;
          delivery_type: 'walking' | 'vehicle';
          created_at: string;
          created_by_admin_id: string | null;
        };
      };
      grocery_items: {
        Row: {
          id: string;
          name: string;
          price: number;
          is_available: boolean;
          created_at: string;
        };
      };
      deliveries: {
        Row: {
          id: string;
          customer_id: string;
          driver_id: string | null;
          items: any;
          total_amount: number;
          delivery_fee: number;
          payment_option: 'pay_on_delivery' | 'paynow';
          customer_latitude: number;
          customer_longitude: number;
          status: 'pending' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled';
          created_at: string;
          accepted_at: string | null;
          delivered_at: string | null;
        };
      };
    };
  };
};
