// Lokale Gebetszeit-Berechnung mit adhan-js (MIT). Macht die Kernfunktion
// netzunabhängig: für JEDES Datum, ohne Netz, ohne Fremd-API im kritischen Pfad
// (Audit 2026-07-27, K3).
//
// ROLLENVERTEILUNG — bewusst so und nicht umgekehrt:
// Aladhan bleibt die PRIMÄRE Quelle, die lokale Berechnung ist der Fallback
// (siehe api.ts). Der Grund ist die Zeitzone: Aladhan liefert die Zeiten in der
// Zeitzone des ORTES, adhan-js rechnet über JS-Date immer in der Zeitzone des
// GERÄTS. Wer in den Einstellungen eine Stadt in einer anderen Zeitzone wählt
// (Salati erlaubt das über die Ortssuche und gespeicherte Orte), bekäme bei
// lokaler Rechnung als Standard still verschobene Zeiten. Solange Netz da ist,
// ist die API also die genauere Quelle; ohne Netz ist die lokale Rechnung immer
// noch um Größenordnungen besser als "gar keine Zeiten" — und für den Normalfall
// (Gerät steht in der Zeitzone des gewählten Ortes) exakt.

import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
  Rounding,
} from 'adhan';

import { DEFAULT_METHOD_ID, methodById } from '@/features/settings/methods';
import type { AppSettings, HighLatitudeSetting, PrayerTimeOffsets } from '@/features/settings/types';
import { NO_PRAYER_TIME_OFFSETS } from '@/features/settings/types';

import type { Timings } from './api';
import { applyPrayerTimeOffsets } from './offsets';

/**
 * Alle nutzer-einstellbaren Parameter der Gebetszeit-Berechnung an einer
 * Stelle — statt sie einzeln durch jede Signatur zu reichen.
 */
export interface PrayerCalcOptions {
  /** Aladhan-Methoden-ID (s. features/settings/methods.ts) */
  method: number;
  /** 0 = Shafi/Maliki/Hanbali (früherer Asr), 1 = Hanafi (späterer Asr) */
  school: 0 | 1;
  highLatitude: HighLatitudeSetting;
  offsets: PrayerTimeOffsets;
}

/**
 * Einziger Weg, aus den App-Einstellungen die Rechenparameter zu bauen —
 * damit Anzeige, Benachrichtigungen, Widgets und ICS-Export garantiert
 * dieselben Zeiten sehen. Die `??`-Absicherungen greifen für Installationen,
 * deren gespeicherte Einstellungen noch aus einer Version vor diesen Feldern
 * stammen.
 */
export function calcOptionsFromSettings(
  settings: Pick<AppSettings, 'method' | 'school' | 'highLatitudeRule' | 'prayerTimeOffsets'>,
): PrayerCalcOptions {
  return {
    method: settings.method,
    school: settings.school,
    highLatitude: settings.highLatitudeRule ?? 'auto',
    offsets: settings.prayerTimeOffsets ?? NO_PRAYER_TIME_OFFSETS,
  };
}

/** Keine Minuten-Zuschläge — der Normalfall, s. {@link baseParams}. */
const KEINE_ZUSCHLAEGE = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

/**
 * Baut die adhan-js-Parameter aus dem Behörden-Katalog
 * (features/settings/methods.ts). Die Winkel stehen damit an GENAU EINER
 * Stelle — dieselbe, die der Info-Screen dem Nutzer anzeigt und die die
 * Aladhan-Anfrage über die Methoden-ID auslöst. Vorher lag die Zuordnung als
 * switch-Block hier und die Namensliste dort; jede neue Behörde musste an
 * zwei Stellen gepflegt werden.
 *
 * ZWEI AUSNAHMEN, die NICHT über die Winkel abbildbar sind:
 *
 * - **13 Diyanet**: `CalculationMethod.Turkey()` bringt Feinkorrekturen mit
 *   (−7 Sonnenaufgang, +5 Dhuhr, +4 Asr, +7 Maghrib), die genau den „temkin"-
 *   Zuschlägen der Diyanet entsprechen (7 Minuten um Sonnenauf-/-untergang,
 *   veröffentlicht unter vakithesaplama.diyanet.gov.tr/temkin.php). Aladhan
 *   wendet dieselben an, obwohl /v1/methods sie nicht ausweist — belegt:
 *   Methode 13 liefert für Berlin, 15.01.2026, Sonnenaufgang 08:03 gegenüber
 *   08:09:52 roh. Sie bleiben deshalb stehen.
 * - **15 Moonsighting Committee**: rechnet nicht mit festem Winkel, sondern
 *   mit einer jahreszeitlich korrigierten Kurve. Die muss aus der Bibliothek
 *   kommen; nur ihre Minuten-Zuschläge (+5 Dhuhr, +3 Maghrib) werden genullt,
 *   weil Aladhan sie nicht kennt.
 *
 * Alle übrigen Methoden werden über `Other()` mit den katalogisierten Werten
 * aufgebaut — auch die, für die adhan-js einen eigenen Namen hätte. Deren
 * Presets tragen nämlich stille Extras (MWL/ISNA/Karachi/Ägypten: Dhuhr +1;
 * Singapur zusätzlich `Rounding.Up`; Dubai −3/+3/+3/+3), die Aladhan nicht
 * anwendet und die die App vorher einzeln wieder wegräumen musste
 * (Abgleich 2026-07-27, docs/audit-2026-07-27/GEBETSZEITEN-ABGLEICH.md).
 *
 * Rounding: Aladhan/PrayTimes rundet kaufmännisch auf ganze Minuten. Wir
 * runden selbst (s. hhmm) statt die Bibliothek runden zu lassen — `Rounding.Up`
 * hätte auch den SONNENAUFGANG nach hinten geschoben, und der beendet das
 * Fadschr-Fenster.
 */
