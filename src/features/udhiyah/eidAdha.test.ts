import { gregorianToHijriOffline } from '@/features/calendar/offline';

import { findNextEidAlAdha, udhiyahReminderDate, UDHIYAH_REMINDER_DAYS_BEFORE, UDHIYAH_REMINDER_HOUR } from './eidAdha';

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('findNextEidAlAdha', () => {
  it('findet ein Datum, das der Offline-Konverter als 10. Dhul-Hiddscha (Monat 12) erkennt', () => {
    const result = findNextEidAlAdha(new Date(2026, 0, 1));
    expect(result).not.toBeNull();
    const hijri = gregorianToHijriOffline(result as Date);
    expect(hijri.month).toBe(12);
    expect(hijri.day).toBe(10);
  });

  it('liefert 2026-05-26 ausgehend vom Jahresbeginn 2026 (gegen den Offline-Konverter berechnet)', () => {
    const result = findNextEidAlAdha(new Date(2026, 0, 1));
    expect(fmt(result as Date)).toBe('2026-05-26');
  });

  it('springt bei Suche direkt nach dem Fest auf das nächste Hijri-Jahr (2027-05-16)', () => {
    const result = findNextEidAlAdha(new Date(2026, 5, 1)); // 1. Juni 2026, nach dem Fest
    expect(fmt(result as Date)).toBe('2027-05-16');
  });

  it('ist inklusive des Startdatums selbst, falls es exakt Eid al-Adha ist', () => {
    const eid = findNextEidAlAdha(new Date(2026, 0, 1)) as Date;
    const again = findNextEidAlAdha(eid);
    expect(fmt(again as Date)).toBe(fmt(eid));
  });
});

describe('udhiyahReminderDate', () => {
  it(`liegt ${UDHIYAH_REMINDER_DAYS_BEFORE} Tage vor Eid al-Adha um ${UDHIYAH_REMINDER_HOUR} Uhr`, () => {
    const now = new Date(2026, 0, 1);
    const reminder = udhiyahReminderDate(now) as Date;
    expect(fmt(reminder)).toBe('2026-05-23');
    expect(reminder.getHours()).toBe(UDHIYAH_REMINDER_HOUR);
  });

  it('liegt der errechnete Termin bereits in der Vergangenheit, wird das nächste Hijri-Jahr verwendet', () => {
    // 2026-05-24: der Erinnerungstermin fürs aktuelle Fest (2026-05-23) ist
    // schon vorbei, das Fest selbst (2026-05-26) aber noch nicht.
    const now = new Date(2026, 4, 24);
    const reminder = udhiyahReminderDate(now) as Date;
    expect(fmt(reminder)).toBe('2027-05-13');
  });

  it('gibt einen Zeitpunkt in der Zukunft relativ zu `now` zurück', () => {
    const now = new Date(2026, 6, 19);
    const reminder = udhiyahReminderDate(now) as Date;
    expect(reminder.getTime()).toBeGreaterThan(now.getTime());
  });
});
