import { buildUdhiyahNotificationContent } from './notifications';

describe('buildUdhiyahNotificationContent', () => {
  it('liefert deutschen Text als Default', () => {
    const content = buildUdhiyahNotificationContent('de');
    expect(content.title).toContain('Udhiyah');
    expect(content.body.length).toBeGreaterThan(0);
  });

  it('liefert englischen Text für en', () => {
    const content = buildUdhiyahNotificationContent('en');
    expect(content.body).toContain('Eid al-Adha');
  });

  it('fällt für unbekannte Locales auf Deutsch zurück', () => {
    const content = buildUdhiyahNotificationContent('xx');
    expect(content).toEqual(buildUdhiyahNotificationContent('de'));
  });
});
