import { SUPPORTED_LOCALES } from '@/lib/locale-detect';

import { buildAdhkarReminderContent } from './duas/adhkarNotifications';
import { buildJumuahReminderContent } from './prayer-times/jumuahReminder';
import { buildPrayerReminderContent, formatOngoingCountdownText } from './prayer-times/notifications';
import { buildPreAdhanReminderContent } from './prayer-times/preAdhanReminder';
import { sunnahText } from './prayer-times/sunnahReminders';
import { buildReviewReminderContent } from './study/reviewNotifications';
import { buildJourneyReminderContent } from './themes/journeyReminder';
import { buildUdhiyahNotificationContent } from './udhiyah/notifications';
import { buildVerseOfDayNotificationContent } from './verseOfDay/notifications';
import { buildWeeklySummaryContent } from './weeklySummary/notifications';
import { buildZakatReminderContent } from './zakat/reminder';

// Audit 2026-07-27 (ungetestete Bereiche, features/**): SÄMTLICHE
// Benachrichtigungs-Texttabellen der App pflegten nur 6 der 14 App-Sprachen
// (de/en/tr/ar/es/fr). Die restlichen 8 (id/bn/fa/ms/ur/ru/sw/ps) liefen alle
// über denselben `?? TABELLE.de`-Fallback — ein Nutzer mit Urdu-, Bengali-,
// Russisch-, Suaheli-, Persisch-, Paschtu-, Indonesisch- oder Malaiisch-
// Oberfläche bekam also DEUTSCHE Gebets-, Zakat-, Adhkar-, Jumuah- und
// Wochen-Benachrichtigungen. Sichtbar wurde das nie, weil der Fallback
// technisch fehlerfrei ist und keine dieser Tabellen getestet war.
//
// Diese Suite prüft deshalb ZWEI Dinge über alle 14 Sprachen:
//  1. Jede Sprache liefert eigenen Text (nicht das deutsche Objekt).
//  2. Jeder Platzhalter der deutschen Vorlage ({p}, {time}, {min}, {lessons},
//     {days}, {topic}) überlebt die Übersetzung — eine Übersetzung ohne
//     {time} würde die Uhrzeit stumm verschlucken.
//
// Bewusst über die reinen Builder statt über reschedule*(): die Sprachwahl ist
// die zu sichernde Logik, expo-notifications ist dafür irrelevant.

const OTHER_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== 'de');

