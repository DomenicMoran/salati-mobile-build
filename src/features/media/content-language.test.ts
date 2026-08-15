// Sprachhinweis auf Medien: erscheint genau dann, wenn die Oberflaeche eine
// andere Sprache spricht als der Inhalt. Getestet wird vor allem der Fall, der
// den Nutzer bisher ueberraschte (tuerkische App, deutsche Folge) — und die
// Rueckwaertskompatibilitaet zu Index-Staenden ohne `lang`.
import de from '@/locales/de.json';
import tr from '@/locales/tr.json';
import {
  contentLanguageLabel,
  contentLanguageNameKey,
  needsContentLanguageNotice,
  normalizeContentLanguage,
} from './content-language';

describe('needsContentLanguageNotice', () => {
  it('zeigt keinen Hinweis, wenn Oberflaeche und Inhalt dieselbe Sprache haben', () => {
    expect(needsContentLanguageNotice('de', 'de')).toBe(false);
  });

  it('zeigt den Hinweis bei abweichender Oberflaechensprache', () => {
    for (const locale of ['tr', 'ar', 'en', 'ru', 'ur']) {
      expect(needsContentLanguageNotice(locale, 'de')).toBe(true);
    }
  });

  it('behandelt ein fehlendes lang-Feld als Deutsch (alte Index-Staende)', () => {
    expect(needsContentLanguageNotice('de', undefined)).toBe(false);
    expect(needsContentLanguageNotice('tr', undefined)).toBe(true);
  });

  it('ignoriert Regionalzusatz und Gross-/Kleinschreibung', () => {
    expect(normalizeContentLanguage('de-DE')).toBe('de');
    expect(normalizeContentLanguage('DE')).toBe('de');
    expect(needsContentLanguageNotice('de', 'de-AT')).toBe(false);
  });
});

describe('contentLanguageLabel', () => {
  // Direkt gegen die Sprachdatei aufloesen statt ueber `translate()`: die
  // nicht-de/en-Locales werden zur Laufzeit per import() nachgeladen, im Test
  // liefe `translate('tr', …)` sonst still in den de/en-Fallback.
  const t = (dict: unknown) => (key: string) =>
    key.split('.').reduce<unknown>((cur, seg) => (cur as Record<string, unknown>)?.[seg], dict) as string;

  it('nennt einem tuerkischen Nutzer die Inhaltssprache in seiner Sprache', () => {
    const label = contentLanguageLabel(t(tr), 'tr', 'de');
    expect(label).toBe(tr.media.contentLanguage.replace('{lang}', tr.media.languages.de));
    expect(label).not.toContain('{lang}');
  });

  it('bleibt fuer deutsche Oberflaeche unsichtbar', () => {
    expect(contentLanguageLabel(t(de), 'de', 'de')).toBeNull();
  });

  it('faellt bei unbenannter Sprache auf den Sprachcode zurueck statt leer zu bleiben', () => {
    expect(contentLanguageNameKey('ar')).toBeNull();
    expect(contentLanguageLabel(t(de), 'de', 'ar')).toBe(
      de.media.contentLanguage.replace('{lang}', 'AR'),
    );
  });
});
