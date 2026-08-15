/**
 * Audit 2026-07-27, Befund O1.
 *
 * Vor dem Fix hing die Namenstabelle an `locale === 'ar'`: in ur/fa/ps stand
 * die lateinische Umschrift ("Fajr") mitten im arabischschriftlichen Satz.
 * Jeder Fall unten war gegen den alten Stand rot — `prayerName('Fajr','ur')`
 * lieferte `'Fajr'`.
 */
import ar from '@/locales/ar.json';
import fa from '@/locales/fa.json';
import ps from '@/locales/ps.json';
import ur from '@/locales/ur.json';

import { PRAYERS } from './next-prayer';
import { buildPrayerReminderContent } from './notifications';
import { buildPreAdhanReminderContent } from './preAdhanReminder';
import { PRAYER_NAMES_RTL, prayerName, type RtlPrayerLocale } from './prayerNames';

const RTL_LOCALES: RtlPrayerLocale[] = ['ar', 'ur', 'fa', 'ps'];
const LATIN_LOCALES = ['de', 'en', 'tr', 'es', 'fr', 'id', 'ms', 'bn', 'ru', 'sw'];

// Die Sprachdateien sind die Quelle der Wahrheit für das, was der Nutzer im
// Screen sieht; die Tabelle im Melder muss dieselben Zeichen liefern.
const LOCALE_JSON: Record<RtlPrayerLocale, { prayers: Record<string, string> }> = {
  ar,
  ur,
  fa,
  ps,
};

describe('prayerName', () => {
  it.each(RTL_LOCALES)('liefert in %s die Landesschrift statt der Umschrift', (locale) => {
    for (const p of PRAYERS) {
      const name = prayerName(p, locale);
      expect(name).toBe(PRAYER_NAMES_RTL[locale][p]);
      // Kein lateinischer Buchstabe — genau das war der Befund.
      expect(name).not.toMatch(/[A-Za-z]/);
    }
  });

  it.each(RTL_LOCALES)('stimmt in %s zeichengleich mit prayers.* der Sprachdatei überein', (locale) => {
    const dict = LOCALE_JSON[locale].prayers;
    for (const p of PRAYERS) {
      expect(prayerName(p, locale)).toBe(dict[p.toLowerCase()]);
    }
  });

  it('behält in linksläufigen Sprachen die etablierte Umschrift', () => {
    for (const locale of LATIN_LOCALES) {
      expect(PRAYERS.map((p) => prayerName(p, locale))).toEqual([...PRAYERS]);
    }
  });

  it('fällt bei unbekanntem Sprachcode auf die Umschrift, bei unbekanntem RTL-Code auf Arabisch zurück', () => {
    expect(prayerName('Fajr', 'xx')).toBe('Fajr');
    // isRtlLanguageCode kennt genau ar/ur/fa/ps — käme eine fünfte RTL-Sprache
    // dazu, ohne dass hier jemand eine Tabelle ergänzt, bleibt es arabisch
    // (lesbar) statt lateinisch (der Fehler von oben).
    expect(prayerName('Fajr', 'ps')).toBe(PRAYER_NAMES_RTL.ps.Fajr);
  });
});

describe('Benachrichtigungstexte nutzen die Landesschrift', () => {
  it.each(RTL_LOCALES)('Adhan-Benachrichtigung in %s ohne lateinische Umschrift', (locale) => {
    const { title, body } = buildPrayerReminderContent('Dhuhr', '13:05', locale);
    expect(title).toContain(PRAYER_NAMES_RTL[locale].Dhuhr);
    expect(body).toContain(PRAYER_NAMES_RTL[locale].Dhuhr);
    expect(`${title} ${body}`).not.toMatch(/Dhuhr/);
  });

  it.each(RTL_LOCALES)('Vor-Adhan-Erinnerung in %s ohne lateinische Umschrift', (locale) => {
    const { title, body } = buildPreAdhanReminderContent('Maghrib', '20:10', 15, locale);
    expect(title).toContain(PRAYER_NAMES_RTL[locale].Maghrib);
    expect(body).toContain(PRAYER_NAMES_RTL[locale].Maghrib);
    expect(`${title} ${body}`).not.toMatch(/Maghrib/);
  });

  it('lässt Adhan- und Vor-Adhan-Melder nicht auseinanderlaufen', () => {
    for (const locale of [...RTL_LOCALES, ...LATIN_LOCALES]) {
      for (const p of PRAYERS) {
        const adhan = buildPrayerReminderContent(p, '05:00', locale);
        const pre = buildPreAdhanReminderContent(p, '05:00', 15, locale);
        const name = prayerName(p, locale);
        expect(adhan.body).toContain(name);
        expect(pre.body).toContain(name);
      }
    }
  });
});
