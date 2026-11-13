// Belegprüfung für die 2026-07-28 ergänzten Studien-Lektionen (Vorbild:
// scripts/check-ki-wissen.mjs, das dieselbe Prüfung für die KI-Wissensschicht
// macht).
//
// Warum: Der häufigste Fehler in KI-erzeugten religiösen Texten ist eine
// erfundene Belegstelle — eine Sure/Vers-Kombination, die es nicht gibt, oder
// eine Hadith-Nummer, die frei erfunden ist. Ein Mensch merkt das beim Lesen
// nicht. Deshalb wird hier jede Quellenangabe der neuen Lektionen maschinell
// gegen den im Repo vorhandenen, bereits geprüften Bestand gehalten:
//   1. „Quran S:A" muss als Vers in public/rag/korpus-de.json existieren.
//   2. „an-Nawawi Nr. N" muss als Hadith-Dokument im selben Korpus existieren.
//   3. Jede andere Angabe (Hadith-Sammlung + Nummer, klassische Sira-/Tabaqat-
//      Literatur) muss WÖRTLICH schon im Bestand vorkommen — in guides.json,
//      in den wissen-*.json der KI-Schicht oder in einer der Lektionen, die es
//      vor dieser Ergänzung schon gab. Damit kann in den neuen Lektionen keine
//      Quelle auftauchen, die nicht vorher jemand geprüft hat.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import guides from '../guides/guides.json';
import akhlaq from './data/akhlaq.json';
import fiqhIbadat from './data/fiqh-ibadat.json';
import nikah from './data/nikah.json';
import sahaba from './data/sahaba.json';

const MOBILE = path.resolve(__dirname, '..', '..', '..');

interface Lesson {
  id: string;
  source?: string;
  story?: unknown[];
  storyQuiz?: unknown[];
}

/** Die in dieser Ergänzung neu hinzugekommenen Lektionen, kursweise. */
const NEUE_LEKTIONEN: [kurs: string, lessons: Lesson[], ids: (id: string) => boolean][] = [
  ['fiqh-ibadat', fiqhIbadat.lessons as Lesson[], () => true],
  ['akhlaq', akhlaq.lessons as Lesson[], (id) => Number(id.split('-')[1]) >= 10],
  ['nikah', nikah.lessons as Lesson[], (id) => Number(id.split('-')[1]) >= 6],
  ['sahaba', sahaba.lessons as Lesson[], (id) => Number(id.split('-')[1]) >= 14],
];

const neu = NEUE_LEKTIONEN.flatMap(([kurs, lessons, gehoertDazu]) =>
  lessons.filter((l) => gehoertDazu(l.id)).map((l) => [kurs, l] as const),
);

// --- Korpus: Verse und Nawawi-Hadithe, gegen die geprüft wird ----------------

const korpus = JSON.parse(
  readFileSync(path.join(MOBILE, 'public', 'rag', 'korpus-de.json'), 'utf8'),
) as { docs: { src?: string }[] };

const verse = new Set<string>();
const nawawiNummern = new Set<string>();
for (const doc of korpus.docs) {
  const vers = /^Koran (\d+):(\d+)/.exec(doc.src ?? '');
  if (vers) verse.add(`${vers[1]}:${vers[2]}`);
  const hadith = /^an-Nawaw[īi] Nr\.\s*(\d+)/.exec(doc.src ?? '');
  if (hadith) nawawiNummern.add(hadith[1]);
}

// --- Bestand: alle Nicht-Koran-Belege, die es vor der Ergänzung schon gab ----

/** Vereinheitlicht Schreibvarianten derselben Sammlung (Buchari/Bukhari …). */
function normalisiere(zitat: string): string {
  return zitat
    .replace(/Buchari/g, 'Bukhari')
    .replace(/Sunan Abu Dawud/g, 'Sunan Abi Dawud')
    .replace(/Jami at-Tirmidhi/g, "Jami' at-Tirmidhi")
    .replace(/Sunan al-Tirmidhi/g, 'Sunan at-Tirmidhi')
    .replace(/\s+/g, ' ')
    .trim();
}

// Im Bestand steht eine Sammlung oft mit mehreren Nummern ("Sahih al-Bukhari
// 159, 185" in guides.json, "2025-2027" bei I'tikaf) — die Nummernliste wird
// deshalb mitgelesen und in Einzelbelege aufgelöst.
const SAMMLUNGEN =
  /(Sahih al-Bukhari|Sahih Muslim|Sunan Abi Dawud|Jami' at-Tirmidhi|Sunan at-Tirmidhi|Sunan Ibn Majah|Sunan an-Nasa'i|Musnad Ahmad|Al-Adab al-Mufrad)\s*(?:Nr\.\s*)?(\d{1,5}(?:\s*[,&-]\s*\d{1,5})*)/g;

/** Alle (Sammlung, Nummer)-Paare eines Quellen-Strings, vereinheitlicht. */
function hadithe(text: string): string[] {
  const treffer: string[] = [];
  for (const m of normalisiere(text).matchAll(SAMMLUNGEN)) {
    for (const nummer of m[2].split(/[,&-]/)) treffer.push(`${m[1]} ${nummer.trim()}`);
  }
  return treffer;
}

