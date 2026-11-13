// Inhaltssprache der Medien (Podcast, Video, Reels) — getrennt von der
// Oberflaechensprache.
//
// Warum es das gibt (Audit 2026-07-27, MEDIEN-LUECKEN.md §5): die App spricht
// 14 Sprachen, aber saemtliche 68 Podcast-Folgen, 62 Videos, 496 Reels und 23
// Handouts sind auf Deutsch produziert. Ein Nutzer mit tuerkischer Oberflaeche
// sah eine vollstaendig tuerkische App, oeffnete den „Lernen"-Tab und fand
// 10,5 h deutsches Audio — ohne jeden Hinweis vorab. Die Enttaeuschung trat
// erst nach dem Antippen ein, schlimmstenfalls erst nach dem Offline-Download.
//
// Der ausgelieferte Contract fuehrte das Feld bis 2026-07-28 gar nicht: das
// lokale manifest.json hatte `lang: "de"` je Folge, podcast/scripts/upload.py
// reichte es aber nicht durch. Jetzt schreiben alle Upload-Skripte `lang` aus
// derselben Quelle (podcast/scripts/series.py, INHALTSSPRACHE).

/** Sprache, in der die Medien produziert sind, wenn der Index nichts sagt.
 *  Aeltere Index-Staende (und alle vor dem 2026-07-28 hochgeladenen) haben kein
 *  `lang` — sie sind ausnahmslos deutsch, „unbekannt" waere hier die falsche
 *  Annahme und wuerde den Hinweis genau dort verschlucken, wo er gebraucht wird. */
export const DEFAULT_CONTENT_LANGUAGE = 'de';

/** Sprachen, fuer die es einen uebersetzten Namen gibt (`media.languages.*`). */
const NAMED_LANGUAGES = ['de'] as const;

export function normalizeContentLanguage(lang?: string): string {
  const value = lang?.trim().toLowerCase();
  if (!value) return DEFAULT_CONTENT_LANGUAGE;
  // "de-DE" -> "de": der Contract fuehrt reine Sprachcodes, ein Regionalzusatz
  // wuerde sonst am Namens-Lookup vorbeilaufen.
  return value.split(/[-_]/)[0];
}

/**
 * Braucht dieser Inhalt einen Sprachhinweis? Nur wenn die Oberflaeche eine
 * ANDERE Sprache spricht als der Inhalt — ein deutscher Nutzer sieht damit
 * exakt dieselbe Liste wie bisher, ohne zusaetzliches Abzeichen.
 */
export function needsContentLanguageNotice(uiLocale: string, contentLang?: string): boolean {
  return normalizeContentLanguage(contentLang) !== normalizeContentLanguage(uiLocale);
}

/**
 * Uebersetzungs-Key fuer den Namen der Inhaltssprache. Fuer Sprachen ohne
 * eigenen Eintrag faellt es auf den Sprachcode in Grossbuchstaben zurueck —
 * lieber „AR" als ein leeres Abzeichen.
 */
export function contentLanguageNameKey(contentLang?: string): string | null {
  const lang = normalizeContentLanguage(contentLang);
  return (NAMED_LANGUAGES as readonly string[]).includes(lang) ? `media.languages.${lang}` : null;
}

/**
 * Fertiger Abzeichen-Text („Inhalt auf Deutsch"), oder `null`, wenn kein
 * Hinweis noetig ist. `t` ist die Funktion aus `useTranslation()`; die
 * Platzhalter-Ersetzung folgt dem Muster der uebrigen Screens (`{lang}`).
 */
export function contentLanguageLabel(
  t: (key: string) => string,
  uiLocale: string,
  contentLang?: string,
): string | null {
  if (!needsContentLanguageNotice(uiLocale, contentLang)) return null;
  const nameKey = contentLanguageNameKey(contentLang);
  const name = nameKey ? t(nameKey) : normalizeContentLanguage(contentLang).toUpperCase();
  return t('media.contentLanguage').replace('{lang}', name);
}

/** true, sobald mindestens ein Eintrag ein explizites `lang` fuehrt (Handouts). */
export function indexHasContentLanguage<T extends { lang?: string }>(items: readonly T[]): boolean {
  return items.some((item) => typeof item.lang === 'string' && item.lang.trim() !== '');
}

/**
 * Harte Inhaltssprache: nur Eintraege, deren `lang` (fehlend = Deutsch) der
 * UI-Locale entspricht. Kein Fallback auf andere Sprachen — fuer Podcast und
 * Hoerbuecher, nicht fuer die weiche Video-Filterleiste.
 */
export function filterByContentLanguage<T extends { lang?: string }>(
  items: readonly T[],
  uiLocale: string,
): T[] {
  const target = normalizeContentLanguage(uiLocale);
  return items.filter((item) => normalizeContentLanguage(item.lang) === target);
}

export type HandoutsLocaleResolution<T extends { lang?: string }> = {
  list: T[];
  /** Oberflaechensprache hat keine eigenen Unterlagen, aber andere Sprachen existieren. */
  showLocaleEmpty: boolean;
  /** Mindestens deutschsprachige PDFs koennen per CTA eingeblendet werden. */
  germanFallbackAvailable: boolean;
};

/**
 * Handouts: strikt nach Inhaltssprache filtern. Fehlen Treffer, bleibt die Liste
 * leer und `showLocaleEmpty` erklaert die DE-only-Lage — optional per CTA
 * `showGermanFallback` die deutschen Unterlagen einblenden (Sprachabzeichen).
 */
export function resolveHandoutsForLocale<T extends { lang?: string }>(
  items: readonly T[],
  uiLocale: string,
  showGermanFallback: boolean,
): HandoutsLocaleResolution<T> {
  if (!indexHasContentLanguage(items)) {
    return { list: [...items], showLocaleEmpty: false, germanFallbackAvailable: false };
  }
  const matched = filterByContentLanguage(items, uiLocale);
  if (matched.length > 0) {
    return { list: matched, showLocaleEmpty: false, germanFallbackAvailable: false };
  }
  const german = filterByContentLanguage(items, DEFAULT_CONTENT_LANGUAGE);
  const germanFallbackAvailable = german.length > 0;
  if (showGermanFallback && germanFallbackAvailable) {
    return { list: german, showLocaleEmpty: false, germanFallbackAvailable: true };
  }
  return {
    list: [],
    showLocaleEmpty: items.length > 0,
    germanFallbackAvailable,
  };
}

/** Strikte Liste ohne deutschen Fallback (Hubs, Zaehler). */
export function handoutsForLocale<T extends { lang?: string }>(
  items: readonly T[],
  uiLocale: string,
): T[] {
  return resolveHandoutsForLocale(items, uiLocale, false).list;
}
