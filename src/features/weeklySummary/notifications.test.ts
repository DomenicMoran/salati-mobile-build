import { buildWeeklySummaryContent } from './notifications';

describe('buildWeeklySummaryContent', () => {
  it('kombiniert beide Kennzahlen, wenn beide vorhanden sind', () => {
    const content = buildWeeklySummaryContent('de', { lessonsCompleted: 4, fullPrayerDays: 5 });
    expect(content.body).toContain('4');
    expect(content.body).toContain('5');
    expect(content.title.length).toBeGreaterThan(0);
  });

  it('zeigt nur Lektionen, wenn keine vollen Gebetstage vorhanden sind', () => {
    const content = buildWeeklySummaryContent('de', { lessonsCompleted: 3, fullPrayerDays: 0 });
    expect(content.body).toContain('3');
    expect(content.body).not.toContain('Gebete');
  });

  it('zeigt nur Gebetstage, wenn keine Lektionen abgeschlossen wurden', () => {
    const content = buildWeeklySummaryContent('de', { lessonsCompleted: 0, fullPrayerDays: 2 });
    expect(content.body).toContain('2');
    expect(content.body).not.toContain('Lektionen abgeschlossen');
  });

  it('zeigt einen motivierenden Leer-Text ohne Zahlen, wenn nichts passiert ist', () => {
    const content = buildWeeklySummaryContent('de', { lessonsCompleted: 0, fullPrayerDays: 0 });
    expect(content.body).not.toMatch(/\d/);
  });

  it('liefert für jede der 6 Sprachen einen nicht-leeren Text ohne offenen Platzhalter', () => {
    for (const locale of ['de', 'en', 'tr', 'ar', 'es', 'fr']) {
      const content = buildWeeklySummaryContent(locale, { lessonsCompleted: 2, fullPrayerDays: 3 });
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.body).not.toContain('{lessons}');
      expect(content.body).not.toContain('{days}');
      expect(content.body).toContain('2');
      expect(content.body).toContain('3');
    }
  });

  it('fällt bei unbekanntem Locale auf Deutsch zurück', () => {
    const stats = { lessonsCompleted: 1, fullPrayerDays: 1 };
    expect(buildWeeklySummaryContent('xx', stats)).toEqual(buildWeeklySummaryContent('de', stats));
  });
});
