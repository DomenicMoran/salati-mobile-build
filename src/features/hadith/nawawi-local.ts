import nawawiCourse from '@/features/study/data/nawawi40.json';
import type { Locale } from '@/lib/locale-detect';

import type { HadithBook, HadithWithTranslation } from './api';

/**
 * An-Nawawi 40 aus dem eigenen Repo statt aus der Hadith-API.
 *
 * Hintergrund (Inhalts-Audit 2026-07-27): fawazahmed0 liefert für diese
 * Sammlung nur ar/en/tr/bn/fr — insbesondere KEIN Deutsch, obwohl Deutsch die
 * Primärsprache der App ist. Der Kurs-Datensatz `study/data/nawawi40.json`
 * enthält dieselben 42 Hadithe mit vokalisiertem arabischem Originaltext
 * (`story[0].arabic`), einer Übersetzung in allen 14 App-Sprachen
 * (`story[0].text`) und einer Quellenangabe je Hadith (`source`).
 *
 * Damit ist An-Nawawi 40 die einzige Sammlung, die in jeder App-Sprache
 * muttersprachlich vorliegt — deshalb wird sie lokal ausgeliefert und nicht
 * über die API geholt (spart zusätzlich zwei Netzwerk-Requests).
 */

interface NawawiLesson {
  id: string;
  source: string;
  title: Partial<Record<Locale, string>>;
  story: { arabic?: string; text: Partial<Record<Locale, string>> }[];
}

const LESSONS = nawawiCourse.lessons as unknown as NawawiLesson[];

/** "nawawi-07" -> 7 */
function lessonNumber(id: string): number {
  return Number(id.replace(/^\D+/, ''));
}

export function localNawawiCollection(lang: Locale): {
  meta: HadithBook['metadata'];
  hadiths: HadithWithTranslation[];
} {
  const hadiths: HadithWithTranslation[] = LESSONS.map((lesson) => {
    const first = lesson.story[0];
    const number = lessonNumber(lesson.id);
    const arabic = first?.arabic?.trim() ?? '';
    const translated = first?.text?.[lang]?.trim() || first?.text?.en?.trim() || arabic;
    return {
      hadithnumber: number,
      arabic,
      translation: lang === 'ar' ? arabic : translated,
      // Die Kursdaten führen die Belegkette als Fließtext ("an-Nawawī Nr. 2 -
      // Sahih Muslim 8"); als Gradierung ausgewiesen, damit die bestehende
      // Detail-UI sie ohne Änderung anzeigt.
      grades: lesson.source ? [{ name: lesson.source, grade: '' }] : [],
      reference: { book: 1, hadith: number },
    };
  }).filter((h) => h.arabic);

  return {
    meta: {
      name: lang === 'ar' ? 'الأربعون النووية' : 'An-Nawawi 40',
      sections: { '1': lang === 'ar' ? 'الأربعون النووية' : 'An-Nawawi 40' },
    },
    hadiths,
  };
}
