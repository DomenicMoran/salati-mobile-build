import { parseCustomDhikr, sanitizeTarget } from './custom';

describe('custom dhikr storage', () => {
  it('lädt gespeicherte Einträge', () => {
    const raw = JSON.stringify([{ id: 'custom-1', text: 'La hawla wa la quwwata illa billah', target: 33 }]);
    expect(parseCustomDhikr(raw)).toEqual([
      { id: 'custom-1', text: 'La hawla wa la quwwata illa billah', target: 33 },
    ]);
  });

  it('filtert kaputte Einträge heraus', () => {
    const raw = JSON.stringify([
      { id: 'custom-1', text: 'Hasbunallah', target: 7 },
      { id: 'custom-2', text: '', target: 33 }, // leerer Text
      { id: 'custom-3', text: 'x', target: 0 }, // Ziel < 1
      { id: 'custom-4', text: 'x' }, // Ziel fehlt
      null,
      'nope',
    ]);
    expect(parseCustomDhikr(raw)).toEqual([{ id: 'custom-1', text: 'Hasbunallah', target: 7 }]);
  });

  it('fällt bei kaputtem JSON oder Nicht-Array auf leere Liste zurück', () => {
    expect(parseCustomDhikr('{nope')).toEqual([]);
    expect(parseCustomDhikr('{"a":1}')).toEqual([]);
    expect(parseCustomDhikr(null)).toEqual([]);
  });

  it('sanitizeTarget klemmt auf 1-9999 und fällt sonst auf 33 zurück', () => {
    expect(sanitizeTarget('33')).toBe(33);
    expect(sanitizeTarget(' 100 ')).toBe(100);
    expect(sanitizeTarget('99999')).toBe(9999);
    expect(sanitizeTarget('0')).toBe(33);
    expect(sanitizeTarget('-5')).toBe(33);
    expect(sanitizeTarget('abc')).toBe(33);
    expect(sanitizeTarget('')).toBe(33);
  });
});
