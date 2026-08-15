import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale-detect';

import duas from './duas/data/duas.json';
import guides from './guides/guides.json';
import fatihaDeep from './learn/data/fatiha-deep.json';
import letterExamples from './learn/data/letter-examples.json';
import salahWords from './learn/data/salah-words.json';
import vocab from './learn/data/vocab.json';
import trivia from './practice/trivia.json';
import akhlaq from './study/data/akhlaq.json';
import amau from './study/data/amau.json';
import aqida from './study/data/aqida.json';
import dialects from './study/data/dialects.json';
import fiqhIbadat from './study/data/fiqh-ibadat.json';
import grammar from './study/data/grammar.json';
import madinah from './study/data/madinah.json';
import nawawi40 from './study/data/nawawi40.json';
import nikah from './study/data/nikah.json';
import prophets from './study/data/prophets.json';
import sahaba from './study/data/sahaba.json';
import seerah from './study/data/seerah.json';
import tajwid from './study/data/tajwid.json';
import wisdom from './wisdom/wisdom.json';

// Inhalts-Audit 2026-07-27: Die Inhaltslücken der App saßen NICHT in der UI
// (locales/*.json haben exakte Schlüsselparität), sondern in den gebündelten
// Datendateien — und zwar konzentriert in denselben 8 Phase-1-Sprachen
// (id/bn/fa/ms/ur/sw/ru/ps). Gemeldet waren u. a.: guides `steps[].text` 0 %,
// wisdom `text` 0 %, letter-examples `meaning` 0 %, 57 Trivia-Fragen und die
// 28 Dialekt-Lektionstitel fehlend. Alle Auflöser (resolveText,
// localizedText, triviaText, resolveWisdomText) fallen still auf en/de zurück,
// der Nutzer sieht also Englisch ohne Hinweis.
//
// Kein Test hätte das bemerkt: die vorhandenen Suiten prüften entweder nur
// de/en/tr/ar (wisdom), nur 6 Sprachen (practice/modes.test.ts) oder gar nichts
// (trivia, letter-examples, study/data). Zusätzlich hätte ein Test ÜBER den
// Auflöser nichts gefunden, weil der Fallback immer einen Wert liefert —
// deshalb prüft diese Suite die ROHDATEN, feldgenau und über alle 14 Sprachen.
//
// Bewusst NICHT hier: features/changelog/changelog.ts (dokumentierte
// Betreiber-Entscheidung im Kopfkommentar: nur de+en, Englisch-Fallback für
// die übrigen 12 Sprachen) sowie Podcast/Handouts (rein deutsche Medien,
// serverseitig aus podcast/scripts gepflegt).

/**
 * Ein "lokalisiertes Objekt" ist ein flaches Objekt, dessen Schlüssel
 * ausschließlich App-Sprachcodes sind. So werden Datenknoten unabhängig vom
 * Schema jeder einzelnen Datei gefunden — auch in künftig ergänzten Feldern.
 */
function isLocalizedObject(value: unknown): value is Partial<Record<Locale, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  if (!keys.every((k) => (SUPPORTED_LOCALES as string[]).includes(k))) return false;
  const record = value as Record<string, unknown>;
  return typeof record.de === 'string' || typeof record.en === 'string';
}

interface Found {
  path: string;
  text: Partial<Record<Locale, string>>;
}

function collect(node: unknown, path: string, out: Found[]): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => collect(child, `${path}[${i}]`, out));
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  if (isLocalizedObject(node)) {
    out.push({ path, text: node });
    return;
  }
  for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
    collect(child, path ? `${path}.${key}` : key, out);
  }
}

const DATASETS: [name: string, data: unknown][] = [
  ['duas/data/duas.json', duas],
  ['guides/guides.json', guides],
  ['learn/data/fatiha-deep.json', fatihaDeep],
  ['learn/data/letter-examples.json', letterExamples],
  ['learn/data/salah-words.json', salahWords],
  ['learn/data/vocab.json', vocab],
  ['practice/trivia.json', trivia],
  ['study/data/akhlaq.json', akhlaq],
  ['study/data/amau.json', amau],
  ['study/data/aqida.json', aqida],
  ['study/data/dialects.json', dialects],
  ['study/data/fiqh-ibadat.json', fiqhIbadat],
  ['study/data/grammar.json', grammar],
  ['study/data/madinah.json', madinah],
  ['study/data/nawawi40.json', nawawi40],
  ['study/data/nikah.json', nikah],
  ['study/data/prophets.json', prophets],
  ['study/data/sahaba.json', sahaba],
  ['study/data/seerah.json', seerah],
  ['study/data/tajwid.json', tajwid],
  ['wisdom/wisdom.json', wisdom],
];

