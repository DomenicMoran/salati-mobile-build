import {
  applyBibliothekReadingSession,
  bibliothekReadingStreak,
  bibliothekPagesToday,
  parseBibliothekReadingStats,
  BIBLIOTHEK_READING_STATS_KEY,
} from './readingStats';

describe('readingStats', () => {
  it('storage key stable', () => {
    expect(BIBLIOTHEK_READING_STATS_KEY).toBe('salati.bibliothek.reading-stats.v1');
  });

  it('accumulates pages and streak', () => {
    let stats = parseBibliothekReadingStats(null);
    stats = applyBibliothekReadingSession(stats, { day: '2026-11-09', pagesRead: 3, secondsSpent: 60 });
    stats = applyBibliothekReadingSession(stats, { day: '2026-11-10', pagesRead: 5, secondsSpent: 120 });
    stats = applyBibliothekReadingSession(stats, { day: '2026-11-11', pagesRead: 2, secondsSpent: 30 });
    expect(stats.totalPages).toBe(10);
    expect(stats.totalSeconds).toBe(210);
    expect(bibliothekPagesToday(stats, '2026-11-11')).toBe(2);
    expect(bibliothekReadingStreak(stats, '2026-11-11')).toBe(3);
  });
});
