import {
  groupEpisodesByCourse,
  hasCourses,
  isStarted,
  isWatched,
  progressOf,
} from './courses';
import type { VideoEpisode } from './data';
import type { ProgressMap } from './progress';

function ep(partial: Partial<VideoEpisode> & { episode_no: number }): VideoEpisode {
  return {
    title: `Folge ${partial.episode_no}`,
    topics: [],
    duration_sec: 100,
    video_url: '',
    cover_url: '',
    ...partial,
  };
}

const KURS = [
  ep({ episode_no: 3, course: 'lesen', course_title: 'Kurs 1', course_order: 1, chapter_no: 2, chapter_title: 'Formen', lesson_no: 1 }),
  ep({ episode_no: 1, course: 'lesen', course_title: 'Kurs 1', course_order: 1, chapter_no: 1, chapter_title: 'Alphabet', lesson_no: 1 }),
  ep({ episode_no: 2, course: 'lesen', course_title: 'Kurs 1', course_order: 1, chapter_no: 1, chapter_title: 'Alphabet', lesson_no: 2 }),
  ep({ episode_no: 9, course: 'tajwid', course_title: 'Kurs 3', course_order: 3, chapter_no: 1, chapter_title: 'Nun', lesson_no: 1 }),
];

describe('groupEpisodesByCourse', () => {
  it('ordnet nach Kurs, Kapitel und Lektion - unabhaengig von der Eingabereihenfolge', () => {
    const kurse = groupEpisodesByCourse(KURS);
    expect(kurse.map((k) => k.id)).toEqual(['lesen', 'tajwid']);
    expect(kurse[0].chapters.map((c) => c.chapterNo)).toEqual([1, 2]);
    expect(kurse[0].chapters[0].episodes.map((e) => e.episode_no)).toEqual([1, 2]);
    expect(kurse[0].episodes.map((e) => e.episode_no)).toEqual([1, 2, 3]);
  });

  it('laesst Folgen ohne Kurs weg, statt einen Sammelkurs zu erfinden', () => {
    const kurse = groupEpisodesByCourse([...KURS, ep({ episode_no: 50 })]);
    expect(kurse.flatMap((k) => k.episodes).map((e) => e.episode_no)).not.toContain(50);
  });

  it('zieht den Anzeigenamen nach, wenn ihn erst eine spaetere Folge traegt', () => {
    const kurse = groupEpisodesByCourse([
      ep({ episode_no: 1, course: 'lesen', chapter_no: 1 }),
      ep({ episode_no: 2, course: 'lesen', course_title: 'Kurs 1', chapter_no: 1, chapter_title: 'Alphabet' }),
    ]);
    expect(kurse[0].title).toBe('Kurs 1');
    expect(kurse[0].chapters[0].title).toBe('Alphabet');
  });

  it('erkennt einen Index ohne Kurseinteilung', () => {
    expect(hasCourses([ep({ episode_no: 1 })])).toBe(false);
    expect(hasCourses(KURS)).toBe(true);
  });
});

describe('Fortschritt', () => {
  const fertig: ProgressMap = { '1': { position: 0, duration: 100, updatedAt: 1, completedAt: 5 } };
  const angefangen: ProgressMap = { '2': { position: 30, duration: 100, updatedAt: 1 } };

  it('zaehlt eine Folge mit Abschlussmarke als gesehen - auch ohne Position', () => {
    expect(isWatched(ep({ episode_no: 1 }), fertig)).toBe(true);
  });

  it('zaehlt Altbestand ohne Marke ueber die Position (>= 90 %)', () => {
    const alt: ProgressMap = { '7': { position: 95, duration: 100, updatedAt: 1 } };
    expect(isWatched(ep({ episode_no: 7 }), alt)).toBe(true);
  });

  it('trennt angefangen von gesehen', () => {
    expect(isStarted(ep({ episode_no: 2 }), angefangen)).toBe(true);
    expect(isWatched(ep({ episode_no: 2 }), angefangen)).toBe(false);
  });

  it('nennt die naechste offene Lektion in Kursreihenfolge', () => {
    const stand = progressOf(groupEpisodesByCourse(KURS)[0].episodes, fertig);
    expect(stand.total).toBe(3);
    expect(stand.watched).toBe(1);
    expect(stand.next?.episode_no).toBe(2);
    expect(stand.ratio).toBeCloseTo(1 / 3);
  });

  it('ist ohne Lektionen leer statt NaN', () => {
    expect(progressOf([], {})).toEqual({ watched: 0, total: 0, ratio: 0, next: undefined });
  });
});
