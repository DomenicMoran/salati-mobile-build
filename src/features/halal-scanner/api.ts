// Open Food Facts API — kostenlos, kein Auth/Key nötig. Fair-Use: eigener
// User-Agent vorgeschrieben (siehe https://wiki.openfoodfacts.org/API), analog
// zum User-Agent-Muster in features/mosques/overpass.ts. Zod validiert nur die
// für die Halal-Klassifikation relevanten Felder — der Rest der Antwort (viele
// hundert Felder) wird ignoriert statt geprüft (.passthrough()).

import { z } from 'zod';

import { fetchWithTimeout } from '@/lib/fetchJson';
import type { Locale } from '@/lib/i18n';

const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
// Open Food Facts verlangt einen User-Agent mit ERREICHBARER Kontakt-URL.
// Stand vorher salatibox.de — diese Domain ist nicht registriert (DENIC:
// NXDOMAIN, geprüft 2026-07-27), die Kontaktangabe lief also ins Leere.
const USER_AGENT = 'SalatiboxApp/1.0 (+https://www.salati.pro)';

const OpenFoodFactsProductSchema = z
  .object({
    product_name: z.string().optional(),
    product_name_en: z.string().optional(),
    ingredients_text: z.string().optional(),
    ingredients_text_de: z.string().optional(),
    ingredients_text_en: z.string().optional(),
    ingredients_text_tr: z.string().optional(),
    ingredients_text_ar: z.string().optional(),
    ingredients_text_es: z.string().optional(),
    ingredients_text_fr: z.string().optional(),
    ingredients_text_id: z.string().optional(),
    ingredients_text_bn: z.string().optional(),
    ingredients_text_fa: z.string().optional(),
    ingredients_text_ms: z.string().optional(),
    ingredients_text_ur: z.string().optional(),
    ingredients_text_sw: z.string().optional(),
    ingredients_text_ru: z.string().optional(),
    ingredients_text_ps: z.string().optional(),
  })
  .passthrough();

const OpenFoodFactsResponseSchema = z
  .object({
    status: z.number().optional(),
    product: OpenFoodFactsProductSchema.optional(),
  })
  .passthrough();

export type OpenFoodFactsProduct = z.infer<typeof OpenFoodFactsProductSchema>;

export interface ScannedProduct {
  barcode: string;
  name: string | null;
  ingredientsText: string | null;
  /** Sprache, aus der ingredientsText stammt, oder 'unknown' bei generischem Feld. */
  ingredientsLang: Locale | 'unknown' | null;
}

// Phase-1-Sprachen (#60: id/bn/fa/ms/ur/sw/ru/ps) werden pro Sprach-Commit
// hier ergänzt, sobald `Locale` (locale-detect.ts) den Code aufnimmt — die
// Zod-Felder oben sind schon vorbereitet.
const INGREDIENTS_FIELD_BY_LOCALE: Record<Locale, keyof OpenFoodFactsProduct> = {
  de: 'ingredients_text_de',
  en: 'ingredients_text_en',
  tr: 'ingredients_text_tr',
  ar: 'ingredients_text_ar',
  es: 'ingredients_text_es',
  fr: 'ingredients_text_fr',
  id: 'ingredients_text_id',
  bn: 'ingredients_text_bn',
  fa: 'ingredients_text_fa',
  ms: 'ingredients_text_ms',
  ur: 'ingredients_text_ur',
  ru: 'ingredients_text_ru',
  sw: 'ingredients_text_sw',
  ps: 'ingredients_text_ps',
};

const FALLBACK_LOCALE_ORDER: Locale[] = [
  'en',
  'de',
  'tr',
  'ar',
  'es',
  'fr',
  'id',
  'bn',
  'fa',
  'ms',
  'ur',
  'ru',
  'sw',
  'ps',
];

/**
 * Wählt den besten verfügbaren Zutatentext: bevorzugte Sprache zuerst, dann
 * die übrigen 5 App-Sprachen, zuletzt das sprachlose Generic-Feld. Open Food
 * Facts befüllt je nach Produkt nur eine Teilmenge der Sprachfelder.
 */
export function pickIngredientsText(
  product: OpenFoodFactsProduct,
  preferredLocale: Locale,
): { text: string; lang: Locale | 'unknown' } | null {
  const localeOrder = [preferredLocale, ...FALLBACK_LOCALE_ORDER.filter((l) => l !== preferredLocale)];

  for (const locale of localeOrder) {
    const value = product[INGREDIENTS_FIELD_BY_LOCALE[locale]];
    if (typeof value === 'string' && value.trim().length > 0) {
      return { text: value.trim(), lang: locale };
    }
  }

  if (typeof product.ingredients_text === 'string' && product.ingredients_text.trim().length > 0) {
    return { text: product.ingredients_text.trim(), lang: 'unknown' };
  }

  return null;
}

/**
 * Lädt Produktdaten per Barcode von Open Food Facts. Gibt `null` zurück, wenn
 * das Produkt nicht gefunden wurde (status !== 1) oder die Antwort nicht dem
 * erwarteten Schema entspricht — wirft nur bei echten Netzwerk-/HTTP-Fehlern.
 */
export async function fetchProductByBarcode(
  barcode: string,
  preferredLocale: Locale,
): Promise<ScannedProduct | null> {
  const r = await fetchWithTimeout(`${BASE_URL}/${encodeURIComponent(barcode)}.json`, {
    headers: { 'User-Agent': USER_AGENT },
    errorPrefix: 'off',
  });
  // Open Food Facts antwortet für einen bekannten, aber nicht existierenden
  // Barcode mit HTTP 404 (verifiziert live), für einen formal ungültigen Code
  // dagegen mit HTTP 200 - in BEIDEN Fällen trägt der JSON-Body {"status":0}.
  // Nur bei anderen Fehlercodes (5xx etc.) ist es ein echter API-Fehler.
  if (!r.ok && r.status !== 404) throw new Error(`off_${r.status}`);

  const json: unknown = await r.json();
  const parsed = OpenFoodFactsResponseSchema.safeParse(json);
  if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) return null;

  const product = parsed.data.product;
  const ingredients = pickIngredientsText(product, preferredLocale);

  return {
    barcode,
    name: product.product_name?.trim() || product.product_name_en?.trim() || null,
    ingredientsText: ingredients?.text ?? null,
    ingredientsLang: ingredients?.lang ?? null,
  };
}
