import korpus from '../../../public/rag/korpus-de.json';
import { AYAHS_PER_SURAH, TOTAL_AYAHS } from './ayahsPerSurah';

/**
 * Vollständigkeit des Korans im gebündelten KI-Korpus (Audit 2026-07-27).
 *
 * Warum als Test und nicht als Skript-Prüfung: `scripts/build-ki-korpus.mjs`
 * liest den Bestand der Koran-Dokumente aus GENAU DIESER Datei und schreibt sie
 * anschließend zurück. Ein Verlust ist damit dauerhaft — er heilt bei keinem
 * späteren Build von selbst aus, und alle 13 übersetzten Korpora übernehmen die
 * Lücke ungeprüft, weil sie dieselben Doc-IDs spiegeln.
 *
 * Genau das ist schon einmal passiert: eine pauschale Mindestlänge von 25
 * Zeichen warf die kurzen Verse („Alif-Lam-Mim", 112:2) aus dem Korpus. Dieser
 * Test prüft deshalb nicht die Summe, sondern jeden einzelnen Vers-Schlüssel.
 *
 * AYAHS_PER_SURAH/TOTAL_AYAHS liegen seit Audit 2026-09-06 in `ayahsPerSurah.ts`
 * (auch von `surahNames.test.ts` verwendet, s. dort).
 */

const quranDocs = (korpus.docs as { id: string; src: string; t: string }[]).filter((d) =>
  d.id.startsWith('q:'),
);

describe('Koran im KI-Korpus (public/rag/korpus-de.json)', () => {
  it('kennt die kanonische Verszahl (Selbstkontrolle der Referenztabelle)', () => {
    expect(AYAHS_PER_SURAH).toHaveLength(114);
    expect(AYAHS_PER_SURAH.reduce((a, b) => a + b, 0)).toBe(TOTAL_AYAHS);
  });

  it('enthält alle 6236 Verse, keinen doppelt', () => {
    expect(quranDocs).toHaveLength(TOTAL_AYAHS);
    expect(new Set(quranDocs.map((d) => d.id)).size).toBe(TOTAL_AYAHS);
  });

  it('hat für jede Sure lückenlos Vers 1 bis zur letzten Verszahl', () => {
    const present = new Set(quranDocs.map((d) => d.id));
    const missing: string[] = [];
    AYAHS_PER_SURAH.forEach((count, index) => {
      const surah = index + 1;
      for (let ayah = 1; ayah <= count; ayah++) {
        if (!present.has(`q:${surah}:${ayah}`)) missing.push(`${surah}:${ayah}`);
      }
    });
    expect(missing).toEqual([]);
  });

  it('führt keine Verse jenseits der kanonischen Zählung', () => {
    const extra = quranDocs
      .map((d) => d.id.split(':').map(Number))
      .filter(([, surah, ayah]) => {
        const count = AYAHS_PER_SURAH[surah - 1];
        return !count || ayah < 1 || ayah > count;
      });
    expect(extra).toEqual([]);
  });

  it('hat zu jedem Vers einen nicht-leeren Text — auch zu den ganz kurzen', () => {
    // Der Regressionsfall: kurze Verse sind vollwertige Belege und dürfen
    // keiner Mindestlänge zum Opfer fallen.
    expect(quranDocs.filter((d) => !d.t.trim())).toEqual([]);
    const short = quranDocs.filter((d) => d.t.trim().length < 25);
    expect(short.length).toBeGreaterThan(50);
    expect(quranDocs.find((d) => d.id === 'q:2:1')?.t.trim()).toBeTruthy();
    expect(quranDocs.find((d) => d.id === 'q:112:2')?.t.trim()).toBeTruthy();
  });

  it('beschriftet jeden Vers mit seiner eigenen Fundstelle (kein Versatz)', () => {
    // Ein um eine Position verrutschter Korpus würde die KI Verse unter
    // falscher Stellenangabe zitieren lassen — der schwerste denkbare Fehler.
    const mismatched = quranDocs.filter((d) => {
      const [, surah, ayah] = d.id.split(':');
      return !new RegExp(`^Koran ${surah}:${ayah}(\\s|$)`).test(d.src);
    });
    expect(mismatched).toEqual([]);
  });
});
