import AsyncStorage from '@react-native-async-storage/async-storage';

import { TASBIH_HISTORY_STORAGE_KEY, parseHistory } from '@/features/dhikr/goal';
import { FASTING_STORAGE_KEY, type FastingData } from '@/features/fasting/store';
import { HIFZ_STORAGE_KEY, parseHifzProgress } from '@/features/hifz/progress';
import { LEARN_PROGRESS_STORAGE_KEY, parseLearnProgress, passedCount } from '@/features/learn/progress';
import { PRACTICE_STATS_STORAGE_KEY, parsePracticeStats } from '@/features/practice/stats';
import { PRACTICE_DAYS_STORAGE_KEY, parsePracticeDays } from '@/features/practice-streak/streak';
import {
  PRAYER_IDS,
  TRACKER_STORAGE_KEY,
  currentStreak,
  dayKey,
  isDayComplete,
  parseTracker,
  type PrayerId,
  type TrackerData,
} from '@/features/tracker/store';

import { HERAUSFORDERUNGEN, type Herausforderung, type Quelle } from './katalog';
import { ladeQuranLog, type QuranLog } from './quranLog';
import { ladeStand, merkeErreicht, speichereStand, type HerausforderungenStand } from './store';

// Fortschritt der Herausforderungen — berechnet, nicht gespeichert.
//
// Jede automatisch gezählte Quelle liest genau den Datensatz, den die
// zugehörige Funktion der App ohnehin führt. Keine Herausforderung erfindet
// eine eigene Zählung, und keine zählt etwas doppelt: „an X Tagen alle fünf
// Gebete" und „X Tage in Folge" lesen beide den Gebets-Tracker, aber die eine
// zählt Tage, die andere die Serie.
//
// Selbst gezählte Ziele (`quelle === 'manuell'`) kommen aus store.ts. Sie sind
// bewusst nicht aus irgendetwas abgeleitet: ob jemand in der Moschee gebetet
// oder Sadaqa gegeben hat, weiß das Telefon nicht, und eine Ersatzmessung wäre
// eine Behauptung.

/** Alle Rohwerte, aus denen sich jeder Fortschritt ergibt. */
export interface Zaehlstand {
  gebetTageVollstaendig: number;
  gebetSerie: number;
  gebetTageJeGebet: Record<PrayerId, number>;
  quranLesetage: number;
  quranSuren: number;
  hifzVerse: number;
  fastenTage: number;
  fastenSerie: number;
  dhikrTage: number;
  dhikrGesamt: number;
  lernTage: number;
  lektionen: number;
  quizRunden: number;
}

export const LEERER_ZAEHLSTAND: Zaehlstand = {
  gebetTageVollstaendig: 0,
  gebetSerie: 0,
  gebetTageJeGebet: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  quranLesetage: 0,
  quranSuren: 0,
  hifzVerse: 0,
  fastenTage: 0,
  fastenSerie: 0,
  dhikrTage: 0,
  dhikrGesamt: 0,
  lernTage: 0,
  lektionen: 0,
  quizRunden: 0,
};

/**
 * Längste zusammenhängende Kette in einer Menge von Kalendertagen.
 *
 * Bewusst die LÄNGSTE und nicht die aktuelle: eine Fastenserie im Ramadan soll
 * im Juli nicht auf 0 stehen. Bei den Gebeten ist es umgekehrt — dort ist die
 * laufende Serie die Aussage, und dafür gibt es `currentStreak` im Tracker.
 */
export function laengsteKette(tage: string[]): number {
  const sortiert = [...new Set(tage)].sort();
  let beste = 0;
  let laufend = 0;
  let vorher: number | null = null;
  for (const tag of sortiert) {
    const ms = Date.parse(`${tag}T00:00:00Z`);
    if (Number.isNaN(ms)) continue;
    laufend = vorher !== null && ms - vorher === 86_400_000 ? laufend + 1 : 1;
    vorher = ms;
    if (laufend > beste) beste = laufend;
  }
  return beste;
}

