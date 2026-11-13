import { buildPrintablePrayerWeekHtml } from './printWeekHtml';
import type { WeekDayRow } from '@/features/prayer-times/week';

describe('buildPrintablePrayerWeekHtml', () => {
  it('embeds prayer times in table', () => {
    const rows: WeekDayRow[] = [
      {
        date: new Date(2026, 10, 13),
        weekdayIdx: 3,
        isToday: true,
        timings: { Fajr: '05:30', Sunrise: '07:00', Dhuhr: '12:00', Asr: '14:00', Maghrib: '16:30', Isha: '18:00' },
      },
    ];
    const html = buildPrintablePrayerWeekHtml(rows, { locale: 'de', timeFormat: '24h', locationLabel: 'Berlin' });
    expect(html).toContain('05:30');
    expect(html).toContain('Berlin');
  });
});
