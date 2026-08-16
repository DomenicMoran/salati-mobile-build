// Herausforderungen: kuratierte Ziele in sechs Bereichen, jeweils in vier
// Stufen.
//
// WARUM VORLAGE × STUFE statt einer flachen Liste von hundert Einträgen:
// jede Herausforderung braucht einen Text in 14 Sprachen. Bei hundert
// einzelnen Texten wären das 1400 Übersetzungen, die niemand pflegen kann —
// und die erste vergessene Sprache fällt still auf Deutsch zurück (genau der
// Befund aus dem Audit 2026-07-27 bei den Benachrichtigungen). Mit Vorlagen
// sind es 28 Sätze mit einem Platzhalter `{n}`; die Stufen entstehen daraus
// rechnerisch. Der Nutzer sieht trotzdem 112 einzelne Herausforderungen.
//
// GRUNDSATZ FÜR DIE QUELLEN: eine Herausforderung zählt entweder aus Daten,
// die die App ohnehin führt (Gebets-Tracker, Fasten, Dhikr, Lernen, Koran,
// Hifz), oder sie wird vom Nutzer selbst hochgezählt. Nichts wird geschätzt
// und nichts doppelt gezählt — was die App nicht wirklich weiß, hakt der
// Nutzer ab. Alles Weitere steht in fortschritt.ts.

import type { IconName } from '@/components/ui/icon-symbol';

export const KATEGORIEN = ['gebet', 'quran', 'fasten', 'dhikr', 'wissen', 'charakter'] as const;
export type Kategorie = (typeof KATEGORIEN)[number];

/**
 * Woraus der Fortschritt kommt. `manuell` heißt: der Nutzer zählt selbst hoch
 * — bewusst und ohne Ersatzmessung, weil die App z. B. nicht wissen kann, ob
 * jemand in der Moschee gebetet oder Sadaqa gegeben hat.
 */
export type Quelle =
  | 'gebet-tage-vollstaendig'
  | 'gebet-serie'
  | 'gebet-fajr-tage'
  | 'gebet-isha-tage'
  | 'quran-lesetage'
  | 'quran-suren'
  | 'hifz-verse'
  | 'fasten-tage'
  | 'fasten-serie'
  | 'dhikr-tage'
  | 'dhikr-gesamt'
  | 'lern-tage'
  | 'lektionen'
  | 'quiz-richtig'
  | 'manuell';

export interface Vorlage {
  /** Kurz und stabil — Teil der Herausforderungs-ID und des Locale-Schlüssels. */
  id: string;
  kategorie: Kategorie;
  quelle: Quelle;
  icon: IconName;
  /**
   * Vier Zielwerte, aufsteigend. KEINER davon ist 1 oder 2 — siehe
   * {@link KLEINSTES_ZIEL}.
   */
  stufen: [number, number, number, number];
}

/**
 * Kleinster erlaubter Zielwert.
 *
 * Die Sätze der Vorlagen tragen den Platzhalter `{n}` vor einem Hauptwort in
 * der Mehrzahl („{n} Suren gelesen"). Bei `{n} = 1` stand da „1 Suren gelesen",
 * „1 Lektionen abgeschlossen", „An 1 Tagen fasten" — falsch in praktisch jeder
 * Sprache; auf der Webseite live gesehen. Bei 2 kommt Arabisch mit dem Dual
 * dazwischen. Ab 3 ist die Mehrzahl in allen 14 Sprachen die richtige Form.
 *
 * Der Ausweg über Einzahl-Formen je Vorlage waere 15 weitere Saetze in 14
 * Sprachen gewesen — fuer einen Zielwert, den niemand vermisst. Ein Einstieg
 * bei 3 ist genauso leicht erreichbar.
 *
 * EHRLICHE GRENZE: Sprachen mit mehreren Mehrzahlformen (Russisch: 3 verlangt
 * den Genitiv Singular, ab 5 den Genitiv Plural) sind damit nicht restlos
 * korrekt. Das saubere Mittel dagegen sind Pluralregeln je Sprache; die sind
 * hier bewusst nicht eingebaut, weil sie fuer 28 Saetze x 14 Sprachen mehr
 * Pflegeaufwand erzeugen, als sie einbringen.
 */
export const KLEINSTES_ZIEL = 3;

/**
 * Die 28 Vorlagen. Reihenfolge innerhalb einer Kategorie = Anzeigereihenfolge;
 * automatisch gezählte zuerst, damit der Einstieg ohne Tipparbeit gelingt.
 */
