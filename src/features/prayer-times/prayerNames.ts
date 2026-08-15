// Gebetsnamen für Benachrichtigungstexte — eine Quelle für alle Melder
// (notifications.ts, preAdhanReminder.ts, Live Activity).
//
// Audit 2026-07-27, Befund O1: die arabischen Namen hingen an
// `locale === 'ar'`. In ur/fa/ps stand damit die LATEINISCHE Umschrift
// ("Fajr") mitten in einem arabischschriftlichen, rechtsläufigen Satz —
// die Zeile brach optisch um und der Screen daneben zeigte gleichzeitig
// den Namen in Landesschrift. Jetzt entscheidet `isRtlLanguageCode`, also
// dieselbe Regel, nach der die App überall sonst RTL behandelt.
//
// Die Namen sind ZEICHENGLEICH mit `prayers.*` aus den Sprachdateien
// (src/locales/{ar,ur,fa,ps}.json) — Paschtu hat eigene Namen
// (ماسپښين …), es wäre falsch, dort arabische einzusetzen. Die Kopie hier
// ist nötig, weil die Melder synchron laufen und die Sprachdateien außer
// de/en erst nachgeladen werden (lib/translate.ts). `prayerNames.test.ts`
// vergleicht beide Seiten und schlägt bei jedem Auseinanderlaufen fehl.
import { isRtlLanguageCode } from '@/lib/locale-detect';

import type { Prayer } from './next-prayer';

export type RtlPrayerLocale = 'ar' | 'ur' | 'fa' | 'ps';

export const PRAYER_NAMES_RTL: Record<RtlPrayerLocale, Record<Prayer, string>> = {
  ar: { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' },
  ur: { Fajr: 'فجر', Dhuhr: 'ظہر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشاء' },
  fa: { Fajr: 'فجر', Dhuhr: 'ظهر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشاء' },
  ps: { Fajr: 'فجر', Dhuhr: 'ماسپخین', Asr: 'مازیګر', Maghrib: 'ماښام', Isha: 'ماخستن' },
};

/**
 * Anzeigename eines Gebets für Benachrichtigungen.
 *
 * Rechtsläufige Sprachen bekommen den Namen in Landesschrift, alle übrigen
 * die etablierte lateinische Umschrift (Fajr, Dhuhr, …) — die ist in
 * de/en/tr/es/fr/id/ms/bn/ru/sw gebräuchlich und wird deshalb nicht
 * übersetzt. Eine künftige RTL-Sprache ohne eigene Tabelle fällt bewusst auf
 * die arabischen Namen zurück (arabische Schrift bleibt lesbar, Umschrift
 * mitten im RTL-Satz wäre der Fehler von oben).
 */
export function prayerName(p: Prayer, locale: string): string {
  if (!isRtlLanguageCode(locale)) return p;
  return (PRAYER_NAMES_RTL[locale as RtlPrayerLocale] ?? PRAYER_NAMES_RTL.ar)[p];
}
