// Muster portiert aus apps/device/src/components/Settings.tsx (Stadtsuche für
// die manuelle Standort-Auswahl, Fallback wenn Geräte-Standort nicht möglich/
// gewünscht ist).
import { fetchJson } from '@/lib/fetchJson';

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: { country?: string; country_code?: string };
}

// Nominatims Nutzungsrichtlinie (https://operations.osmfoundation.org/policies/nominatim/)
// verlangt einen aussagekräftigen User-Agent ODER Referer, der die Anwendung
// identifiziert - ohne einen von beidem antwortet der Dienst mit HTTP 403
// "Access denied" (verifiziert per curl: Requests ganz ohne User-Agent bzw.
// mit generischem Test-UA werden abgelehnt, derselbe Request mit
// aussagekräftigem User-Agent liefert normale Treffer). React Natives
// fetch() auf Android/iOS setzt von sich aus KEINEN aussagekräftigen
// User-Agent (z. B. okhttp/…), das führte live im Emulator zu einer leeren
// Ergebnisliste ohne jede Fehlermeldung (Audit 2026-07-21, Bereich A:
// "Mehrere gespeicherte Orte" - Stadtsuche lieferte nie Treffer).
const NOMINATIM_USER_AGENT = 'SalatiBox/1.0 (+info@menucloud-berlin.de)';

export async function searchCity(query: string, signal?: AbortSignal): Promise<NominatimResult[]> {
  if (query.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(
    query,
  )}`;
  const j = await fetchJson<unknown>(url, {
    signal,
    headers: { 'Accept-Language': 'de', 'User-Agent': NOMINATIM_USER_AGENT },
    errorPrefix: 'nominatim_search',
  });
  return Array.isArray(j) ? j : [];
}

export interface NominatimLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
  label: string;
}

/**
 * Audit 2026-07-27 (O4): `parseFloat` lieferte bei einem nicht-numerischen
 * Feld `NaN`. Das landete ungeprüft in `settings.location` und damit in JEDER
 * Folgeberechnung — Gebetszeiten, Qibla, Hijri-Tage rechnen ab da still mit
 * NaN, ohne dass irgendwo ein Fehler sichtbar wird. Deshalb hier eine harte
 * Prüfung (`Number.isFinite` + Wertebereich) und `null` als Signal an die
 * Aufrufer, die daraufhin eine Meldung zeigen statt zu speichern.
 */
export function nominatimResultToLocation(r: NominatimResult): NominatimLocation | null {
  const lat = parseFloat(r.lat);
  const lon = parseFloat(r.lon);
  // Wertebereich mitprüfen: ein plausibel aussehender, aber unmöglicher Wert
  // (lat 999) wäre für die Sonnenstandsrechnung genauso kaputt wie NaN.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const addr = r.display_name.split(',');
  const city = (addr[0] ?? r.display_name).trim();
  const country = (r.address?.country_code || '').toUpperCase() || 'DE';
  return {
    city,
    country,
    lat,
    lon,
    label: `${city}${r.address?.country ? ', ' + r.address.country : ''}`,
  };
}
