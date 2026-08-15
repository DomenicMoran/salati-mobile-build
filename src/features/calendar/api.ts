// Aladhan-Kalender-Endpoints — liefern für jeden Tag eines Monats die
// Gregorianisch<->Hijri-Zuordnung inkl. bekannter Feiertage/Anlässe direkt
// von der API (kein eigenes Islamic-Events-Datenset nötig).

import { fmtDateAladhan } from '@/features/prayer-times/api';
import { fetchJson } from '@/lib/fetchJson';

export interface CalendarDay {
  hijri: {
    date: string;
    day: string;
    month: { number: number; en: string; ar: string };
    year: string;
    weekday: { en: string; ar: string };
    holidays: string[];
  };
  gregorian: {
    date: string;
    day: string;
    month: { number: number; en: string };
    year: string;
    weekday: { en: string };
  };
}

async function getJson<T>(url: string): Promise<T> {
  const j = await fetchJson<{ code?: number; data?: T }>(url, { errorPrefix: 'aladhan_calendar' });
  if (j.code !== 200) throw new Error('aladhan_calendar_bad_response');
  return j.data as T;
}

/** Ganzer Gregorianischer Monat mit Hijri-Zuordnung pro Tag. */
export async function fetchGregorianMonth(month: number, year: number): Promise<CalendarDay[]> {
  return getJson<CalendarDay[]>(`https://api.aladhan.com/v1/gToHCalendar/${month}/${year}`);
}

/** Einzeldatum Gregorianisch → Hijri — für den freien Datumsumrechner (hijri-converter.tsx). */
export async function fetchGregorianToHijri(date: Date): Promise<CalendarDay> {
  return getJson<CalendarDay>(`https://api.aladhan.com/v1/gToH/${fmtDateAladhan(date)}`);
}

/** Einzeldatum Hijri → Gregorianisch — Kehrseite von fetchGregorianToHijri. */
export async function fetchHijriToGregorian(day: number, month: number, year: number): Promise<CalendarDay> {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return getJson<CalendarDay>(`https://api.aladhan.com/v1/hToG/${dd}-${mm}-${year}`);
}
