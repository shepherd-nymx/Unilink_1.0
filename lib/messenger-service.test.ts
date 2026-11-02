import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { fetchMessengersByDistance } from './messenger-service';

describe('fetchMessengersByDistance', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('calls the distance RPC with the shop and customer coordinates only', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await fetchMessengersByDistance('shop-1', -17.82, 31.05);

    expect(rpc).toHaveBeenCalledWith('get_messengers_by_distance', {
      p_shop_id: 'shop-1',
      p_customer_lat: -17.82,
      p_customer_lng: 31.05,
    });
  });

  it('returns messengers sorted nearest first', async () => {
    rpc.mockResolvedValue({
      data: [
        { id: 'far', full_name: 'Far', profile_picture_url: null, average_rating: 4, vehicle_type: 'car', distance_km: '5.00' },
        { id: 'near', full_name: 'Near', profile_picture_url: null, average_rating: 5, vehicle_type: 'bike', distance_km: '0.60' },
      ],
      error: null,
    });

    const result = await fetchMessengersByDistance('shop-1', -17.82, 31.05);

    expect(result.map(m => m.id)).toEqual(['near', 'far']);
  });

  it('throws a readable error when the request fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    await expect(fetchMessengersByDistance('shop-1', -17.82, 31.05)).rejects.toThrow(
      'Could not load messengers. Please try again.'
    );
  });

  it('throws when the response has an unexpected shape', async () => {
    rpc.mockResolvedValue({ data: { unexpected: true }, error: null });

    await expect(fetchMessengersByDistance('shop-1', -17.82, 31.05)).rejects.toThrow();
  });
});
