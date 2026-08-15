// Eingabe-Prüfung für den Hijri-Umrechner (app/hijri-converter.tsx).
//
// Audit 2026-07-27 (Bildschirm-Bericht M21): Der Screen verschluckte jede
// ungültige Eingabe stumm — „31. Februar", ein leeres Feld oder ein Jahr 0
// ergaben nur einen Gedankenstrich „—", ohne zu sagen warum. Dazu war das
// Verhalten inkonsistent: die Stepper klemmen auf min/max, die Tastatur-
// eingabe nicht. Die Prüfung lag ausserdem mitten im Screen und war damit
// nicht testbar. Beides hier zusammengeführt: eine reine Funktion je
// Kalender, die statt `null` einen benannten Grund liefert, den das UI
// übersetzen kann.

import type { HijriYMD } from './offline';

/** Warum eine Datumseingabe nicht verwendbar ist. */
export type DateInputError =
  /** Mindestens ein Feld ist leer oder keine Zahl. */
  | 'incomplete'
  /** Zahl ausserhalb des zulässigen Bereichs (Monat 13, Jahr 0, Tag 32 …). */
  | 'range'
  /** Bereich stimmt, Datum existiert trotzdem nicht (31. Februar). */
  | 'nonexistent';

export type DateInputResult<T> = { ok: true; value: T } | { ok: false; error: DateInputError };

function toInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // parseInt('12abc') wäre 12 — hier soll nur eine reine Zahl durchgehen.
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isInteger(n) ? n : null;
}

/**
 * Gregorianische Eingabe → `Date`.
 *
 * `new Date(2026, 1, 31)` normalisiert überlaufende Tage stillschweigend zum
 * 3. März — genau das ist der Fall, den der Nutzer erklärt bekommen muss.
 */
export function parseGregorianInput(day: string, month: string, year: string): DateInputResult<Date> {
  const d = toInt(day);
  const m = toInt(month);
  const y = toInt(year);
  if (d === null || m === null || y === null) return { ok: false, error: 'incomplete' };
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1 || y > 9999) return { ok: false, error: 'range' };
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return { ok: false, error: 'nonexistent' };
  // Jahre < 100 setzt der Date-Konstruktor auf 19xx (Legacy-Verhalten) — das
  // wäre ein anderes Datum als eingegeben und darf nicht durchgehen.
  if (date.getFullYear() !== y) return { ok: false, error: 'range' };
  return { ok: true, value: date };
}

/**
 * Hijri-Eingabe → `HijriYMD`.
 *
 * Hijri-Monate haben 29 oder 30 Tage; welcher, hängt vom Sichtungsverfahren
 * ab und ist ohne Kalenderquelle nicht entscheidbar. Deshalb ist 1–30 der
 * zulässige Bereich und es gibt hier bewusst kein `'nonexistent'`.
 */
export function parseHijriInput(day: string, month: string, year: string): DateInputResult<HijriYMD> {
  const d = toInt(day);
  const m = toInt(month);
  const y = toInt(year);
  if (d === null || m === null || y === null) return { ok: false, error: 'incomplete' };
  if (m < 1 || m > 12 || d < 1 || d > 30 || y < 1 || y > 9999) return { ok: false, error: 'range' };
  return { ok: true, value: { day: d, month: m, year: y } };
}
