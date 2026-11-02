import { describe, expect, it } from 'vitest';
import { formatDistance, normalizeMessengerRows } from './messenger-selection';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'driver-1',
  full_name: 'Alice',
  profile_picture_url: null,
  average_rating: 4.5,
  vehicle_type: 'bike',
  distance_km: 1.5,
  ...overrides,
});

describe('normalizeMessengerRows ordering', () => {
  it('sorts messengers nearest first', () => {
    const result = normalizeMessengerRows([
      row({ id: 'far', full_name: 'Far', distance_km: 4.2 }),
      row({ id: 'near', full_name: 'Near', distance_km: 0.8 }),
      row({ id: 'mid', full_name: 'Mid', distance_km: 2.1 }),
    ]);
    expect(result.map(m => m.id)).toEqual(['near', 'mid', 'far']);
  });

  it('breaks distance ties by name', () => {
    const result = normalizeMessengerRows([
      row({ id: 'b', full_name: 'Bongani', distance_km: 1 }),
      row({ id: 'a', full_name: 'Amanda', distance_km: 1 }),
    ]);
    expect(result.map(m => m.fullName)).toEqual(['Amanda', 'Bongani']);
  });

  it('accepts numeric strings for distance returned by the database numeric type', () => {
    const result = normalizeMessengerRows([
      row({ id: 'b', distance_km: '3.40' }),
      row({ id: 'a', distance_km: '0.25' }),
    ]);
    expect(result.map(m => m.id)).toEqual(['a', 'b']);
    expect(result[0].distanceKm).toBe(0.25);
  });
});

describe('normalizeMessengerRows missing location', () => {
  it('drops messengers whose distance is null', () => {
    const result = normalizeMessengerRows([
      row({ id: 'ok', distance_km: 2 }),
      row({ id: 'no-location', distance_km: null }),
    ]);
    expect(result.map(m => m.id)).toEqual(['ok']);
  });

  it('drops messengers whose distance is not a usable number', () => {
    const result = normalizeMessengerRows([
      row({ id: 'blank', distance_km: '' }),
      row({ id: 'text', distance_km: 'unknown' }),
      row({ id: 'nan', distance_km: NaN }),
      row({ id: 'negative', distance_km: -1 }),
      row({ id: 'ok', distance_km: 0.5 }),
    ]);
    expect(result.map(m => m.id)).toEqual(['ok']);
  });

  it('drops rows missing an id or name', () => {
    const result = normalizeMessengerRows([
      row({ id: null }),
      row({ full_name: '' }),
      row({ id: 'ok' }),
    ]);
    expect(result.map(m => m.id)).toEqual(['ok']);
  });

  it('keeps messengers without a rating or photo and defaults rating to 0', () => {
    const [messenger] = normalizeMessengerRows([
      row({ average_rating: null, profile_picture_url: '', vehicle_type: null }),
    ]);
    expect(messenger.averageRating).toBe(0);
    expect(messenger.profilePictureUrl).toBeNull();
    expect(messenger.vehicleType).toBeNull();
  });

  it('returns an empty list when no messengers are eligible', () => {
    expect(normalizeMessengerRows([])).toEqual([]);
  });
});

describe('normalizeMessengerRows response shape', () => {
  it('throws when the response is not a list', () => {
    expect(() => normalizeMessengerRows(null)).toThrow();
    expect(() => normalizeMessengerRows({ id: 'x' })).toThrow();
  });

  it('exposes only the fields needed for display and distance', () => {
    const [messenger] = normalizeMessengerRows([row({ home_latitude: -17.8, home_longitude: 31.0 })]);
    expect(Object.keys(messenger).sort()).toEqual(
      ['averageRating', 'distanceKm', 'fullName', 'id', 'profilePictureUrl', 'vehicleType'].sort()
    );
  });
});

describe('formatDistance', () => {
  it('shows metres under one kilometre', () => {
    expect(formatDistance(0.42)).toBe('420 m away');
    expect(formatDistance(0.001)).toBe('1 m away');
  });

  it('shows one decimal place from one kilometre up', () => {
    expect(formatDistance(2.345)).toBe('2.3 km away');
  });
});
