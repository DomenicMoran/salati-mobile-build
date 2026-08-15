// Client-seitiger Aladhan-Aufruf — kein Next.js-Backend in Expo verfügbar.
// Portiert aus apps/device/src/app/api/timings/route.ts (dort als Server-Proxy).
//
// KRITISCH: Aladhan erwartet ein Datumssegment im Pfad (DD-MM-YYYY). Ohne
// explizites Datum wird die URL fehlgeformt und die API liefert 404 — das war
// ein realer Bug im Salatibox-Audit 2026-07-07. Immer todayAladhan()/fmtDate()
// verwenden, nie das Segment weglassen.
//
// Seit 2026-07-27: Aladhan ist die primäre Quelle, adhan-js (calc.ts) rechnet
// dieselben Zeiten lokal, sobald die API nicht erreichbar ist — die App
// funktioniert damit vollständig offline. Begründung der Rollenverteilung
// steht im Kopf von calc.ts. Die Nutzer-Minuten-Korrektur (offsets.ts) wird
// auf BEIDE Pfade angewandt, die Hochbreiten-Regel geht als
// `latitudeAdjustmentMethod` an Aladhan und als `highLatitudeRule` an adhan-js.

import { fetchWithTimeout } from '@/lib/fetchJson';

import { aladhanLatitudeAdjustment, computeTimings, type PrayerCalcOptions } from './calc';
import { applyPrayerTimeOffsets } from './offsets';

/**
 * Gesamtbudget für ALLE Versuche von {@link fetchTimingsWithRetry} zusammen.
 *
 * Warum ein Budget statt eines Timeouts je Versuch (Performance-Audit
 * 2026-07-27, §6): fetch() kennt in React Native kein Timeout. Bei einem
 * hängenden Netz (Captive-Portal, stiller Paketverlust) blieb der Gebetszeiten-
 * Screen unbegrenzt im Ladezustand — die lokale Berechnung (calc.ts), die die
 * App offline tragen soll, wurde nie erreicht. Ein Timeout je Versuch würde
 * sich dagegen mit den 3 Versuchen und dem Backoff multiplizieren.
 *
 * Mit dem Budget gilt: nach spätestens 8 s stehen Zeiten auf dem Schirm —
 * egal ob aus der API oder aus adhan-js.
 */
export const TIMINGS_BUDGET_MS = 8_000;

/** Kalender-Endpoint (ein Monat auf einmal, entsprechend größere Antwort). */
const CALENDAR_TIMEOUT_MS = 10_000;

export interface Timings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface HijriDate {
  day: string;
  month: { number: string; en: string };
  year: string;
}

interface AlAdhanResponse {
  data?: {
    timings?: Record<string, string>;
    date?: { hijri?: HijriDate };
  };
}

