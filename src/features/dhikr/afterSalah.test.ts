import {
  AFTER_SALAH_PHASES,
  AFTER_SALAH_TOTAL,
  INITIAL_AFTER_SALAH_STATE,
  resetAfterSalah,
  tapAfterSalah,
  totalAfterSalahProgress,
  type AfterSalahState,
} from './afterSalah';

describe('AFTER_SALAH_PHASES', () => {
  it('ist die klassische 33/33/34-Folge, insgesamt 100', () => {
    expect(AFTER_SALAH_PHASES.map((p) => p.target)).toEqual([33, 33, 34]);
    expect(AFTER_SALAH_TOTAL).toBe(100);
  });
});

describe('tapAfterSalah', () => {
  function tapN(state: AfterSalahState, n: number): AfterSalahState {
    let s = state;
    for (let i = 0; i < n; i++) s = tapAfterSalah(s);
    return s;
  }

  it('zählt innerhalb der ersten Phase hoch', () => {
    const state = tapN(INITIAL_AFTER_SALAH_STATE, 10);
    expect(state).toEqual({ phaseIndex: 0, count: 10, complete: false });
  });

  it('wechselt nach 33 Taps automatisch zur zweiten Phase (Zähler auf 0)', () => {
    const state = tapN(INITIAL_AFTER_SALAH_STATE, 33);
    expect(state).toEqual({ phaseIndex: 1, count: 0, complete: false });
  });

  it('wechselt nach 33+33 Taps zur dritten Phase', () => {
    const state = tapN(INITIAL_AFTER_SALAH_STATE, 66);
    expect(state).toEqual({ phaseIndex: 2, count: 0, complete: false });
  });

  it('markiert nach 33+33+34 Taps die Sequenz als abgeschlossen, Zähler bleibt auf dem vollen Ziel', () => {
    const state = tapN(INITIAL_AFTER_SALAH_STATE, 100);
    expect(state).toEqual({ phaseIndex: 2, count: 34, complete: true });
  });

  it('ist nach Abschluss ein No-Op (kein weiterer Zähler-Sprung)', () => {
    const done = tapN(INITIAL_AFTER_SALAH_STATE, 100);
    expect(tapAfterSalah(done)).toEqual(done);
    expect(tapAfterSalah(tapAfterSalah(done))).toEqual(done);
  });
});

describe('resetAfterSalah', () => {
  it('liefert den Ausgangszustand', () => {
    expect(resetAfterSalah()).toEqual({ phaseIndex: 0, count: 0, complete: false });
  });
});

describe('totalAfterSalahProgress', () => {
  it('zählt Phase 0 direkt', () => {
    expect(totalAfterSalahProgress({ phaseIndex: 0, count: 5, complete: false })).toBe(5);
  });

  it('addiert abgeschlossene Phasen davor', () => {
    expect(totalAfterSalahProgress({ phaseIndex: 1, count: 10, complete: false })).toBe(33 + 10);
    expect(totalAfterSalahProgress({ phaseIndex: 2, count: 0, complete: false })).toBe(33 + 33);
  });

  it('erreicht 100 beim Abschluss', () => {
    expect(totalAfterSalahProgress({ phaseIndex: 2, count: 34, complete: true })).toBe(100);
  });
});
