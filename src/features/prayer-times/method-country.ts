// Welche Behörde für welches Land? — die Vorauswahl der Berechnungsmethode.
//
// WARUM ÜBERHAUPT: Die Methode ist der einzige Schalter, der die Zeiten um
// mehr als ein paar Minuten verschiebt (in Berlin im Sommer über eine Stunde),
// und ausgerechnet er stand bisher ohne Bezug zum Standort da. Wer die App in
// Marokko öffnet, soll nicht raten müssen, welcher der 23 Einträge die
// marokkanische ist — er soll die richtige vorgeschlagen bekommen und sie
// ändern können.
//
// GRUNDLAGE ist ausschließlich das Feld `countries` im Behörden-Katalog
// (features/settings/methods.ts) — es gibt keine zweite Länderliste, die
// stillschweigend davon abweichen könnte. Ein Test stellt sicher, dass kein
// Land zwei Methoden beansprucht.

import { DEFAULT_METHOD_ID, PRAYER_METHODS, methodById, type PrayerMethod } from '@/features/settings/methods';

/** Weltweit gebräuchliche Methode für Länder ohne eigene Zuordnung. */
export const WELTWEITE_METHODE = 3; // Muslim World League

/**
 * Woher der Vorschlag kommt — der Info-Text im UI sagt das dem Nutzer, damit
 * ein Vorschlag nicht wie eine Feststellung wirkt.
 */
export type MethodBasis =
  /** Für dieses Land ist eine Behörde hinterlegt. */
  | 'country'
  /** Land bekannt, aber ohne eigene Zuordnung → Muslim World League. */
  | 'worldwide'
  /** Kein Land bekannt (kein Standort gesetzt) → App-Voreinstellung. */
  | 'default';

export interface MethodRecommendation {
  methodId: number;
  basis: MethodBasis;
}

/** ISO-3166-alpha-2 → Methoden-ID, aufgebaut aus dem Katalog. */
const NACH_LAND: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (const m of PRAYER_METHODS) {
    for (const land of m.countries) {
      // Erster Eintrag gewinnt; der Doppelbelegungs-Test schlägt ohnehin an,
      // bevor so etwas ausgeliefert wird.
      if (!map.has(land)) map.set(land, m.id);
    }
  }
  return map;
})();

/** Nur für Tests/Diagnose: alle zugeordneten Länder. */
export function zugeordneteLaender(): string[] {
  return [...NACH_LAND.keys()].sort();
}

/**
 * Vorschlag für einen Ländercode (Groß-/Kleinschreibung egal). Gibt IMMER eine
 * gültige Methoden-ID zurück — ein Vorschlag, der ins Leere zeigt, wäre
 * schlimmer als gar keiner.
 */
export function recommendMethod(country?: string | null): MethodRecommendation {
  const code = (country ?? '').trim().toUpperCase();
  if (!code) return { methodId: DEFAULT_METHOD_ID, basis: 'default' };
  const id = NACH_LAND.get(code);
  if (id !== undefined) return { methodId: id, basis: 'country' };
  return { methodId: WELTWEITE_METHODE, basis: 'worldwide' };
}

/** Bequemlichkeit für Screens: der vorgeschlagene Katalog-Eintrag selbst. */
export function recommendedMethod(country?: string | null): PrayerMethod | undefined {
  return methodById(recommendMethod(country).methodId);
}

/**
 * true, wenn die eingestellte Methode NICHT die des aktuellen Landes ist.
 * Grundlage für den Hinweis „In {Land} rechnet man üblicherweise nach {X}" —
 * bewusst nur ein Hinweis mit Ein-Tipp-Übernahme, kein automatisches Umstellen:
 * wer bewusst der Methode seiner Heimat oder seiner Moschee folgt, darf sie
 * nicht durch einen Ortswechsel verlieren.
 */
export function methodDiffersFromCountry(method: number, country?: string | null): boolean {
  const empfehlung = recommendMethod(country);
  return empfehlung.basis === 'country' && empfehlung.methodId !== method;
}
