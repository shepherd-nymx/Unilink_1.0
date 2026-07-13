export function parseDMS(coordString: string): { latitude: number; longitude: number } | null {
  const trimmed = coordString.trim();

  const decimalPattern = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;
  const decimalMatch = trimmed.match(decimalPattern);

  if (decimalMatch) {
    const latitude = parseFloat(decimalMatch[1]);
    const longitude = parseFloat(decimalMatch[2]);

    if (isNaN(latitude) || isNaN(longitude)) {
      return null;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }

    return { latitude, longitude };
  }

  const dmsPattern =
    /(\d+)°(\d+)'([\d.]+)"([NS])\s+(\d+)°(\d+)'([\d.]+)"([EW])/i;
  const dmsMatch = trimmed.match(dmsPattern);

  if (!dmsMatch) {
    return null;
  }

  const latDeg = parseInt(dmsMatch[1]);
  const latMin = parseInt(dmsMatch[2]);
  const latSec = parseFloat(dmsMatch[3]);
  const latDir = dmsMatch[4].toUpperCase();

  const lonDeg = parseInt(dmsMatch[5]);
  const lonMin = parseInt(dmsMatch[6]);
  const lonSec = parseFloat(dmsMatch[7]);
  const lonDir = dmsMatch[8].toUpperCase();

  let latitude = latDeg + latMin / 60 + latSec / 3600;
  if (latDir === 'S') {
    latitude = -latitude;
  }

  let longitude = lonDeg + lonMin / 60 + lonSec / 3600;
  if (lonDir === 'W') {
    longitude = -longitude;
  }

  return { latitude, longitude };
}

export function toDMS(latitude: number, longitude: number): string {
  const latAbs = Math.abs(latitude);
  const latDeg = Math.floor(latAbs);
  const latMin = Math.floor((latAbs - latDeg) * 60);
  const latSec = ((latAbs - latDeg - latMin / 60) * 3600).toFixed(1);
  const latDir = latitude >= 0 ? 'N' : 'S';

  const lonAbs = Math.abs(longitude);
  const lonDeg = Math.floor(lonAbs);
  const lonMin = Math.floor((lonAbs - lonDeg) * 60);
  const lonSec = ((lonAbs - lonDeg - lonMin / 60) * 3600).toFixed(1);
  const lonDir = longitude >= 0 ? 'E' : 'W';

  return `${latDeg}°${latMin}'${latSec}"${latDir} ${lonDeg}°${lonMin}'${lonSec}"${lonDir}`;
}

export function toDecimal(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export function toGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