/** Tage im Tracker, an denen ein bestimmtes Gebet verrichtet wurde. */
export function tageMitGebet(daten: TrackerData, gebet: PrayerId): number {
  return Object.values(daten).filter((eintrag) => eintrag?.[gebet] === true).length;
}

/** Tage im Tracker mit allen fünf Gebeten (befreite Tage zählen nicht mit). */
export function tageVollstaendig(daten: TrackerData): number {
  return Object.keys(daten).filter((tag) => isDayComplete(daten, tag)).length;
}

function parseFasting(raw: string | null): FastingData {
  if (!raw) return {};
  try {
    const roh = JSON.parse(raw) as unknown;
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {};
    const sauber: FastingData = {};
    for (const [tag, wert] of Object.entries(roh as Record<string, unknown>)) {
      if (wert === true) sauber[tag] = true;
    }
    return sauber;
  } catch {
    return {};
  }
}

/** Summe aller auswendig gelernten Verse über alle Suren. */
export function hifzVerseGesamt(progress: ReturnType<typeof parseHifzProgress>): number {
  let summe = 0;
  for (const sure of Object.values(progress)) {
    for (const status of Object.values(sure ?? {})) {
      if (status === 'known') summe += 1;
    }
  }
  return summe;
}

/** Liest alle Quellen einmal und bildet daraus die Rohwerte. */
export async function ladeZaehlstand(heute: Date = new Date()): Promise<Zaehlstand> {
  const schluessel = [
    TRACKER_STORAGE_KEY,
    FASTING_STORAGE_KEY,
    TASBIH_HISTORY_STORAGE_KEY,
    PRACTICE_DAYS_STORAGE_KEY,
    LEARN_PROGRESS_STORAGE_KEY,
    PRACTICE_STATS_STORAGE_KEY,
    HIFZ_STORAGE_KEY,
  ];
  let roh: [string, string | null][] = [];
  try {
    roh = (await AsyncStorage.multiGet(schluessel)) as [string, string | null][];
  } catch {
    return LEERER_ZAEHLSTAND;
  }
  const werte = Object.fromEntries(roh) as Record<string, string | null>;

  const tracker = parseTracker(werte[TRACKER_STORAGE_KEY] ?? null);
  const fasten = parseFasting(werte[FASTING_STORAGE_KEY] ?? null);
  const dhikr = parseHistory(werte[TASBIH_HISTORY_STORAGE_KEY] ?? null);
  const lernTage = parsePracticeDays(werte[PRACTICE_DAYS_STORAGE_KEY] ?? null);
  const lernen = parseLearnProgress(werte[LEARN_PROGRESS_STORAGE_KEY] ?? null);
  const quiz = parsePracticeStats(werte[PRACTICE_STATS_STORAGE_KEY] ?? null);
  const hifz = parseHifzProgress(werte[HIFZ_STORAGE_KEY] ?? null);

  let quran: QuranLog = { tage: [], suren: [] };
  try {
    quran = await ladeQuranLog();
  } catch {
    // Lesetagebuch fehlt — die beiden Koran-Ziele stehen dann auf 0.
  }

  const fastenTage = Object.keys(fasten).filter((tag) => fasten[tag]);
  const dhikrTage = Object.entries(dhikr).filter(([, anzahl]) => anzahl > 0);

  return {
    gebetTageVollstaendig: tageVollstaendig(tracker),
    gebetSerie: currentStreak(tracker, heute),
    gebetTageJeGebet: Object.fromEntries(
      PRAYER_IDS.map((p) => [p, tageMitGebet(tracker, p)]),
    ) as Record<PrayerId, number>,
    quranLesetage: quran.tage.length,
    quranSuren: quran.suren.length,
    hifzVerse: hifzVerseGesamt(hifz),
    fastenTage: fastenTage.length,
    fastenSerie: laengsteKette(fastenTage),
    dhikrTage: dhikrTage.length,
    dhikrGesamt: dhikrTage.reduce((summe, [, anzahl]) => summe + anzahl, 0),
    lernTage: lernTage.length,
    lektionen: passedCount(lernen),
    quizRunden: Object.values(quiz).reduce((summe, m) => summe + (m?.plays ?? 0), 0),
  };
}

