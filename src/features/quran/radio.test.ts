import { parseRadios } from './radio';

// Der Radio-Screen listet, was parseRadios durchlässt. Zwei Risiken: ein
// http-Stream (Android blockiert Klartext-Traffic per Default -> Sender lädt
// ewig) und ein Eintrag ohne Namen (leere Zeile in der Liste).

describe('parseRadios', () => {
  it('übernimmt gültige https-Sender unverändert', () => {
    expect(
      parseRadios({
        radios: [{ id: 7, name: 'Radio Al-Sudais', url: 'https://qurango.net/radio/sudais' }],
      }),
    ).toEqual([{ id: 7, name: 'Radio Al-Sudais', url: 'https://qurango.net/radio/sudais' }]);
  });

  it('verwirft http-Streams (Android blockiert Klartext-Traffic)', () => {
    expect(parseRadios({ radios: [{ id: 1, name: 'X', url: 'http://qurango.net/radio/x' }] })).toEqual([]);
  });

  it('verwirft Einträge ohne Namen, ohne URL oder mit falschen Typen', () => {
    expect(
      parseRadios({
        radios: [
          { id: 1, name: '   ', url: 'https://a/1' },
          { id: 2, url: 'https://a/2' },
          { id: 3, name: 'Ohne URL' },
          { name: 'Ohne ID', url: 'https://a/4' },
          { id: '5' as unknown as number, name: 'ID als String', url: 'https://a/5' },
        ],
      }),
    ).toEqual([]);
  });

  it('normalisiert Mehrfach-Leerzeichen und Zeilenumbrüche im Namen', () => {
    expect(
      parseRadios({ radios: [{ id: 1, name: '  Radio\n\tAl   Quran  ', url: 'https://a/1' }] })[0].name,
    ).toBe('Radio Al Quran');
  });

  it('behält arabische und kyrillische Sendernamen unverändert', () => {
    const parsed = parseRadios({
      radios: [
        { id: 1, name: 'إذاعة القرآن الكريم', url: 'https://a/1' },
        { id: 2, name: 'Радио Корана', url: 'https://a/2' },
        { id: 3, name: 'قرآن ریڈیو', url: 'https://a/3' },
      ],
    });
    expect(parsed.map((r) => r.name)).toEqual(['إذاعة القرآن الكريم', 'Радио Корана', 'قرآن ریڈیو']);
  });

  it('kommt mit fehlendem/leerem radios-Feld klar', () => {
    expect(parseRadios({})).toEqual([]);
    expect(parseRadios({ radios: [] })).toEqual([]);
  });
});
