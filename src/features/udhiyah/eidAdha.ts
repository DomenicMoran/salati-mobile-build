// Datums-Herleitung für Eid al-Adha (10. Dhul-Hiddscha, Hijri-Monat 12) —
// nutzt den bereits vorhandenen Offline-Gregorianisch→Hijri-Konverter
// (features/calendar/offline.ts, derselbe auch für islamicDays.ts genutzt)
// statt einer eigenen Berechnung. Der Konverter weicht an manchen Tagen um
// ±1 Tag vom mondsichtungsbasierten Aladhan-Kalender ab (s. Datei-Kommentar
// dort) — für eine saisonale "in den Tagen davor"-Erinnerung ist das
// ausreichend genau, anders als z. B. beim exakten Ramadan-Beginn.
import { gregorianToHijriOffline } from '@/features/calendar/offline';
import { parseTimeOn } from '@/features/prayer-times/next-prayer';

/** Wie viele Tage vor Eid al-Adha die Udhiyah/Qurbani-Erinnerung ausgelöst wird. */
export const UDHIYAH_REMINDER_DAYS_BEFORE = 3;

/** Feste lokale Stunde der Erinnerung (Vormittag, unabhängig von Gebetszeiten). */
export const UDHIYAH_REMINDER_HOUR = 9;

/**
 * Sucht ab `from` (inklusive) vorwärts das nächste Datum mit Hijri 12-10
 * (Eid al-Adha). `maxDays` deckt selbst einen ungünstigen Startpunkt kurz
 * nach dem letzten Eid al-Adha ab (Hijri-Jahr hat 354/355 Tage).
 */
export function findNextEidAlAdha(from: Date, maxDays = 400): Date | null {
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < maxDays; i++) {
    const hijri = gregorianToHijriOffline(cursor);
    if (hijri.month === 12 && hijri.day === 10) return new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/**
 * Zeitpunkt der Udhiyah-Erinnerung: UDHIYAH_REMINDER_DAYS_BEFORE Tage vor dem
 * nächsten Eid al-Adha, feste Uhrzeit. Liegt der errechnete Zeitpunkt schon
 * in der Vergangenheit (z. B. App-Start 1-2 Tage vor Eid, oder direkt danach
 * im selben Hijri-Jahr), wird stattdessen das darauffolgende Eid al-Adha
 * (nächstes Hijri-Jahr) verwendet — sonst würde bis kurz vor dem
 * übernächsten Fest gar keine Erinnerung mehr geplant.
 */
export function udhiyahReminderDate(now: Date, hour: number = UDHIYAH_REMINDER_HOUR): Date | null {
  const firstEid = findNextEidAlAdha(now);
  if (!firstEid) return null;

  const firstReminder = reminderBeforeEid(firstEid, hour);
  if (firstReminder.getTime() > now.getTime()) return firstReminder;

  const searchFrom = new Date(firstEid);
  searchFrom.setDate(searchFrom.getDate() + 1);
  const nextEid = findNextEidAlAdha(searchFrom);
  if (!nextEid) return null;
  return reminderBeforeEid(nextEid, hour);
}

function reminderBeforeEid(eid: Date, hour: number): Date {
  const d = new Date(eid);
  d.setDate(d.getDate() - UDHIYAH_REMINDER_DAYS_BEFORE);
  // parseTimeOn statt setHours — Begruendung s. prayer-times/next-prayer.ts.
  return parseTimeOn(`${String(hour).padStart(2, '0')}:00`, d);
}
