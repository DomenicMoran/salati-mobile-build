// 1:1 portiert aus apps/device/src/components/SalatiDashboard.tsx (qiblaBearing).
const MECCA_LAT = 21.4225;
const MECCA_LON = 39.8262;

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}
function toDeg(r: number): number {
  return (r * 180) / Math.PI;
}

/** Great-Circle-Bearing (0–360°) vom Standort (lat, lon) zur Kaaba. */
export function qiblaBearing(lat: number, lon: number): number {
  const phi1 = toRad(lat);
  const phi2 = toRad(MECCA_LAT);
  const dLon = toRad(MECCA_LON - lon);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Mittlerer Erdradius (km), Standardwert für Haversine-Distanzen.
const EARTH_RADIUS_KM = 6371;

/** Great-Circle-Distanz (Haversine, in km) vom Standort (lat, lon) zur Kaaba. */
export function distanceToMeccaKm(lat: number, lon: number): number {
  const phi1 = toRad(lat);
  const phi2 = toRad(MECCA_LAT);
  const dPhi = toRad(MECCA_LAT - lat);
  const dLambda = toRad(MECCA_LON - lon);
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
