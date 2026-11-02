export type MessengerOption = {
  id: string;
  fullName: string;
  profilePictureUrl: string | null;
  averageRating: number;
  vehicleType: string | null;
  distanceKm: number;
};

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function normalizeMessengerRows(rows: unknown): MessengerOption[] {
  if (!Array.isArray(rows)) {
    throw new Error('Unexpected response while loading messengers.');
  }

  const options: MessengerOption[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const record = row as Record<string, unknown>;

    const id = toText(record.id);
    const fullName = toText(record.full_name);
    const distanceKm = toFiniteNumber(record.distance_km);
    if (!id || !fullName || distanceKm === null || distanceKm < 0) continue;

    options.push({
      id,
      fullName,
      profilePictureUrl: toText(record.profile_picture_url),
      averageRating: toFiniteNumber(record.average_rating) ?? 0,
      vehicleType: toText(record.vehicle_type),
      distanceKm,
    });
  }

  return options.sort(
    (a, b) => a.distanceKm - b.distanceKm || a.fullName.localeCompare(b.fullName)
  );
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1000))} m away`;
  return `${distanceKm.toFixed(1)} km away`;
}
