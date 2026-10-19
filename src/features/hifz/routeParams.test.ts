import { parseSurahNumber } from './routeParams';

describe('Hifz deep-link surah', () => {
  it.each([undefined, '', 'NaN', 'gap-test', '0', '-1', '115', '1.5', 'Infinity'])('safely defaults %s', (value) => {
    expect(parseSurahNumber(value)).toBe(1);
  });
  it.each(['1', '2', '114'])('preserves valid surah %s', (value) => {
    expect(parseSurahNumber(value)).toBe(Number(value));
  });
  it('accepts repeated query parameters deterministically', () => {
    expect(parseSurahNumber(['2', '3'])).toBe(2);
  });
});
