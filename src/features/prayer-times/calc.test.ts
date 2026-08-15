import { NO_PRAYER_TIME_OFFSETS, type PrayerTimeOffsets } from '@/features/settings/types';
import { METHODS } from '@/features/settings/methods';

import { aladhanLatitudeAdjustment, computeTimings, computeUpcomingTimings, resolveHighLatitudeRule } from './calc';
import { shiftHHMM } from './offsets';

// Referenzort Berlin (52,52° N / 13,405° O) — der Default-Standort der App und
// mit >48° Breite genau der Fall, für den die Hochbreiten-Regel gebraucht wird.
const BERLIN = { lat: 52.52, lon: 13.405 };
// Referenzort Mekka — unter 48° Breite, dient als Gegenprobe für "auto".
const MAKKAH = { lat: 21.3891, lon: 39.8579 };

// Die Tests laufen in der Zeitzone des Rechners; adhan-js rechnet über JS-Date
// ebenfalls lokal. Die Referenzwerte unten sind in BERLINER Ortszeit angegeben
// und werden auf die Zeitzone des Testrechners umgerechnet — sonst wäre der
// Test nur auf einem Rechner in Europe/Berlin grün.
function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Berliner Ortszeit → Ortszeit des Testrechners (`berlinOffset` in Minuten zu UTC). */
function asLocal(hhmm: string, berlinOffset: number, at: Date): string {
  return shiftHHMM(hhmm, -at.getTimezoneOffset() - berlinOffset);
}

const base = { highLatitude: 'auto', offsets: NO_PRAYER_TIME_OFFSETS } as const;