function baseParams(method: number): CalculationParameters {
  if (method === 13) {
    const p = CalculationMethod.Turkey();
    p.rounding = Rounding.None;
    return p;
  }
  if (method === 15) {
    const p = CalculationMethod.MoonsightingCommittee();
    p.methodAdjustments = { ...KEINE_ZUSCHLAEGE };
    p.rounding = Rounding.None;
    return p;
  }

  // Unbekannte ID (beschädigte Einstellungen, Downgrade): auf die
  // Voreinstellung zurückfallen statt auf 0°/0° aus `Other()` — das lieferte
  // sonst Fadschr = Sonnenaufgang.
  const m = methodById(method) ?? methodById(DEFAULT_METHOD_ID);
  const p = CalculationMethod.Other();
  p.methodAdjustments = { ...KEINE_ZUSCHLAEGE };
  p.rounding = Rounding.None;
  if (!m) return p;

  p.fajrAngle = m.fajrAngle;
  if (m.isha.kind === 'angle') p.ishaAngle = m.isha.angle;
  else p.ishaInterval = m.isha.minutes;
  if (m.maghribAngle !== undefined) p.maghribAngle = m.maghribAngle;
  // Lissabon (+3) und Jordanien (+5) setzen Maghrib nicht auf den Sonnen-
  // untergang, sondern einige Minuten danach. Aladhan führt das als eigenen
  // Parameter; in adhan-js ist der Minuten-Zuschlag der einzige Weg dorthin.
  if (m.maghribMinutes !== undefined) p.methodAdjustments.maghrib = m.maghribMinutes;
  if (m.dhuhrMinutes !== undefined) p.methodAdjustments.dhuhr = m.dhuhrMinutes;
  return p;
}

/**
 * Ab dieser Breite greift überhaupt eine Hochbreiten-Regel — dieselbe Schwelle,
 * die adhan-js in `HighLatitudeRule.recommended()` benutzt. Anders als dort auf
 * den BETRAG angewandt: adhan-js prüft `latitude > 48` und lässt die Südhalb-
 * kugel ungeschützt, obwohl Punta Arenas (−53,2°) dasselbe Problem hat wie
 * Berlin (+52,5°). Aladhan macht diesen Unterschied nicht — auch für Punta
 * Arenas, 21.12.2026, meldet die Antwort ohne Parameter ANGLE_BASED.
 */
const HOHE_BREITE_AB_GRAD = 48;

