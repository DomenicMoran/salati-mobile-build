// Live-Goldpreis für den Nisab-Vergleich (Audit 2026-07-20): eine religiöse
// Zakat-Pflicht-Aussage auf Basis eines fest einprogrammierten, veralteten
// Preises wäre eine echte fachliche Falschauskunft (nicht nur ein
// UX-Mangel). Quellen bewusst ohne API-Key/Anmeldung gewählt (Budget):
// - gold-api.com: Gold (XAU) in USD/Feinunze, kostenlos, CORS aktiv
// - frankfurter.app: EZB-Referenzkurse USD-><ZIELWÄHRUNG>, kostenlos, CORS aktiv
// Schlägt einer der beiden Aufrufe fehl (offline, Dienst down), liefert
// fetchLiveGoldPricePerGram() null - der Aufrufer fällt dann auf den
// zuletzt erfolgreich gecachten Live-Preis DERSELBEN Währung zurück, und
// erst wenn es NIE einen gab auf die statische Referenz aus calc.ts (siehe
// zakat.tsx). Mehrwährungs-Erweiterung 2026-07-21: jede Währung hat ihren
// eigenen Cache-Eintrag - ein Wechsel der Auswahl darf nie den zuletzt
// gecachten Preis einer ANDEREN Währung fälschlich anzeigen.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchJson } from '@/lib/fetchJson';

import type { ZakatCurrency } from './calc';

const TROY_OUNCE_GRAMS = 31.1034768;
const GOLD_API_URL = 'https://api.gold-api.com/price/XAU';
// frankfurter.app leitet mittlerweile dauerhaft (301) auf frankfurter.dev
// weiter - direkt die .dev-Domain aufrufen spart den Redirect-Hop.
const FX_API_BASE_URL = 'https://api.frankfurter.dev/v1/latest?from=USD&to=';

export interface GoldPrice {
  /** Goldpreis pro Gramm, in `currency`. */
  pricePerGram: number;
  /** Zeitpunkt (epoch ms), zu dem dieser Wert zuletzt erfolgreich live geholt wurde. */
  fetchedAt: number;
  currency: ZakatCurrency;
}

/**
 * Cache-Schlüssel je Währung. EUR behält bewusst den alten (vor-2026-07-21)
 * Schlüssel `salatibox:zakat-gold-price-eur` - Nutzer, die die App schon vor
 * der Mehrwährungs-Erweiterung hatten, sollen ihren gecachten Preis beim
 * Update nicht verlieren.
 */
function cacheKey(currency: ZakatCurrency): string {
  return currency === 'EUR'
    ? 'salatibox:zakat-gold-price-eur'
    : `salatibox:zakat-gold-price-${currency.toLowerCase()}`;
}

/** Wie `fetchJson`, aber JEDER Fehler (HTTP, Netz, Timeout, kaputtes JSON) wird
 * zu `null` — der Aufrufer faellt dann auf den Cache bzw. die statische
 * Referenz zurueck. Der Fehler selbst ist im lokalen Fehler-Log (errorLog.ts)
 * bereits protokolliert. */
async function holeJsonOderNull(url: string, errorPrefix: string): Promise<unknown | null> {
  return fetchJson<unknown>(url, { errorPrefix }).catch(() => null);
}

/** Holt den aktuellen Goldpreis in `currency`/Gramm live, oder `null` bei jedem Fehler. */
export async function fetchLiveGoldPricePerGram(currency: ZakatCurrency): Promise<number | null> {
  const [gold, fx] = await Promise.all([
    holeJsonOderNull(GOLD_API_URL, 'zakat_gold_price'),
    // USD braucht keinen FX-Aufruf - Kurs ist per Definition 1.
    currency === 'USD'
      ? Promise.resolve({ rates: { USD: 1 } })
      : holeJsonOderNull(`${FX_API_BASE_URL}${currency}`, 'zakat_fx_rate'),
  ]);
  const usdPerOz = (gold as { price?: unknown } | null)?.price;
  const usdToTarget = (fx as { rates?: Record<string, unknown> } | null)?.rates?.[currency];
  if (
    typeof usdPerOz !== 'number' ||
    typeof usdToTarget !== 'number' ||
    !(usdPerOz > 0) ||
    !(usdToTarget > 0)
  ) {
    return null;
  }
  return (usdPerOz / TROY_OUNCE_GRAMS) * usdToTarget;
}

export async function readCachedGoldPrice(currency: ZakatCurrency): Promise<GoldPrice | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(currency));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { pricePerGram?: unknown; eurPerGram?: unknown; fetchedAt?: unknown };
    // Legacy-Format (vor der Mehrwährungs-Erweiterung, nur für den alten
    // EUR-Schlüssel möglich) speicherte den Preis unter `eurPerGram`.
    const pricePerGram = typeof parsed.pricePerGram === 'number' ? parsed.pricePerGram : parsed.eurPerGram;
    if (typeof pricePerGram !== 'number' || !(pricePerGram > 0) || typeof parsed.fetchedAt !== 'number') {
      return null;
    }
    return { pricePerGram, fetchedAt: parsed.fetchedAt, currency };
  } catch {
    return null;
  }
}

async function writeCachedGoldPrice(currency: ZakatCurrency, price: GoldPrice): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(currency), JSON.stringify(price));
  } catch {
    // Speicher voll o.ä. — Cache ist best-effort, kein harter Fehler
  }
}

/**
 * Liefert den besten verfügbaren Goldpreis für `currency`: live falls
 * erreichbar (wird dann gecacht), sonst den zuletzt gecachten Live-Preis
 * DERSELBEN Währung, sonst `null` (für diese Währung noch nie erfolgreich
 * geholt — Aufrufer muss auf die statische Referenz zurückfallen).
 */
export async function getGoldPricePerGram(currency: ZakatCurrency): Promise<GoldPrice | null> {
  const live = await fetchLiveGoldPricePerGram(currency);
  if (live !== null) {
    const price: GoldPrice = { pricePerGram: live, fetchedAt: Date.now(), currency };
    await writeCachedGoldPrice(currency, price);
    return price;
  }
  return readCachedGoldPrice(currency);
}
