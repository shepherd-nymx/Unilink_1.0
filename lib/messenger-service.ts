import { supabase } from '@/lib/supabase';
import { MessengerOption, normalizeMessengerRows } from '@/lib/messenger-selection';

export async function fetchMessengersByDistance(
  shopId: string,
  customerLat: number,
  customerLng: number
): Promise<MessengerOption[]> {
  const { data, error } = await supabase.rpc('get_messengers_by_distance', {
    p_shop_id: shopId,
    p_customer_lat: customerLat,
    p_customer_lng: customerLng,
  });
  if (error) {
    throw new Error('Could not load messengers. Please try again.');
  }
  return normalizeMessengerRows(data);
}
