import korpus from '../../../public/rag/korpus-de.json';

import akhlaq from './data/akhlaq.json';
import aqida from './data/aqida.json';
import grammar from './data/grammar.json';
import nawawi40 from './data/nawawi40.json';
import nikah from './data/nikah.json';
import prophets from './data/prophets.json';
import sahaba from './data/sahaba.json';
import seerah from './data/seerah.json';
import tajwid from './data/tajwid.json';

/**
 * Belegprüfung der Studien-Kurse gegen den echten Koran-Korpus.
 *
 * Warum: Die Kurse werben mit "quellenbelegt" bzw. "mit Koran-Belegen". Eine
 * erfundene Vers-Nummer ist in religiösem Lernstoff der schwerste denkbare
 * Fehler — und der wahrscheinlichste, weil Belege beim Schreiben aus dem
 * Gedächtnis entstehen. `scripts/check-ki-wissen.mjs` prüft genau das für die
 * KI-Wissensschicht; dieser Test zieht dieselbe Prüfung in die Testsuite und
 * dehnt sie auf die Kursdaten aus:
 *   1. jede "Quran x:y"/"Koran x:y"-Angabe im `source`-Feld existiert wirklich
 *      (bei Bereichen "x:y–z" jeder einzelne Vers dazwischen),
 *   2. jedes `globalAyah` eines Story-Abschnitts liegt in 1–6236 und
 *      entspricht dem Vers, der zur Sure/Vers-Zählung gehört,
 *   3. der Propheten-Kurs führt in JEDER Lektion mindestens einen Koran-Beleg
 *      (das ist das Versprechen aus study.courses.prophets.desc).
 *
 * Datenquelle ist public/rag/korpus-de.json — dieselbe Datei, deren
 * Vollständigkeit quran/korpus-koran.test.ts absichert. Damit kann dieser Test
 * nicht dadurch grün werden, dass der Korpus schrumpft.
 */

// Verszahl je Sure in der Hafs-Zählung (Summe 6236) — identisch zur Tabelle in
// quran/korpus-koran.test.ts, dort gegen zwei unabhängige APIs verifiziert.
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

const presentVerses = new Set(
  (korpus.docs as { id: string }[]).filter((d) => d.id.startsWith('q:')).map((d) => d.id.slice(2)),
);

/** Globale Ayah-Nummer (1–6236) aus Sure/Vers — Umkehrung der Korpus-Reihenfolge. */
function globalAyahOf(surah: number, ayah: number): number {
  let sum = 0;
  for (let s = 1; s < surah; s++) sum += AYAHS_PER_SURAH[s - 1];
  return sum + ayah;
}

/** Sure/Vers aus einer globalen Ayah-Nummer. */
function surahAyahOf(globalAyah: number): string {
  let rest = globalAyah;
  for (let s = 1; s <= 114; s++) {
    const count = AYAHS_PER_SURAH[s - 1];
    if (rest <= count) return `${s}:${rest}`;
    rest -= count;
  }
  return `?:${globalAyah}`;
}

interface Localized {
  de?: string;
}
interface StorySection {
  arabic?: string;
  globalAyah?: number;
}
interface CourseLesson {
  id: string;
  title?: Localized;
  source?: string;
  story?: StorySection[];
}
interface CourseData {
  lessons: CourseLesson[];
}

const COURSES: [name: string, data: CourseData][] = [
  ['prophets', prophets as CourseData],
  ['seerah', seerah as CourseData],
  ['aqida', aqida as CourseData],
  ['sahaba', sahaba as CourseData],
  ['akhlaq', akhlaq as CourseData],
  ['nikah', nikah as CourseData],
  ['nawawi40', nawawi40 as CourseData],
  ['tajwid', tajwid as CourseData],
  ['grammar', grammar as CourseData],
];

/**
 * Erlaubte Beleg-Schreibweisen im `source`-Feld: "Quran 2:30", "Koran 2:30",
 * "Quran 2:30–38" (Halbgeviertstrich) und "Quran 2:30-38" (Bindestrich).
 * Bewusst tolerant gegenüber dem umgebenden Text ("Beispiele: Koran 1:2"),
 * aber strikt gegenüber der Zahl selbst.
 */
const VERSE_REF = /(?:Quran|Koran)\s*(\d+):(\d+)(?:\s*[–-]\s*(\d+))?/g;

function verseRefsIn(source: string): { ref: string; surah: number; ayah: number }[] {
  const out: { ref: string; surah: number; ayah: number }[] = [];
  for (const match of source.matchAll(VERSE_REF)) {
    const surah = Number(match[1]);
    const from = Number(match[2]);
    const to = match[3] ? Number(match[3]) : from;
    for (let ayah = from; ayah <= to; ayah++) out.push({ ref: match[0], surah, ayah });
  }
  return out;
}

