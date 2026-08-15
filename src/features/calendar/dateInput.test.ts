/**
 * Audit 2026-07-27, Bildschirm-Bericht M21.
 *
 * Der Hijri-Umrechner verschluckte jede ungueltige Eingabe stumm („—"). Die
 * Pruefung lag im Screen und war nicht testbar. Jetzt liefert sie einen
 * BENANNTEN Grund, den das UI uebersetzt; jeder Fall unten ist ein Text, den
 * der Nutzer vorher nie zu sehen bekam.
 */
import { parseGregorianInput, parseHijriInput } from './dateInput';

describe('parseGregorianInput', () => {
  it('nimmt ein gueltiges Datum an', () => {
    const r = parseGregorianInput('27', '7', '2026');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.getFullYear()).toBe(2026);
      expect(r.value.getMonth()).toBe(6);
      expect(r.value.getDate()).toBe(27);
    }
  });

  it.each([
    ['leerer Tag', '', '7', '2026'],
    ['leerer Monat', '27', '', '2026'],
    ['leeres Jahr', '27', '7', ''],
    ['nur Leerzeichen', '  ', '7', '2026'],
    ['Buchstaben', 'abc', '7', '2026'],
    ['Zahl mit Anhang', '27x', '7', '2026'],
    ['negatives Vorzeichen', '-1', '7', '2026'],
  ])('meldet bei %s "incomplete"', (_n, d, m, y) => {
    const r = parseGregorianInput(d, m, y);
    expect(r).toEqual({ ok: false, error: 'incomplete' });
  });

  it.each([
    ['Monat 0', '1', '0', '2026'],
    ['Monat 13', '1', '13', '2026'],
    ['Tag 0', '0', '7', '2026'],
    ['Tag 32', '32', '7', '2026'],
    ['Jahr 0', '1', '7', '0'],
    ['Jahr 10000', '1', '7', '10000'],
    ['zweistelliges Jahr (Date macht daraus 19xx)', '1', '7', '26'],
  ])('meldet bei %s "range"', (_n, d, m, y) => {
    const r = parseGregorianInput(d, m, y);
    expect(r).toEqual({ ok: false, error: 'range' });
  });

  it('meldet den 31. Februar als nicht existierend statt ihn zum 3. Maerz zu machen', () => {
    // Das ist der im Bericht genannte Fall: `new Date(2026, 1, 31)` ergibt
    // still den 3. Maerz.
    expect(parseGregorianInput('31', '2', '2026')).toEqual({ ok: false, error: 'nonexistent' });
  });

  it.each([
    ['31. April', '31', '4', '2026'],
    ['29. Februar im Nicht-Schaltjahr', '29', '2', '2026'],
  ])('meldet %s als nicht existierend', (_n, d, m, y) => {
    expect(parseGregorianInput(d, m, y)).toEqual({ ok: false, error: 'nonexistent' });
  });

  it('laesst den 29. Februar im Schaltjahr zu', () => {
    const r = parseGregorianInput('29', '2', '2024');
    expect(r.ok).toBe(true);
  });

  it('ignoriert umgebende Leerzeichen', () => {
    expect(parseGregorianInput(' 27 ', ' 7 ', ' 2026 ').ok).toBe(true);
  });
});

describe('parseHijriInput', () => {
  it('nimmt ein gueltiges Hijri-Datum an', () => {
    expect(parseHijriInput('10', '9', '1448')).toEqual({
      ok: true,
      value: { day: 10, month: 9, year: 1448 },
    });
  });

  it('laesst Tag 30 zu (Hijri-Monate haben 29 oder 30 Tage)', () => {
    expect(parseHijriInput('30', '9', '1448').ok).toBe(true);
  });

  it.each([
    ['Tag 31', '31', '9', '1448'],
    ['Monat 13', '10', '13', '1448'],
    ['Jahr 0', '10', '9', '0'],
  ])('meldet bei %s "range"', (_n, d, m, y) => {
    expect(parseHijriInput(d, m, y)).toEqual({ ok: false, error: 'range' });
  });

  it('meldet leere Felder als "incomplete"', () => {
    expect(parseHijriInput('', '9', '1448')).toEqual({ ok: false, error: 'incomplete' });
  });
});
