import {
  buildJumuahReminderContent,
  computeJumuahReminderTime,
  findNextJumuah,
  JUMUAH_REMINDER_OFFSET_MINUTES,
} from './jumuahReminder';
import type { DayTimings } from './notifications';

function mkDay(dateStr: string, dhuhr: string): DayTimings {
  return {
    date: new Date(dateStr),
    timings: { Fajr: '04:00', Sunrise: '05:30', Dhuhr: dhuhr, Asr: '17:00', Maghrib: '20:00', Isha: '21:30' },
  };
}

describe('computeJumuahReminderTime', () => {
  it('liegt genau JUMUAH_REMINDER_OFFSET_MINUTES vor Dhuhr', () => {
    const friday = new Date('2026-07-24T00:00:00'); // ein Freitag
    const reminder = computeJumuahReminderTime('13:00', friday);
    const dhuhr = new Date('2026-07-24T13:00:00');
    expect(dhuhr.getTime() - reminder.getTime()).toBe(JUMUAH_REMINDER_OFFSET_MINUTES * 60_000);
  });
});

describe('findNextJumuah', () => {
  it('findet den einzigen Freitag im 7-Tage-Fenster', () => {
    // 2026-07-20 ist ein Montag -> Fenster Mo-So enthält genau einen Freitag (24.)
    const days: DayTimings[] = [
      mkDay('2026-07-20T00:00:00', '13:05'), // Mo
      mkDay('2026-07-21T00:00:00', '13:05'), // Di
      mkDay('2026-07-22T00:00:00', '13:05'), // Mi
      mkDay('2026-07-23T00:00:00', '13:05'), // Do
      mkDay('2026-07-24T00:00:00', '13:05'), // Fr
      mkDay('2026-07-25T00:00:00', '13:05'), // Sa
      mkDay('2026-07-26T00:00:00', '13:05'), // So
    ];
    const now = new Date('2026-07-20T08:00:00');
    const found = findNextJumuah(days, now);
    expect(found?.date.toDateString()).toBe(new Date('2026-07-24T00:00:00').toDateString());
  });

  it('ignoriert einen Freitag, dessen Erinnerungszeitpunkt schon vorbei ist', () => {
    const days: DayTimings[] = [mkDay('2026-07-24T00:00:00', '13:05')];
    const now = new Date('2026-07-24T23:00:00'); // weit nach Dhuhr UND nach dem Reminder-Offset
    expect(findNextJumuah(days, now)).toBeNull();
  });

  it('gibt null zurück, wenn kein Freitag im Fenster liegt', () => {
    const days: DayTimings[] = [mkDay('2026-07-20T00:00:00', '13:05'), mkDay('2026-07-21T00:00:00', '13:05')];
    expect(findNextJumuah(days, new Date('2026-07-20T00:00:00'))).toBeNull();
  });
});

describe('buildJumuahReminderContent', () => {
  it('enthält die formatierte Uhrzeit und einen Deep-Link zu Sure Al-Kahf (18)', () => {
    const content = buildJumuahReminderContent('de', '13:05');
    expect(content.body).toContain('13:05');
    expect(content.data.deepLink).toBe('salatibox://quran/18?ayah=1');
  });

  it('liefert für jede der 6 unterstützten Sprachen einen nicht-leeren Titel', () => {
    for (const locale of ['de', 'en', 'tr', 'ar', 'es', 'fr']) {
      const content = buildJumuahReminderContent(locale, '13:05');
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.body).toContain('13:05');
    }
  });

  it('fällt bei unbekanntem Locale auf Deutsch zurück', () => {
    const unknown = buildJumuahReminderContent('xx', '13:05');
    const de = buildJumuahReminderContent('de', '13:05');
    expect(unknown.title).toBe(de.title);
  });
});
