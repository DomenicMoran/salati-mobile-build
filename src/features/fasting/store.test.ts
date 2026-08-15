import { fastCountdown, isRamadanMonth, parseFasting } from './store';

describe('parseFasting', () => {
  it('leer/kaputt ergibt leeres Objekt', () => {
    expect(parseFasting(null)).toEqual({});
    expect(parseFasting('kaputt{')).toEqual({});
  });

  it('gültige Daten werden übernommen', () => {
    expect(parseFasting('{"2026-03-01":true}')).toEqual({ '2026-03-01': true });
  });

  it('Array statt Objekt ergibt leeres Objekt (typeof [] === "object" reicht nicht)', () => {
    expect(parseFasting('[]')).toEqual({});
    expect(parseFasting('null')).toEqual({});
  });
});

describe('isRamadanMonth', () => {
  it('erkennt Hijri-Monat 9 (Ramadan) als String, wie von Aladhan geliefert', () => {
    expect(isRamadanMonth('9')).toBe(true);
  });

  it('erkennt Monat 9 auch als Number', () => {
    expect(isRamadanMonth(9)).toBe(true);
  });

  it('lehnt alle anderen Hijri-Monate ab', () => {
    expect(isRamadanMonth('1')).toBe(false);
    expect(isRamadanMonth('10')).toBe(false);
    expect(isRamadanMonth(12)).toBe(false);
  });

  it('lehnt undefined/kaputte Werte ab, statt zu crashen', () => {
    expect(isRamadanMonth(undefined)).toBe(false);
    expect(isRamadanMonth('abc')).toBe(false);
  });
});

describe('fasting-Dashboard-Karte: Ramadan-Countdown-Zustand', () => {
  // Reine Zeitrechnung fuer die neue Home-Dashboard-Karte (Suhoor-/Iftar-
  // Countdown) - baut direkt auf der bestehenden fastCountdown()-Logik auf,
  // die die Fasten-Tracker-Karte (app/fasting.tsx) bereits nutzt.
  const fajr = '04:30';
  const maghrib = '20:45';

  it('vor Fajr: Phase suhoor, Rest bis Suhoor-Ende', () => {
    const now = new Date(2026, 2, 10, 2, 0, 0, 0);
    const result = fastCountdown(fajr, maghrib, now);
    expect(result.phase).toBe('suhoor');
    expect(result.msRemaining).toBeGreaterThan(0);
  });

  it('zwischen Fajr und Maghrib: Phase iftar, Rest bis Iftar', () => {
    const now = new Date(2026, 2, 10, 12, 0, 0, 0);
    const result = fastCountdown(fajr, maghrib, now);
    expect(result.phase).toBe('iftar');
    expect(result.msRemaining).toBeGreaterThan(0);
  });

  it('nach Maghrib: Phase done, kein Rest mehr', () => {
    const now = new Date(2026, 2, 10, 21, 0, 0, 0);
    const result = fastCountdown(fajr, maghrib, now);
    expect(result.phase).toBe('done');
    expect(result.msRemaining).toBe(0);
  });
});
