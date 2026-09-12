import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { AYAHS_PER_SURAH } from './ayahsPerSurah';
import { ensureSurahNamesLoaded, surahNameTranslation, SW_SURAH_CLASSIFICATION } from './surahNames';

// Geräteprüfung auf Arabisch (Audit 2026-09-06): die Surennamen erschienen
// englisch ("Al-Faatiha", "The Opening"), weil surahNameTranslation() nur
// Deutsch abdeckte. Dieser Test erzwingt jetzt ALLE 14 UI-Sprachen: jede Sure
// braucht in jeder Sprache einen nichtleeren, sprachspezifischen Namen, und
// keine Sprache darf still auf die englische API-Bedeutung zurückfallen.
//
// AYAHS_PER_SURAH.length (114) ist die im Repo bereits verifizierte kanonische
// Surenzahl (s. korpus-koran.test.ts) — hier als Schleifengrenze verwendet
// statt die Zahl 114 ein zweites Mal unabhängig zu behaupten.
const SURAH_COUNT = AYAHS_PER_SURAH.length;

const EN = 'The Cow';

// Sprachen, die den arabischen Originalnamen zeigen statt einer Übersetzung
// (Arabisch selbst, sowie Urdu/Persisch/Paschtu — s. Kommentar in surahNames.ts).
const ARABIC_SCRIPT_LOCALES = ['ar', 'fa', 'ur', 'ps'];

// Sprachen, deren Namenstabelle per dynamic import() nachgeladen wird.
const LAZY_LOCALES = ['tr', 'id', 'ms', 'ru', 'fr', 'es', 'bn', 'sw'];

describe('surahNameTranslation — Deutsch', () => {
  it('übersetzt bekannte Suren', () => {
    expect(surahNameTranslation(1, 'de', 'The Opening')).toBe('Die Eröffnung');
    expect(surahNameTranslation(2, 'de', EN)).toBe('Die Kuh');
    expect(surahNameTranslation(112, 'de', 'Sincerity')).toBe('Die Aufrichtigkeit');
    expect(surahNameTranslation(114, 'de', 'Mankind')).toBe('Die Menschen');
  });

  it('hat für ALLE 114 Suren einen nichtleeren deutschen Namen', () => {
    for (let n = 1; n <= SURAH_COUNT; n++) {
      const name = surahNameTranslation(n, 'de', EN);
      expect({ n, name }).not.toEqual({ n, name: EN });
      expect(name.trim()).not.toBe('');
    }
  });

  it('vergibt keinen Namen doppelt außer bei echten Namensgleichheiten', () => {
    // Doppelte Bedeutungen wären ein Copy-Paste-Fehler in der Tabelle.
    const names = Array.from({ length: SURAH_COUNT }, (_, i) => surahNameTranslation(i + 1, 'de', EN));
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    expect(duplicates).toEqual([]);
  });

  it('fällt außerhalb 1..114 auf den englischen Namen zurück', () => {
    expect(surahNameTranslation(0, 'de', EN)).toBe(EN);
    expect(surahNameTranslation(115, 'de', EN)).toBe(EN);
    expect(surahNameTranslation(-1, 'de', EN)).toBe(EN);
  });
});

describe('surahNameTranslation — Englisch', () => {
  it('gibt für "en" direkt den übergebenen API-Namen zurück', () => {
    for (let n = 1; n <= SURAH_COUNT; n++) {
      expect(surahNameTranslation(n, 'en', `Fallback ${n}`)).toBe(`Fallback ${n}`);
    }
  });
});

describe('surahNameTranslation — arabische Schrift (ar/fa/ur/ps)', () => {
  it.each(ARABIC_SCRIPT_LOCALES)('%s zeigt den arabischen Originalnamen, nie Englisch', (locale) => {
    for (let n = 1; n <= SURAH_COUNT; n++) {
      const name = surahNameTranslation(n, locale, EN);
      expect(name.trim()).not.toBe('');
      expect(name).not.toBe(EN);
      // Arabische Schrift: kein lateinisches Zeichen im Namen.
      expect(name).not.toMatch(/[a-zA-Z]/);
    }
  });

  it('liefert für alle vier Sprachen denselben arabischen Namen (Wortlaut ist sprachneutral)', () => {
    for (let n = 1; n <= SURAH_COUNT; n++) {
      const [first, ...rest] = ARABIC_SCRIPT_LOCALES.map((locale) => surahNameTranslation(n, locale, EN));
      for (const name of rest) expect(name).toBe(first);
    }
  });
});

