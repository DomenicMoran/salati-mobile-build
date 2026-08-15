import { buildReviewReminderContent } from './reviewNotifications';

describe('buildReviewReminderContent', () => {
  it('nutzt den generischen Text, wenn kein Thema bekannt ist', () => {
    const content = buildReviewReminderContent('de');
    expect(content.body).not.toContain('{topic}');
    expect(content.body.toLowerCase()).toContain('fällig');
  });

  it('nutzt den generischen Text bei leerem/Whitespace-Thema', () => {
    expect(buildReviewReminderContent('de', '')).toEqual(buildReviewReminderContent('de'));
    expect(buildReviewReminderContent('de', '   ')).toEqual(buildReviewReminderContent('de'));
  });

  it('setzt den Lektionsnamen in den Text ein, wenn ein Thema bekannt ist', () => {
    const content = buildReviewReminderContent('de', 'Sabr');
    expect(content.body).not.toContain('{topic}');
    expect(content.body).toContain('Sabr');
  });

  it('trimmt umgebenden Whitespace des Themennamens', () => {
    const content = buildReviewReminderContent('de', '  Sabr  ');
    expect(content.body).toContain('Sabr');
    expect(content.body).not.toContain('  Sabr  ');
  });

  it('liefert für jede der 6 Sprachen einen Text ohne offenen Platzhalter', () => {
    for (const locale of ['de', 'en', 'tr', 'ar', 'es', 'fr']) {
      const withTopic = buildReviewReminderContent(locale, 'Sabr');
      expect(withTopic.body).toContain('Sabr');
      expect(withTopic.body).not.toContain('{topic}');
      expect(withTopic.title.length).toBeGreaterThan(0);

      const generic = buildReviewReminderContent(locale);
      expect(generic.body).not.toContain('{topic}');
      expect(generic.title.length).toBeGreaterThan(0);
    }
  });

  it('fällt bei unbekanntem Locale auf Deutsch zurück', () => {
    expect(buildReviewReminderContent('xx', 'Sabr')).toEqual(buildReviewReminderContent('de', 'Sabr'));
    expect(buildReviewReminderContent('xx')).toEqual(buildReviewReminderContent('de'));
  });
});