describe('Methoden-Mapping Aladhan → adhan-js', () => {
  const JUNE = new Date(2026, 5, 21); // Sommersonnenwende
  const DECEMBER = new Date(2026, 11, 21); // Wintersonnenwende

  // Referenzwerte Berlin, Muslim World League, Shafi, Hochbreiten-Regel "auto".
  // Sonnenaufgang/Dhuhr/Maghrib sind gegen die astronomischen Ist-Werte für
  // Berlin gegengeprüft (21.06.: Sonnenaufgang 04:43, Sonnenhöchststand 13:09,
  // Sonnenuntergang 21:33 MESZ; 21.12.: 08:15 / 12:05 / 15:54 MEZ).
  it('Referenzwerte Berlin 21.06.2026 (MESZ, UTC+2)', () => {
    const t = computeTimings(BERLIN.lat, BERLIN.lon, JUNE, { ...base, method: 3, school: 0 });
    expect(t.Sunrise).toBe(asLocal('04:43', 120, JUNE));
    expect(t.Dhuhr).toBe(asLocal('13:09', 120, JUNE));
    expect(t.Maghrib).toBe(asLocal('21:33', 120, JUNE));
    // Fadschr/Ischa hängen als einzige an der Hochbreiten-Regel. Seit 1.37.0
    // löst `auto` in Berlin winkelbasiert auf statt auf die Siebtel-Regel;
    // damit gilt hier 02:34/23:35 statt vorher 03:42/22:35. Beide Werte live
    // gegen api.aladhan.com/v1/timings/21-06-2026 (method=3, school=0,
    // latitudeAdjustmentMethod=3) geprüft — die Antwort liefert exakt
    // Fajr 02:34, Isha 23:35.
    expect(t.Fajr).toBe(asLocal('02:34', 120, JUNE));
    expect(t.Asr).toBe(asLocal('17:33', 120, JUNE));
    expect(t.Isha).toBe(asLocal('23:35', 120, JUNE));
  });

  it('Referenzwerte Berlin 21.12.2026 (MEZ, UTC+1)', () => {
    const t = computeTimings(BERLIN.lat, BERLIN.lon, DECEMBER, { ...base, method: 3, school: 0 });
    expect(t.Sunrise).toBe(asLocal('08:15', 60, DECEMBER));
    expect(t.Dhuhr).toBe(asLocal('12:05', 60, DECEMBER));
    expect(t.Maghrib).toBe(asLocal('15:54', 60, DECEMBER));
    expect(t.Fajr).toBe(asLocal('06:07', 60, DECEMBER));
    expect(t.Asr).toBe(asLocal('13:39', 60, DECEMBER));
    expect(t.Isha).toBe(asLocal('17:55', 60, DECEMBER));
  });

  it('liefert für jede der 13 angebotenen Methoden vollständige Zeiten', () => {
    for (const m of METHODS) {
      const t = computeTimings(BERLIN.lat, BERLIN.lon, DECEMBER, { ...base, method: m.id, school: 0 });
      for (const value of Object.values(t)) {
        expect(value).toMatch(/^\d{2}:\d{2}$/);
      }
    }
  });

  it('hält die Gebetsreihenfolge über den Tag ein (Berlin, Dezember)', () => {
    const t = computeTimings(BERLIN.lat, BERLIN.lon, DECEMBER, { ...base, method: 3, school: 0 });
    expect(minutes(t.Fajr)).toBeLessThan(minutes(t.Sunrise));
    expect(minutes(t.Sunrise)).toBeLessThan(minutes(t.Dhuhr));
    expect(minutes(t.Dhuhr)).toBeLessThan(minutes(t.Asr));
    expect(minutes(t.Asr)).toBeLessThan(minutes(t.Maghrib));
    expect(minutes(t.Maghrib)).toBeLessThan(minutes(t.Isha));
  });

  it('ISNA (15°) ergibt späteren Fajr und früheren Isha als MWL (18°/17°)', () => {
    const mwl = computeTimings(BERLIN.lat, BERLIN.lon, DECEMBER, { ...base, method: 3, school: 0 });
    const isna = computeTimings(BERLIN.lat, BERLIN.lon, DECEMBER, { ...base, method: 2, school: 0 });
    expect(minutes(isna.Fajr)).toBeGreaterThan(minutes(mwl.Fajr));
    expect(minutes(isna.Isha)).toBeLessThan(minutes(mwl.Isha));
  });

  it('Umm al-Qura (ID 4) setzt Isha auf Maghrib + 90 Minuten', () => {
    const t = computeTimings(MAKKAH.lat, MAKKAH.lon, DECEMBER, { ...base, method: 4, school: 0 });
    expect(minutes(t.Isha) - minutes(t.Maghrib)).toBe(90);
  });

  it('Gulf Region (ID 8, in adhan-js nicht vorhanden) nutzt ebenfalls das 90-Minuten-Intervall', () => {
    const t = computeTimings(MAKKAH.lat, MAKKAH.lon, DECEMBER, { ...base, method: 8, school: 0 });
    expect(minutes(t.Isha) - minutes(t.Maghrib)).toBe(90);
  });

  it('UOIF Frankreich (ID 12, nachgebaut mit 12°/12°) liegt näher am Sonnenauf-/untergang als MWL', () => {
    const uoif = computeTimings(BERLIN.lat, BERLIN.lon, DECEMBER, { ...base, method: 12, school: 0 });
    const mwl = computeTimings(BERLIN.lat, BERLIN.lon, DECEMBER, { ...base, method: 3, school: 0 });
    expect(minutes(uoif.Fajr)).toBeGreaterThan(minutes(mwl.Fajr));
    expect(minutes(uoif.Isha)).toBeLessThan(minutes(mwl.Isha));
  });

  it('unbekannte Methoden-IDs fallen auf Muslim World League zurück', () => {
    const unknown = computeTimings(BERLIN.lat, BERLIN.lon, JUNE, { ...base, method: 999, school: 0 });
    const mwl = computeTimings(BERLIN.lat, BERLIN.lon, JUNE, { ...base, method: 3, school: 0 });
    expect(unknown).toEqual(mwl);
  });

  it('Hanafi (school 1) ergibt einen späteren Asr als Shafi (school 0)', () => {
    const shafi = computeTimings(BERLIN.lat, BERLIN.lon, JUNE, { ...base, method: 3, school: 0 });
    const hanafi = computeTimings(BERLIN.lat, BERLIN.lon, JUNE, { ...base, method: 3, school: 1 });
    expect(minutes(hanafi.Asr)).toBeGreaterThan(minutes(shafi.Asr));
    // Alle übrigen Zeiten bleiben unberührt.
    expect(hanafi.Dhuhr).toBe(shafi.Dhuhr);
    expect(hanafi.Maghrib).toBe(shafi.Maghrib);
  });
});

