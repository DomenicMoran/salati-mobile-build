import { SUPPORTED_LOCALES } from '@/lib/locale-detect';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import { antwortSprache, brauchtQuellenHinweis, KI_SPRACHEN, sprachHinweise } from './sprachen';

describe('antwortSprache', () => {
  it('antwortet in der Sprache des geladenen Korpus — im Zitat-Modus gibt es keine andere', () => {
    expect(antwortSprache('de')).toBe('de');
    expect(antwortSprache('tr')).toBe('tr');
    expect(antwortSprache('bn')).toBe('bn');
  });

  it('fällt bei unbekanntem Korpus auf Deutsch zurück', () => {
    expect(antwortSprache('xx')).toBe('de');
    expect(antwortSprache()).toBe('de');
  });

  it('kennt für jede der 14 App-Sprachen einen Namen und ein Endonym', () => {
    for (const code of ['de', 'en', 'tr', 'ar', 'fr', 'es', 'ru', 'id', 'ms', 'bn', 'ur', 'fa', 'ps', 'sw']) {
      expect(KI_SPRACHEN[code]?.name).toBeTruthy();
      expect(KI_SPRACHEN[code]?.endonym).toBeTruthy();
    }
  });

  it('verlangt den Quellen-Hinweis nur, solange die Quellen nicht in der App-Sprache sind', () => {
    expect(brauchtQuellenHinweis('de')).toBe(false);
    expect(brauchtQuellenHinweis('tr')).toBe(true);
    expect(brauchtQuellenHinweis('tr', 'tr')).toBe(false);
  });
});

/**
 * Seit dem Zitat-Modus (features/ki/zitat.ts) gibt es im KI-Screen nur noch
 * Hinweise zur QUELLENLAGE. Die frühere Qualitätswarnung und der Beta-Schalter
 * „Antwort in meiner Sprache" sind entfallen: es wird nicht mehr formuliert und
 * nicht mehr übersetzt, sondern wörtlich zitiert — nachgemessen mit demselben
 * Fragensatz wie zuvor, 0 erfundene Aussagen in allen 14 Sprachen
 * (docs/audit-2026-07-27/KI-ZITATMODUS.md).
 */
describe('sprachHinweise', () => {
  it('nennt in jeder Fremdsprache die deutsche Quellenlage, solange der Korpus deutsch ist', () => {
    for (const locale of SUPPORTED_LOCALES.filter((code) => code !== 'de')) {
      expect(sprachHinweise(locale, 'de').quellenDeutsch).toBe(true);
    }
  });

  it('zeigt bei übersetztem Korpus nur noch den Rest-Hinweis zur Wissensschicht', () => {
    expect(sprachHinweise('bn', 'bn', 12)).toEqual({ quellenDeutsch: false, teilweiseDeutsch: true, sichtbar: true });
    expect(sprachHinweise('bn', 'bn', 0)).toEqual({ quellenDeutsch: false, teilweiseDeutsch: false, sichtbar: false });
  });

  it('zeigt für Deutsch keinen Kasten — dort ist die Quellenlage der Normalfall', () => {
    expect(sprachHinweise('de', 'de', 12).sichtbar).toBe(false);
  });

  it('hat keine Qualitätswarnung mehr', () => {
    expect(sprachHinweise('bn', 'bn', 12)).not.toHaveProperty('qualitaetsWarnung');
  });
});

describe('Dauerhinweis im KI-Screen', () => {
  // Die KI-Kennzeichnung (EU AI Act Art. 50) MUSS erhalten bleiben — je Sprache
  // der Begriff, der sie trägt.
  const KI_KENNZEICHNUNG: Record<string, string> = {
    de: 'KI-gestützte',
    en: 'AI-assisted',
    tr: 'Yapay zeka',
    ar: 'الذكاء الاصطناعي',
    es: 'IA',
    fr: 'IA',
    id: 'AI',
    bn: 'এআই',
    fa: 'هوش مصنوعی',
    ms: 'AI',
    ur: 'AI',
    ru: 'ИИ',
    sw: 'AI',
    ps: 'مصنوعي ځیرکتیا',
  };
  // Satzende in lateinischer Schrift, Urdu (Danda) und Bengalisch (Danda).
  const SATZENDE = /[.۔।]/g;

  it('nennt in allen 14 Sprachen die KI-Kennzeichnung UND das verbliebene Risiko', () => {
    for (const locale of SUPPORTED_LOCALES) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamischer Pfad, kein statischer Import möglich
      const dict = require(`@/locales/${locale}.json`);
      const text: string = dict.ki.aiDisclosure;
      expect(text).toContain(KI_KENNZEICHNUNG[locale]);
      // Zwei Sätze: Kennzeichnung + verbliebenes Risiko.
      expect((text.match(SATZENDE) ?? []).length).toBeGreaterThanOrEqual(2);
      expect(text.length).toBeGreaterThan(80);
    }
  });

  it('benennt das RICHTIGE Risiko: unpassende oder unvollständige Stelle statt erfundener Zahlen', () => {
    // Die alte Warnung („Zahlen, Schritte und Verneinungen können falsch sein")
    // beschrieb Modell-Halluzinationen. Im Zitat-Modus kann das nicht mehr
    // passieren — sie stehenzulassen wäre eine falsche Aussage über das Produkt.
    expect(de.ki.aiDisclosure).toContain('wörtlichen Auszügen');
    expect(de.ki.aiDisclosure).toContain('verlinkte Quelle');
    expect(de.ki.aiDisclosure).not.toMatch(/Zahlen, Schritte und Verneinungen/);
    expect(en.ki.aiDisclosure).toContain('verbatim excerpts');
    expect(en.ki.aiDisclosure).toContain('linked source');
    expect(en.ki.aiDisclosure).not.toMatch(/Numbers, steps and negations/);
  });

  it('hat den Beta-Schalter und seine Warnung in allen 14 Sprachen entfernt', () => {
    for (const locale of SUPPORTED_LOCALES) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamischer Pfad, kein statischer Import möglich
      const dict = require(`@/locales/${locale}.json`);
      expect(dict.ki.answerInMyLanguage).toBeUndefined();
      expect(dict.ki.answerInMyLanguageWarning).toBeUndefined();
    }
  });
});
