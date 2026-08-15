// HadeethEnc.com — „Enzyklopädie der übersetzten Prophetenhadithe"
// (الموسوعة الحديثية / hadeethenc.com), Schwesterprojekt von QuranEnc.com und
// IslamHouse.com.
//
// WARUM diese zweite Hadith-Quelle (Inhalts-Audit 2026-07-27):
// Der bisherige Bestand (fawazahmed0 + AhmedBaset, siehe api.ts) hat NULL
// deutsche Ausgaben — Deutsch, Spanisch, Persisch, Malaiisch, Suaheli und
// Paschtu fielen bei jeder Sammlung außer An-Nawawi 40 stumm auf Englisch
// zurück. HadeethEnc schließt genau diese Lücke: die Enzyklopädie führt 71
// Sprachen und deckt damit ALLE 14 App-Sprachen ab (live gegen
// `/api/v1/languages` geprüft, 2026-07-27).
//
// NUTZUNGSBEDINGUNGEN des Anbieters (Startseite hadeethenc.com, „Terms and
// policies"): Weiterverwendung erlaubt, solange (1) der Inhalt unverändert
// bleibt — keine Ergänzung, keine Kürzung, keine Umformulierung —, (2) die
// Quelle „HadeethEnc.com" klar genannt wird und (3) neben den Hadithen keine
// unpassende Werbung steht. Alle drei Punkte hält die App ein: der Text wird
// 1:1 gerendert, die Quelle steht auf der Lizenzseite (lizenzen.tsx) und im
// Hadith-Detail, und die App zeigt keine Werbung. Es wird NICHTS maschinell
// übersetzt — ausgeliefert wird ausschließlich die redaktionell geprüfte
// Übersetzung des Anbieters in der jeweiligen Sprache.
//
// Die Liste-Endpunkte liefern pro Sprache NUR die tatsächlich übersetzten
// Hadithe (verifiziert: Kategorie 3 hat 725 Einträge auf Arabisch, aber 187
// auf Deutsch). Es gibt hier also — anders als bei den Sammlungen in api.ts —
// keinen stillen Englisch-Ersatz: was angezeigt wird, existiert wirklich in
// der gewählten Sprache. Der Umfang unterscheidet sich trotzdem je Sprache,
// darum weist `hadeethencTotalCount()` die echte Anzahl aus.

import { fetchJson } from '@/lib/fetchJson';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale-detect';

const BASE = 'https://hadeethenc.com/api/v1';

/** Hadithe pro Seite. 30 statt 100: erste Seite erscheint schneller. */
export const HADEETHENC_PAGE_SIZE = 30;

/**
 * Pflicht-Quellennennung des Anbieters. Bewusst ein unübersetzter Eigenname:
 * die Bedingungen verlangen die Nennung genau dieser Quelle, in jeder Sprache
 * gleich. Steht im Detail-Screen und in jedem geteilten Text/Bild.
 */
export const HADEETHENC_ATTRIBUTION = 'HadeethEnc.com';

/**
 * Sprachcodes der Enzyklopädie. Für alle 14 App-Sprachen identisch mit dem
 * App-Locale (live gegen `/api/v1/languages` abgeglichen, 2026-07-27) — die
 * Tabelle bleibt trotzdem explizit, damit ein künftiger Locale (z. B. `pt-BR`)
 * hier auffällt statt still einen 404 zu erzeugen.
 */
const HADEETHENC_LANGS: Record<Locale, string> = {
  ar: 'ar',
  en: 'en',
  de: 'de',
  tr: 'tr',
  fr: 'fr',
  es: 'es',
  id: 'id',
  ms: 'ms',
  bn: 'bn',
  ur: 'ur',
  fa: 'fa',
  ru: 'ru',
  sw: 'sw',
  ps: 'ps',
};

/** true = die Enzyklopädie führt diese App-Sprache (aktuell alle 14). */
export function isHadeethencLangAvailable(locale: Locale): boolean {
  return HADEETHENC_LANGS[locale] !== undefined;
}

/** App-Locale → Sprachcode der Enzyklopädie (Fallback Englisch, nie stumm für die 14). */
export function hadeethencLang(locale: Locale): string {
  return HADEETHENC_LANGS[locale] ?? 'en';
}

export interface HadeethencCategory {
  id: string;
  title: string;
  /** Anzahl der in DIESER Sprache übersetzten Hadithe (inkl. Unterkategorien). */
  count: number;
  parentId: string | null;
}

export interface HadeethencListItem {
  id: string;
  title: string;
}

export interface HadeethencPage {
  items: HadeethencListItem[];
  page: number;
  lastPage: number;
  total: number;
}

export interface HadeethencHadith {
  id: string;
  title: string;
  /** Arabischer Urtext (`hadeeth_ar`). */
  arabic: string;
  /** Übersetzung in der gewählten Sprache — leer, wenn die Sprache Arabisch ist. */
  translation: string;
  /** Quellenangabe, z. B. „Überliefert von al-Bukhari". */
  attribution: string;
  /** Graduierung, z. B. „Authentischer Text" (sahih). */
  grade: string;
  /** Erläuterung der Gelehrtenredaktion. */
  explanation: string;
  /** Nutzen/Lehren („Benefits"). */
  hints: string[];
}

// --- Rohformate der API (nur die Felder, die wir wirklich lesen) ---

interface RawCategory {
  id: string;
  title: string;
  hadeeths_count: string;
  parent_id: string | null;
}

