import { buildPreAdhanReminderContent, computePreAdhanReminderTime } from './preAdhanReminder';

describe('computePreAdhanReminderTime', () => {
  it('liegt exakt offsetMinutes vor der Gebetszeit', () => {
    const prayerTime = new Date('2026-07-20T13:05:00');
    const reminder = computePreAdhanReminderTime(prayerTime, 15);
    expect(prayerTime.getTime() - reminder.getTime()).toBe(15 * 60_000);
  });

  it('unterstützt alle drei wählbaren Offsets (10/15/20)', () => {
    const prayerTime = new Date('2026-07-20T13:05:00');
    for (const offset of [10, 15, 20] as const) {
      const reminder = computePreAdhanReminderTime(prayerTime, offset);
      expect(prayerTime.getTime() - reminder.getTime()).toBe(offset * 60_000);
    }
  });
});

describe('buildPreAdhanReminderContent', () => {
  it('enthält Gebetsname, Minutenzahl und Uhrzeit im Body', () => {
    const content = buildPreAdhanReminderContent('Dhuhr', '13:05', 15, 'de');
    expect(content.body).toContain('15');
    expect(content.body).toContain('13:05');
    expect(content.title).toContain('Dhuhr');
  });

  it('nutzt für Arabisch den arabischen Gebetsnamen statt der Transliteration', () => {
    const content = buildPreAdhanReminderContent('Fajr', '04:15', 10, 'ar');
    expect(content.title).toContain('الفجر');
    expect(content.title).not.toContain('Fajr');
  });

  it('liefert für jede der 6 unterstützten Sprachen einen nicht-leeren Titel', () => {
    for (const locale of ['de', 'en', 'tr', 'ar', 'es', 'fr']) {
      const content = buildPreAdhanReminderContent('Asr', '17:00', 20, locale);
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.body).not.toContain('{p}');
      expect(content.body).not.toContain('{min}');
      expect(content.body).not.toContain('{time}');
    }
  });

  it('fällt bei unbekanntem Locale auf Deutsch zurück', () => {
    const unknown = buildPreAdhanReminderContent('Isha', '21:30', 10, 'xx');
    const de = buildPreAdhanReminderContent('Isha', '21:30', 10, 'de');
    expect(unknown.title).toBe(de.title);
  });
});
