/**
 * Countdown-Einheiten (Audit 2026-07-28, T17).
 *
 * Befund: „noch 1h 55m" stand fest im Code — auf Arabisch also lateinische
 * Einheiten mitten im arabischen Satz, in der Handy- wie in der TV-App. Beide
 * ziehen die Werte jetzt aus denselben Locale-Schluesseln `time.*`. Dieser Test
 * haelt zwei Dinge fest, die sonst leise auseinanderlaufen: dass jede der 14
 * Sprachen die drei Einheiten hat, und dass Handy und TV woertlich dieselben
 * benutzen.
 */
import fs from 'fs';
import path from 'path';

import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale-detect';
import { ensureLocale, translate } from '@/lib/translate';
import { COUNTDOWN_UNIT_KEYS, countdownUnits, formatCountdown } from './next-prayer';

// Nur de/en sind statisch gebuendelt; ohne dieses Nachladen liefe `translate`
// fuer ar/tr/... auf die englische Fallback-Kette und der Test wuerde das
// Gegenteil dessen pruefen, was er soll.
beforeAll(async () => {
  await Promise.all(SUPPORTED_LOCALES.map((l) => ensureLocale(l)));
});

const TV_LOCALES = path.join(__dirname, '..', '..', '..', '..', 'tv', 'src', 'locales');

function mobileUnits(locale: Locale) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamischer Pfad
  const dict = require(`@/locales/${locale}.json`) as { time: Record<string, string> };
  return dict.time;
}

function tvUnits(locale: Locale) {
  const raw = fs.readFileSync(path.join(TV_LOCALES, `${locale}.json`), 'utf8');
  return (JSON.parse(raw) as { time: Record<string, string> }).time;
}

describe('time.*-Schluessel', () => {
  it.each(SUPPORTED_LOCALES)('%s hat alle drei Einheiten, nicht leer', (locale) => {
    const u = mobileUnits(locale);
    for (const key of ['hoursShort', 'minutesShort', 'secondsShort']) {
      expect(typeof u[key]).toBe('string');
      expect(u[key].trim()).not.toBe('');
      // Kurzform: der Countdown tickt sekuendlich, ein ausgeschriebenes
      // „Minuten" sprengt die Zeile.
      expect(u[key].length).toBeLessThanOrEqual(4);
    }
  });

  it.each(SUPPORTED_LOCALES)('%s benutzt in Handy und TV dieselben Einheiten', (locale) => {
    expect(mobileUnits(locale)).toEqual(tvUnits(locale));
  });

  it('nutzt in ar/fa/ur/ps keine lateinischen Einheiten', () => {
    // Der eigentliche Befund: „بعد 1h 55m". Lateinische Buchstaben in einer
    // rechtslaeufigen Oberflaeche sind genau das, was nicht mehr vorkommen darf.
    for (const locale of ['ar', 'fa', 'ur', 'ps'] as const) {
      for (const value of Object.values(mobileUnits(locale))) {
        expect(value).not.toMatch(/[A-Za-z]/);
      }
    }
  });
});

describe('countdownUnits + formatCountdown', () => {
  it('setzt die Einheiten der aktiven Sprache ein', () => {
    const de = countdownUnits((k) => translate('de', k));
    expect(de).toEqual({ hours: 'h', minutes: 'min', seconds: 's' });
    expect(formatCountdown(3 * 3600_000 + 5 * 60_000 + 9_000, de)).toBe('3h 05min 09s');
  });

  it('liefert in Arabisch arabische Einheiten in der richtigen Reihenfolge', () => {
    const ar = countdownUnits((k) => translate('ar', k));
    const out = formatCountdown(1 * 3600_000 + 55 * 60_000 + 4_000, ar);
    // Logische Reihenfolge Zahl → Einheit; der Bidi-Algorithmus dreht die
    // Gruppen im rechtslaeufigen Absatz, gelesen beginnt es also mit den
    // Stunden. Genau so darf es NICHT mehr aussehen: „1h 55m".
    expect(out).toBe('1س 55د 04ث');
    expect(out).not.toMatch(/[A-Za-z]/);
    // Jede Gruppe haengt an ihrer Zahl (kein Leerzeichen dazwischen) — sonst
    // reisst Bidi Zahl und Einheit im Umbruch auseinander.
    for (const group of out.split(' ')) expect(group).toMatch(/^\d+\p{Script=Arabic}+$/u);
  });

  it.each(SUPPORTED_LOCALES)('%s formatiert ohne uebrig gebliebenen Platzhalter', (locale) => {
    const out = formatCountdown(65_000, countdownUnits((k) => translate(locale, k)));
    expect(out).not.toContain('{');
    // Der Fallback „Schluessel selbst" darf nie durchschlagen.
    for (const key of Object.values(COUNTDOWN_UNIT_KEYS)) expect(out).not.toContain(key);
  });
});