describe.each(DATASETS)('Inhaltsdatei %s', (name, data) => {
  const found: Found[] = [];
  collect(data, '', found);

  it('enthält überhaupt lokalisierte Inhalte (Schutz vor leerem Zählergebnis)', () => {
    expect(found.length).toBeGreaterThan(0);
  });

  it('ist in allen 14 App-Sprachen befüllt (kein stiller Englisch-Fallback)', () => {
    const missing: string[] = [];
    for (const { path, text } of found) {
      for (const locale of SUPPORTED_LOCALES) {
        if (!text[locale]?.trim()) missing.push(`${name} ${path} → ${locale}`);
      }
    }
    // Erste 20 Treffer reichen zum Debuggen; die Länge belegt das Ausmaß.
    expect({ count: missing.length, sample: missing.slice(0, 20) }).toEqual({
      count: 0,
      sample: [],
    });
  });
});

describe('Inhalts-Abdeckung: die im Audit 2026-07-27 gemeldeten Lücken', () => {
  // Feldgenaue Gegenproben zu den fünf namentlich gemeldeten Lücken. Sie sind
  // absichtlich zusätzlich zur generischen Prüfung oben da: der generische
  // Walker würde ein KOMPLETT entferntes Feld nicht bemerken (kein Objekt =
  // keine fehlende Sprache), diese Zusicherungen schon.
  const PHASE_1: Locale[] = ['id', 'bn', 'fa', 'ms', 'ur', 'sw', 'ru', 'ps'];

  it('guides: jeder Schritt hat Titel UND Text in den 8 Phase-1-Sprachen', () => {
    expect(guides.guides.length).toBe(11);
    for (const guide of guides.guides) {
      expect(guide.steps.length).toBeGreaterThan(0);
      for (const step of guide.steps) {
        for (const locale of PHASE_1) {
          expect((step.title as Record<string, string>)[locale]?.trim()).toBeTruthy();
          expect((step.text as Record<string, string>)[locale]?.trim()).toBeTruthy();
        }
      }
    }
  });

  it('guides: jeder Guide führt eine Quellenangabe (Belegpflicht)', () => {
    for (const guide of guides.guides) {
      expect((guide as { source?: string }).source?.trim()).toBeTruthy();
    }
  });

  it('trivia: alle Übungsmodi sind übersetzt, auch sahaba/akhlaq/nikah/dialects', () => {
    const byCategory = new Map<string, number>();
    for (const q of trivia.questions) {
      byCategory.set(q.category, (byCategory.get(q.category) ?? 0) + 1);
      for (const locale of PHASE_1) {
        expect((q.q as Record<string, string>)[locale]?.trim()).toBeTruthy();
        for (const option of q.options) {
          expect((option as Record<string, string>)[locale]?.trim()).toBeTruthy();
        }
      }
    }
    // Die vier Kategorien, die laut Audit zu 100 % englisch waren.
    for (const category of ['sahaba', 'akhlaq', 'nikah', 'dialects']) {
      expect(byCategory.get(category) ?? 0).toBeGreaterThan(0);
    }
  });

  it('wisdom: jede Weisheit hat Text in allen 14 Sprachen und eine Quelle', () => {
    expect(wisdom.entries.length).toBeGreaterThanOrEqual(26);
    for (const entry of wisdom.entries) {
      expect(entry.source?.trim()).toBeTruthy();
      for (const locale of SUPPORTED_LOCALES) {
        expect((entry.text as Record<string, string>)[locale]?.trim()).toBeTruthy();
      }
    }
  });

  it('letter-examples: jedes Beispielwort der ersten Lektion ist übersetzt', () => {
    expect(letterExamples.length).toBeGreaterThan(0);
    for (const example of letterExamples) {
      for (const locale of SUPPORTED_LOCALES) {
        expect((example.meaning as Record<string, string>)[locale]?.trim()).toBeTruthy();
      }
    }
  });

  it('dialects: alle Lektionstitel sind übersetzt (nicht nur die Vokabeln)', () => {
    expect(dialects.lessons.length).toBe(28);
    for (const lesson of dialects.lessons) {
      for (const locale of SUPPORTED_LOCALES) {
        expect((lesson.title as Record<string, string>)[locale]?.trim()).toBeTruthy();
      }
    }
  });
});
