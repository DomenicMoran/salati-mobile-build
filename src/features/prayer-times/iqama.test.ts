import { formatIqama, iqamaTime } from './iqama';

function on(hh: number, mm: number): Date {
  return new Date(2026, 5, 15, hh, mm, 0, 0);
}

describe('iqamaTime', () => {
  it('adds the offset in minutes to the adhan time', () => {
    const result = iqamaTime('04:30', 20, on(0, 0));
    expect(result.getHours()).toBe(4);
    expect(result.getMinutes()).toBe(50);
  });

  it('carries over into the next hour', () => {
    const result = iqamaTime('13:50', 15, on(0, 0));
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(5);
  });

  it('rolls over midnight for a late Isha + offset', () => {
    const result = iqamaTime('23:50', 20, on(0, 0));
    expect(result.getDate()).toBe(16); // reference was the 15th
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(10);
  });

  it('is a no-op with a zero offset', () => {
    const result = iqamaTime('17:00', 0, on(0, 0));
    expect(result.getHours()).toBe(17);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('formatIqama', () => {
  it('formats in 24h', () => {
    expect(formatIqama('04:30', 20, on(0, 0), '24h')).toBe('04:50');
  });

  it('formats in 12h with AM/PM across the boundary', () => {
    expect(formatIqama('11:50', 15, on(0, 0), '12h')).toBe('12:05 PM');
  });

  it('formats a Maghrib+10min offset that crosses into the next hour', () => {
    expect(formatIqama('20:55', 10, on(0, 0), '24h')).toBe('21:05');
  });
});
