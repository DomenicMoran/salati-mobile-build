import AsyncStorage from '@react-native-async-storage/async-storage';

// Lesetagebuch für den Koran: an welchen Kalendertagen gelesen wurde und
// welche Suren dabei schon dran waren.
//
// WARUM EIN EIGENER SPEICHER und nicht `salatibox:quran-progress`: dessen
// `history` ist bewusst auf 15 Einträge gedeckelt (READ_HISTORY_MAX, für die
// „Zuletzt gelesen"-Chips) und trägt kein Kalenderdatum. Als Grundlage für
// „an 30 Tagen gelesen" oder „20 Suren gelesen" wäre sie schlicht falsch — sie
// vergisst nach 15 Suren und kennt keine Tage. Statt den bestehenden Deckel
// anzufassen (und damit die Chips zu verändern) steht hier ein zweiter, sehr
// kleiner Datensatz.
//
// Geschrieben wird an GENAU EINER Stelle: `setLastRead` in
// features/quran/progress.ts, also dort, wo die App ohnehin festhält, dass
// gelesen wurde. Keine zweite Aufrufstelle, die beim Umbauen vergessen wird.

export const QURAN_LOG_STORAGE_KEY = 'salatibox:quran-lesetagebuch';

export interface QuranLog {
  /** Kalendertage 'YYYY-MM-DD', aufsteigend, ohne Doppel. */
  tage: string[];
  /** Surennummern 1–114, aufsteigend, ohne Doppel. */
  suren: number[];
}

export const LEERER_QURAN_LOG: QuranLog = { tage: [], suren: [] };

/** Lokaler Kalendertag als 'YYYY-MM-DD' (gleiche Form wie im Gebets-Tracker). */
export function tagesSchluessel(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Defensiv: alles, was nicht passt, wird verworfen statt zu werfen. */
export function parseQuranLog(raw: string | null): QuranLog {
  if (!raw) return LEERER_QURAN_LOG;
  try {
    const roh = JSON.parse(raw) as Partial<QuranLog>;
    const tage = Array.isArray(roh.tage)
      ? [...new Set(roh.tage.filter((t): t is string => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t)))].sort()
      : [];
    const suren = Array.isArray(roh.suren)
      ? [...new Set(roh.suren.filter((s): s is number => Number.isInteger(s) && s >= 1 && s <= 114))].sort((a, b) => a - b)
      : [];
    return { tage, suren };
  } catch {
    return LEERER_QURAN_LOG;
  }
}

/**
 * Trägt Tag und Sure ein. Reine Funktion — gibt bei unverändertem Ergebnis das
 * EINGANGSOBJEKT zurück, damit der Aufrufer am Identitätsvergleich erkennt,
 * dass nichts zu speichern ist (bei jedem Verlassen eines Sure-Bildschirms
 * sonst ein Schreibvorgang).
 */
export function eintragen(log: QuranLog, surah: number, tag: string = tagesSchluessel()): QuranLog {
  const tagFehlt = !log.tage.includes(tag);
  const sureFehlt = Number.isInteger(surah) && surah >= 1 && surah <= 114 && !log.suren.includes(surah);
  if (!tagFehlt && !sureFehlt) return log;
  return {
    tage: tagFehlt ? [...log.tage, tag].sort() : log.tage,
    suren: sureFehlt ? [...log.suren, surah].sort((a, b) => a - b) : log.suren,
  };
}

export async function ladeQuranLog(): Promise<QuranLog> {
  try {
    return parseQuranLog(await AsyncStorage.getItem(QURAN_LOG_STORAGE_KEY));
  } catch {
    return LEERER_QURAN_LOG;
  }
}

/**
 * Liest, ergänzt, schreibt — und zwar nur, wenn sich etwas geändert hat.
 * Bewusst Lesen-vor-Schreiben statt eines gehaltenen Zustands im Speicher:
 * derselbe Eintrag kann aus mehreren Bildschirmen kommen, und ein
 * zwischengespeicherter Stand würde den jeweils anderen überschreiben.
 */
export async function merkeGelesen(surah: number, tag: string = tagesSchluessel()): Promise<void> {
  try {
    const vorher = await ladeQuranLog();
    const nachher = eintragen(vorher, surah, tag);
    if (nachher === vorher) return;
    await AsyncStorage.setItem(QURAN_LOG_STORAGE_KEY, JSON.stringify(nachher));
  } catch {
    // Ein verlorener Eintrag darf das Lesen nicht stören.
  }
}