const bestandHadithe = new Set<string>();
const bestandLiteratur = new Set<string>();

function erfasseBestand(quelle: string): void {
  for (const treffer of hadithe(quelle)) bestandHadithe.add(treffer);
  for (const teil of quelle.split(';')) {
    const t = normalisiere(teil);
    if (t && !/^Quran /.test(t) && hadithe(t).length === 0) bestandLiteratur.add(t);
  }
}

for (const guide of guides.guides as { source?: string }[]) {
  if (guide.source) erfasseBestand(guide.source);
}
for (const datei of readdirSync(path.join(MOBILE, 'src', 'features', 'ki'))) {
  if (!datei.startsWith('wissen-') || !datei.endsWith('.json')) continue;
  const json = JSON.parse(readFileSync(path.join(MOBILE, 'src', 'features', 'ki', datei), 'utf8')) as {
    eintraege?: { belege?: string[] }[];
  };
  for (const eintrag of json.eintraege ?? []) erfasseBestand((eintrag.belege ?? []).join('; '));
}
const neueIds = new Set(neu.map(([, l]) => l.id));
for (const datei of readdirSync(path.join(MOBILE, 'src', 'features', 'study', 'data'))) {
  if (!datei.endsWith('.json')) continue;
  const json = JSON.parse(
    readFileSync(path.join(MOBILE, 'src', 'features', 'study', 'data', datei), 'utf8'),
  ) as { lessons?: Lesson[] };
  for (const lesson of json.lessons ?? []) {
    if (!neueIds.has(lesson.id) && lesson.source) erfasseBestand(lesson.source);
  }
}

// --- Prüfungen ---------------------------------------------------------------

describe('Belege der 2026-07-28 ergänzten Lektionen', () => {
  it('findet überhaupt neue Lektionen (Schutz vor leerem Prüfergebnis)', () => {
    expect(neu.length).toBe(24 + 5 + 4 + 2);
  });

  it('jede neue Lektion führt eine Quellenangabe', () => {
    expect(neu.filter(([, l]) => !l.source?.trim()).map(([, l]) => l.id)).toEqual([]);
  });

  it('jede neue Lektion hat mindestens einen Koran- oder Hadith-Beleg', () => {
    const ohne = neu
      .filter(([, l]) => {
        const teile = (l.source ?? '').split(';').map((t) => t.trim());
        return !teile.some((t) => /^Quran \d+:\d+$/.test(t) || hadithe(t).length > 0 || /^an-Nawawi Nr\./.test(t));
      })
      .map(([, l]) => l.id);
    expect(ohne).toEqual([]);
  });

  it('jeder Koran-Beleg existiert wirklich im Korpus (kein erfundener Vers)', () => {
    const fehlend: string[] = [];
    for (const [kurs, lesson] of neu) {
      for (const teil of (lesson.source ?? '').split(';')) {
        const m = /^Quran (\d+):(\d+)$/.exec(teil.trim());
        if (!m) continue;
        if (!verse.has(`${m[1]}:${m[2]}`)) fehlend.push(`${kurs}/${lesson.id}: ${teil.trim()}`);
      }
    }
    expect(fehlend).toEqual([]);
  });

  it('jeder an-Nawawi-Beleg existiert als Hadith im Korpus', () => {
    const fehlend: string[] = [];
    for (const [kurs, lesson] of neu) {
      for (const teil of (lesson.source ?? '').split(';')) {
        const m = /^an-Nawaw[īi] Nr\.\s*(\d+)$/.exec(teil.trim());
        if (!m) continue;
        if (!nawawiNummern.has(m[1])) fehlend.push(`${kurs}/${lesson.id}: ${teil.trim()}`);
      }
    }
    expect(fehlend).toEqual([]);
  });

  it('jede sonstige Quellenangabe kommt wörtlich im vorhandenen Bestand vor', () => {
    const unbekannt: string[] = [];
    for (const [kurs, lesson] of neu) {
      for (const rohteil of (lesson.source ?? '').split(';')) {
        const teil = normalisiere(rohteil);
        if (!teil || /^Quran \d+:\d+$/.test(teil) || /^an-Nawaw[īi] Nr\.\s*\d+$/.test(teil)) continue;
        const treffer = hadithe(teil);
        if (treffer.length > 0) {
          for (const t of treffer) if (!bestandHadithe.has(t)) unbekannt.push(`${kurs}/${lesson.id}: ${t}`);
          continue;
        }
        if (!bestandLiteratur.has(teil)) unbekannt.push(`${kurs}/${lesson.id}: ${teil}`);
      }
    }
    expect(unbekannt).toEqual([]);
  });

  it('jede neue Lektion hat mindestens 3 Abschnitte und 3 Quizfragen', () => {
    const duenn = neu
      .filter(([, l]) => (l.story?.length ?? 0) < 3 || (l.storyQuiz?.length ?? 0) < 3)
      .map(([, l]) => l.id);
    expect(duenn).toEqual([]);
  });
});
