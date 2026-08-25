// Kurs -> Kapitel -> Lektion: die Menue-Ebene ueber der Videoliste.
//
// Vorher war "Koran lernen / Videos" EINE lange Liste mit Reihen-Kopfzeilen.
// Wer wissen wollte, wo er steht, musste scrollen (User 2026-08-25: "so eine
// Art Menue, dass man erstmal auswaehlt welchen Kurs man macht, welches
// Kapitel, welches Video ... dass man sieht wie viel man schon geguckt hat").
//
// Die Ordnung steht IM INDEX (Felder course/chapter_no/lesson_no, gepflegt in
// podcast/scripts/kursordnung.py) - nicht hier. Diese Datei gruppiert nur und
// rechnet den Fortschritt zusammen. Damit bleibt die App ohne Neubau
// aenderbar, sobald sich die Kurseinteilung aendert.

import type { VideoEpisode } from './data';
import type { ProgressMap } from './progress';

/** Ab wieviel Prozent eine Lektion als gesehen gilt. Das Ende eines Videos
 *  besteht aus Abspann und Nachlaufstille - wer bis 90 % kommt, hat sie
 *  gesehen. */
export const WATCHED_RATIO = 0.9;

export interface CourseChapter {
  chapterNo: number;
  title: string;
  episodes: VideoEpisode[];
}

export interface Course {
  id: string;
  title: string;
  order: number;
  chapters: CourseChapter[];
  /** Alle Lektionen des Kurses, in Kapitel- und Lektionsreihenfolge. */
  episodes: VideoEpisode[];
}

export interface CourseProgress {
  /** Wieviele Lektionen als gesehen gelten. */
  watched: number;
  total: number;
  /** 0..1 - Anteil gesehener Lektionen. */
  ratio: number;
  /** Die erste noch nicht gesehene Lektion; fuer "Weiterlernen". */
  next?: VideoEpisode;
}

function num(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Gruppiert die Folgen zu Kursen und Kapiteln.
 *
 * Folgen ohne `course` gehoeren zu keinem Kurs und werden ausgelassen - sie
 * bleiben ueber die flache Liste erreichbar. So kann ein aelterer Index (ganz
 * ohne Kursfelder) nie ein leeres Menue erzeugen, sondern gar keins, und die
 * Ansicht faellt sichtbar auf die Liste zurueck.
 */
export function groupEpisodesByCourse(episodes: VideoEpisode[]): Course[] {
  const byId = new Map<string, Course>();
  for (const ep of episodes) {
    const id = ep.course?.trim();
    if (!id) continue;
    let course = byId.get(id);
    if (!course) {
      course = {
        id,
        title: ep.course_title?.trim() || id,
        order: num(ep.course_order, 99),
        chapters: [],
        episodes: [],
      };
      byId.set(id, course);
    } else if (course.title === id && ep.course_title?.trim()) {
      // Traegt erst eine spaetere Folge den Anzeigenamen, wird er nachgezogen -
      // sonst bliebe die interne Kennung stehen (derselbe Fall wie bei den
      // Reihen-Kopfzeilen, Audit 2026-07-27).
      course.title = ep.course_title.trim();
    }
    const chapterNo = num(ep.chapter_no, 99);
    let chapter = course.chapters.find((c) => c.chapterNo === chapterNo);
    if (!chapter) {
      chapter = { chapterNo, title: ep.chapter_title?.trim() || '', episodes: [] };
      course.chapters.push(chapter);
    } else if (!chapter.title && ep.chapter_title?.trim()) {
      chapter.title = ep.chapter_title.trim();
    }
    chapter.episodes.push(ep);
  }

  const courses = [...byId.values()];
  for (const course of courses) {
    course.chapters.sort((a, b) => a.chapterNo - b.chapterNo);
    for (const chapter of course.chapters) {
      chapter.episodes.sort(
        (a, b) =>
          num(a.lesson_no, a.episode_no) - num(b.lesson_no, b.episode_no) ||
          a.episode_no - b.episode_no,
      );
    }
    course.episodes = course.chapters.flatMap((c) => c.episodes);
  }
  courses.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return courses;
}

/** true, sobald der Index ueberhaupt eine Kurseinteilung mitbringt. */
export function hasCourses(episodes: VideoEpisode[]): boolean {
  return episodes.some((e) => !!e.course?.trim());
}

/** Gilt diese Lektion als gesehen?
 *
 *  Zwei Wege fuehren dahin: die Folge wurde zu Ende geschaut (dann traegt der
 *  Eintrag `completedAt`), oder sie steht kurz vor dem Ende. Der zweite Fall
 *  faengt Eintraege ab, die vor 2026-08-25 entstanden sind - damals gab es
 *  die Marke noch nicht. */
export function isWatched(ep: VideoEpisode, progress: ProgressMap): boolean {
  const entry = progress[String(ep.episode_no)];
  if (!entry) return false;
  if (entry.completedAt) return true;
  const total = entry.duration || ep.duration_sec;
  if (!total) return false;
  return entry.position / total >= WATCHED_RATIO;
}

/** Angefangen, aber noch nicht zu Ende geschaut. */
export function isStarted(ep: VideoEpisode, progress: ProgressMap): boolean {
  const entry = progress[String(ep.episode_no)];
  return !!entry && entry.position > 0 && !isWatched(ep, progress);
}

/** Fortschritt ueber eine beliebige Menge von Lektionen. */
export function progressOf(
  episodes: VideoEpisode[],
  progress: ProgressMap,
): CourseProgress {
  let watched = 0;
  let next: VideoEpisode | undefined;
  for (const ep of episodes) {
    if (isWatched(ep, progress)) {
      watched += 1;
    } else if (!next) {
      next = ep;
    }
  }
  const total = episodes.length;
  return { watched, total, ratio: total ? watched / total : 0, next };
}