/** Rohwert einer Quelle. `manuell` kommt nicht von hier, sondern aus dem Stand. */
export function wertFuerQuelle(quelle: Quelle, z: Zaehlstand): number {
  switch (quelle) {
    case 'gebet-tage-vollstaendig':
      return z.gebetTageVollstaendig;
    case 'gebet-serie':
      return z.gebetSerie;
    case 'gebet-fajr-tage':
      return z.gebetTageJeGebet.fajr;
    case 'gebet-isha-tage':
      return z.gebetTageJeGebet.isha;
    case 'quran-lesetage':
      return z.quranLesetage;
    case 'quran-suren':
      return z.quranSuren;
    case 'hifz-verse':
      return z.hifzVerse;
    case 'fasten-tage':
      return z.fastenTage;
    case 'fasten-serie':
      return z.fastenSerie;
    case 'dhikr-tage':
      return z.dhikrTage;
    case 'dhikr-gesamt':
      return z.dhikrGesamt;
    case 'lern-tage':
      return z.lernTage;
    case 'lektionen':
      return z.lektionen;
    case 'quiz-richtig':
      return z.quizRunden;
    case 'manuell':
      return 0;
  }
}

export interface Fortschritt {
  herausforderung: Herausforderung;
  /** Aktueller Wert, gedeckelt auf das Ziel. */
  wert: number;
  /** 0 bis 1. */
  anteil: number;
  erreicht: boolean;
  /** Zeitpunkt des ersten Erreichens, falls bekannt. */
  erreichtAm?: number;
}

export function berechneFortschritt(
  z: Zaehlstand,
  stand: HerausforderungenStand,
  liste: Herausforderung[] = HERAUSFORDERUNGEN,
): Fortschritt[] {
  return liste.map((h) => {
    const roh = h.quelle === 'manuell' ? (stand[h.id]?.zaehler ?? 0) : wertFuerQuelle(h.quelle, z);
    const wert = Math.min(roh, h.ziel);
    const erreichtAm = stand[h.id]?.erreichtAm;
    return {
      herausforderung: h,
      wert,
      anteil: h.ziel > 0 ? wert / h.ziel : 0,
      // Einmal geschafft bleibt geschafft, auch wenn die Serie später reißt —
      // Begruendung im Kopf von store.ts.
      erreicht: roh >= h.ziel || erreichtAm !== undefined,
      erreichtAm,
    };
  });
}

/**
 * Schreibt für jede gerade erreichte Herausforderung den Zeitpunkt fest und
 * liefert die IDs, die dabei NEU dazugekommen sind — daraus baut der Bildschirm
 * seine Glückwunsch-Meldung.
 */
export async function sichereErreichte(
  fortschritte: Fortschritt[],
  stand: HerausforderungenStand,
  jetzt: number = Date.now(),
): Promise<{ stand: HerausforderungenStand; neu: string[] }> {
  let naechster = stand;
  const neu: string[] = [];
  for (const f of fortschritte) {
    if (!f.erreicht || f.erreichtAm !== undefined) continue;
    naechster = merkeErreicht(naechster, f.herausforderung.id, jetzt);
    neu.push(f.herausforderung.id);
  }
  if (neu.length > 0) await speichereStand(naechster);
  return { stand: naechster, neu };
}

/** Alles in einem Rutsch — der Bildschirm ruft nur das hier. */
export async function ladeAlles(heute: Date = new Date()): Promise<{
  fortschritte: Fortschritt[];
  stand: HerausforderungenStand;
  neuErreicht: string[];
  heuteSchluessel: string;
}> {
  const [z, stand] = await Promise.all([ladeZaehlstand(heute), ladeStand()]);
  const roh = berechneFortschritt(z, stand);
  const { stand: gespeichert, neu } = await sichereErreichte(roh, stand);
  return {
    fortschritte: berechneFortschritt(z, gespeichert),
    stand: gespeichert,
    neuErreicht: neu,
    heuteSchluessel: dayKey(heute),
  };
}
