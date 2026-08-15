// Reise-Modus: Qasr-Hinweis (verkürztes Gebet) + Jam'-Hinweis (Gebete
// zusammenlegen), sobald der aktuell aktive Standort weit genug vom
// gespeicherten Heimatort entfernt ist. Schwelle (85 km) + Grundregel
// stammen aus docs/IDEEN-BACKLOG.md ("Gebet & Alltag") — bewusst nur die
// allgemein anerkannte Grundregel wiedergegeben, keine eigene Rechtsmeinung.

export interface Coordinates {
  lat: number;
  lon: number;
}

/** Reise-Schwelle in km, ab der der Qasr/Jam'-Hinweis eingeblendet wird. */
export const TRAVEL_DISTANCE_THRESHOLD_KM = 85;

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Großkreisdistanz zwischen zwei Koordinaten in km (Haversine-Formel). */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  // Math.min(1, …) fängt Float-Rundungsfehler ab, die h knapp über 1 treiben
  // könnten (asin wäre dann NaN) — passiert z.B. bei a === b.
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface TravelStatus {
  isTraveling: boolean;
  distanceKm: number;
}

/** `home === null` (noch kein Heimatort erfasst) => nie "auf Reisen". */
export function getTravelStatus(home: Coordinates | null, current: Coordinates): TravelStatus {
  if (!home) return { isTraveling: false, distanceKm: 0 };
  const d = distanceKm(home, current);
  return { isTraveling: d > TRAVEL_DISTANCE_THRESHOLD_KM, distanceKm: d };
}