interface RawListResponse {
  data: { id: string; title: string }[];
  meta: { current_page: string; last_page: number; total_items: number };
}

interface RawHadeeth {
  id: string;
  title?: string;
  hadeeth?: string;
  hadeeth_ar?: string;
  attribution?: string;
  grade?: string;
  explanation?: string;
  hints?: string[] | null;
}

// --- Reine Transformationen (ohne Netz, damit direkt testbar) ---

/** Normalisiert die Kategorieliste; kaputte Zähler werden zu 0 statt NaN. */
export function parseCategories(raw: RawCategory[]): HadeethencCategory[] {
  return raw.map((c) => ({
    id: String(c.id),
    title: c.title,
    count: Number.isFinite(Number(c.hadeeths_count)) ? Number(c.hadeeths_count) : 0,
    parentId: c.parent_id === null ? null : String(c.parent_id),
  }));
}

/** Die 7 Hauptthemen (Koran, Hadithwissenschaft, Aqida, Fiqh, Charakter, Da'wah, Sira). */
export function topLevelCategories(cats: HadeethencCategory[]): HadeethencCategory[] {
  return cats.filter((c) => c.parentId === null);
}

/** Unterthemen einer Kategorie — leere Liste, wenn es keine gibt. */
export function childCategories(cats: HadeethencCategory[], parentId: string): HadeethencCategory[] {
  return cats.filter((c) => c.parentId === parentId);
}

/**
 * Gesamtzahl der in dieser Sprache übersetzten Hadithe. Bewusst aus den
 * Hauptthemen summiert statt hart verdrahtet: der Bestand wächst laufend, und
 * eine veraltete Konstante wäre eine Falschaussage im UI.
 */
export function hadeethencTotalCount(cats: HadeethencCategory[]): number {
  return topLevelCategories(cats).reduce((sum, c) => sum + c.count, 0);
}

export function parseListPage(raw: RawListResponse): HadeethencPage {
  return {
    items: (raw.data ?? []).map((h) => ({ id: String(h.id), title: h.title })),
    page: Number(raw.meta?.current_page ?? 1),
    lastPage: Number(raw.meta?.last_page ?? 1),
    total: Number(raw.meta?.total_items ?? 0),
  };
}

/**
 * Baut den Anzeige-Hadith. Bei Arabisch ist `hadeeth` bereits der Urtext —
 * dann bleibt `translation` leer, damit das UI den Text nicht doppelt zeigt.
 * `hints` kommt gelegentlich als `null`; einzelne Einträge tragen ein
 * abschließendes `\r` aus dem Redaktionssystem, das hier entfernt wird (reine
 * Whitespace-Bereinigung, kein Eingriff in den Inhalt).
 */
export function parseHadeeth(raw: RawHadeeth, lang: string): HadeethencHadith {
  const arabic = (raw.hadeeth_ar ?? raw.hadeeth ?? '').trim();
  const translated = (raw.hadeeth ?? '').trim();
  return {
    id: String(raw.id),
    title: (raw.title ?? '').trim(),
    arabic,
    translation: lang === 'ar' || translated === arabic ? '' : translated,
    attribution: (raw.attribution ?? '').trim(),
    grade: (raw.grade ?? '').trim(),
    explanation: (raw.explanation ?? '').trim(),
    hints: (raw.hints ?? []).map((h) => h.trim()).filter((h) => h !== ''),
  };
}

// --- Netzabrufe (alle über fetchJson: Timeout + Fehler-Log + klarer Fehler) ---

export async function fetchHadeethencCategories(locale: Locale): Promise<HadeethencCategory[]> {
  const lang = hadeethencLang(locale);
  const raw = await fetchJson<RawCategory[]>(`${BASE}/categories/list/?language=${lang}`, {
    errorPrefix: 'hadeethenc_categories',
  });
  return parseCategories(raw);
}

export async function fetchHadeethencPage(
  locale: Locale,
  categoryId: string,
  page: number,
): Promise<HadeethencPage> {
  const lang = hadeethencLang(locale);
  const raw = await fetchJson<RawListResponse>(
    `${BASE}/hadeeths/list/?language=${lang}&category_id=${encodeURIComponent(categoryId)}` +
      `&page=${page}&per_page=${HADEETHENC_PAGE_SIZE}`,
    { errorPrefix: 'hadeethenc_list' },
  );
  return parseListPage(raw);
}

/**
 * Einzelner Hadith. Existiert er in der gewählten Sprache nicht, antwortet die
 * API mit HTTP 404 und leerem Body — `fetchJson` wirft dann
 * `hadeethenc_hadeeth_404`, das UI zeigt seinen Fehlerzustand. Kein stiller
 * Sprachwechsel: die Listen führen ohnehin nur übersetzte Hadithe.
 */
export async function fetchHadeethencHadith(locale: Locale, id: string): Promise<HadeethencHadith> {
  const lang = hadeethencLang(locale);
  const raw = await fetchJson<RawHadeeth>(
    `${BASE}/hadeeths/one/?language=${lang}&id=${encodeURIComponent(id)}`,
    { errorPrefix: 'hadeethenc_hadeeth' },
  );
  return parseHadeeth(raw, lang);
}

/** Für Tests/Doku: dass die Tabelle wirklich alle App-Sprachen abdeckt. */
export const HADEETHENC_SUPPORTED_LOCALES = SUPPORTED_LOCALES.filter(isHadeethencLangAvailable);