/** Alle {platzhalter} eines Strings, sortiert — Reihenfolge ist übersetzungsabhängig. */
function placeholders(s: string): string[] {
  return (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
}

function flatten(value: Record<string, unknown>): string[] {
  return Object.values(value).flatMap((v) =>
    typeof v === 'string' ? [v] : typeof v === 'object' && v ? flatten(v as Record<string, unknown>) : [],
  );
}

/**
 * Prüft eine Textquelle über alle Sprachen: eigener Text + Platzhalter-Parität
 * gegen die deutsche Vorlage.
 */
function expectFullyLocalized(label: string, build: (locale: string) => Record<string, unknown>): void {
  const german = build('de');
  const germanStrings = flatten(german);
  expect(germanStrings.length).toBeGreaterThan(0);

  for (const locale of OTHER_LOCALES) {
    const localized = build(locale);
    expect({ label, locale, text: localized }).not.toEqual({ label, locale, text: german });

    const localizedStrings = flatten(localized);
    expect({ label, locale, count: localizedStrings.length }).toEqual({
      label,
      locale,
      count: germanStrings.length,
    });
    localizedStrings.forEach((s, i) => {
      expect({ label, locale, i, ph: placeholders(s) }).toEqual({
        label,
        locale,
        i,
        ph: placeholders(germanStrings[i]),
      });
      expect(s.trim()).not.toBe('');
    });
  }
}

describe('Benachrichtigungs-Texte sind in allen 14 App-Sprachen gepflegt', () => {
  it('deckt genau die 14 unterstützten Sprachen ab', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(14);
    expect(OTHER_LOCALES).toHaveLength(13);
  });

  it('Gebetszeit-Erinnerung (prayer-times/notifications)', () => {
    expectFullyLocalized('prayer', (locale) => buildPrayerReminderContent('Fajr', '05:12', locale));
  });

  it('Dauerhafte "nächstes Gebet"-Notification', () => {
    const next: Parameters<typeof formatOngoingCountdownText>[0] = {
      nextPrayer: 'Maghrib',
      nextTs: new Date('2026-07-27T20:41:00'),
      nextIdx: 3,
      diffMs: 42 * 60_000,
    };
    expectFullyLocalized('ongoing', (locale) => {
      const { title, body } = formatOngoingCountdownText(next, locale, '24h');
      return { title, body };
    });
  });

  it('Vor-Adhan-Erinnerung', () => {
    expectFullyLocalized('preAdhan', (locale) => buildPreAdhanReminderContent('Isha', '22:15', 15, locale));
  });

  it('Jumuah-Erinnerung', () => {
    expectFullyLocalized('jumuah', (locale) => {
      const { title, body } = buildJumuahReminderContent(locale, '13:24');
      return { title, body };
    });
  });

  it('Sunnah-Gebets-Erinnerungen (Duha/Tahajjud/Witr)', () => {
    for (const prayer of ['duha', 'tahajjud', 'witr'] as const) {
      expectFullyLocalized(`sunnah:${prayer}`, (locale) => sunnahText(locale, prayer));
    }
  });

  it('Adhkar-Erinnerungen (morgens/abends)', () => {
    expectFullyLocalized('adhkar', (locale) => buildAdhkarReminderContent(locale));
  });

  it('Wiederholungs-Erinnerung — generisch und mit Themen-Platzhalter', () => {
    expectFullyLocalized('review:generic', (locale) => buildReviewReminderContent(locale));
    expectFullyLocalized('review:topic', (locale) => buildReviewReminderContent(locale, 'Tajwid'));
  });

  it('Reise-Erinnerung (Themen-Leseplan)', () => {
    expectFullyLocalized('journey', (locale) => buildJourneyReminderContent(locale));
  });

  it('Udhiyah/Qurbani-Erinnerung', () => {
    expectFullyLocalized('udhiyah', (locale) => buildUdhiyahNotificationContent(locale));
  });

  it('Vers/Hadith des Tages — nur der Titel ist übersetzt, Body kommt aus der Quelle', () => {
    const content = {
      arabic: 'ٱلْحَمْدُ لِلَّٰهِ',
      translation: 'Alles Lob gebührt Allah.',
      source: 'Al-Fatiha 1:2',
      deepLink: 'salatibox://quran/1?ayah=2',
    };
    for (const kind of ['verse', 'hadith'] as const) {
      const ref = kind === 'verse' ? ({ kind, surah: 1, ayah: 2 } as const) : ({ kind, number: 1 } as const);
      expectFullyLocalized(`verseOfDay:${kind}`, (locale) => ({
        title: buildVerseOfDayNotificationContent(ref, content, locale).title,
      }));
      // Der Body bleibt bewusst der Quelltext (Übersetzung + Quelle) — er darf
      // sich mit der UI-Sprache NICHT ändern, sonst würde hier ein
      // Sprachwechsel eine falsche Quellenangabe suggerieren.
      expect(buildVerseOfDayNotificationContent(ref, content, 'ur').body).toBe(
        buildVerseOfDayNotificationContent(ref, content, 'de').body,
      );
    }
  });

  it('Zakat-Stichtag-Erinnerung', () => {
    expectFullyLocalized('zakat', (locale) => buildZakatReminderContent(locale));
  });

  it('Wochen-Zusammenfassung — alle vier Satzvarianten', () => {
    const cases = [
      { lessonsCompleted: 3, fullPrayerDays: 5 },
      { lessonsCompleted: 3, fullPrayerDays: 0 },
      { lessonsCompleted: 0, fullPrayerDays: 5 },
      { lessonsCompleted: 0, fullPrayerDays: 0 },
    ];
    for (const stats of cases) {
      expectFullyLocalized(`weekly:${stats.lessonsCompleted}/${stats.fullPrayerDays}`, (locale) =>
        buildWeeklySummaryContent(locale, stats),
      );
    }
  });
});

describe('Unbekannte Sprache fällt sauber zurück statt zu crashen', () => {
  it('liefert für einen unbekannten Code den deutschen Text', () => {
    expect(buildZakatReminderContent('xx-YY')).toEqual(buildZakatReminderContent('de'));
    expect(buildAdhkarReminderContent('')).toEqual(buildAdhkarReminderContent('de'));
    expect(sunnahText('klingon', 'witr')).toEqual(sunnahText('de', 'witr'));
  });
});
