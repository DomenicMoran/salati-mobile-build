import { islamicDayKeys } from './islamicDays';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale-detect';

import ar from '@/locales/ar.json';
import bn from '@/locales/bn.json';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fa from '@/locales/fa.json';
import fr from '@/locales/fr.json';
import id from '@/locales/id.json';
import ms from '@/locales/ms.json';
import ps from '@/locales/ps.json';
import ru from '@/locales/ru.json';
import sw from '@/locales/sw.json';
import tr from '@/locales/tr.json';
import ur from '@/locales/ur.json';

type CalendarLocale = { calendar?: { days?: Record<string, string> } };
const LOCALE_FILES: Record<Locale, CalendarLocale> = {
  ar,
  bn,
  de,
  en,
  es,
  fa,
  fr,
  id,
  ms,
  ps,
  ru,
  sw,
  tr,
  ur,
};

// Religiöse Kalendertage: ein falsches Hijri-Datum würde einem Nutzer den
// Ashura-Fastentag oder Arafah am FALSCHEN Tag anzeigen. Die Zuordnung ist
// hier deshalb explizit gegen die klassischen Daten geprüft — nicht nur die
// Existenz eines Schlüssels.

describe('islamicDayKeys — die neun kuratierten Tage', () => {
  const expected: [number, number, string][] = [
    [1, 1, 'newYear'], // 1. Muharram
    [1, 10, 'ashura'], // 10. Muharram
    [3, 12, 'mawlid'], // 12. Rabi al-Awwal
    [7, 27, 'miraj'], // 27. Rajab
    [9, 1, 'ramadanStart'], // 1. Ramadan
    [9, 27, 'laylatAlQadr'], // 27. Ramadan
    [10, 1, 'eidFitr'], // 1. Shawwal
    [12, 9, 'arafah'], // 9. Dhu al-Hijjah
    [12, 10, 'eidAdha'], // 10. Dhu al-Hijjah
  ];

  it.each(expected)('Hijri %i-%i → %s', (month, day, key) => {
    expect(islamicDayKeys(month, day)).toEqual([key]);
  });

  it('Arafah liegt genau einen Tag vor Eid al-Adha', () => {
    expect(islamicDayKeys(12, 9)).toEqual(['arafah']);
    expect(islamicDayKeys(12, 10)).toEqual(['eidAdha']);
  });

  it('Laylat al-Qadr liegt im Ramadan, nicht in Shawwal', () => {
    expect(islamicDayKeys(9, 27)).toEqual(['laylatAlQadr']);
    expect(islamicDayKeys(10, 27)).toEqual([]);
  });
});

describe('islamicDayKeys — gewöhnliche und ungültige Tage', () => {
  it('liefert für einen gewöhnlichen Tag eine leere Liste', () => {
    expect(islamicDayKeys(2, 15)).toEqual([]);
    expect(islamicDayKeys(9, 15)).toEqual([]);
  });

  it('liefert für Monat/Tag außerhalb des Hijri-Kalenders eine leere Liste', () => {
    expect(islamicDayKeys(0, 1)).toEqual([]);
    expect(islamicDayKeys(13, 1)).toEqual([]);
    expect(islamicDayKeys(1, 0)).toEqual([]);
    expect(islamicDayKeys(1, 31)).toEqual([]);
    expect(islamicDayKeys(Number.NaN, Number.NaN)).toEqual([]);
  });

  it('markiert im ganzen Hijri-Jahr genau neun Tage', () => {
    let marked = 0;
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 30; d++) marked += islamicDayKeys(m, d).length;
    }
    expect(marked).toBe(9);
  });
});

describe('islamicDayKeys — jeder Schlüssel ist in allen 14 Sprachen übersetzt', () => {
  // Der Rückgabewert ist ein Locale-Key-Suffix (calendar.days.*). Fehlt er in
  // einer Sprachdatei, zeigt der Kalender dort den rohen Schlüsselnamen.
  it.each(SUPPORTED_LOCALES)('%s hat alle calendar.days.*-Texte', (locale) => {
    const days = LOCALE_FILES[locale].calendar?.days ?? {};
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 30; d++) {
        for (const key of islamicDayKeys(m, d)) {
          expect(typeof days[key]).toBe('string');
          expect(days[key].trim()).not.toBe('');
        }
      }
    }
  });
});