/** Übersetzt die App-Einstellung in die adhan-js-Regel (`auto` = breitenabhängig). */
export function resolveHighLatitudeRule(
  setting: HighLatitudeSetting,
  lat: number,
): 'middleofthenight' | 'seventhofthenight' | 'twilightangle' {
  switch (setting) {
    case 'middleOfNight':
      return HighLatitudeRule.MiddleOfTheNight;
    case 'seventhOfNight':
      return HighLatitudeRule.SeventhOfTheNight;
    case 'twilightAngle':
      return HighLatitudeRule.TwilightAngle;
    case 'auto':
    default:
      // NICHT auf `HighLatitudeRule.recommended()` zurückändern — das lieferte
      // oberhalb von 48° die SIEBTEL-Regel und war die Ursache der Nutzer-
      // meldung "Gebetszeiten stimmen nicht" (App 1.36, Berlin, Ischa 22:16).
      //
      // Messung Berlin (52,52/13,405), 28.07.2026, Methode 13, school=0, über
      // api.aladhan.com/v1/timings/28-07-2026 — die drei Regeln liegen weit
      // auseinander, und die offiziellen Diyanet-Zeiten liegen dazwischen:
      //
      // |                          | Fadschr | Ischa |
      // |--------------------------|---------|-------|
      // | 1 = Mitte der Nacht      | 01:52   | 00:02 |
      // | 2 = Siebtel der Nacht    | 04:09   | 22:16 |  ← bisheriger `auto`-Wert
      // | 3 = winkelbasiert        | 02:51   | 23:25 |  ← jetziger `auto`-Wert
      // | Diyanet offiziell        | 03:33   | 22:42 |  (namazvakti.diyanet.gov.tr)
      //
      // EHRLICHE ABWÄGUNG, damit sie niemand später für einen Fehler hält:
      // gemessen an Diyanets eigener Veröffentlichung ist die winkelbasierte
      // Regel SCHLECHTER als die Siebtel-Regel (Ischa +43 statt −26 min,
      // Fadschr −42 statt +36 min). Die Voreinstellung zielt bewusst NICHT auf
      // Diyanets Veröffentlichung, sondern auf Übereinstimmung mit den
      // verbreiteten Gebetszeit-Apps: deren Hintergrunddienst Aladhan antwortet
      // für hohe Breiten ohne gesetzten `latitudeAdjustmentMethod` mit
      // ANGLE_BASED (belegt: die Antwort meldet genau diesen Wert). Nutzer
      // vergleichen ihre Zeiten mit anderen Apps, nicht mit der Diyanet-Website.
      //
      // Es gibt für hohe Breiten keine allgemeingültig richtige Regel — die
      // Spanne zwischen den drei Regeln beträgt in Berlin im Sommer über eine
      // Stunde. Deshalb steht in den Einstellungen ein Hinweis, sich notfalls
      // nach der eigenen Moschee zu richten (settings.highLatitude.hint), und
      // deshalb bleiben alle drei Regeln ausdrücklich wählbar.
      return Math.abs(lat) > HOHE_BREITE_AB_GRAD
        ? HighLatitudeRule.TwilightAngle
        : HighLatitudeRule.MiddleOfTheNight;
  }
}

/**
 * Aladhan kennt nur drei Werte für `latitudeAdjustmentMethod`:
 * 1 = Mitte der Nacht, 2 = Siebtel der Nacht, 3 = winkelbasiert.
 * Der Wert wird bewusst aus {@link resolveHighLatitudeRule} abgeleitet statt
 * zweitverdrahtet: nur so bekommt Aladhan exakt die Regel, mit der auch die
 * Offline-Rechnung arbeitet. `auto` ergibt oberhalb von 48° damit 3 — genau
 * den Wert, den Aladhan ohne den Parameter selbst wählt (ANGLE_BASED).
 */
export function aladhanLatitudeAdjustment(setting: HighLatitudeSetting, lat: number): 1 | 2 | 3 {
  const rule = resolveHighLatitudeRule(setting, lat);
  if (rule === HighLatitudeRule.SeventhOfTheNight) return 2;
  if (rule === HighLatitudeRule.TwilightAngle) return 3;
  return 1;
}

const MINUTE_MS = 60_000;

/**
 * Sekundengenaue Zeit auf "HH:MM" bringen. `mode`:
 *  - `nearest`: kaufmännisch, wie Aladhan/PrayTimes es für alle Zeiten tut.
 *  - `up`: auf die nächste volle Minute AUFrunden. Nur für Dhuhr, s.
 *    computeTimings — die angezeigte Minute darf nie vor dem Zenitdurchgang
 *    liegen.
 */
function hhmm(d: Date, mode: 'nearest' | 'up' = 'nearest'): string {
  const ms = d.getTime();
  const rounded = new Date((mode === 'up' ? Math.ceil(ms / MINUTE_MS) : Math.round(ms / MINUTE_MS)) * MINUTE_MS);
  return `${String(rounded.getHours()).padStart(2, '0')}:${String(rounded.getMinutes()).padStart(2, '0')}`;
}

/**
 * Der Asr-Zeitpunkt nach der Schattenregel existiert nicht an jedem Tag: er ist
 * definiert als der Moment, in dem der Schatten auf Mittagsschatten + n × Länge
 * angewachsen ist, und das setzt cot(h) = n + tan|Breite − Deklination| mit
 * h > Horizont voraus. Ab |Breite − Deklination| ≳ 90° — also im Polarkreis im
 * Winterhalbjahr — wird die verlangte Sonnenhöhe negativ, die Bedingung wäre
 * erst NACH Sonnenuntergang erfüllt, und adhan-js liefert einen Wert außerhalb
 * des Tages (gemessen Tromsø 15.01.2026: Asr 12:32 bei Sonnenuntergang 12:26,
 * 10.12.2026 sogar Asr 10:52 vor Dhuhr 11:32).
 *
 * Wir kappen deshalb auf den Sonnenuntergang: das ist der Grenzwert der Formel
 * (frühestens dann ist die Schattenlänge erreicht) und hält die Reihenfolge
 * Dhuhr < Asr ≤ Maghrib ein, auf die next-prayer.ts und die Benachrichtigungen
 * bauen. Aladhan kappt in denselben Fällen auf Dhuhr (Tromsø 15.01.: Asr 11:54
 * = Dhuhr) — das verletzt die Schattenbedingung eindeutig, der Schatten hat um
 * 11:54 gerade seine kürzeste Länge. Eine fatwa-basierte Regel (fester Anteil
 * der Tageslänge, nächstgelegener Ort) wäre die Produkt-Antwort; sie braucht
 * eine Einstellung und ist bewusst nicht Teil dieses Abgleichs.
 */