describe('Koran-Belege der Studien-Kurse existieren wirklich', () => {
  it('Selbstkontrolle: die Referenztabelle summiert sich auf 6236 Verse', () => {
    expect(AYAHS_PER_SURAH).toHaveLength(114);
    expect(AYAHS_PER_SURAH.reduce((a, b) => a + b, 0)).toBe(6236);
    expect(presentVerses.size).toBe(6236);
    // Gegenprobe der Umrechnung an bekannten Ankern (Fatiha-Ende, Ayat al-Kursi).
    expect(globalAyahOf(1, 7)).toBe(7);
    expect(globalAyahOf(2, 255)).toBe(262);
    expect(surahAyahOf(262)).toBe('2:255');
  });

  it.each(COURSES)('%s: jede zitierte Vers-Nummer steht im Korpus', (name, data) => {
    const missing: string[] = [];
    for (const lesson of data.lessons) {
      if (!lesson.source) continue;
      for (const { ref, surah, ayah } of verseRefsIn(lesson.source)) {
        if (!presentVerses.has(`${surah}:${ayah}`)) {
          missing.push(`${name} ${lesson.id}: "${ref}" -> ${surah}:${ayah} existiert nicht`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('prüft dabei wirklich Belege (Schutz vor stillschweigend leerem Ergebnis)', () => {
    // nawawi40 zitiert bewusst Hadith-Nummern statt Verse und trägt hier
    // nichts bei — die Gesamtzahl darf trotzdem nie auf null fallen, sonst
    // liefe die Regex ins Leere und alle Prüfungen oben wären wertlos.
    const total = COURSES.reduce(
      (sum, [, data]) =>
        sum + data.lessons.reduce((n, lesson) => n + verseRefsIn(lesson.source ?? '').length, 0),
      0,
    );
    expect(total).toBeGreaterThan(100);
  });

  it.each(COURSES)('%s: jedes globalAyah zeigt auf einen echten Vers', (name, data) => {
    const broken: string[] = [];
    for (const lesson of data.lessons) {
      for (const section of lesson.story ?? []) {
        const globalAyah = section.globalAyah;
        if (globalAyah === undefined) continue;
        if (!Number.isInteger(globalAyah) || globalAyah < 1 || globalAyah > 6236) {
          broken.push(`${name} ${lesson.id}: globalAyah ${globalAyah} liegt außerhalb 1–6236`);
          continue;
        }
        if (!presentVerses.has(surahAyahOf(globalAyah))) {
          broken.push(`${name} ${lesson.id}: globalAyah ${globalAyah} hat keinen Vers im Korpus`);
        }
        // Ein globalAyah ohne arabischen Text wäre ein stummer Audio-Knopf.
        if (!section.arabic?.trim()) {
          broken.push(`${name} ${lesson.id}: globalAyah ${globalAyah} ohne arabischen Text`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('Propheten-Kurs löst sein Versprechen "von Adam bis Isa - mit Koran-Belegen" ein', () => {
  const lessons = (prophets as CourseData).lessons;

  it('führt jede Lektion mit mindestens einem Koran-Beleg', () => {
    const withoutProof = lessons
      .filter((lesson) => verseRefsIn(lesson.source ?? '').length === 0)
      .map((lesson) => lesson.id);
    expect(withoutProof).toEqual([]);
  });

  it('deckt die Kette von Adam bis Isa lückenlos ab', () => {
    // Reihenfolge = Lehrplan des Kurses. Geprüft wird der deutsche Titel, weil
    // er den Propheten benennt; die Übersetzungen deckt content-i18n.test.ts ab.
    const expected = [
      'Adam',
      'Idris',
      'Nuh',
      'Hud',
      'Salih',
      'Ibrahim I',
      'Ibrahim II',
      'Lut',
      'Ismail',
      'Ishaq und Yaqub',
      'Yusuf I',
      'Yusuf II',
      'Ayyub',
      'Shuayb',
      'Musa I',
      'Musa II',
      'Harun',
      'Dawud',
      'Sulaiman',
      "Ilyas, Al-Yasa' und Dhul-Kifl",
      'Yunus',
      'Zakariya',
      'Yahya',
      'Isa I',
      'Isa II',
    ];
    const titles = lessons.map((lesson) => lesson.title?.de ?? lesson.id);
    expect(titles).toHaveLength(expected.length);
    expected.forEach((name, index) => {
      expect(titles[index].startsWith(name)).toBe(true);
    });
  });

  it('nennt alle 24 im Koran namentlich genannten Propheten vor Muhammad ﷺ', () => {
    // Der 25. (Muhammad ﷺ) hat einen eigenen Kurs (seerah) — deshalb endet
    // dieser Kurs bei Isa, genau wie die Kursbeschreibung es ankündigt.
    const joined = lessons.map((lesson) => lesson.title?.de ?? '').join(' | ');
    const names = [
      'Adam', 'Idris', 'Nuh', 'Hud', 'Salih', 'Ibrahim', 'Lut', 'Ismail', 'Ishaq',
      'Yaqub', 'Yusuf', 'Ayyub', 'Shuayb', 'Musa', 'Harun', 'Dawud', 'Sulaiman',
      'Ilyas', "Al-Yasa'", 'Dhul-Kifl', 'Yunus', 'Zakariya', 'Yahya', 'Isa',
    ];
    expect(names).toHaveLength(24);
    expect(names.filter((name) => !joined.includes(name))).toEqual([]);
  });

  it('hält je Lektion das Format der Bestandslektionen ein (3–4 Abschnitte, 4 Quizfragen)', () => {
    for (const lesson of lessons) {
      const sections = lesson.story ?? [];
      expect(sections.length).toBeGreaterThanOrEqual(3);
      expect(sections.length).toBeLessThanOrEqual(4);
      const quiz = (lesson as unknown as { storyQuiz?: { options: unknown[] }[] }).storyQuiz ?? [];
      expect(quiz).toHaveLength(4);
      for (const question of quiz) expect(question.options).toHaveLength(4);
    }
  });
});
