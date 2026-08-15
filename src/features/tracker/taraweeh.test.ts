import {
  changeTaraweehRakaat,
  parseTaraweehData,
  setTaraweehRakaat,
  taraweehNightsCount,
  taraweehTotal,
} from './taraweeh';

describe('parseTaraweehData', () => {
  it('leerer Datensatz bei null/kaputtem JSON', () => {
    expect(parseTaraweehData(null)).toEqual({});
    expect(parseTaraweehData('kaputt{')).toEqual({});
  });

  it('parst einen gültigen Nacht->Rakaat-Datensatz', () => {
    expect(parseTaraweehData('{"2026-03-01":8,"2026-03-02":20}')).toEqual({
      '2026-03-01': 8,
      '2026-03-02': 20,
    });
  });

  it('Array statt Objekt ergibt leeres Objekt', () => {
    expect(parseTaraweehData('[]')).toEqual({});
    expect(parseTaraweehData('null')).toEqual({});
  });

  it('rundet auf ganze Rakaat ab und ignoriert negative/ungültige Werte', () => {
    expect(parseTaraweehData('{"2026-03-01":11.5,"2026-03-02":-4,"2026-03-03":"nope"}')).toEqual({
      '2026-03-01': 11,
    });
  });
});

describe('setTaraweehRakaat', () => {
  it('setzt eine positive Zahl für den Tag', () => {
    expect(setTaraweehRakaat({}, '2026-03-01', 20)).toEqual({ '2026-03-01': 20 });
  });

  it('clamped negative Eingaben auf 0 und entfernt den Tag dabei', () => {
    expect(setTaraweehRakaat({ '2026-03-01': 8 }, '2026-03-01', -5)).toEqual({});
  });

  it('0 entfernt den Eintrag statt ihn als 0 zu speichern', () => {
    expect(setTaraweehRakaat({ '2026-03-01': 8 }, '2026-03-01', 0)).toEqual({});
  });

  it('rundet Nicht-Ganzzahlen ab', () => {
    expect(setTaraweehRakaat({}, '2026-03-01', 9.9)).toEqual({ '2026-03-01': 9 });
  });

  it('lässt andere Tage unangetastet', () => {
    expect(setTaraweehRakaat({ '2026-03-01': 8 }, '2026-03-02', 12)).toEqual({
      '2026-03-01': 8,
      '2026-03-02': 12,
    });
  });
});

describe('changeTaraweehRakaat', () => {
  it('erhöht von 0 in 2er-Schritten', () => {
    let data = {};
    data = changeTaraweehRakaat(data, '2026-03-01', 2);
    expect(data).toEqual({ '2026-03-01': 2 });
    data = changeTaraweehRakaat(data, '2026-03-01', 2);
    expect(data).toEqual({ '2026-03-01': 4 });
  });

  it('kann nicht unter 0 fallen', () => {
    expect(changeTaraweehRakaat({ '2026-03-01': 2 }, '2026-03-01', -4)).toEqual({});
  });

  it('startet bei 0, wenn der Tag noch keinen Eintrag hat', () => {
    expect(changeTaraweehRakaat({}, '2026-03-01', -2)).toEqual({});
  });
});

describe('taraweehTotal / taraweehNightsCount', () => {
  const data = { '2026-03-01': 8, '2026-03-02': 20, '2026-03-03': 0 };

  it('summiert alle Rakaat über alle Nächte', () => {
    expect(taraweehTotal(data)).toBe(28);
  });

  it('0 bei leerem Datensatz', () => {
    expect(taraweehTotal({})).toBe(0);
  });

  it('zählt nur Nächte mit mindestens 1 Rakaat', () => {
    expect(taraweehNightsCount(data)).toBe(2);
    expect(taraweehNightsCount({})).toBe(0);
  });
});
