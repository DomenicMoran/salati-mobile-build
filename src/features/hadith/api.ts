// Hadith-Sammlungen der App.
//
// STAND 2026-07-30: Es gibt nur noch EINE Sammlung, und die kommt aus dem
// eigenen Repo — An-Nawawi 40. Alles Weitere läuft über HadeethEnc
// (hadeethenc.ts), thematisch statt nach Sammlungen geordnet.
//
// WARUM die Sammlungen weg sind (Lizenz-Audit, docs/LIZENZ-AUDIT-2026-07-30.md):
// Bis hierher kamen zehn Sammlungen von `fawazahmed0/hadith-api` und drei von
// `AhmedBaset/hadith-json`. Beide Datensätze stehen selbst unter freien
// Lizenzen — die Unlicense deckt aber die SAMMLUNG, nicht zwingend die darin
// enthaltenen Übersetzungen. Die arabischen Grundtexte sind seit Jahrhunderten
// gemeinfrei, bei den Übersetzungen ließ sich die Rechtekette nicht bis zum
// Ursprung belegen (die `References.md` nennt sunnah.com, hadithbd.com u. a.
// als Herkunft, ohne Übersetzer oder Rechteinhaber zu benennen).
//
// Das ist bewusst entschieden worden: lieber ein kleinerer Bestand mit
// belegter Rechtelage als ein größerer mit ungeklärter. HadeethEnc nennt seine
// Bedingungen ausdrücklich (unveränderte Wiedergabe, Quellennennung, keine
// unpassende Werbung) und liefert alle 14 App-Sprachen redaktionell übersetzt.
//
// An-Nawawi 40 bleibt, weil es nie von dort kam: die 42 Hadithe liegen als
// eigener Kurs-Datensatz im Repo (study/data/nawawi40.json), vokalisiert und
// in allen 14 Sprachen — siehe nawawi-local.ts.

import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale-detect';

import { localNawawiCollection } from './nawawi-local';

/** Alle 14 App-Sprachen. */
export type HadithLang = Locale;

export interface Collection {
  id: string;
  name: string;
  /** Anzahl statt "alle" bei den 40er-Sammlungen — hilft der Listen-UI. */
  isForty?: boolean;
}

/**
 * Die verbliebene Sammlung. Bewusst weiterhin eine Liste und kein Sonderfall:
 * kommt je eine Sammlung mit geklärten Rechten dazu, wird sie hier ergänzt,
 * ohne dass die Screens sich ändern.
 */
export const COLLECTIONS: Collection[] = [{ id: 'nawawi', name: 'An-Nawawi 40', isForty: true }];

/** Sammlungen, die vollständig aus Repo-Daten kommen (alle 14 App-Sprachen). */
const LOCAL_COLLECTIONS = new Set(['nawawi']);

export function istBekannteSammlung(collection: string): boolean {
  return COLLECTIONS.some((c) => c.id === collection);
}

/**
 * Wählt die tatsächlich verfügbare Übersetzungssprache.
 *
 * Seit die API-Sammlungen weg sind, ist das trivial: die eine verbliebene
 * Sammlung liegt in jeder App-Sprache vor. Die Funktion bleibt trotzdem, weil
 * die Screens sie aufrufen und eine künftige Sammlung wieder Lücken haben kann.
 */
export function resolveHadithLang(_collection: string, lang: HadithLang): HadithLang {
  return lang;
}

/** true = für diese Sammlung gibt es die gewünschte Sprache nicht (Englisch-Ersatz). */
export function isHadithTranslationFallback(collection: string, lang: HadithLang): boolean {
  return resolveHadithLang(collection, lang) !== lang;
}

/** Sprachen, in denen diese Sammlung wirklich vorliegt (für den Sprach-Umschalter). */
export function hadithLangsForCollection(collection: string): HadithLang[] {
  return SUPPORTED_LOCALES.filter((l) => !isHadithTranslationFallback(collection, l));
}

export interface HadithGrade {
  name: string;
  grade: string;
}

export interface HadithEntry {
  hadithnumber: number;
  arabicnumber: number;
  text: string;
  grades: HadithGrade[];
  reference: { book: number; hadith: number };
}

export interface HadithBook {
  metadata: { name: string; sections: Record<string, string> };
  hadiths: HadithEntry[];
}

export interface HadithWithTranslation {
  hadithnumber: number;
  arabic: string;
  translation: string;
  grades: HadithGrade[];
  reference: { book: number; hadith: number };
}

/**
 * Lädt eine Sammlung. Ohne Netz — der Bestand liegt im App-Paket, ist also
 * auch offline vollständig da.
 */
export async function fetchHadithCollection(
  collection: string,
  translationLang: HadithLang,
): Promise<{ meta: HadithBook['metadata']; hadiths: HadithWithTranslation[] }> {
  if (!LOCAL_COLLECTIONS.has(collection)) {
    throw new Error(`hadith_unbekannte_sammlung_${collection}`);
  }
  return localNawawiCollection(translationLang);
}
