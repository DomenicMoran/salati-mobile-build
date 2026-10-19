import React, { useMemo } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Lesson } from '@/features/learn/curriculum';
import type { LearnProgress } from '@/features/learn/progress';
import { SettingsProvider, useSettings } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '@/lib/i18n';
import pflichtwissenData from './data/pflichtwissen.json';
import {
  applyCoursePlacement,
  buildCourseCheckpoints,
  buildHydratedCourseCheckpoints,
  recommendedNextLessonIn,
  selectCheckpointLessons,
} from './placement';

const pflichtwissenLessons = (pflichtwissenData as { lessons: Lesson[] }).lessons;

function HydratingPlacementQuestion() {
  const { loaded } = useSettings();
  const { locale } = useTranslation();
  const prompt = useMemo(() => {
    const checkpoints = buildHydratedCourseCheckpoints(pflichtwissenLessons, locale, loaded, () => 0.5);
    return checkpoints?.flatMap((checkpoint) => checkpoint.questions)
      .find((question) => question.promptText === 'من كان الزائر الغريب في حديث جبريل؟')?.promptText ?? 'Loading';
  }, [loaded, locale]);
  return React.createElement(Text, null, prompt);
}

function vocabLesson(id: string): Lesson {
  return {
    id,
    kind: 'vocab',
    title: { de: id, en: id, tr: id, ar: id, es: id, fr: id },
    vocabWords: [
      {
        arabic: 'كِتَابٌ',
        translit: 'kitabun',
        meaning: { de: 'Buch', en: 'Book', tr: 'Kitap', ar: 'كتاب', es: 'Libro', fr: 'Livre' },
      },
      {
        arabic: 'قَلَمٌ',
        translit: 'qalamun',
        meaning: { de: 'Stift', en: 'Pen', tr: 'Kalem', ar: 'قلم', es: 'Bolígrafo', fr: 'Stylo' },
      },
      {
        arabic: 'بَيْتٌ',
        translit: 'baytun',
        meaning: { de: 'Haus', en: 'House', tr: 'Ev', ar: 'بيت', es: 'Casa', fr: 'Maison' },
      },
      {
        arabic: 'بَابٌ',
        translit: 'babun',
        meaning: { de: 'Tür', en: 'Door', tr: 'Kapı', ar: 'باب', es: 'Puerta', fr: 'Porte' },
      },
    ],
  };
}

function makeLessons(n: number): Lesson[] {
  return Array.from({ length: n }, (_, i) => vocabLesson(`c-${i + 1}`));
}

