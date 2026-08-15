import { NO_PRAYER_TIME_OFFSETS } from '@/features/settings/types';

import { computeTimings } from './calc';
import {
  hatEingaben,
  matchMosqueTimes,
  parseHHMM,
  refineOffsets,
  type MosqueTimesInput,
} from './mosque-match';

const BERLIN = { lat: 52.52, lon: 13.405 };
const TAG = new Date(2026, 2, 20); // 20.03.2026, Tagundnachtgleiche

/** Die Zeiten, die eine Moschee mit genau diesen Einstellungen aushängen würde. */
function aushang(method: number, school: 0 | 1, verschiebung = 0): MosqueTimesInput {
  const t = computeTimings(BERLIN.lat, BERLIN.lon, TAG, {
    method,
    school,
    highLatitude: 'auto',
    offsets: NO_PRAYER_TIME_OFFSETS,
  });
  const schiebe = (hhmm: string) => {
    const min = parseHHMM(hhmm)! + verschiebung;
    return `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  };
  return {
    fajr: schiebe(t.Fajr),
    dhuhr: schiebe(t.Dhuhr),
    asr: schiebe(t.Asr),
    maghrib: schiebe(t.Maghrib),
    isha: schiebe(t.Isha),
  };
}

describe('parseHHMM', () => {
  it('liest die üblichen Schreibweisen', () => {
    expect(parseHHMM('07:05')).toBe(425);
    expect(parseHHMM('7:05')).toBe(425);
    expect(parseHHMM('7.05')).toBe(425);
    expect(parseHHMM(' 07:05 ')).toBe(425);
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('23:59')).toBe(1439);
  });

  it('weist Unsinn zurück statt ihn zu raten', () => {
    expect(parseHHMM('')).toBeNull();
    expect(parseHHMM(undefined)).toBeNull();
    expect(parseHHMM('25:00')).toBeNull();
    expect(parseHHMM('07:60')).toBeNull();
    expect(parseHHMM('705')).toBeNull();
    expect(parseHHMM('abc')).toBeNull();
  });
});

describe('hatEingaben', () => {
  it('erkennt leere und unbrauchbare Eingaben', () => {
    expect(hatEingaben({})).toBe(false);
    expect(hatEingaben({ fajr: '', isha: 'x' })).toBe(false);
    expect(hatEingaben({ isha: '21:30' })).toBe(true);
  });
});

describe('matchMosqueTimes', () => {
  it('findet die Methode zurück, aus der die Zeiten stammen', () => {
    const treffer = matchMosqueTimes(aushang(5, 0), BERLIN.lat, BERLIN.lon, TAG);
    expect(treffer).not.toBeNull();
    expect(treffer!.method).toBe(5);
    expect(treffer!.school).toBe(0);
    expect(treffer!.maxAbweichung).toBeLessThanOrEqual(1);
    expect(treffer!.ohneKorrekturBrauchbar).toBe(true);
  });

  it('meldet „ohne Korrektur" nur, wenn wirklich keine übrig bleibt', () => {
    // Der Screen schreibt bei true „trifft deine Zeiten ohne jede Korrektur".
    // Stünde daneben trotzdem eine Korrektur, widerspräche sich die Seite.
    for (const verschiebung of [0, 1, 4]) {
      const treffer = matchMosqueTimes(aushang(13, 0, verschiebung), BERLIN.lat, BERLIN.lon, TAG)!;
      const alleNull = Object.values(treffer.offsets).every((v) => v === 0);
      expect([verschiebung, treffer.ohneKorrekturBrauchbar]).toEqual([verschiebung, alleNull]);
    }
  });

  it('erkennt die spätere Asr-Zeit (Hanafi)', () => {
    const treffer = matchMosqueTimes(aushang(13, 1), BERLIN.lat, BERLIN.lon, TAG);
    expect(treffer!.school).toBe(1);
  });

  it('legt eine gleichmäßige Verschiebung in die Minuten-Korrektur', () => {
    const treffer = matchMosqueTimes(aushang(13, 0, 4), BERLIN.lat, BERLIN.lon, TAG)!;
    // Die Methode selbst trifft nicht mehr auf die Minute — genau dafür ist die
    // Korrektur da. Jede angegebene Zeit muss danach passen.
    for (const feld of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
      expect(treffer.offsets[feld]).not.toBe(0);
    }
    expect(treffer.ohneKorrekturBrauchbar).toBe(false);
  });

  it('stellt die Zeiten nach Übernahme exakt her', () => {
    const eingabe = aushang(13, 0, 3);
    const treffer = matchMosqueTimes(eingabe, BERLIN.lat, BERLIN.lon, TAG)!;
    const danach = computeTimings(BERLIN.lat, BERLIN.lon, TAG, {
      method: treffer.method,
      school: treffer.school,
      highLatitude: treffer.highLatitude,
      offsets: treffer.offsets,
    });
    expect(danach.Fajr).toBe(eingabe.fajr);
    expect(danach.Dhuhr).toBe(eingabe.dhuhr);
    expect(danach.Asr).toBe(eingabe.asr);
    expect(danach.Maghrib).toBe(eingabe.maghrib);
    expect(danach.Isha).toBe(eingabe.isha);
  });

  it('kommt mit einer einzigen angegebenen Zeit aus', () => {
    const treffer = matchMosqueTimes({ isha: '21:30' }, BERLIN.lat, BERLIN.lon, TAG)!;
    expect(treffer.verglicheneZeiten).toBe(1);
    // Nur Ischa angegeben: die übrigen Korrekturen bleiben unangetastet.
    expect(treffer.offsets.fajr).toBe(0);
    expect(treffer.offsets.dhuhr).toBe(0);
  });

  it('gibt ohne verwertbare Eingabe null zurück statt zu raten', () => {
    expect(matchMosqueTimes({}, BERLIN.lat, BERLIN.lon, TAG)).toBeNull();
    expect(matchMosqueTimes({ fajr: 'x' }, BERLIN.lat, BERLIN.lon, TAG)).toBeNull();
  });

  it('bevorzugt bei Gleichstand die Voreinstellung', () => {
    // Diyanet (13) und Muslim World League (3) haben dieselben Winkel; ein
    // Aushang nach MWL ist von einem nach Diyanet nicht immer unterscheidbar.
    // Dann soll die Voreinstellung gewinnen und nicht die Schleifenreihenfolge.
    const treffer = matchMosqueTimes({ dhuhr: '12:19' }, BERLIN.lat, BERLIN.lon, TAG)!;
    expect(treffer.method).toBe(13);
  });

  it('bleibt innerhalb der erlaubten Korrekturgrenzen', () => {
    // Absichtlich unsinnige Eingabe (Iqama-Zeiten einer ganz anderen Stadt).
    const treffer = matchMosqueTimes({ fajr: '12:00', isha: '03:00' }, BERLIN.lat, BERLIN.lon, TAG)!;
    for (const wert of Object.values(treffer.offsets)) {
      expect(wert).toBeGreaterThanOrEqual(-60);
      expect(wert).toBeLessThanOrEqual(60);
    }
    expect(treffer.maxAbweichung).toBeGreaterThan(60);
  });
});

describe('refineOffsets', () => {
  const EINGABE: MosqueTimesInput = { fajr: '02:44', dhuhr: '13:12', asr: '18:25' };
  const BASIS = matchMosqueTimes(EINGABE, BERLIN.lat, BERLIN.lon, TAG)!;

  /**
   * Der Fehler, den diese Funktion behebt (Browser-Prüfung 2026-08-07): die
   * Korrektur stammte aus der lokalen Rechnung, angezeigt wurden aber die
   * API-Zeiten. Wo beide um eine Minute abweichen, ging die Korrektur um eine
   * Minute daneben.
   */
  it('rechnet die Korrektur gegen die tatsächlich angezeigten Zeiten', () => {
    const angezeigt = { Fajr: '02:44', Sunrise: '05:36', Dhuhr: '13:12', Asr: '18:25', Maghrib: '20:48', Isha: '23:22' };
    const verfeinert = refineOffsets(BASIS, EINGABE, angezeigt);
    // Die API trifft die Eingabe hier exakt — es darf KEINE Korrektur bleiben.
    expect(verfeinert.offsets).toEqual({ fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });
    expect(verfeinert.ohneKorrekturBrauchbar).toBe(true);
    expect(verfeinert.maxAbweichung).toBe(0);
  });

  it('verschiebt genau um die Differenz zur angezeigten Zeit', () => {
    const angezeigt = { Fajr: '02:42', Sunrise: '05:36', Dhuhr: '13:14', Asr: '18:25', Maghrib: '20:48', Isha: '23:22' };
    const verfeinert = refineOffsets(BASIS, EINGABE, angezeigt);
    expect(verfeinert.offsets.fajr).toBe(2);
    expect(verfeinert.offsets.dhuhr).toBe(-2);
    expect(verfeinert.offsets.asr).toBe(0);
    // Nicht eingetragene Gebete bleiben unangetastet.
    expect(verfeinert.offsets.maghrib).toBe(0);
    expect(verfeinert.offsets.isha).toBe(0);
  });

  it('behält Methode und Asr-Schule des lokalen Treffers bei', () => {
    const angezeigt = { Fajr: '02:42', Sunrise: '05:36', Dhuhr: '13:14', Asr: '18:25', Maghrib: '20:48', Isha: '23:22' };
    const verfeinert = refineOffsets(BASIS, EINGABE, angezeigt);
    expect([verfeinert.method, verfeinert.school, verfeinert.highLatitude]).toEqual([
      BASIS.method,
      BASIS.school,
      BASIS.highLatitude,
    ]);
  });

  it('gibt den Treffer unverändert zurück, wenn nichts vergleichbar ist', () => {
    const angezeigt = { Fajr: '', Sunrise: '', Dhuhr: '', Asr: '', Maghrib: '', Isha: '' };
    expect(refineOffsets(BASIS, EINGABE, angezeigt)).toBe(BASIS);
  });

  it('hält auch nach dem Nachrechnen die Korrekturgrenzen ein', () => {
    // Angezeigte Zeiten aus einer ganz anderen Zeitzone: die Differenz wäre
    // größer als ±60 Minuten und muss gekappt werden.
    const angezeigt = { Fajr: '12:00', Sunrise: '15:00', Dhuhr: '20:00', Asr: '02:00', Maghrib: '05:00', Isha: '08:00' };
    const verfeinert = refineOffsets(BASIS, EINGABE, angezeigt);
    for (const wert of Object.values(verfeinert.offsets)) {
      expect(wert).toBeGreaterThanOrEqual(-60);
      expect(wert).toBeLessThanOrEqual(60);
    }
  });
});
