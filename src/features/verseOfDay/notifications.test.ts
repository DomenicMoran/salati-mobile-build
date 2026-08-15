import { buildVerseOfDayNotificationContent } from './notifications';
import type { VerseOfDayContent } from './content';
import type { VerseOfDayRef } from './pool';

const verseRef: VerseOfDayRef = { kind: 'verse', surah: 2, ayah: 255 };
const hadithRef: VerseOfDayRef = { kind: 'hadith', number: 1 };

const verseContent: VerseOfDayContent = {
  arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ',
  translation: 'Allah - there is no deity except Him, the Ever-Living, the Sustainer of existence.',
  source: 'Al-Baqara 2:255',
  deepLink: 'salatibox://quran/2?ayah=255',
};

const hadithContent: VerseOfDayContent = {
  arabic: 'إنما الأعمال بالنيات',
  translation: 'Actions are but by intentions.',
  source: 'An-Nawawi 40 · Hadith 1',
  deepLink: 'salatibox://hadith/nawawi/1',
};

describe('buildVerseOfDayNotificationContent', () => {
  it('nutzt den Vers-Titel für Vers-Referenzen', () => {
    const content = buildVerseOfDayNotificationContent(verseRef, verseContent, 'de');
    expect(content.title).toBe('Vers des Tages');
  });

  it('nutzt den Hadith-Titel für Hadith-Referenzen', () => {
    const content = buildVerseOfDayNotificationContent(hadithRef, hadithContent, 'de');
    expect(content.title).toBe('Hadith des Tages');
  });

  it('enthält Übersetzung und Quelle im Body', () => {
    const content = buildVerseOfDayNotificationContent(verseRef, verseContent, 'de');
    expect(content.body).toContain('Ever-Living');
    expect(content.body).toContain('Al-Baqara 2:255');
  });

  it('kürzt eine sehr lange Übersetzung, ohne die Quelle zu verlieren', () => {
    const longContent: VerseOfDayContent = {
      ...verseContent,
      translation: 'x'.repeat(500),
    };
    const content = buildVerseOfDayNotificationContent(verseRef, longContent, 'de');
    expect(content.body).toContain('…');
    expect(content.body).toContain('Al-Baqara 2:255');
    expect(content.body.length).toBeLessThan(300);
  });

  it('trägt den Deep-Link im data-Payload für den Tap-Handler', () => {
    const content = buildVerseOfDayNotificationContent(verseRef, verseContent, 'de');
    expect(content.data).toEqual({ deepLink: 'salatibox://quran/2?ayah=255' });
  });

  it('liefert für jede der 6 unterstützten Sprachen einen nicht-leeren Titel', () => {
    for (const locale of ['de', 'en', 'tr', 'ar', 'es', 'fr']) {
      const verse = buildVerseOfDayNotificationContent(verseRef, verseContent, locale);
      const hadith = buildVerseOfDayNotificationContent(hadithRef, hadithContent, locale);
      expect(verse.title.length).toBeGreaterThan(0);
      expect(hadith.title.length).toBeGreaterThan(0);
      expect(verse.title).not.toBe(hadith.title);
    }
  });

  it('fällt bei unbekanntem Locale auf Deutsch zurück', () => {
    const unknown = buildVerseOfDayNotificationContent(verseRef, verseContent, 'xx');
    const de = buildVerseOfDayNotificationContent(verseRef, verseContent, 'de');
    expect(unknown.title).toBe(de.title);
  });
});
