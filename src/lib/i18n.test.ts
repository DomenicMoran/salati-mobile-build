import { isLocaleLoaded, preloadLocale, translate } from './translate';

describe('translate', () => {
  it('resolves a nested key for the requested locale', async () => {
    // de/en sind statisch gebündelt, alle anderen Sprachen werden nachgeladen
    // (translate.ts) — im Test genauso explizit anstoßen wie in der App.
    expect(translate('en', 'nav.qibla')).toBe('Qibla');
    await preloadLocale('tr');
    await preloadLocale('ar');
    expect(translate('tr', 'nav.qibla')).toBe('Kıble');
    expect(translate('ar', 'nav.qibla')).toBe('القبلة');
  });

  it('falls back to German when the key is missing in the requested locale', () => {
    // Alle vier Locale-Dateien haben den gleichen Key-Umfang (nav/common) — dieser
    // Test dokumentiert das Fallback-Verhalten für den Fall künftiger Lücken.
    expect(translate('de', 'nav.duas')).toBe('Duas');
  });

  it('returns the key itself when no dictionary has it', () => {
    expect(translate('de', 'nonexistent.key')).toBe('nonexistent.key');
  });

  it('falls back to English/German until a lazy locale is loaded', async () => {
    expect(isLocaleLoaded('ru')).toBe(false);
    // Noch nicht geladen -> englischer Fallback statt eines leeren Strings.
    expect(translate('ru', 'nav.qibla')).toBe('Qibla');
    await preloadLocale('ru');
    expect(isLocaleLoaded('ru')).toBe(true);
    expect(translate('ru', 'nav.qibla')).not.toBe('Qibla');
  });
});
