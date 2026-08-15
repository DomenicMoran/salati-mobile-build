import { NO_PRAYER_TIME_OFFSETS } from '@/features/settings/types';

import { fetchTimingsWithRetry, fmtDateAladhan, isDegenerateSolarDay, onlyHHMM, TIMINGS_BUDGET_MS } from './api';

describe('fmtDateAladhan', () => {
  it('formats a date as DD-MM-YYYY (Aladhan-required path segment)', () => {
    expect(fmtDateAladhan(new Date(2026, 0, 5))).toBe('05-01-2026');
    expect(fmtDateAladhan(new Date(2026, 11, 31))).toBe('31-12-2026');
  });

  it('pads single-digit day and month', () => {
    expect(fmtDateAladhan(new Date(2027, 2, 9))).toBe('09-03-2027');
  });
});

describe('onlyHHMM', () => {
  it('strips Aladhan timezone suffix', () => {
    expect(onlyHHMM('05:12 (CET)')).toBe('05:12');
  });

  it('returns the value unchanged when there is no suffix', () => {
    expect(onlyHHMM('13:45')).toBe('13:45');
  });

  it('returns empty string for undefined input', () => {
    expect(onlyHHMM(undefined)).toBe('');
  });
});

describe('isDegenerateSolarDay', () => {
  // Echte Aladhan-Antworten für Tromsø (69,65° N), Methode 3 — an Polartagen
  // kippen die Zeiten auf einen einzigen Wert statt Zeiten zu liefern.
  it('erkennt den Polarsommer-Platzhalter (21.06.2026: alles 00:46)', () => {
    expect(
      isDegenerateSolarDay({
        Fajr: '00:46',
        Sunrise: '00:46',
        Dhuhr: '12:46',
        Asr: '17:58',
        Maghrib: '00:46',
        Isha: '00:46',
      }),
    ).toBe(true);
  });

  it('erkennt die Polarnacht-Antwort (10.12.2026: Sonnenaufgang = Dhuhr = Maghrib)', () => {
    expect(
      isDegenerateSolarDay({
        Fajr: '08:11',
        Sunrise: '11:37',
        Dhuhr: '11:37',
        Asr: '12:11',
        Maghrib: '11:37',
        Isha: '15:03',
      }),
    ).toBe(true);
  });

  it('lässt einen normalen Tag durch (Berlin 15.01.2026)', () => {
    expect(
      isDegenerateSolarDay({
        Fajr: '06:06',
        Sunrise: '08:03',
        Dhuhr: '12:21',
        Asr: '14:05',
        Maghrib: '16:29',
        Isha: '18:19',
      }),
    ).toBe(false);
  });
});

// Regressionsschutz für den Audit-Befund "kein einziger fetch() hat ein Timeout"
// (Performance-Audit 2026-07-27, §6): ein hängendes Netz — kein Fehler, keine
// Antwort — ließ den Gebetszeiten-Screen unbegrenzt laden. Der Offline-Pfad
// (adhan-js) wurde nie erreicht.
describe('fetchTimingsWithRetry — Zeitbudget bei hängendem Netz', () => {
  const BERLIN = { lat: 52.52, lon: 13.405 };
  const OPTS = { method: 3, school: 0, highLatitude: 'auto', offsets: NO_PRAYER_TIME_OFFSETS } as const;

  it('fällt spätestens nach dem Budget auf die lokale Berechnung zurück', async () => {
    const origFetch = globalThis.fetch;
    const abortSignal = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
    const origTimeoutFactory = abortSignal.timeout;
    // AbortSignal.timeout() läuft an Jests Fake-Timern vorbei (nativer Node-
    // Timer). Hermes/React Native liefert die Fabrik ohnehin nicht — hier also
    // bewusst derselbe setTimeout-Pfad wie auf dem Gerät.
    delete abortSignal.timeout;
    jest.useFakeTimers();

    const signals: AbortSignal[] = [];
    globalThis.fetch = jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          signals.push(signal);
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as unknown as typeof globalThis.fetch;

    try {
      const pending = fetchTimingsWithRetry(BERLIN.lat, BERLIN.lon, new Date(2026, 0, 15), OPTS);
      // Ein Vielfaches des Budgets: würde sich Timeout × Retry multiplizieren,
      // stünde das Promise hier noch offen und der Test liefe in den Jest-Timeout.
      await jest.advanceTimersByTimeAsync(TIMINGS_BUDGET_MS * 4);
      const result = await pending;

      expect(result.timings.Fajr).toMatch(/^\d{2}:\d{2}$/);
      expect(result.hijri).toBeUndefined();
      // Höchstens die 3 vorgesehenen Versuche — und jeder wurde abgebrochen.
      expect(signals.length).toBeGreaterThan(0);
      expect(signals.length).toBeLessThanOrEqual(3);
      expect(signals.every((s) => s.aborted)).toBe(true);
    } finally {
      jest.useRealTimers();
      globalThis.fetch = origFetch;
      if (origTimeoutFactory) abortSignal.timeout = origTimeoutFactory;
    }
  });
});
