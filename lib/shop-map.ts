export type MapShop = {
  id: string; name: string; status: string;
  latitude: number; longitude: number;
  address: string | null; category: string | null;
  logo_url: string | null; description: string | null; is_available: boolean | null;
};
export type Coordinates = { latitude: number; longitude: number };

export function validShopCoordinates(latitude: unknown, longitude: unknown): boolean {
  if (latitude == null || longitude == null || latitude === '' || longitude === '') return false;
  if (typeof latitude !== 'number' && typeof latitude !== 'string') return false;
  if (typeof longitude !== 'number' && typeof longitude !== 'string') return false;
  if (typeof latitude === 'string' && !latitude.trim()) return false;
  if (typeof longitude === 'string' && !longitude.trim()) return false;
  const lat = Number(latitude), lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

export function normalizeMapShops(rows: unknown[]): MapShop[] {
  return rows.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    if (row.status !== 'active' || typeof row.id !== 'string' || typeof row.name !== 'string' || !validShopCoordinates(row.latitude, row.longitude)) return [];
    const str = (key: string) => typeof row[key] === 'string' ? row[key] as string : null;
    return [{ id: row.id, name: row.name, status: 'active', latitude: Number(row.latitude), longitude: Number(row.longitude), address: str('address'), category: str('category'), logo_url: str('logo_url'), description: str('description'), is_available: typeof row.is_available === 'boolean' ? row.is_available : null }];
  });
}

export function filterMapShops(shops: MapShop[], query: string, category: string | null): MapShop[] {
  const search = query.trim().toLowerCase();
  return shops.filter(shop => (!category || shop.category === category) && (!search || [shop.name, shop.address, shop.category].some(v => v?.toLowerCase().includes(search))));
}
