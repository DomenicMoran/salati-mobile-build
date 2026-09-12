/**
 * Belegter Fehler (Geraet, ar): die native Registerleiste (expo-router/
 * unstable-native-tabs, gebaut in components/app-tabs.tsx) zeigte "Prayer"
 * auf Englisch, obwohl Inhalt und Layout bereits korrekt Arabisch waren.
 * `<AppTabs>` selbst laesst sich unter Jest nicht rendern (expo-quick-actions
 * laedt intern eine zweite React-Kopie, "Invalid hook call" unabhaengig von
 * dieser Aenderung) — deshalb zwei separate, aber zusammen ausreichende
 * Nachweise:
 *
 * 1. Die Beschriftungen selbst (`t('nav.*')`, dieselbe Funktion, die
 *    <NativeTabs.Trigger.Label> fuellt) folgen der eingestellten Sprache auch
 *    fuer eine nachgeladene Sprache (ar), nicht nur fuer Deutsch/Englisch.
 * 2. Der Registerleisten-Schluessel aus app-tabs.tsx (`nativeTabsKey`)
 *    erzwingt genau beim Uebergang "Sprache noch nicht geladen" ->
 *    "geladen" sowie bei jedem Sprachwechsel einen Neubau — und sonst nie.
 */
import { nativeTabsKey } from '@/components/app-tabs';
import { isLocaleLoaded, preloadLocale, translate } from '@/lib/translate';

describe('Registerleisten-Beschriftung folgt der Sprache (auch nachgeladen)', () => {
  it('nav.* faellt vor dem Nachladen auf Englisch zurueck und wechselt danach auf Arabisch', async () => {
    // Eigene, in dieser Datei noch nicht angefasste Sprache (Modul-Zustand von
    // translate.ts ist pro Testdatei frisch, s. lib/i18n.test.ts) — reproduziert
    // exakt den Geraetebefund: erste Abfrage vor preloadLocale().
    expect(isLocaleLoaded('fa')).toBe(false);
    expect(translate('fa', 'nav.prayerTimes')).toBe('Prayer');

    await preloadLocale('fa');

    expect(isLocaleLoaded('fa')).toBe(true);
    expect(translate('fa', 'nav.prayerTimes')).not.toBe('Prayer');
    expect(translate('fa', 'nav.prayerTimes')).toBe('نماز');
  });

  it('funktioniert nicht nur fuer Deutsch, sondern fuer jede nachgeladene Sprache (hier ar)', async () => {
    await preloadLocale('ar');
    expect(translate('ar', 'nav.prayerTimes')).toBe('الصلاة');
    expect(translate('ar', 'nav.qibla')).toBe('القبلة');
    expect(translate('ar', 'nav.quran')).toBe('القرآن');
    expect(translate('ar', 'nav.lernen')).toBe('تعلّم');
    expect(translate('ar', 'nav.more')).toBe('المزيد');
  });
});

describe('nativeTabsKey (components/app-tabs.tsx)', () => {
  it('bleibt fuer die immer geladenen Standardsprachen konstant', () => {
    expect(nativeTabsKey('de', true)).toBe('de');
    expect(nativeTabsKey('en', true)).toBe('en');
  });

  it('unterscheidet sich, solange eine nachgeladene Sprache noch nicht da ist', () => {
    const nochNicht = nativeTabsKey('ar', false);
    const geladen = nativeTabsKey('ar', true);
    expect(nochNicht).not.toBe(geladen);
    // Der geladene Schluessel ist bewusst genau die Locale selbst (React
    // erkennt so `de` -> `ar` als Wechsel, ohne dass der "geladen"-Zustand
    // fuer bereits vollstaendig geladene Sprachen je einen zusaetzlichen
    // Neubau erzwingt).
    expect(geladen).toBe('ar');
  });

  it('erzwingt einen Neubau bei jedem Sprachwechsel, auch zwischen zwei bereits geladenen Sprachen', () => {
    expect(nativeTabsKey('de', true)).not.toBe(nativeTabsKey('ar', true));
  });
});