describe('Hochbreiten-Regel', () => {
  const JUNE = new Date(2026, 5, 21);

  it('löst "auto" breitenabhängig auf (>48° winkelbasiert, sonst Mitte der Nacht)', () => {
    // Bis 1.36 stand hier 'seventhofthenight' (adhan-js HighLatitudeRule.
    // recommended). Das war die Ursache der Nutzermeldung "Gebetszeiten
    // stimmen nicht" — Begründung des Wechsels samt Messwerten im Kommentar an
    // resolveHighLatitudeRule.
    expect(resolveHighLatitudeRule('auto', BERLIN.lat)).toBe('twilightangle');
    expect(resolveHighLatitudeRule('auto', MAKKAH.lat)).toBe('middleofthenight');
  });

  it('behandelt die Südhalbkugel wie die Nordhalbkugel', () => {
    // adhan-js prüft `latitude > 48` und ließe Punta Arenas (−53,2°) auf der
    // Nachtmitte stehen; Aladhan meldet auch dort ANGLE_BASED.
    expect(resolveHighLatitudeRule('auto', -53.16)).toBe('twilightangle');
    expect(aladhanLatitudeAdjustment('auto', -53.16)).toBe(3);
  });

  it('reicht die feste Wahl unverändert an adhan-js durch', () => {
    expect(resolveHighLatitudeRule('middleOfNight', BERLIN.lat)).toBe('middleofthenight');
    expect(resolveHighLatitudeRule('seventhOfNight', MAKKAH.lat)).toBe('seventhofthenight');
    expect(resolveHighLatitudeRule('twilightAngle', BERLIN.lat)).toBe('twilightangle');
  });

  it('übersetzt in die drei Aladhan-Werte (1/2/3)', () => {
    expect(aladhanLatitudeAdjustment('auto', BERLIN.lat)).toBe(3); // Berlin > 48° → winkelbasiert
    expect(aladhanLatitudeAdjustment('auto', MAKKAH.lat)).toBe(1);
    expect(aladhanLatitudeAdjustment('middleOfNight', BERLIN.lat)).toBe(1);
    expect(aladhanLatitudeAdjustment('seventhOfNight', BERLIN.lat)).toBe(2);
    expect(aladhanLatitudeAdjustment('twilightAngle', BERLIN.lat)).toBe(3);
  });

  it('liefert in Berlin im Juni überhaupt gültige Fajr-/Isha-Zeiten (Kernbefund K1)', () => {
    for (const rule of ['auto', 'middleOfNight', 'seventhOfNight', 'twilightAngle'] as const) {
      const t = computeTimings(BERLIN.lat, BERLIN.lon, JUNE, {
        method: 3,
        school: 0,
        highLatitude: rule,
        offsets: NO_PRAYER_TIME_OFFSETS,
      });
      expect(t.Fajr).toMatch(/^\d{2}:\d{2}$/);
      expect(t.Isha).toMatch(/^\d{2}:\d{2}$/);
      // Fajr liegt vor Sonnenaufgang; Isha liegt nach Maghrib — bei "Mitte der
      // Nacht" fällt Isha im Berliner Juni hinter Mitternacht, die Uhrzeit ist
      // dann kleiner. Deshalb zyklisch über 24 h prüfen.
      expect(minutes(t.Fajr)).toBeLessThan(minutes(t.Sunrise));
      const afterMaghrib = (minutes(t.Isha) - minutes(t.Maghrib) + 1440) % 1440;
      expect(afterMaghrib).toBeGreaterThan(0);
      expect(afterMaghrib).toBeLessThan(8 * 60); // nicht erst am nächsten Vormittag
    }
  });

  it('die Regeln unterscheiden sich in Berlin im Juni tatsächlich voneinander', () => {
    const seventh = computeTimings(BERLIN.lat, BERLIN.lon, JUNE, {
      method: 3,
      school: 0,
      highLatitude: 'seventhOfNight',
      offsets: NO_PRAYER_TIME_OFFSETS,
    });
    const middle = computeTimings(BERLIN.lat, BERLIN.lon, JUNE, {
      method: 3,
      school: 0,
      highLatitude: 'middleOfNight',
      offsets: NO_PRAYER_TIME_OFFSETS,
    });
    // Die Siebtel-Regel ist die STRENGERE Grenze — genau deshalb empfiehlt
    // adhan-js sie oberhalb von 48°: sie schiebt Fajr weiter nach hinten
    // (Richtung Sonnenaufgang) als die Nachtmitte, die im Berliner Juni noch
    // eine Fajr-Zeit kurz nach 1 Uhr zulässt.
    expect(minutes(seventh.Fajr)).toBeGreaterThan(minutes(middle.Fajr));
    expect(seventh.Fajr).not.toBe(middle.Fajr);
    expect(seventh.Isha).not.toBe(middle.Isha);
  });

  it('bleibt in Berlin im Dezember wirkungslos — alle vier Regeln liefern dieselben Zeiten', () => {
    const dec = new Date(2026, 11, 21);
    const results = (['auto', 'middleOfNight', 'seventhOfNight', 'twilightAngle'] as const).map((rule) =>
      computeTimings(BERLIN.lat, BERLIN.lon, dec, {
        method: 3,
        school: 0,
        highLatitude: rule,
        offsets: NO_PRAYER_TIME_OFFSETS,
      }),
    );
    for (const r of results) expect(r).toEqual(results[0]);
  });

  it('greift unterhalb 48° Breite im Dezember gar nicht ein (identische Zeiten)', () => {
    const dec = new Date(2026, 11, 21);
    const auto = computeTimings(MAKKAH.lat, MAKKAH.lon, dec, { ...base, method: 3, school: 0 });
    const twilight = computeTimings(MAKKAH.lat, MAKKAH.lon, dec, {
      method: 3,
      school: 0,
      highLatitude: 'twilightAngle',
      offsets: NO_PRAYER_TIME_OFFSETS,
    });
    expect(auto).toEqual(twilight);
  });
});