describe('surahNameTranslation — nachgeladene Sprachen (tr/id/ms/ru/fr/es/bn/sw)', () => {
  it.each(LAZY_LOCALES)('%s fällt vor dem Laden auf Englisch zurück, danach nicht mehr', async (locale) => {
    // Frisches Modul pro Test wäre teuer (14 Sprachen) — stattdessen eine noch
    // nicht angefragte Surennummer je Sprache nutzen, um den Vor-Ladezustand
    // ehrlich zu beobachten, statt Zustand aus einem vorigen Test zu erben.
    expect(surahNameTranslation(1, locale, EN)).toBe(EN);
    await ensureSurahNamesLoaded(locale);
    for (let n = 1; n <= SURAH_COUNT; n++) {
      const name = surahNameTranslation(n, locale, EN);
      expect({ locale, n, name }).not.toEqual({ locale, n, name: EN });
      expect(name.trim()).not.toBe('');
    }
  });
});

describe('surahNameTranslation — alle 14 Sprachen zusammen', () => {
  it('hat für jede der 114 Suren in jeder der 14 Sprachen einen nichtleeren, nicht-englischen Namen', async () => {
    const allLocales = ['de', ...ARABIC_SCRIPT_LOCALES, ...LAZY_LOCALES];
    expect(allLocales).toHaveLength(13); // + 'en' selbst = 14 UI-Sprachen insgesamt.
    await Promise.all(LAZY_LOCALES.map((locale) => ensureSurahNamesLoaded(locale)));

    const gaps: string[] = [];
    for (const locale of allLocales) {
      for (let n = 1; n <= SURAH_COUNT; n++) {
        const name = surahNameTranslation(n, locale, EN);
        if (!name.trim() || name === EN) gaps.push(`${locale}:${n}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('kennt keine andere UI-Sprache als diese 14 (Selbstkontrolle der Testliste)', () => {
    // Diese Liste muss exakt src/locales/*.json entsprechen — sonst prüft der
    // Test oben nicht wirklich "alle" Sprachen.
    const localeFiles = readdirSync(join(__dirname, '../../locales'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
    expect(localeFiles).toEqual(['ar', 'bn', 'de', 'en', 'es', 'fa', 'fr', 'id', 'ms', 'ps', 'ru', 'sw', 'tr', 'ur'].sort());
  });
});

describe('surahNameTranslation — Suaheli-Bedeutungen (sw.json)', () => {
  // Audit 2026-09-06 A: sw.json enthielt für alle 114 Suren nur die
  // Umschrift (z. B. "Al-Baqarah"), keine Bedeutung — ein früherer Lauf fand
  // keine verlässliche vollständige Quelle und hat bewusst nicht geraten
  // (richtig so: eine falsche Bedeutung bei einem Korannamen wiegt schwerer
  // als eine fehlende). Recherche fand nur für 8 der 114 Suren eine
  // zitierbare Kiswahili-Bedeutung (bongoclass.com), jeweils als
  // "Umschrift — Bedeutung" eingetragen, HERKUNFT: zitiert.
  const SW_MEANINGS: Record<number, string> = {
    1: 'Ufunguzi',
    102: 'Tamaa ya Wingi wa Mali na Watoto',
    104: 'Msingiziaji',
    106: 'Kabila la Kuraishi',
    111: 'Kamba',
    112: 'Uaminifu wa Imani',
    113: 'Mapambazuko',
    114: 'Watu',
  };

  it('belegt weiterhin die 8 zitierten Bedeutungen als "Umschrift — Bedeutung"', async () => {
    await ensureSurahNamesLoaded('sw');
    for (const [n, meaning] of Object.entries(SW_MEANINGS)) {
      const name = surahNameTranslation(Number(n), 'sw', EN);
      expect(name).toContain(' — ');
      expect(name).toContain(meaning);
    }
  });

  // Audit 2026-09-06 B: die übrigen 106 Suren wurden einzeln in drei Gruppen
  // eingeteilt (s. SW_SURAH_CLASSIFICATION in surahNames.ts): 'a' klar
  // lexikalisch (gewöhnliches arabisches Wort, jetzt übersetzt), 'b'
  // theologisch aufgeladen/mehrdeutig, 'c' Buchstabensuren/Eigennamen (b und
  // c bleiben Umschrift). Die folgenden Tests prüfen die REGEL aus dieser
  // Einteilung, nicht mehr nur eine feste Zahl: jede 'a'-Sure braucht eine
  // Bedeutung, keine 'b'/'c'-Sure darf eine erfundene bekommen. Eine spätere
  // Korrektur der Einteilung (z. B. ein Fund für eine 'b'/'c'-Sure, oder eine
  // widerlegte 'a'-Übersetzung) muss SW_SURAH_CLASSIFICATION UND sw.json
  // gemeinsam ändern — sonst schlägt einer dieser Tests fehl.
  it('hat für jede Sure der Gruppe a (klar lexikalisch) eine übersetzte Bedeutung', async () => {
    await ensureSurahNamesLoaded('sw');
    const missing: number[] = [];
    for (const [nStr, group] of Object.entries(SW_SURAH_CLASSIFICATION)) {
      if (group !== 'a') continue;
      const n = Number(nStr);
      const name = surahNameTranslation(n, 'sw', EN);
      if (!name.includes(' — ')) missing.push(n);
    }
    expect(missing).toEqual([]);
  });

  it('erfindet für keine Sure der Gruppen b/c (theologisch/mehrdeutig, Buchstaben/Eigennamen) eine Bedeutung', async () => {
    await ensureSurahNamesLoaded('sw');
    const invented: number[] = [];
    for (const [nStr, group] of Object.entries(SW_SURAH_CLASSIFICATION)) {
      if (group === 'a') continue;
      const n = Number(nStr);
      const name = surahNameTranslation(n, 'sw', EN);
      if (name.includes(' — ')) invented.push(n);
    }
    expect(invented).toEqual([]);
  });

  it('kennt für keine Sure außerhalb der 8 zitierten + Gruppe a eine Bedeutung', async () => {
    await ensureSurahNamesLoaded('sw');
    const groupACount = Object.values(SW_SURAH_CLASSIFICATION).filter((g) => g === 'a').length;
    let withMeaning = 0;
    for (let n = 1; n <= SURAH_COUNT; n++) {
      const name = surahNameTranslation(n, 'sw', EN);
      if (name.includes(' — ')) withMeaning++;
    }
    expect(withMeaning).toBe(Object.keys(SW_MEANINGS).length + groupACount);
  });

  it('deckt mit den 8 zitierten Suren plus SW_SURAH_CLASSIFICATION alle 114 Suren ab', () => {
    const covered = new Set([...Object.keys(SW_MEANINGS).map(Number), ...Object.keys(SW_SURAH_CLASSIFICATION).map(Number)]);
    expect(covered.size).toBe(SURAH_COUNT);
    for (let n = 1; n <= SURAH_COUNT; n++) expect(covered.has(n)).toBe(true);
  });
});

describe('surahNameTranslation — unbekannte Sprache/Surennummer', () => {
  it('fällt für eine nicht unterstützte Sprache auf Englisch zurück', () => {
    expect(surahNameTranslation(2, 'xx', EN)).toBe(EN);
  });

  it('fällt außerhalb 1..114 auch in den anderen Sprachen auf Englisch zurück', async () => {
    await ensureSurahNamesLoaded('tr');
    expect(surahNameTranslation(0, 'tr', EN)).toBe(EN);
    expect(surahNameTranslation(115, 'tr', EN)).toBe(EN);
    expect(surahNameTranslation(0, 'ar', EN)).toBe(EN);
    expect(surahNameTranslation(115, 'ar', EN)).toBe(EN);
  });

  it('behandelt Regional-Codes wie de-DE NICHT als Deutsch (exakter Vergleich)', () => {
    // Dokumentiert das aktuelle Verhalten: settings.language liefert immer
    // einen reinen Sprachcode (s. lib/locale-detect.ts), Regionen kommen nicht vor.
    expect(surahNameTranslation(2, 'de-DE', EN)).toBe(EN);
  });
});
