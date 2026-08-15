import { angleLerp, headingFromOrientationEvent, SCREEN_ANGLE_CONVENTION } from './useCompass';

describe('headingFromOrientationEvent', () => {
  it('nutzt webkitCompassHeading direkt (iOS Safari, 0° = Norden im Uhrzeigersinn)', () => {
    expect(headingFromOrientationEvent({ webkitCompassHeading: 137, alpha: 20 })).toBe(137);
    expect(headingFromOrientationEvent({ webkitCompassHeading: 370, alpha: null })).toBe(10);
  });

  it('wandelt absolutes alpha (gegen Uhrzeigersinn) in Kompass-Heading um', () => {
    expect(headingFromOrientationEvent({ absolute: true, alpha: 0 })).toBe(0);
    expect(headingFromOrientationEvent({ absolute: true, alpha: 90 })).toBe(270);
    expect(headingFromOrientationEvent({ absolute: true, alpha: 350 })).toBe(10);
  });

  it('verwirft relative (nicht-absolute) alpha-Werte — kein irreführender Kompass', () => {
    expect(headingFromOrientationEvent({ absolute: false, alpha: 90 })).toBeNull();
    expect(headingFromOrientationEvent({ alpha: 90 })).toBeNull();
    expect(headingFromOrientationEvent({ absolute: true, alpha: null })).toBeNull();
  });

  it('ignoriert screenAngle bei webkitCompassHeading (iOS rechnet die Drehung selbst heraus)', () => {
    expect(headingFromOrientationEvent({ webkitCompassHeading: 137, alpha: 20 }, 90)).toBe(137);
  });
});

/**
 * Audit 2026-07-27, Befund O3 — bewusst NICHT „auf Verdacht" geändert.
 *
 * Der `screenAngle`-Pfad war bis hierher vollständig ungetestet. Die beiden
 * kursierenden Formeln unterscheiden sich um 2 × screenAngle (im Querformat
 * also 180°); welche stimmt, entscheidet sich am Gerät. Diese Suite hält
 * beide Konventionen mit denselben Eingabewerten fest: nach der
 * Geräte-Prüfung (Anleitung an `SCREEN_ANGLE_CONVENTION` in useCompass.ts)
 * ist die Umstellung ein Einzeiler, und dieser Test sagt sofort, ob der
 * Schalter wirklich das tut, was auf ihm steht.
 */
describe('Bildschirm-Rotationskorrektur (screenAngle)', () => {
  // alpha, screenAngle, Erwartung 'add', Erwartung 'subtract'
  const CASES: [number, number, number, number][] = [
    [0, 0, 0, 0],
    [0, 90, 90, 270],
    [90, 90, 0, 180],
    [90, 270, 180, 0],
    // 180° ist der Fall, in dem beide Konventionen zusammenfallen
    // (2 × 180 ≡ 0 mod 360) — nützlich als Kontrollpunkt.
    [45, 180, 135, 135],
    [350, 90, 100, 280],
  ];

  it.each(CASES)(
    'alpha=%s, screenAngle=%s → add: %s°',
    (alpha, screenAngle, expectedAdd) => {
      expect(headingFromOrientationEvent({ absolute: true, alpha }, screenAngle, 'add')).toBe(expectedAdd);
    },
  );

  it.each(CASES)(
    'alpha=%s, screenAngle=%s → subtract: %s°',
    (alpha, screenAngle, _add, expectedSubtract) => {
      expect(headingFromOrientationEvent({ absolute: true, alpha }, screenAngle, 'subtract')).toBe(
        expectedSubtract,
      );
    },
  );

  it('unterscheidet sich zwischen den Konventionen um genau 2 × screenAngle', () => {
    for (const [alpha, screenAngle] of CASES) {
      const add = headingFromOrientationEvent({ absolute: true, alpha }, screenAngle, 'add') as number;
      const sub = headingFromOrientationEvent({ absolute: true, alpha }, screenAngle, 'subtract') as number;
      expect((add - sub + 720) % 360).toBe((2 * screenAngle) % 360);
    }
  });

  it('liefert ohne Drehung (Hochformat) in beiden Konventionen dasselbe', () => {
    for (const alpha of [0, 37, 180, 359]) {
      expect(headingFromOrientationEvent({ absolute: true, alpha }, 0, 'add')).toBe(
        headingFromOrientationEvent({ absolute: true, alpha }, 0, 'subtract'),
      );
    }
  });

  it('nutzt ohne dritten Parameter die eingestellte Konvention', () => {
    for (const [alpha, screenAngle] of CASES) {
      expect(headingFromOrientationEvent({ absolute: true, alpha }, screenAngle)).toBe(
        headingFromOrientationEvent({ absolute: true, alpha }, screenAngle, SCREEN_ANGLE_CONVENTION),
      );
    }
  });

  it('bleibt für jede Kombination im gültigen Bereich 0…360', () => {
    for (let alpha = 0; alpha <= 360; alpha += 15) {
      for (const screenAngle of [0, 90, 180, 270]) {
        for (const convention of ['add', 'subtract'] as const) {
          const h = headingFromOrientationEvent({ absolute: true, alpha }, screenAngle, convention);
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThan(360);
        }
      }
    }
  });
});

describe('angleLerp', () => {
  it('interpolates linearly for a normal (non-wrapping) case', () => {
    expect(angleLerp(0, 90, 0.5)).toBeCloseTo(45, 5);
  });

  it('takes the short way across the 0/360 boundary', () => {
    // von 350 nach 10 ist die kürzeste Route +20 (über 0), nicht -340
    expect(angleLerp(350, 10, 0.5)).toBeCloseTo(0, 5);
  });

  it('is a no-op at t=0', () => {
    expect(angleLerp(123, 45, 0)).toBeCloseTo(123, 5);
  });
});
