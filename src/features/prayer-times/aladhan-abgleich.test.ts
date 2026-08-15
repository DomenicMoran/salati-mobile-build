/**
 * Regressionstest der Offline-Berechnung (calc.ts) gegen eingefrorene
 * Aladhan-Werte. Er hält fest, was der Abgleich vom 27.07.2026 ergeben hat
 * (Befunde und Belege: docs/audit-2026-07-27/GEBETSZEITEN-ABGLEICH.md) und
 * schlägt an, sobald die lokale Rechnung wieder von der primären Quelle
 * abdriftet — z. B. nach einem adhan-js-Update, das eigene Minuten-Zuschläge
 * einführt.
 *
 * HERKUNFT DER FIXTURE (__fixtures__/aladhan-2026-07-28.json)
 * api.aladhan.com/v1/timings/<DD-MM-YYYY>, NEU ABGERUFEN AM 28.07.2026 mit
 * exakt den Parametern, die api.ts sendet: method=<Methode der Stadt>,
 * school=0, latitudeAdjustmentMethod=aladhanLatitudeAdjustment('auto', lat).
 * 9 Städte × 4 Termine (15.01., 21.06., 27.07., 10.12.2026) × 6 Zeiten.
 *
 * Warum neu erhoben: `auto` löst oberhalb von 48° Breite seit 1.37.0 auf die
 * WINKELBASIERTE Regel auf statt auf die Siebtel-Regel (Begründung und
 * Messwerte im Kommentar an resolveHighLatitudeRule in calc.ts). Damit sendet
 * api.ts für Berlin, London und Tromsø `latitudeAdjustmentMethod=3` statt 2 —
 * die alte Fixture beschrieb also eine Regel, mit der die App nicht mehr
 * rechnet. Städte unter 48° (Kairo, Mekka, Istanbul, Jakarta, Kapstadt,
 * New York) bekommen unverändert 1.
 *
 * Die Zeiten stehen in der ORTSZEIT der jeweiligen Stadt; computeTimings
 * liefert Gerätezeit, deshalb rechnet der Test jede berechnete Zeit über die
 * echte UTC-Verschiebung der Stadt zurück in deren Ortszeit. Damit läuft er in
 * jeder Zeitzone gleich.
 *
 * TOLERANZEN — je Kategorie, mit Begründung:
 *
 * 1. TOLERANZ_RUNDUNG = 1 min, für alle Zeiten außerhalb der Polarkreise außer
 *    Asr. Beide Seiten runden sekundengenaue Werte auf ganze Minuten; schon
 *    Sekunden-Unterschiede in der Sonnenposition kippen die Minute. Dhuhr
 *    runden wir zusätzlich bewusst auf (nie vor dem Zenit, s. calc.ts), was
 *    ebenfalls höchstens diese eine Minute kostet.
 *
 * 2. TOLERANZ_ASR = 3 min, nur für Asr außerhalb der Polarkreise. Ursache ist
 *    eine Konventionsdifferenz, kein Fehler: adhan-js bildet den Schattenwinkel
 *    aus der Deklination um 00:00 UT des Tages, PrayTimes/Aladhan aus der
 *    Deklination zur Asr-Zeit. Im Winter hoher Breiten ist die Höhenkurve der
 *    Sonne am Nachmittag so flach, dass daraus 2–3 Minuten werden (Messreihe:
 *    Berlin 15.01. 3 min, London 15.01./10.12. 2 min, Istanbul 15.01. 2 min,
 *    Kapstadt 27.07. 2 min, Kairo/Mekka/New York ≤ 1 min).
 *
 * 3. Innerhalb der Polarkreise (|Breite| ≥ 66,56°) wird NICHT auf Minuten
 *    verglichen. Aladhan liefert dort an Tagen ohne Sonnenauf-/untergang
 *    Platzhalter statt Zeiten (Tromsø 21.06.2026: Fadschr = Sonnenaufgang =
 *    Maghrib = Ischa = 00:46). Geprüft wird stattdessen, dass unsere Rechnung
 *    einen vollständigen, in sich geordneten Tag liefert.
 */
import { NO_PRAYER_TIME_OFFSETS } from '@/features/settings/types';

import referenz from './__fixtures__/aladhan-2026-07-28.json';
import { computeTimings } from './calc';

interface Referenztag {
  ort: string;
  lat: number;
  lon: number;
  tz: string;
  methode: number;
  tag: string; // DD-MM-YYYY
  timings: Record<string, string>;
}

const TOLERANZ_RUNDUNG = 1;
const TOLERANZ_ASR = 3;
/** Neigung der Erdachse — ab dieser Breite gibt es Polartag/Polarnacht. */
const POLARKREIS = 66.56;

const ZEITEN = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

const tage = referenz as Referenztag[];

