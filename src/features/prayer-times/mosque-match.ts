// „Richte dich nach deiner Moschee" — aus den Zeiten eines Aushangs die
// passenden Einstellungen zurückrechnen.
//
// DAS PROBLEM: Die ehrliche Antwort auf „welche Methode ist richtig?" lautet
// „die, nach der deine Gemeinde betet". Nur konnte man das bisher nur durch
// Ausprobieren herausfinden: 23 Methoden × 2 Asr-Schulen × 4 Hochbreiten-Regeln
// sind 184 Kombinationen, und danach blieben immer noch Minuten-Korrekturen
// übrig. Genau das macht diese Datei automatisch: der Nutzer tippt die Zeiten
// EINES Tages ab, die App sucht die Kombination mit der kleinsten Abweichung
// und legt den Rest in die Minuten-Korrektur.
//
// WARUM ERST DIE METHODE, DANN DIE KORREKTUR: Eine reine Minuten-Korrektur
// würde nur für den abgetippten Tag stimmen. Die Methoden unterscheiden sich im
// WINKEL, und der wirkt sich über das Jahr unterschiedlich stark aus — in
// Berlin zwischen Dezember und Juni um über eine Stunde. Wer die richtige
// Methode trifft, hat das ganze Jahr recht; wer nur schiebt, hat einen Tag lang
// recht.
//
// RECHNUNG BEWUSST LOKAL (adhan-js, calc.ts): Die Suche braucht 184 Durchläufe.
// Über die API wären das 184 Anfragen für einen einzigen Tastendruck.

import {
  DEFAULT_METHOD_ID,
  PRAYER_METHODS,
  type PrayerMethod,
} from '@/features/settings/methods';
import {
  HIGH_LATITUDE_OPTIONS,
  NO_PRAYER_TIME_OFFSETS,
  PRAYER_TIME_OFFSET_MAX,
  PRAYER_TIME_OFFSET_MIN,
  type HighLatitudeSetting,
  type PrayerTimeOffsets,
} from '@/features/settings/types';

import type { Timings } from './api';
import { computeTimings } from './calc';

/** Die Felder, die der Nutzer abtippt. Leere/ungültige werden übergangen. */
export interface MosqueTimesInput {
  fajr?: string;
  sunrise?: string;
  dhuhr?: string;
  asr?: string;
  maghrib?: string;
  isha?: string;
}

export interface MosqueMatch {
  method: number;
  school: 0 | 1;
  highLatitude: HighLatitudeSetting;
  /** Restabweichung je Gebet, direkt als Einstellung übernehmbar. */
  offsets: PrayerTimeOffsets;
  /** Größte Einzelabweichung VOR der Minuten-Korrektur, in Minuten. */
  maxAbweichung: number;
  /** Durchschnittliche Abweichung VOR der Minuten-Korrektur, in Minuten. */
  schnittAbweichung: number;
  /** Wie viele der sechs Zeiten der Nutzer angegeben hat. */
  verglicheneZeiten: number;
  /**
   * true = die Methode allein trifft JEDE angegebene Zeit auf die Minute, es
   * bleibt keine einzige Korrektur übrig.
   *
   * Bewusst exakt null und nicht „±2 Minuten genügt": der Screen sagt bei
   * `true` „ohne jede Korrektur" — stünde daneben trotzdem eine Korrektur von
   * +1, widerspräche sich die Seite selbst.
   */
  ohneKorrekturBrauchbar: boolean;
}

const FELDER = [
  ['fajr', 'Fajr'],
  ['sunrise', 'Sunrise'],
  ['dhuhr', 'Dhuhr'],
  ['asr', 'Asr'],
  ['maghrib', 'Maghrib'],
  ['isha', 'Isha'],
] as const;

