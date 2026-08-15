// OpenStreetMap Overpass API (overpass-api.de) — Fair-Use 10.000 Queries/Tag +
// 1GB/Tag laut Betreiber-Policy, kein Key nötig, aber eigener User-Agent
// vorgeschrieben. Daten stehen unter ODbL — Attribution ist im UI Pflicht
// (siehe mosques.tsx). Cache über AsyncStorage vermeidet wiederholte Queries
// für dieselbe Region.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchJson } from '@/lib/fetchJson';

export { distanceKm } from './geo';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
// Overpass ist bei belasteten Servern regelmaessig 15-20 s langsam (die API
// stellt Anfragen in eine Warteschlange). Darum bewusst deutlich mehr als der
// 12-s-Default aus lib/fetchJson — sonst brechen echte Treffer ab.
const OVERPASS_TIMEOUT_MS = 30_000;
// Overpass-Nutzungsregeln verlangen einen User-Agent mit erreichbarer
// Kontakt-URL. Stand vorher salatibox.de — nicht registriert (DENIC:
// NXDOMAIN, geprüft 2026-07-27); ein toter Kontakt kann Sperren auslösen.
const USER_AGENT = 'SalatiboxApp/1.0 (+https://www.salati.pro)';
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // OSM-Daten ändern sich selten
// Audit 2026-07-27 (O2): `Mosque.id` ist seit diesem Stand `"node/123"` statt
// `123`. Alte Cache-Einträge tragen noch die nackte Zahl — mit ihnen findet
// der Routen-Knopf (`m.id === data.id`) nichts mehr und React bekäme wieder
// mehrdeutige Keys. Statt die Einträge stumm falsch zu lesen, steckt die
// Format-Version im Schlüssel: alte Einträge werden nie wieder getroffen und
// laufen über die TTL aus dem Speicher (kein Migrations-Code für Daten, die
// ohnehin in 3 Tagen neu geholt werden).
const CACHE_VERSION = 'v2';

export interface Mosque {
  /**
   * OSM-Identität als `"<typ>/<id>"` (z. B. `"node/240094030"`).
   * Die Abfrage liefert `node` UND `way`; OSM führt beide in GETRENNTEN
   * ID-Räumen, dieselbe Zahl kann also zweimal im selben Radius auftauchen.
   * Nur mit dem Typ davor ist der Wert eindeutig — er ist React-Key UND
   * Nachschlage-Schlüssel des Routen-Knopfs im Karten-Popup.
   */
  id: string;
  lat: number;
  lon: number;
  name: string;
  address?: string;
  openingHours?: string;
}

interface OverpassElement {
  id: number;
  /** Overpass liefert den Typ bei `out center` je Element mit. */
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function buildQuery(lat: number, lon: number, radiusMeters: number): string {
  return `[out:json][timeout:25];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${lat},${lon});
  way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${lat},${lon});
);
out center;`;
}

function toMosque(el: OverpassElement): Mosque | null {
  const point = el.lat != null && el.lon != null ? { lat: el.lat, lon: el.lon } : el.center;
  if (!point) return null;
  const tags = el.tags ?? {};
  const addressParts = [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(
    Boolean,
  );
  return {
    // Fehlt `type` (theoretisch, s. Overpass-Doku), bleibt "element" als
    // neutrales Präfix — das ist immer noch eindeutiger als die nackte Zahl.
    id: `${el.type || 'element'}/${el.id}`,
    lat: point.lat,
    lon: point.lon,
    name: tags.name || tags['name:en'] || 'Moschee',
    address: addressParts.length > 0 ? addressParts.join(' ') : undefined,
    openingHours: tags.opening_hours,
  };
}

function cacheKey(lat: number, lon: number, radiusMeters: number): string {
  return `salatibox:mosques:${CACHE_VERSION}:${lat.toFixed(2)}:${lon.toFixed(2)}:${radiusMeters}`;
}

function halalCacheKey(lat: number, lon: number, radiusMeters: number): string {
  return `salatibox:halal:${CACHE_VERSION}:${lat.toFixed(2)}:${lon.toFixed(2)}:${radiusMeters}`;
}

export interface HalalPlace extends Mosque {
  cuisine?: string;
}

function buildHalalQuery(lat: number, lon: number, radiusMeters: number): string {
  return `[out:json][timeout:25];
(
  node["amenity"~"restaurant|fast_food|cafe"]["diet:halal"~"yes|only"](around:${radiusMeters},${lat},${lon});
  way["amenity"~"restaurant|fast_food|cafe"]["diet:halal"~"yes|only"](around:${radiusMeters},${lat},${lon});
);
out center;`;
}

/** Halal-Restaurants/Imbisse via OSM (diet:halal=yes|only) — gleiche Cache-Logik. */
export async function fetchNearbyHalal(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<HalalPlace[]> {
  const key = halalCacheKey(lat, lon, radiusMeters);
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached) as { savedAt: number; places: HalalPlace[] };
      if (Date.now() - parsed.savedAt < CACHE_TTL_MS) return parsed.places;
    }
  } catch {
    // Cache-Lesefehler ignorieren
  }

  const data = await fetchJson<OverpassResponse>(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'User-Agent': USER_AGENT },
    body: buildHalalQuery(lat, lon, radiusMeters),
    errorPrefix: 'overpass',
    timeoutMs: OVERPASS_TIMEOUT_MS,
  });
  const places = data.elements
    .map((el) => {
      const base = toMosque(el);
      if (!base) return null;
      return { ...base, name: el.tags?.name || 'Halal', cuisine: el.tags?.cuisine } as HalalPlace;
    })
    .filter((p): p is HalalPlace => p !== null);

  try {
    await AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), places }));
  } catch {
    // best-effort
  }

  return places;
}

export async function fetchNearbyMosques(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<Mosque[]> {
  const key = cacheKey(lat, lon, radiusMeters);
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached) as { savedAt: number; mosques: Mosque[] };
      if (Date.now() - parsed.savedAt < CACHE_TTL_MS) return parsed.mosques;
    }
  } catch {
    // Cache-Lesefehler ignorieren, einfach neu laden
  }

  const data = await fetchJson<OverpassResponse>(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'User-Agent': USER_AGENT },
    body: buildQuery(lat, lon, radiusMeters),
    errorPrefix: 'overpass',
    timeoutMs: OVERPASS_TIMEOUT_MS,
  });
  const mosques = data.elements.map(toMosque).filter((m): m is Mosque => m !== null);

  try {
    await AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), mosques }));
  } catch {
    // Speicher voll o.ä. — Cache ist best-effort
  }

  return mosques;
}
