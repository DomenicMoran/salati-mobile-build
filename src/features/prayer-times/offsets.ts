// Manuelle Minuten-Korrektur je Gebet ("tune"). Praktisch jede Moschee weicht
// ein paar Minuten von der reinen Rechnung ab; ohne diese Korrektur passt die
// App nicht zur eigenen Gemeinde (Audit 2026-07-27, K2).
//
// BEWUSSTE ENTSCHEIDUNG: Die Korrektur wird an EINER Stelle client-seitig
// angewandt (hier), nicht über den Aladhan-Parameter `tune`. Grund: dieselbe
// Funktion gilt dann unverändert für die lokale Berechnung (calc.ts) und für
// Werte aus dem Offline-Cache. Zwei Korrekturpfade (Server + Client) wären die
// naheliegende Quelle für doppelt angewandte Minuten.

import type { PrayerTimeOffsets } from '@/features/settings/types';
import { PRAYER_TIME_OFFSET_MAX, PRAYER_TIME_OFFSET_MIN } from '@/features/settings/types';

import type { Timings } from './api';

/** Auf ganze Minuten im erlaubten Bereich (±60) begrenzen. */
export function clampOffset(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.min(PRAYER_TIME_OFFSET_MAX, Math.max(PRAYER_TIME_OFFSET_MIN, Math.round(minutes)));
}

/**
 * Verschiebt eine "HH:MM"-Zeit um `minutes`. Über Mitternacht wird zyklisch
 * gerechnet (23:50 + 20 = 00:10) — die Zeit gehört weiterhin zu diesem
 * Kalendertag, genau wie bei Aladhan-`tune`.
 */
export function shiftHHMM(hhmm: string, minutes: number): string {
  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const total = (((h * 60 + m + clampOffset(minutes)) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Wendet die Nutzer-Korrektur auf alle sechs Zeiten an (auch Sonnenaufgang). */
export function applyPrayerTimeOffsets(timings: Timings, offsets: PrayerTimeOffsets): Timings {
  return {
    Fajr: shiftHHMM(timings.Fajr, offsets.fajr),
    Sunrise: shiftHHMM(timings.Sunrise, offsets.sunrise),
    Dhuhr: shiftHHMM(timings.Dhuhr, offsets.dhuhr),
    Asr: shiftHHMM(timings.Asr, offsets.asr),
    Maghrib: shiftHHMM(timings.Maghrib, offsets.maghrib),
    Isha: shiftHHMM(timings.Isha, offsets.isha),
  };
}