describe('selectCheckpointLessons', () => {
  it('nutzt jede Lektion als Meilenstein, wenn der Kurs kurz ist', () => {
    const lessons = makeLessons(3);
    expect(selectCheckpointLessons(lessons).map((l) => l.id)).toEqual(['c-1', 'c-2', 'c-3']);
  });

  it('verteilt maximal 5 Meilensteine gleichmäßig über einen langen Kurs', () => {
    const lessons = makeLessons(83); // z.B. Madinah-Kurs
    const checkpoints = selectCheckpointLessons(lessons);
    expect(checkpoints).toHaveLength(5);
    expect(checkpoints[0].id).toBe('c-1');
    expect(checkpoints[checkpoints.length - 1].id).toBe('c-83'); // letzte Lektion immer dabei
    // aufsteigend sortiert, keine Duplikate
    const indices = checkpoints.map((l) => lessons.indexOf(l));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('leerer Kurs liefert keine Meilensteine', () => {
    expect(selectCheckpointLessons([])).toEqual([]);
  });
});

describe('buildCourseCheckpoints', () => {
  it('erzeugt für jeden Meilenstein ein nichtleeres Quiz', () => {
    const lessons = makeLessons(16); // z.B. Grammar-Kurs
    const checkpoints = buildCourseCheckpoints(lessons, 'de', Math.random);
    expect(checkpoints).toHaveLength(5);
    for (const cp of checkpoints) {
      expect(cp.questions.length).toBeGreaterThan(0);
    }
  });

  it('lokalisiert Pflichtwissen-Fragen in der angeforderten App-Sprache', () => {
    const lessons = (pflichtwissenData as { lessons: Lesson[] }).lessons;
    const checkpoints = buildCourseCheckpoints(lessons, 'ar', () => 0.5);
    const questions = checkpoints.flatMap((checkpoint) => checkpoint.questions);
    expect(questions.some((question) => question.promptText === 'من كان الزائر الغريب في حديث جبريل؟')).toBe(true);
    expect(questions.every((question) => question.contentFallback !== true)).toBe(true);
  });

  it('hält Default-Deutsch während der Settings-Hydrierung zurück und baut nach Arabic-Hydrierung arabische Fragen', () => {
    const lessons = (pflichtwissenData as { lessons: Lesson[] }).lessons;
    // SettingsProvider render #1: loaded=false, locale=DEFAULT_SETTINGS.language ('de').
    expect(buildHydratedCourseCheckpoints(lessons, 'de', false, () => 0.5)).toBeNull();
    // AsyncStorage finishes: loaded=true, locale='ar'; the rendered quiz must now be Arabic.
    const checkpoints = buildHydratedCourseCheckpoints(lessons, 'ar', true, () => 0.5);
    const questions = checkpoints?.flatMap((checkpoint) => checkpoint.questions) ?? [];
    expect(questions.some((question) => question.promptText === 'من كان الزائر الغريب في حديث جبريل؟')).toBe(true);
    expect(questions.every((question) => question.contentFallback !== true)).toBe(true);
  });

  it('rendert nach async Settings-Hydrierung Arabisch statt vorübergehend deutscher Quizfragen', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, language: 'ar' }));
    await render(React.createElement(HydratingPlacementQuestion), { wrapper: SettingsProvider });
    expect(screen.queryByText('Wer war der fremde Besucher im Dschibril-Hadith?')).toBeNull();
    await waitFor(() => expect(screen.getByText('من كان الزائر الغريب في حديث جبريل؟')).toBeTruthy());
  });
});

describe('applyCoursePlacement', () => {
  it('markiert alle Lektionen bis einschließlich upToLessonId als bestanden', () => {
    const lessons = makeLessons(5);
    const result = applyCoursePlacement(lessons, {}, 'c-3', 1000);
    expect(Object.keys(result).sort()).toEqual(['c-1', 'c-2', 'c-3']);
    expect(result['c-3']).toEqual({ score: 10, total: 10, completedAt: 1000 });
    expect(result['c-4']).toBeUndefined();
  });

  it('gibt progress unverändert zurück, wenn upToLessonId null ist', () => {
    const lessons = makeLessons(3);
    const progress: LearnProgress = { 'c-1': { score: 5, total: 10, completedAt: 1 } };
    expect(applyCoursePlacement(lessons, progress, null)).toBe(progress);
  });

  it('gibt progress unverändert zurück, wenn die Lektion nicht existiert', () => {
    const lessons = makeLessons(3);
    const progress: LearnProgress = {};
    expect(applyCoursePlacement(lessons, progress, 'unknown-id')).toBe(progress);
  });
});

describe('recommendedNextLessonIn', () => {
  it('empfiehlt die erste Lektion ohne bestandenen Meilenstein', () => {
    const lessons = makeLessons(5);
    expect(recommendedNextLessonIn(lessons, null).id).toBe('c-1');
  });

  it('empfiehlt die Lektion direkt nach dem letzten bestandenen Meilenstein', () => {
    const lessons = makeLessons(5);
    expect(recommendedNextLessonIn(lessons, 'c-2').id).toBe('c-3');
  });

  it('klemmt auf die letzte Lektion, wenn der Meilenstein schon der letzte ist', () => {
    const lessons = makeLessons(5);
    expect(recommendedNextLessonIn(lessons, 'c-5').id).toBe('c-5');
  });
});
