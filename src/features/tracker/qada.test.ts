import {
  applyQadaChange,
  applyQadaMakeUp,
  applyQadaMakeUpDay,
  canMakeUpFullDay,
  parsePrayerQadaData,
  parsePrayerQadaState,
  serializePrayerQadaState,
  totalQadaOwed,
  type PrayerQadaState,
} from './qada';

const empty = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

describe('parsePrayerQadaData', () => {
  it('leerer Datensatz bei null (kein gespeicherter Wert)', () => {
    expect(parsePrayerQadaData(null)).toEqual({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });
  });

  it('parst einen gültigen Pro-Gebetsart-Datensatz', () => {
    expect(parsePrayerQadaData('{"fajr":3,"dhuhr":0,"asr":1,"maghrib":2,"isha":0}')).toEqual({
      fajr: 3,
      dhuhr: 0,
      asr: 1,
      maghrib: 2,
      isha: 0,
    });
  });

  it('rundet auf ganze Gebete ab und ignoriert negative Werte', () => {
    expect(parsePrayerQadaData('{"fajr":3.7,"dhuhr":-2,"asr":0,"maghrib":0,"isha":0}')).toEqual({
      fajr: 3,
      dhuhr: 0,
      asr: 0,
      maghrib: 0,
      isha: 0,
    });
  });

  it('leerer Datensatz bei kaputtem JSON oder falscher Struktur', () => {
    expect(parsePrayerQadaData('nope')).toEqual({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });
    expect(parsePrayerQadaData('[1,2,3]')).toEqual({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });
    expect(parsePrayerQadaData('')).toEqual({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });
  });

  it('ignoriert unbekannte Felder und füllt fehlende Gebetsarten mit 0', () => {
    expect(parsePrayerQadaData('{"fajr":2,"witr":5,"unknown":9}')).toEqual({
      fajr: 2,
      dhuhr: 0,
      asr: 0,
      maghrib: 0,
      isha: 0,
    });
  });

  it('Legacy-Format (einzelne Zahl aus der Vor-Pro-Gebetsart-Version) wird komplett auf Fajr gebucht', () => {
    expect(parsePrayerQadaData('5')).toEqual({ fajr: 5, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });
  });

  it('negative Legacy-Zahl ergibt leeren Datensatz', () => {
    expect(parsePrayerQadaData('-3')).toEqual({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });
  });
});

describe('totalQadaOwed', () => {
  it('summiert alle Gebetsarten', () => {
    expect(totalQadaOwed({ fajr: 3, dhuhr: 0, asr: 1, maghrib: 2, isha: 0 })).toBe(6);
  });

  it('0 bei leerem Datensatz', () => {
    expect(totalQadaOwed({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 })).toBe(0);
  });
});

describe('parsePrayerQadaState', () => {
  it('liest den Nachhol-Stand aus dem done-Feld', () => {
    const state = parsePrayerQadaState('{"fajr":3,"dhuhr":1,"done":{"fajr":10,"isha":2}}');
    expect(state.owed).toEqual({ ...empty, fajr: 3, dhuhr: 1 });
    expect(state.done).toEqual({ ...empty, fajr: 10, isha: 2 });
  });

  it('ältere Datenstände ohne done-Feld bleiben lesbar', () => {
    const state = parsePrayerQadaState('{"fajr":3,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}');
    expect(state.owed.fajr).toBe(3);
    expect(state.done).toEqual(empty);
  });

  it('Legacy-Zahl und leerer Speicher ergeben einen leeren Nachhol-Stand', () => {
    expect(parsePrayerQadaState('5')).toEqual({ owed: { ...empty, fajr: 5 }, done: empty });
    expect(parsePrayerQadaState(null)).toEqual({ owed: empty, done: empty });
    expect(parsePrayerQadaState('kaputt')).toEqual({ owed: empty, done: empty });
  });

  it('ein unbrauchbares done-Feld wird verworfen statt zu stören', () => {
    expect(parsePrayerQadaState('{"fajr":1,"done":42}').done).toEqual(empty);
    expect(parsePrayerQadaState('{"fajr":1,"done":[1,2]}').done).toEqual(empty);
    expect(parsePrayerQadaState('{"fajr":1,"done":{"fajr":-4}}').done).toEqual(empty);
  });

  it('Hin- und Rückweg über die Serialisierung erhält beide Stände', () => {
    const state: PrayerQadaState = {
      owed: { fajr: 4, dhuhr: 0, asr: 2, maghrib: 0, isha: 1 },
      done: { fajr: 12, dhuhr: 3, asr: 0, maghrib: 0, isha: 0 },
    };
    expect(parsePrayerQadaState(serializePrayerQadaState(state))).toEqual(state);
  });

  it('der offene Bestand steht weiterhin auf oberster Ebene (alte Leser bleiben korrekt)', () => {
    const raw = serializePrayerQadaState({ owed: { ...empty, fajr: 7 }, done: { ...empty, fajr: 2 } });
    expect(parsePrayerQadaData(raw)).toEqual({ ...empty, fajr: 7 });
  });
});

describe('Bestand korrigieren vs. nachholen', () => {
  const state: PrayerQadaState = { owed: { ...empty, fajr: 5, isha: 2 }, done: { ...empty, fajr: 1 } };

  it('change verändert nur den offenen Bestand', () => {
    const next = applyQadaChange(state, 'fajr', 10);
    expect(next.owed.fajr).toBe(15);
    expect(next.done).toEqual(state.done);
  });

  it('change geht nicht unter null', () => {
    expect(applyQadaChange(state, 'isha', -10).owed.isha).toBe(0);
  });

  it('makeUp bucht um: weniger offen, mehr nachgeholt', () => {
    const next = applyQadaMakeUp(state, 'fajr', 2);
    expect(next.owed.fajr).toBe(3);
    expect(next.done.fajr).toBe(3);
    // Gesamtzahl der jemals eingetragenen Gebete bleibt gleich
    expect(next.owed.fajr + next.done.fajr).toBe(state.owed.fajr + state.done.fajr);
  });

  it('makeUp bucht nie mehr, als offen ist', () => {
    const next = applyQadaMakeUp(state, 'isha', 99);
    expect(next.owed.isha).toBe(0);
    expect(next.done.isha).toBe(2);
  });

  it('makeUp ohne offenen Bestand ändert nichts', () => {
    expect(applyQadaMakeUp(state, 'asr', 3)).toBe(state);
    expect(applyQadaMakeUp(state, 'fajr', 0)).toBe(state);
    expect(applyQadaMakeUp(state, 'fajr', -2)).toBe(state);
  });

  it('ein ganzer Tag ist nur nachholbar, wenn alle 5 Gebetsarten offen sind', () => {
    expect(canMakeUpFullDay(state)).toBe(false);
    expect(applyQadaMakeUpDay(state)).toBe(state);

    const voll: PrayerQadaState = { owed: { fajr: 2, dhuhr: 2, asr: 2, maghrib: 2, isha: 1 }, done: { ...empty } };
    expect(canMakeUpFullDay(voll)).toBe(true);
    const next = applyQadaMakeUpDay(voll);
    expect(next.owed).toEqual({ fajr: 1, dhuhr: 1, asr: 1, maghrib: 1, isha: 0 });
    expect(next.done).toEqual({ fajr: 1, dhuhr: 1, asr: 1, maghrib: 1, isha: 1 });
    expect(canMakeUpFullDay(next)).toBe(false);
  });
});