export function fmtDateAladhan(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function onlyHHMM(s: string | undefined): string {
  return s ? (s.split(' ')[0] ?? '') : '';
}

/**
 * Gemeinsame Query-Parameter für alle Aladhan-Endpoints. `latitudeAdjustmentMethod`
 * wurde bis 2026-07-27 nie gesetzt (Audit-Befund K1) — ohne den Parameter waren
 * Fadschr/Ischa in Deutschland im Sommer unbrauchbar.
 * Kein `tune`-Parameter: die Minuten-Korrektur passiert client-seitig, damit sie
 * auch für lokal berechnete und gecachte Zeiten gilt (s. offsets.ts).
 */
function aladhanQuery(opts: PrayerCalcOptions, lat: number): string {
  return `method=${opts.method}&school=${opts.school}&latitudeAdjustmentMethod=${aladhanLatitudeAdjustment(
    opts.highLatitude,
    lat,
  )}`;
}

function timingsFromResponse(t: Record<string, string>): Timings {
  return {
    Fajr: onlyHHMM(t.Fajr),
    Sunrise: onlyHHMM(t.Sunrise),
    Dhuhr: onlyHHMM(t.Dhuhr),
    Asr: onlyHHMM(t.Asr),
    Maghrib: onlyHHMM(t.Maghrib),
    Isha: onlyHHMM(t.Isha),
  };
}

/**
 * Innerhalb der Polarkreise gibt es Tage ohne Sonnenauf- oder -untergang. Aladhan
 * liefert dafür keine Ersatzzeiten, sondern kippt die betroffenen Zeiten auf
 * einen einzigen Wert — nachgemessen für Tromsø (69,65° N), Methode 3:
 *   21.06.2026: Fadschr = Sonnenaufgang = Maghrib = Ischa = 00:46
 *   10.12.2026: Sonnenaufgang = Dhuhr = Maghrib = 11:37
 * Das ist keine Gebetszeit, sondern ein Platzhalter: "Maghrib = Sonnenaufgang"
 * kann der Nutzer nicht befolgen. In genau diesen Fällen ist die lokale Rechnung
 * (calc.ts, Aqrab al-Ayyam über PolarCircleResolution) die bessere Quelle — sie
 * liefert die Zeiten des nächstgelegenen Tages, an dem die Sonne auf- und
 * untergeht. Erkennung bewusst über die ROHEN API-Werte, vor der Nutzer-
 * Korrektur: eine Korrektur nur auf Dhuhr würde die Gleichheit sonst verdecken.
 */
export function isDegenerateSolarDay(t: Timings): boolean {
  return t.Sunrise === t.Dhuhr || t.Sunrise === t.Maghrib || t.Dhuhr === t.Maghrib;
}

async function fetchAladhan(
  url: string,
  opts: PrayerCalcOptions,
  timeoutMs: number = TIMINGS_BUDGET_MS,
): Promise<{ timings: Timings; hijri?: HijriDate; degenerate: boolean } | null> {
  const r = await fetchWithTimeout(url, {
    headers: { 'user-agent': 'salatibox-mobile/1.0' },
    timeoutMs,
    errorPrefix: 'aladhan_timings',
  });
  if (!r.ok) return null;
  const j: AlAdhanResponse = await r.json();
  if (!j.data?.timings) return null;
  const raw = timingsFromResponse(j.data.timings);
  return {
    timings: applyPrayerTimeOffsets(raw, opts.offsets),
    hijri: j.data.date?.hijri,
    degenerate: isDegenerateSolarDay(raw),
  };
}

export async function fetchTimingsByCoords(
  lat: number,
  lon: number,
  date: Date,
  opts: PrayerCalcOptions,
  timeoutMs?: number,
) {
  const url = `https://api.aladhan.com/v1/timings/${fmtDateAladhan(date)}?latitude=${lat}&longitude=${lon}&${aladhanQuery(
    opts,
    lat,
  )}`;
  return fetchAladhan(url, opts, timeoutMs);
}

/**
 * Variante über Stadt/Land statt Koordinaten. `lat` dient hier ausschließlich
 * dazu, die Hochbreiten-Einstellung "auto" aufzulösen (Aladhan kennt kein
 * "auto") — die Zeiten selbst berechnet die API aus dem Ortsnamen.
 */
export async function fetchTimingsByCity(
  city: string,
  country: string,
  date: Date,
  opts: PrayerCalcOptions,
  lat: number,
  timeoutMs?: number,
) {
  const url = `https://api.aladhan.com/v1/timingsByCity/${fmtDateAladhan(date)}?city=${encodeURIComponent(
    city,
  )}&country=${encodeURIComponent(country)}&${aladhanQuery(opts, lat)}`;
  return fetchAladhan(url, opts, timeoutMs);
}

interface AlAdhanCalendarDay {
  timings?: Record<string, string>;
  date?: { gregorian?: { date?: string } }; // DD-MM-YYYY
}

/**
 * Gebetszeiten für die nächsten `count` Tage (inkl. heute) — Grundlage für
 * die Mehrtages-Notification-Planung und den ICS-Export. Nutzt den Kalender-
 * Endpoint (1 Call pro Monat statt 7 Einzel-Calls); Monatsübergang = maximal
 * 2 Calls. Tage, die die API nicht liefert (offline, Ausfall), werden lokal
 * berechnet — sonst stünde ein Nutzer ohne Netz auch ohne Benachrichtigungen da.
 */
export async function fetchUpcomingTimings(
  lat: number,
  lon: number,
  opts: PrayerCalcOptions,
  count: number = 7,
  now: Date = new Date(),
): Promise<{ date: Date; timings: Timings }[]> {
  const months = new Map<string, { year: number; month: number }>();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    months.set(`${d.getFullYear()}-${d.getMonth() + 1}`, {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  const byDate = new Map<string, Timings>();
  for (const { year, month } of months.values()) {
    const url = `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lon}&${aladhanQuery(
      opts,
      lat,
    )}`;
    try {
      const r = await fetchWithTimeout(url, {
        headers: { 'user-agent': 'salatibox-mobile/1.0' },
        timeoutMs: CALENDAR_TIMEOUT_MS,
        errorPrefix: 'aladhan_calendar',
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: AlAdhanCalendarDay[] };
      for (const day of j.data ?? []) {
        const t = day.timings;
        const dateStr = day.date?.gregorian?.date;
        if (!t || !dateStr) continue;
        const raw = timingsFromResponse(t);
        // Polartage übergeht die Schleife: der Tag fällt unten in die lokale
        // Rechnung, statt einen Platzhalter in Wochenübersicht, ICS-Export und
        // Benachrichtigungen zu tragen (s. isDegenerateSolarDay).
        if (isDegenerateSolarDay(raw)) continue;
        byDate.set(dateStr, applyPrayerTimeOffsets(raw, opts.offsets));
      }
    } catch {
      // Netzfehler — die betroffenen Tage kommen unten aus der lokalen Rechnung.
    }
  }
  const result: { date: Date; timings: Timings }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const timings = byDate.get(fmtDateAladhan(d)) ?? computeTimings(lat, lon, d, opts);
    result.push({ date: d, timings });
  }
  return result;
}

/**
 * Mit 3 Versuchen (Backoff) — spiegelt das Retry-Pattern aus SalatiDashboard.tsx.
 * Danach wird lokal gerechnet statt `null` zurückzugeben: Aufrufer (Screen,
 * Homescreen-Widget) bekommen so auch offline gültige Zeiten. Die Korrektur-
 * Minuten sind in beiden Pfaden bereits angewandt — hier NICHT erneut anwenden.
 */
export async function fetchTimingsWithRetry(lat: number, lon: number, date: Date, opts: PrayerCalcOptions) {
  const deadline = Date.now() + TIMINGS_BUDGET_MS;
  for (let attempt = 0; attempt < 3; attempt++) {
    // Jeder Versuch bekommt nur, was vom Gesamtbudget noch übrig ist. Damit
    // kann sich der Retry nicht mit dem Timeout multiplizieren.
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const result = await fetchTimingsByCoords(lat, lon, date, opts, remaining);
      // Entarteter Polartag: die API hat geantwortet, aber ohne brauchbare
      // Zeiten. Kein Retry (die Antwort wäre dieselbe) — lokal rechnen und nur
      // das Hijri-Datum aus der Antwort übernehmen.
      if (result?.degenerate) return { timings: computeTimings(lat, lon, date, opts), hijri: result.hijri };
      if (result) return result;
    } catch {
      // retry
    }
    // Backoff nur, wenn danach überhaupt noch Zeit für einen Versuch bleibt —
    // sonst wartet die App am Ende nur noch, ohne etwas damit anzufangen.
    const backoff = 400 * (attempt + 1);
    if (Date.now() + backoff >= deadline) break;
    await new Promise((res) => setTimeout(res, backoff));
  }
  return { timings: computeTimings(lat, lon, date, opts) };
}