export const VORLAGEN: Vorlage[] = [
  // ─────────────────────────────────────────────────────────────── Gebet
  { id: 'gebet-vollstaendig', kategorie: 'gebet', quelle: 'gebet-tage-vollstaendig', icon: 'checkmark-circle', stufen: [3, 7, 30, 100] },
  { id: 'gebet-serie', kategorie: 'gebet', quelle: 'gebet-serie', icon: 'flame', stufen: [3, 7, 30, 100] },
  { id: 'gebet-fajr', kategorie: 'gebet', quelle: 'gebet-fajr-tage', icon: 'sunny', stufen: [3, 7, 30, 100] },
  { id: 'gebet-isha', kategorie: 'gebet', quelle: 'gebet-isha-tage', icon: 'moon', stufen: [3, 7, 30, 100] },
  { id: 'gebet-moschee', kategorie: 'gebet', quelle: 'manuell', icon: 'business', stufen: [3, 10, 40, 100] },
  { id: 'gebet-jumuah', kategorie: 'gebet', quelle: 'manuell', icon: 'people', stufen: [4, 12, 26, 52] },
  { id: 'gebet-sunnah', kategorie: 'gebet', quelle: 'manuell', icon: 'add-circle', stufen: [3, 10, 40, 100] },

  // ─────────────────────────────────────────────────────────────── Koran
  { id: 'quran-lesetage', kategorie: 'quran', quelle: 'quran-lesetage', icon: 'book', stufen: [3, 7, 30, 100] },
  { id: 'quran-suren', kategorie: 'quran', quelle: 'quran-suren', icon: 'library', stufen: [3, 10, 40, 114] },
  { id: 'quran-auswendig', kategorie: 'quran', quelle: 'hifz-verse', icon: 'bulb', stufen: [5, 25, 100, 600] },
  { id: 'quran-kahf', kategorie: 'quran', quelle: 'manuell', icon: 'bookmark', stufen: [4, 12, 26, 52] },
  { id: 'quran-nacht', kategorie: 'quran', quelle: 'manuell', icon: 'moon', stufen: [3, 7, 30, 100] },

  // ────────────────────────────────────────────────────────────── Fasten
  { id: 'fasten-tage', kategorie: 'fasten', quelle: 'fasten-tage', icon: 'restaurant', stufen: [3, 10, 20, 30] },
  { id: 'fasten-serie', kategorie: 'fasten', quelle: 'fasten-serie', icon: 'flame', stufen: [3, 7, 15, 30] },
  { id: 'fasten-montag-donnerstag', kategorie: 'fasten', quelle: 'manuell', icon: 'calendar', stufen: [4, 12, 26, 52] },
  { id: 'fasten-weisse-tage', kategorie: 'fasten', quelle: 'manuell', icon: 'moon', stufen: [3, 6, 9, 12] },

  // ─────────────────────────────────────────────────────────────── Dhikr
  { id: 'dhikr-tage', kategorie: 'dhikr', quelle: 'dhikr-tage', icon: 'sparkles', stufen: [3, 7, 30, 100] },
  { id: 'dhikr-gesamt', kategorie: 'dhikr', quelle: 'dhikr-gesamt', icon: 'ellipse', stufen: [100, 1000, 10000, 33000] },
  { id: 'dhikr-nach-gebet', kategorie: 'dhikr', quelle: 'manuell', icon: 'repeat', stufen: [5, 25, 100, 500] },
  { id: 'dhikr-istighfar', kategorie: 'dhikr', quelle: 'manuell', icon: 'heart', stufen: [3, 7, 30, 100] },
  { id: 'dhikr-dua-auswendig', kategorie: 'dhikr', quelle: 'manuell', icon: 'chatbubbles', stufen: [3, 7, 15, 40] },

  // ─────────────────────────────────────────────────────────────── Wissen
  { id: 'wissen-lerntage', kategorie: 'wissen', quelle: 'lern-tage', icon: 'school', stufen: [3, 7, 30, 100] },
  { id: 'wissen-lektionen', kategorie: 'wissen', quelle: 'lektionen', icon: 'list', stufen: [3, 10, 50, 150] },
  { id: 'wissen-quiz', kategorie: 'wissen', quelle: 'quiz-richtig', icon: 'game-controller', stufen: [10, 50, 250, 1000] },
  { id: 'wissen-hadith', kategorie: 'wissen', quelle: 'manuell', icon: 'document-text', stufen: [5, 20, 50, 200] },

  // ──────────────────────────────────────────────────────────── Charakter
  { id: 'charakter-sadaqa', kategorie: 'charakter', quelle: 'manuell', icon: 'gift', stufen: [3, 7, 30, 100] },
  { id: 'charakter-eltern', kategorie: 'charakter', quelle: 'manuell', icon: 'call', stufen: [4, 12, 26, 52] },
  { id: 'charakter-helfen', kategorie: 'charakter', quelle: 'manuell', icon: 'hand-left', stufen: [3, 10, 40, 100] },
];

export interface Herausforderung {
  /** `<vorlageId>-<stufe>` — stabil, weil weder Vorlage noch Stufenzahl wandern. */
  id: string;
  vorlageId: string;
  kategorie: Kategorie;
  quelle: Quelle;
  icon: IconName;
  /** 1 bis 4. */
  stufe: number;
  ziel: number;
}

/** Alle Herausforderungen, flach und in Anzeigereihenfolge. */
export const HERAUSFORDERUNGEN: Herausforderung[] = VORLAGEN.flatMap((v) =>
  v.stufen.map((ziel, i) => ({
    id: `${v.id}-${i + 1}`,
    vorlageId: v.id,
    kategorie: v.kategorie,
    quelle: v.quelle,
    icon: v.icon,
    stufe: i + 1,
    ziel,
  })),
);

export function herausforderungenDerKategorie(kategorie: Kategorie): Herausforderung[] {
  return HERAUSFORDERUNGEN.filter((h) => h.kategorie === kategorie);
}

export function herausforderungMitId(id: string): Herausforderung | undefined {
  return HERAUSFORDERUNGEN.find((h) => h.id === id);
}

/** Locale-Schlüssel des Satzes einer Vorlage (enthält den Platzhalter `{n}`). */
export function vorlageTextSchluessel(vorlageId: string): string {
  return `challenges.vorlagen.${vorlageId}`;
}

/** Locale-Schlüssel eines Kategorienamens. */
export function kategorieTextSchluessel(kategorie: Kategorie): string {
  return `challenges.kategorien.${kategorie}`;
}
