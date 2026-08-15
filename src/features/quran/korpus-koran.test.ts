import korpus from '../../../public/rag/korpus-de.json';

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
 */

// Verszahl je Sure in der Hafs-Zählung (Summe 6236), am 2026-07-27 gegen
// api.alquran.cloud/v1/surah UND api.quran.com/api/v4/chapters geprüft —
// beide Quellen stimmen in allen 114 Werten überein.
const AYAHS_PER_SURAH = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6,
];

const TOTAL_AYAHS = 6236;

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