describe('computeUpcomingTimings', () => {
  it('liefert lückenlos `count` aufeinanderfolgende Kalendertage', () => {
    const from = new Date(2026, 11, 30); // über den Jahreswechsel
    const days = computeUpcomingTimings(BERLIN.lat, BERLIN.lon, { ...base, method: 3, school: 0 }, 4, from);
    expect(days).toHaveLength(4);
    expect(days.map((d) => d.date.getDate())).toEqual([30, 31, 1, 2]);
    expect(days[2]?.date.getFullYear()).toBe(2027);
    for (const d of days) expect(d.timings.Fajr).toMatch(/^\d{2}:\d{2}$/);
  });

  it('wendet die Minuten-Korrektur auf jeden Tag an', () => {
    const from = new Date(2026, 5, 1);
    const offsets: PrayerTimeOffsets = { ...NO_PRAYER_TIME_OFFSETS, dhuhr: 7 };
    const plain = computeUpcomingTimings(BERLIN.lat, BERLIN.lon, { ...base, method: 3, school: 0 }, 3, from);
    const tuned = computeUpcomingTimings(
      BERLIN.lat,
      BERLIN.lon,
      { method: 3, school: 0, highLatitude: 'auto', offsets },
      3,
      from,
    );
    for (let i = 0; i < 3; i++) {
      expect(minutes(tuned[i]!.timings.Dhuhr) - minutes(plain[i]!.timings.Dhuhr)).toBe(7);
    }
  });
});
