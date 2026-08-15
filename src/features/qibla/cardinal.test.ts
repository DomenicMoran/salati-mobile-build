import { cardinalKey } from './cardinal';

// Der Schlüssel landet direkt in `qibla.dir.<key>` — ein Off-by-one im
// Sektor-Index würde dem Nutzer eine FALSCHE Himmelsrichtung zur Qibla
// anzeigen (z. B. "Südost" statt "Süd"). Deshalb hier explizit die
// Sektor-Grenzen und der Wrap um 360°/0°.

describe('cardinalKey — Sektor-Mitten', () => {
  const centers: [number, string][] = [
    [0, 'n'],
    [45, 'no'],
    [90, 'o'],
    [135, 'so'],
    [180, 's'],
    [225, 'sw'],
    [270, 'w'],
    [315, 'nw'],
  ];
  it.each(centers)('%i° → %s', (bearing, key) => {
    expect(cardinalKey(bearing)).toBe(key);
  });
});

describe('cardinalKey — Sektor-Grenzen (22,5° Halbschritte)', () => {
  it('kippt bei 22,5° von Nord auf Nordost', () => {
    expect(cardinalKey(22.4)).toBe('n');
    expect(cardinalKey(22.5)).toBe('no');
  });

  it('kippt bei 337,5° zurück auf Nord (Wrap über 360°)', () => {
    expect(cardinalKey(337.4)).toBe('nw');
    expect(cardinalKey(337.5)).toBe('n');
    expect(cardinalKey(359.9)).toBe('n');
  });
});

describe('cardinalKey — Werte außerhalb 0..360', () => {
  it('normalisiert negative Peilungen', () => {
    expect(cardinalKey(-45)).toBe('nw');
    expect(cardinalKey(-90)).toBe('w');
    expect(cardinalKey(-360)).toBe('n');
  });

  it('normalisiert Peilungen über 360° (mehrfache Umdrehungen)', () => {
    expect(cardinalKey(360)).toBe('n');
    expect(cardinalKey(450)).toBe('o');
    expect(cardinalKey(-720 + 180)).toBe('s');
  });

  it('liefert für jede ganze Gradzahl einen gültigen Schlüssel', () => {
    const valid = new Set(['n', 'no', 'o', 'so', 's', 'sw', 'w', 'nw']);
    for (let b = -720; b <= 720; b++) {
      expect(valid.has(cardinalKey(b))).toBe(true);
    }
  });
});

describe('cardinalKey — Qibla ab Berlin', () => {
  // Berlin → Kaaba liegt bei ~136° (s. qibla/bearing.ts) — muss "Südost" sein.
  it('136° ab Berlin ist Südost', () => {
    expect(cardinalKey(136)).toBe('so');
  });
});
