import de from '@/locales/de.json';
import en from '@/locales/en.json';
import type { Locale } from './locale-detect';

/**
 * Sprachdateien: `de` (App-Default) und `en` (Fallback-Kette) sind statisch
 * gebündelt, die übrigen 12 werden per `import()` nachgeladen.
 *
 * Grund (Performance-Audit 2026-07-27, §1.5): alle 14 Locales statisch
 * importiert ergaben 3.091.110 B im IMMER geladenen `__common`-Chunk
 * (49 % davon) — auf jeder Route, obwohl immer nur eine Sprache aktiv ist.
 * Metro escaped dabei jedes Nicht-ASCII-Zeichen als `\uXXXX`, was ru/ur/fa/ps/ar
 * gegenüber der Quelldatei mehr als verdoppelt.
 *
 * Metro braucht für `import()` einen statischen Pfad-String — deshalb die
 * explizite Map statt `import('@/locales/' + locale + '.json')`.
 */
const LOADERS: Record<Exclude<Locale, 'de' | 'en'>, () => Promise<unknown>> = {
  tr: () => import('@/locales/tr.json'),
  ar: () => import('@/locales/ar.json'),
  es: () => import('@/locales/es.json'),
  fr: () => import('@/locales/fr.json'),
  id: () => import('@/locales/id.json'),
  bn: () => import('@/locales/bn.json'),
  fa: () => import('@/locales/fa.json'),
  ms: () => import('@/locales/ms.json'),
  ur: () => import('@/locales/ur.json'),
  ru: () => import('@/locales/ru.json'),
  sw: () => import('@/locales/sw.json'),
  ps: () => import('@/locales/ps.json'),
};

const DICTIONARIES: Partial<Record<Locale, unknown>> = { de, en };

const pending = new Map<Locale, Promise<void>>();
const listeners = new Set<() => void>();

// Monoton steigender Zähler als Snapshot für useSyncExternalStore. Startwert 0
// ist gleichzeitig der Server-Snapshot: beim statischen Web-Export (und damit
// bei der Hydration) ist garantiert nichts nachgeladen, Server- und erster
// Client-Render liefern denselben Wert — kein Hydration-Mismatch.
let version = 0;

export const LOCALES_SERVER_VERSION = 0;

export function isLocaleLoaded(locale: Locale): boolean {
  return DICTIONARIES[locale] !== undefined;
}

export function getLocalesVersion(): number {
  return version;
}

export function getLocalesServerVersion(): number {
  return LOCALES_SERVER_VERSION;
}

export function subscribeToLocales(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * Lädt die Sprachdatei einer Locale (idempotent) und benachrichtigt danach alle
 * Abonnenten, damit gerenderte Screens die Texte übernehmen. Wirft nie: schlägt
 * das Nachladen fehl, bleibt die bestehende de/en-Fallback-Kette aktiv.
 */
export function ensureLocale(locale: Locale): Promise<void> {
  if (isLocaleLoaded(locale)) return Promise.resolve();
  const existing = pending.get(locale);
  if (existing) return existing;
  const loader = LOADERS[locale as Exclude<Locale, 'de' | 'en'>];
  if (!loader) return Promise.resolve();
  const task = loader()
    .then((mod) => {
      const dict = (mod as { default?: unknown })?.default ?? mod;
      DICTIONARIES[locale] = dict;
      version += 1;
      for (const listener of listeners) listener();
    })
    .catch(() => {
      // Sprachdatei nicht ladbar (Offline beim ersten Wechsel auf Web) —
      // Fallback auf en/de bleibt, ein späterer Aufruf darf es erneut versuchen.
      pending.delete(locale);
    });
  pending.set(locale, task);
  return task;
}

/**
 * Wie `ensureLocale`, bricht aber spätestens nach `timeoutMs` ab. Für Aufrufer,
 * die vor dem ersten Rendern kurz auf die Sprache warten wollen (Vermeidung
 * eines sichtbaren de→xx-Umschlags), ohne sich an einen hängenden Chunk-Download
 * zu binden.
 */
export function preloadLocale(locale: Locale, timeoutMs = 1500): Promise<void> {
  const load = ensureLocale(locale);
  if (isLocaleLoaded(locale)) return load;
  return Promise.race([
    load,
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      // Node/Jest: Timer darf den Prozess nicht offen halten.
      (timer as unknown as { unref?: () => void }).unref?.();
    }),
  ]);
}

/**
 * Auflösung eines gepunkteten Keys ("nav.qibla") gegen das Wörterbuch der
 * eingestellten Sprache, mit Fallback auf Englisch, dann Deutsch, dann auf den
 * Key selbst. Synchron und rein — solange die Sprachdatei noch nicht
 * nachgeladen ist, greift dieselbe Fallback-Kette wie bei fehlenden Keys.
 *
 * Bewusst ohne Abhängigkeit auf den Settings-Store gehalten (reine Funktion,
 * testbar ohne AsyncStorage-Mock).
 */
export function translate(locale: Locale, key: string): string {
  const segments = key.split('.');
  const lookup = (dict: unknown): string | undefined => {
    let cur: unknown = dict;
    for (const seg of segments) {
      if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg];
      } else {
        return undefined;
      }
    }
    return typeof cur === 'string' ? cur : undefined;
  };
  return lookup(DICTIONARIES[locale]) ?? lookup(DICTIONARIES.en) ?? lookup(DICTIONARIES.de) ?? key;
}
