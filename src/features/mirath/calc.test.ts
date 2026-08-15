import { calcMirath } from './calc';

function frac(shares: ReturnType<typeof calcMirath>['shares'], heir: string): number {
  return shares.find((s) => s.heir === heir)?.fraction ?? 0;
}

describe('calcMirath', () => {
  it('Gharrawayn: Ehemann + Vater + Mutter, keine Kinder -> Ehemann 1/2, Mutter 1/6, Vater 1/3', () => {
    const r = calcMirath({
      deceasedGender: 'female',
      hasSpouse: true,
      wivesCount: 1,
      sons: 0,
      daughters: 0,
      fatherAlive: true,
      motherAlive: true,
      fullBrothers: 0,
      fullSisters: 0,
    });
    expect(r.gharrawaynApplied).toBe(true);
    expect(frac(r.shares, 'husband')).toBeCloseTo(1 / 2);
    expect(frac(r.shares, 'mother')).toBeCloseTo(1 / 6);
    expect(frac(r.shares, 'father')).toBeCloseTo(1 / 3);
    expect(r.unresolvedRemainder).toBeCloseTo(0);
  });

  it('Ehefrau + 2 Söhne + 1 Tochter -> Ehefrau 1/8, Söhne/Tochter residuär 2:1', () => {
    const r = calcMirath({
      deceasedGender: 'male',
      hasSpouse: true,
      wivesCount: 1,
      sons: 2,
      daughters: 1,
      fatherAlive: false,
      motherAlive: false,
      fullBrothers: 0,
      fullSisters: 0,
    });
    expect(frac(r.shares, 'wife')).toBeCloseTo(1 / 8);
    const sonShare = r.shares.find((s) => s.heir === 'son');
    const daughterShare = r.shares.find((s) => s.heir === 'daughter');
    expect(sonShare?.perPerson).toBeCloseTo((daughterShare?.perPerson ?? 0) * 2);
    const total =
      frac(r.shares, 'wife') + (sonShare?.fraction ?? 0) + (daughterShare?.fraction ?? 0);
    expect(total).toBeCloseTo(1);
  });

  it('Awl-Fall: Ehemann + 2 volle Schwestern -> 3/7 und 4/7 (bekanntes Lehrbuchbeispiel)', () => {
    const r = calcMirath({
      deceasedGender: 'female',
      hasSpouse: true,
      wivesCount: 1,
      sons: 0,
      daughters: 0,
      fatherAlive: false,
      motherAlive: false,
      fullBrothers: 0,
      fullSisters: 2,
    });
    expect(r.awlApplied).toBe(true);
    expect(r.awlSumBefore).toBeCloseTo(7 / 6);
    expect(frac(r.shares, 'husband')).toBeCloseTo(3 / 7);
    expect(frac(r.shares, 'sister')).toBeCloseTo(4 / 7);
  });

  it('Einzelne Tochter ohne weitere residuäre Erben -> unresolvedRemainder statt Rateergebnis', () => {
    const r = calcMirath({
      deceasedGender: 'male',
      hasSpouse: false,
      wivesCount: 0,
      sons: 0,
      daughters: 1,
      fatherAlive: false,
      motherAlive: false,
      fullBrothers: 0,
      fullSisters: 0,
    });
    expect(frac(r.shares, 'daughter')).toBeCloseTo(1 / 2);
    expect(r.unresolvedRemainder).toBeCloseTo(1 / 2);
  });

  it('Vater als residuärer Erbe bei nur Töchtern (kein Sohn)', () => {
    const r = calcMirath({
      deceasedGender: 'male',
      hasSpouse: false,
      wivesCount: 0,
      sons: 0,
      daughters: 2,
      fatherAlive: true,
      motherAlive: false,
      fullBrothers: 0,
      fullSisters: 0,
    });
    // 2 Töchter = 2/3 fest, Vater 1/6 fest + Rest (1 - 2/3 - 1/6 = 1/6) = 1/3.
    expect(frac(r.shares, 'daughter')).toBeCloseTo(2 / 3);
    expect(frac(r.shares, 'father')).toBeCloseTo(1 / 3);
    expect(r.unresolvedRemainder).toBeCloseTo(0);
  });

  it('Awl-Fall mit residuärem Vater (Lehrbuch: 24 -> 27): Ehefrau + 2 Töchter + Vater + Mutter', () => {
    // Klassischer Fara'id-Fall: Ehefrau 1/8, 2+ Töchter 2/3, Vater 1/6, Mutter 1/6
    // ergeben ohne Awl 27/24 > 1 (112.5%). Der Vater ist zwar technisch residuär
    // (kein Sohn vorhanden), hat aber selbst einen festen Anteil (1/6) — daher
    // muss Awl trotz residuärer Klasse greifen, sonst wird mehr als die gesamte
    // Erbmasse verteilt. Erwartetes Ergebnis: Nenner 24 -> 27.
    const r = calcMirath({
      deceasedGender: 'male',
      hasSpouse: true,
      wivesCount: 1,
      sons: 0,
      daughters: 2,
      fatherAlive: true,
      motherAlive: true,
      fullBrothers: 0,
      fullSisters: 0,
    });
    expect(r.awlApplied).toBe(true);
    expect(r.awlSumBefore).toBeCloseTo(27 / 24);
    expect(frac(r.shares, 'wife')).toBeCloseTo(3 / 27);
    expect(frac(r.shares, 'daughter')).toBeCloseTo(16 / 27);
    expect(frac(r.shares, 'father')).toBeCloseTo(4 / 27);
    expect(frac(r.shares, 'mother')).toBeCloseTo(4 / 27);
    const total = r.shares.reduce((sum, s) => sum + s.fraction, 0);
    expect(total).toBeCloseTo(1);
  });

  it('Summe aller Anteile ergibt nie mehr als 1', () => {
    const r = calcMirath({
      deceasedGender: 'male',
      hasSpouse: true,
      wivesCount: 2,
      sons: 1,
      daughters: 2,
      fatherAlive: true,
      motherAlive: true,
      fullBrothers: 3,
      fullSisters: 1,
    });
    const total = r.shares.reduce((sum, s) => sum + s.fraction, 0);
    expect(total).toBeLessThanOrEqual(1.0001);
  });
});
