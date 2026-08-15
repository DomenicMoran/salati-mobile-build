// Zakat-Rechner: 2,5 % auf zakatpflichtiges Vermögen oberhalb des Nisab.
// Nisab = Gegenwert von 85 g Gold (alternativ 595 g Silber) — der aktuelle
// Grammpreis wird vom Nutzer eingegeben (bewusst offline, keine Kurs-API).

export const ZAKAT_RATE = 0.025;
export const NISAB_GOLD_GRAMS = 85;
export const NISAB_SILVER_GRAMS = 595;

/**
 * Unterstützte Währungen für den Zakat-Rechner (Mehrwährungs-Erweiterung
 * 2026-07-21): EUR bleibt Default, dazu die 5 Währungen, die sowohl in den
 * EZB-Referenzkursen (frankfurter.app/.dev, Datenquelle für price.ts) als
 * auch bei den typischen Ländern der 14 App-Sprachen am meisten Sinn
 * ergeben (USD als globale Leitwährung, GBP fürs Englische, TRY fürs
 * Türkische, IDR fürs Indonesische, MYR fürs Malaiische). Andere naheliegende
 * Landeswährungen (z. B. PKR, BDT, AFN, KES, SAR) fehlen bewusst - sie sind
 * NICHT Teil der EZB-Referenzkurse und damit über frankfurter.app nicht ohne
 * eigenen (kostenpflichtigen) FX-Anbieter live abrufbar.
 */
export const ZAKAT_CURRENCIES = ['EUR', 'USD', 'GBP', 'TRY', 'IDR', 'MYR'] as const;
export type ZakatCurrency = (typeof ZAKAT_CURRENCIES)[number];

/**
 * Grobe Referenzwerte für den Gold-Grammpreis je Währung (Audit 2026-07-19
 * D6, erweitert 2026-07-21 auf alle ZAKAT_CURRENCIES): Default 0 ließ den
 * Rechner irreführend mit "keine Zakat fällig" starten. Bewusst KEIN
 * verpflichtender Live-Kurs (App bleibt offline-first) - der Wert wird in
 * der UI ausdrücklich als "bitte aktuellen Kurs prüfen" angeboten, nicht
 * still eingesetzt. Werte aus Goldpreis (gold-api.com, ~4075 USD/oz) x
 * EZB-Referenzkurs (frankfurter.app), Stand: Juli 2026.
 */
export const REFERENCE_GOLD_PRICE_PER_GRAM: Record<ZakatCurrency, number> = {
  EUR: 115,
  USD: 131,
  GBP: 97,
  TRY: 6180,
  IDR: 2_350_000,
  MYR: 536,
};

export interface ZakatInput {
  cash: number;
  goldValue: number;
  silverValue: number;
  businessAssets: number;
  debts: number;
  /** Preis pro Gramm Gold in Landeswährung */
  goldPricePerGram: number;
}

export interface ZakatResult {
  base: number;
  nisab: number;
  aboveNisab: boolean;
  /**
   * true, wenn goldPricePerGram (noch) nicht gesetzt ist. In diesem Fall ist
   * `aboveNisab: false` KEINE fachliche Aussage ("unter dem Nisab"), sondern
   * bedeutet nur "nicht berechenbar" — die UI muss das unterscheiden (Audit
   * 2026-07-20: sonst zeigt der Rechner fälschlich "keine Zakat fällig" für
   * jeden Nutzer, der das Preisfeld leer lässt, unabhängig vom Vermögen).
   */
  priceMissing: boolean;
  due: number;
}

export function calcZakat(input: ZakatInput): ZakatResult {
  const base = Math.max(
    0,
    input.cash + input.goldValue + input.silverValue + input.businessAssets - input.debts,
  );
  const priceMissing = !(input.goldPricePerGram > 0);
  const nisab = NISAB_GOLD_GRAMS * Math.max(0, input.goldPricePerGram);
  const aboveNisab = !priceMissing && base >= nisab;
  return { base, nisab, aboveNisab, priceMissing, due: aboveNisab ? base * ZAKAT_RATE : 0 };
}

/** Tolerantes Zahlen-Parsing für Eingabefelder ("1.234,56" / "1234.56" / ""). */
export function parseAmount(text: string): number {
  const normalized = text.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