function asrWithinDay(times: PrayerTimes): Date {
  const ok = times.asr > times.dhuhr && times.asr <= times.sunset;
  return ok ? times.asr : times.sunset;
}

/**
 * Gebetszeiten für `date` ohne Netz. Liefert dasselbe Format wie die Aladhan-
 * Antwort ("HH:MM" in lokaler Zeit), inklusive der Nutzer-Minuten-Korrektur.
 *
 * Bekannte, bewusst hingenommene Abweichung zu Aladhan (≤ 3 min, nur bei
 * flachem Sonnenstand): der ASR. adhan-js bildet den Schattenwinkel aus der
 * Deklination um 00:00 UT des Kalendertages (SolarTime.js: `julianDay(…, 0)`),
 * PrayTimes/Aladhan aus der Deklination zur Asr-Zeit selbst. Die Deklination
 * wandert bis zu 0,4°/Tag; in Winter-Nachmittagen hoher Breiten ist die
 * Höhenkurve der Sonne so flach, dass daraus 2–3 Minuten werden (Berlin
 * 15.01.2026: 14:08 vs. 14:05; Kairo/Mekka: 0–1 min). Eine Korrektur bräuchte
 * die nicht exportierten adhan-js-Interna (SolarTime/Astronomical) oder eine
 * eigene Sonnenposition — beides teurer als der gewonnene Fehler.
 */
export function computeTimings(lat: number, lon: number, date: Date, opts: PrayerCalcOptions): Timings {
  const params = baseParams(opts.method);
  params.madhab = opts.school === 1 ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = resolveHighLatitudeRule(opts.highLatitude, lat);
  // Innerhalb der Polarkreise gibt es Tage ohne Sonnenauf-/untergang. Ohne
  // Auflösung liefert adhan-js dort `Invalid Date` — die App zeigte dann
  // "NaN:NaN". AqrabYaum nimmt das nächstgelegene Datum, an dem sich die
  // Zeiten berechnen lassen; das ist die verbreitete Praxis (Aqrab al-Ayyam).
  // Bewusst NICHT an die Hochbreiten-Einstellung gekoppelt: diese wählt die
  // Nachtanteil-Regel für Fadschr/Ischa und hat für Tage ganz ohne Sonnenauf-
  // gang keine Aussage. Die echte Alternative wäre AqrabBalad (Zeiten eines
  // Ersatzortes bei 65°), das aber auch Dhuhr/Asr verschiebt. Aladhan liefert
  // an diesen Tagen entartete Werte (Tromsø 21.06.2026: Fadschr = Sonnenauf-
  // gang = Maghrib = Ischa = 00:46), api.ts erkennt das und rechnet dann lokal.
  params.polarCircleResolution = PolarCircleResolution.AqrabYaum;

  const times = new PrayerTimes(new Coordinates(lat, lon), date, params);
  const raw: Timings = {
    Fajr: hhmm(times.fajr),
    Sunrise: hhmm(times.sunrise),
    // Dhuhr beginnt erst NACH dem Zenitdurchgang; kaufmännisches Runden dürfte
    // eine Minute anzeigen, die bis zu 29 s davor liegt — in dieser Spanne ist
    // das Gebet ungültig. Aufrunden kostet gegenüber Aladhan höchstens eine
    // Minute und immer in die sichere Richtung. Aladhan selbst rundet auch hier
    // kaufmännisch, adhan-js addierte je nach Methode 1 bzw. 5 Minuten.
    Dhuhr: hhmm(times.dhuhr, 'up'),
    Asr: hhmm(asrWithinDay(times)),
    Maghrib: hhmm(times.maghrib),
    Isha: hhmm(times.isha),
  };
  return applyPrayerTimeOffsets(raw, opts.offsets);
}

/**
 * Mehrere aufeinanderfolgende Tage lokal berechnen — Fallback für die
 * Notification-/ICS-Planung (fetchUpcomingTimings), wenn die API nichts liefert.
 */
export function computeUpcomingTimings(
  lat: number,
  lon: number,
  opts: PrayerCalcOptions,
  count: number,
  from: Date,
): { date: Date; timings: Timings }[] {
  const days: { date: Date; timings: Timings }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    days.push({ date: d, timings: computeTimings(lat, lon, d, opts) });
  }
  return days;
}
