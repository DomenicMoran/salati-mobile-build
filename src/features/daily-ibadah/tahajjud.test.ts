import { tahajjudWindow } from './tahajjud';

describe('tahajjudWindow', () => {
  it('third starts two thirds after maghrib', () => {
    const maghrib = new Date('2026-01-01T18:00:00');
    const fajr = new Date('2026-01-02T06:00:00');
    const w = tahajjudWindow(maghrib, fajr);
    expect(w.thirdStart.getTime()).toBe(maghrib.getTime() + (2 * (fajr.getTime() - maghrib.getTime())) / 3);
    expect(w.end.getTime()).toBe(fajr.getTime());
  });
});