/** „7:05", „07:05", „07.05" → Minuten seit Mitternacht. Sonst null. */
export function parseHHMM(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^\s*(\d{1,2})[:.\s](\d{2})\s*$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Kürzester Abstand zweier Minutenwerte, zyklisch über Mitternacht. */
function abstand(a: number, b: number): number {
  const d = (((a - b) % 1440) + 1440) % 1440;
  return Math.min(d, 1440 - d);
}

/** Vorzeichenbehaftete Verschiebung von `berechnet` auf `gewuenscht`. */
function verschiebung(gewuenscht: number, berechnet: number): number {
  let d = gewuenscht - berechnet;
  if (d > 720) d -= 1440;
  if (d < -720) d += 1440;
  return d;
}

/**
 * Ist mindestens eine verwertbare Zeit angegeben? Ohne das hätte die Suche
 * keinen Anhaltspunkt und würde die erste Kombination zurückgeben.
 */
export function hatEingaben(input: MosqueTimesInput): boolean {
  return FELDER.some(([feld]) => parseHHMM(input[feld]) !== null);
}

interface Kandidat {
  method: number;
  school: 0 | 1;
  highLatitude: HighLatitudeSetting;
  summe: number;
  max: number;
  abweichungen: Partial<Record<keyof PrayerTimeOffsets, number>>;
  anzahl: number;
  rang: number;
}

/**
 * Rangfolge für den Gleichstand: Bei mehreren gleich guten Kombinationen soll
 * die naheliegendste gewinnen — die Voreinstellung, dann die Reihenfolge des
 * Katalogs, innerhalb dessen die frühere Asr-Zeit und `auto`.
 */
function rangVon(m: PrayerMethod, index: number, school: 0 | 1, hl: HighLatitudeSetting): number {
  const methodRang = m.id === DEFAULT_METHOD_ID ? -1 : index;
  return methodRang * 100 + (school === 0 ? 0 : 10) + HIGH_LATITUDE_OPTIONS.indexOf(hl);
}

/**
 * Sucht die Einstellungs-Kombination, die den abgetippten Zeiten am nächsten
 * kommt, und liefert die verbleibende Differenz als Minuten-Korrektur.
 *
 * `null`, wenn keine einzige Zeit lesbar war.
 */
export function matchMosqueTimes(
  input: MosqueTimesInput,
  lat: number,
  lon: number,
  date: Date,
): MosqueMatch | null {
  const ziel = FELDER.map(([feld, key]) => ({ feld, key, minuten: parseHHMM(input[feld]) })).filter(
    (z): z is { feld: keyof PrayerTimeOffsets; key: keyof Timings; minuten: number } => z.minuten !== null,
  );
  if (ziel.length === 0) return null;

  let bester: Kandidat | null = null;

  PRAYER_METHODS.forEach((m, index) => {
    for (const school of [0, 1] as const) {
      for (const highLatitude of HIGH_LATITUDE_OPTIONS) {
        const berechnet = computeTimings(lat, lon, date, {
          method: m.id,
          school,
          highLatitude,
          offsets: NO_PRAYER_TIME_OFFSETS,
        });
        let summe = 0;
        let max = 0;
        const abweichungen: Kandidat['abweichungen'] = {};
        for (const z of ziel) {
          const ist = parseHHMM(berechnet[z.key]);
          if (ist === null) continue;
          const diff = abstand(z.minuten, ist);
          summe += diff;
          if (diff > max) max = diff;
          abweichungen[z.feld] = verschiebung(z.minuten, ist);
        }
        const rang = rangVon(m, index, school, highLatitude);
        const kandidat: Kandidat = {
          method: m.id,
          school,
          highLatitude,
          summe,
          max,
          abweichungen,
          anzahl: ziel.length,
          rang,
        };
        if (
          !bester ||
          kandidat.summe < bester.summe ||
          // Gleiche Gesamtabweichung: die mit dem kleineren Ausreißer gewinnt,
          // danach die naheliegendere Kombination. Sonst hinge das Ergebnis an
          // der Reihenfolge der Schleife.
          (kandidat.summe === bester.summe && kandidat.max < bester.max) ||
          (kandidat.summe === bester.summe && kandidat.max === bester.max && kandidat.rang < bester.rang)
        ) {
          bester = kandidat;
        }
      }
    }
  });

  if (!bester) return null;
  const treffer: Kandidat = bester;

  const offsets: PrayerTimeOffsets = { ...NO_PRAYER_TIME_OFFSETS };
  for (const [feld] of FELDER) {
    const d = treffer.abweichungen[feld];
    if (d === undefined) continue;
    // Grenzen der Einstellung einhalten. Wird sie erreicht, stimmt etwas
    // Grundsätzliches nicht (falsche Stadt, Iqama- statt Adhan-Zeiten) — der
    // Screen weist darauf über `maxAbweichung` hin.
    offsets[feld] = Math.min(PRAYER_TIME_OFFSET_MAX, Math.max(PRAYER_TIME_OFFSET_MIN, d));
  }

  return {
    method: treffer.method,
    school: treffer.school,
    highLatitude: treffer.highLatitude,
    offsets,
    maxAbweichung: treffer.max,
    schnittAbweichung: Math.round((treffer.summe / treffer.anzahl) * 10) / 10,
    verglicheneZeiten: treffer.anzahl,
    ohneKorrekturBrauchbar: Object.values(offsets).every((v) => v === 0),
  };
}

/**
 * Rechnet die Minuten-Korrektur gegen die Zeiten nach, die die App später
 * WIRKLICH anzeigt.
 *
 * WARUM DAS NÖTIG IST — am 2026-08-07 im Browser aufgefallen: Die Suche oben
 * rechnet lokal (184 Kombinationen, über die API wären das 184 Anfragen für
 * einen Tastendruck). Angezeigt werden aber, solange Netz da ist, die Zeiten
 * der Aladhan-API. Beide unterscheiden sich in genau zwei dokumentierten
 * Punkten um bis zu eine Minute: Salati rundet Dhuhr auf (nie vor dem
 * Zenitdurchgang), und adhan-js bildet den Asr-Schattenwinkel aus einer
 * anderen Deklinations-Epoche. Eine lokal ermittelte Korrektur von „+1" landete
 * damit auf einem API-Wert, der schon eine Minute weiter war — die Uhr zeigte
 * 02:45, obwohl der Aushang 02:44 sagt.
 *
 * EINE Anfrage genügt: die Methode steht ja bereits fest. Ohne Netz bleibt es
 * bei den lokalen Werten — dann rechnet die App ohnehin lokal, und die passen.
 */
export function refineOffsets(match: MosqueMatch, input: MosqueTimesInput, angezeigt: Timings): MosqueMatch {
  const offsets: PrayerTimeOffsets = { ...NO_PRAYER_TIME_OFFSETS };
  let max = 0;
  let summe = 0;
  let anzahl = 0;
  for (const [feld, key] of FELDER) {
    const ziel = parseHHMM(input[feld]);
    const ist = parseHHMM(angezeigt[key]);
    if (ziel === null || ist === null) continue;
    offsets[feld] = Math.min(PRAYER_TIME_OFFSET_MAX, Math.max(PRAYER_TIME_OFFSET_MIN, verschiebung(ziel, ist)));
    const d = abstand(ziel, ist);
    summe += d;
    if (d > max) max = d;
    anzahl++;
  }
  if (anzahl === 0) return match;
  return {
    ...match,
    offsets,
    maxAbweichung: max,
    schnittAbweichung: Math.round((summe / anzahl) * 10) / 10,
    verglicheneZeiten: anzahl,
    ohneKorrekturBrauchbar: Object.values(offsets).every((v) => v === 0),
  };
}