function minuten(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Verschiebt "HH:MM" zyklisch um beliebig viele Minuten (offsets.ts kappt bei ±60). */
function verschiebe(hhmm: string, minutenOffset: number): string {
  const gesamt = (((minuten(hhmm) + minutenOffset) % 1440) + 1440) % 1440;
  return `${String(Math.floor(gesamt / 60)).padStart(2, '0')}:${String(gesamt % 60).padStart(2, '0')}`;
}

/** Abstand zweier Uhrzeiten auf dem 24-h-Kreis (Polarzeiten kippen über Mitternacht). */
function abstand(a: string, b: string): number {
  const roh = Math.abs(minuten(a) - minuten(b));
  return Math.min(roh, 1440 - roh);
}

/** UTC-Verschiebung einer Zeitzone am Stichtag, in Minuten östlich von UTC. */
function utcOffsetMinuten(zeitzone: string, at: Date): number {
  const teile = new Intl.DateTimeFormat('en-US', { timeZone: zeitzone, timeZoneName: 'longOffset' }).formatToParts(at);
  const name = teile.find((t) => t.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const treffer = /GMT([+-])(\d{1,2}):(\d{2})/.exec(name);
  if (!treffer) return 0; // reines "GMT" = UTC
  return (treffer[1] === '-' ? -1 : 1) * (Number(treffer[2]) * 60 + Number(treffer[3]));
}

/** Ortszeit des Testrechners → Ortszeit der Stadt. */
function inOrtszeit(hhmm: string, zeitzone: string, at: Date): string {
  return verschiebe(hhmm, utcOffsetMinuten(zeitzone, at) + at.getTimezoneOffset());
}

function berechne(d: Referenztag): Record<string, string> {
  const [tt, mm, jj] = d.tag.split('-').map(Number);
  const datum = new Date(jj!, mm! - 1, tt!, 12);
  const eigene = computeTimings(d.lat, d.lon, datum, {
    method: d.methode,
    school: 0,
    highLatitude: 'auto',
    offsets: NO_PRAYER_TIME_OFFSETS,
  });
  const ortszeit: Record<string, string> = {};
  for (const z of ZEITEN) ortszeit[z] = inOrtszeit(eigene[z], d.tz, datum);
  return ortszeit;
}

describe('Zeitzonen-Hilfsfunktion des Tests', () => {
  it('liest die UTC-Verschiebung inklusive Sommerzeit', () => {
    expect(utcOffsetMinuten('Europe/Berlin', new Date(Date.UTC(2026, 0, 15, 12)))).toBe(60);
    expect(utcOffsetMinuten('Europe/Berlin', new Date(Date.UTC(2026, 6, 27, 12)))).toBe(120);
    expect(utcOffsetMinuten('Asia/Jakarta', new Date(Date.UTC(2026, 0, 15, 12)))).toBe(420);
    expect(utcOffsetMinuten('America/New_York', new Date(Date.UTC(2026, 0, 15, 12)))).toBe(-300);
  });
});

describe('Offline-Berechnung gegen Aladhan (Fixture 28.07.2026)', () => {
  const ausserhalbPolarkreis = tage.filter((d) => Math.abs(d.lat) < POLARKREIS);
  const imPolarkreis = tage.filter((d) => Math.abs(d.lat) >= POLARKREIS);

  it('deckt 9 Städte und 4 Termine ab', () => {
    expect(tage).toHaveLength(36);
    expect(new Set(tage.map((d) => d.ort)).size).toBe(9);
    expect(imPolarkreis).not.toHaveLength(0);
  });

  it(`bleibt außerhalb der Polarkreise bei Fadschr/Sonnenaufgang/Dhuhr/Maghrib/Ischa innerhalb ${TOLERANZ_RUNDUNG} min`, () => {
    const abweichungen: string[] = [];
    for (const d of ausserhalbPolarkreis) {
      const eigene = berechne(d);
      for (const z of ZEITEN) {
        if (z === 'Asr') continue;
        const diff = abstand(d.timings[z]!, eigene[z]!);
        if (diff > TOLERANZ_RUNDUNG) {
          abweichungen.push(`${d.ort} ${d.tag} ${z}: Aladhan ${d.timings[z]} / lokal ${eigene[z]} (${diff} min)`);
        }
      }
    }
    expect(abweichungen).toEqual([]);
  });

  it(`bleibt außerhalb der Polarkreise beim Asr innerhalb ${TOLERANZ_ASR} min (Deklinations-Konvention)`, () => {
    const abweichungen: string[] = [];
    for (const d of ausserhalbPolarkreis) {
      const eigene = berechne(d);
      const diff = abstand(d.timings.Asr!, eigene.Asr!);
      if (diff > TOLERANZ_ASR) {
        abweichungen.push(`${d.ort} ${d.tag} Asr: Aladhan ${d.timings.Asr} / lokal ${eigene.Asr} (${diff} min)`);
      }
    }
    expect(abweichungen).toEqual([]);
  });

  it('liefert im Polarkreis einen vollständigen, geordneten Tag — auch wo Aladhan Platzhalter liefert', () => {
    for (const d of imPolarkreis) {
      const eigene = berechne(d);
      for (const z of ZEITEN) expect(eigene[z]).toMatch(/^\d{2}:\d{2}$/);
      // Fadschr … Maghrib liegen im Polarsommer alle innerhalb eines
      // Kalendertages; Ischa kann hinter Mitternacht fallen und wird deshalb
      // zyklisch geprüft.
      expect(minuten(eigene.Fajr!)).toBeLessThanOrEqual(minuten(eigene.Sunrise!));
      expect(minuten(eigene.Sunrise!)).toBeLessThanOrEqual(minuten(eigene.Dhuhr!));
      expect(minuten(eigene.Dhuhr!)).toBeLessThan(minuten(eigene.Asr!));
      expect(minuten(eigene.Asr!)).toBeLessThanOrEqual(minuten(eigene.Maghrib!));
      const nachMaghrib = (minuten(eigene.Isha!) - minuten(eigene.Maghrib!) + 1440) % 1440;
      expect(nachMaghrib).toBeGreaterThan(0);
      expect(nachMaghrib).toBeLessThan(12 * 60);
    }
  });

  it('hat an Tromsøs Polartagen echte Zeiten, wo Aladhan alles auf einen Wert kippt', () => {
    // Beleg für den Fallback in api.ts (isDegenerateSolarDay): am 21.06.2026
    // meldet Aladhan Sonnenaufgang = Maghrib = 00:46.
    const polartag = tage.find((d) => d.ort === 'Tromsoe' && d.tag === '21-06-2026')!;
    expect(polartag.timings.Sunrise).toBe(polartag.timings.Maghrib);
    const eigene = berechne(polartag);
    expect(eigene.Sunrise).not.toBe(eigene.Maghrib);
  });
});

describe('Angleichung der adhan-js-Methodenzuschläge an Aladhan', () => {
  // Alle Sollwerte live gegen api.aladhan.com/v1/timings/15-01-2026
  // (Berlin, school=0) geprüft. Die Sollwerte hier sind Dhuhr, Sonnenaufgang
  // und Maghrib — auf die wirkt die Hochbreiten-Regel nicht, sie gelten daher
  // unverändert für latitudeAdjustmentMethod 2 wie 3.
  const BERLIN = { lat: 52.52, lon: 13.405, tz: 'Europe/Berlin' };
  const TAG = new Date(2026, 0, 15, 12);
  const basis = { school: 0, highLatitude: 'auto', offsets: NO_PRAYER_TIME_OFFSETS } as const;
  const berlin = (methode: number) => {
    const t = computeTimings(BERLIN.lat, BERLIN.lon, TAG, { ...basis, method: methode });
    return Object.fromEntries(ZEITEN.map((z) => [z, inOrtszeit(t[z], BERLIN.tz, TAG)]));
  };

  it('Muslim World League (3) ohne den adhan-js-Zuschlag von 1 min auf Dhuhr', () => {
    // Sonnenhöchststand roh 12:15:46 → Aladhan 12:16, adhan-js lieferte 12:17.
    expect(berlin(3).Dhuhr).toBe('12:16');
  });

  it('Moonsighting Committee (15) ohne die Zuschläge von 5 min (Dhuhr) und 3 min (Maghrib)', () => {
    const t = berlin(15);
    expect(t.Dhuhr).toBe('12:16');
    expect(t.Maghrib).toBe('16:22');
  });

  it('Diyanet (13) behält seine Feinkorrektur — die wendet Aladhan ebenfalls an', () => {
    const t = berlin(13);
    expect(t.Sunrise).toBe('08:03'); // roh 08:09:52, Diyanet −7
    expect(t.Dhuhr).toBe('12:21'); // roh 12:15:46, Diyanet +5
    expect(t.Maghrib).toBe('16:29'); // roh 16:22:06, Diyanet +7
  });

  it('rundet Dhuhr auf, damit die angezeigte Minute nie vor dem Zenit liegt', () => {
    // Jakarta 21.06.2026: Zenitdurchgang 11:54:22 → 11:55. Aladhan rundet
    // kaufmännisch auf 11:54 und liegt damit 22 s vor dem Zenit.
    const t = computeTimings(-6.2088, 106.8456, new Date(2026, 5, 21, 12), { ...basis, method: 11 });
    expect(inOrtszeit(t.Dhuhr, 'Asia/Jakarta', new Date(2026, 5, 21, 12))).toBe('11:55');
  });

  it('Singapur (11) rundet nicht mehr pauschal auf — der Sonnenaufgang bleibt bei Aladhan', () => {
    // Rounding.Up hätte den Sonnenaufgang (Ende des Fadschr-Fensters) nach
    // hinten geschoben: roh 06:01:29 → 06:02 statt 06:01.
    const t = computeTimings(-6.2088, 106.8456, new Date(2026, 5, 21, 12), { ...basis, method: 11 });
    expect(inOrtszeit(t.Sunrise, 'Asia/Jakarta', new Date(2026, 5, 21, 12))).toBe('06:01');
  });
});
