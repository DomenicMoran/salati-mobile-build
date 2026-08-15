import { formatRelativeTime } from './relativeTime';

// Minimaler Fake-Übersetzer: liefert den Key selbst zurück (wie translate()'s
// Fallback), reicht um die Verzweigungslogik ohne locales/*.json zu prüfen.
const t = (key: string) => key;

describe('formatRelativeTime', () => {
  const now = 1_000_000_000_000; // fixer Referenzzeitpunkt

  it('unter einer Minute: "justNow"', () => {
    expect(formatRelativeTime(t, now - 30_000, now)).toBe('quran.history.justNow');
  });

  it('unter einer Stunde: Minuten', () => {
    expect(formatRelativeTime(t, now - 5 * 60_000, now)).toBe('quran.history.minutesAgo');
  });

  it('unter 24h: Stunden', () => {
    const at = now - 3 * 60 * 60_000;
    expect(formatRelativeTime(t, at, now)).toBe('quran.history.hoursAgo');
  });

  it('zwischen 24h und 48h: "yesterday"', () => {
    const at = now - 30 * 60 * 60_000; // 30h zurück
    expect(formatRelativeTime(t, at, now)).toBe('quran.history.yesterday');
  });

  it('ab 48h: Tage', () => {
    const at = now - 3 * 24 * 60 * 60_000; // 3 Tage zurück
    expect(formatRelativeTime(t, at, now)).toBe('quran.history.daysAgo');
  });

  it('Zukunft/negative Differenz wird auf 0 gekappt statt negativ', () => {
    expect(formatRelativeTime(t, now + 60_000, now)).toBe('quran.history.justNow');
  });

  it('ersetzt den {n}-Platzhalter mit dem tatsächlichen Wert', () => {
    const tWithPlaceholder = (key: string) => (key === 'quran.history.minutesAgo' ? 'vor {n} Min.' : key);
    expect(formatRelativeTime(tWithPlaceholder, now - 5 * 60_000, now)).toBe('vor 5 Min.');
  });
});
