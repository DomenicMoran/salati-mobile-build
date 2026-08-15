// Studien-Kurse ("Salati Studium"): kuratierte, quellen-zitierte Lernpfade,
// die dieselbe Lektions-Engine wie "Koran lesen lernen" nutzen (kinds
// story/concept/wordbyword, Fortschritt via useCourseProgress je Storage-Key).
//
// Performance (Web-Export salati.pro): die 12 Kurs-JSONs sind zusammen ~6,8MB
// (madinah.json allein 1,86MB). Früher wurden alle 12 beim Modul-Top-Level
// statisch importiert, wodurch JEDE Route, die COURSES importierte (auch
// z. B. das Studium-Hub-Listing, das nur id/icon/title braucht), alle 12
// JSONs ins eigene JS-Chunk zog — Metro hob das zusätzlich in einen
// gemeinsamen `__common`-Chunk, der unabhängig von Routen-Splitting in die
// Root-HTML gezogen wurde (siehe Audit). Jetzt gibt es zwei Ebenen:
//   - COURSE_META: synchron verfügbare Metadaten (id/icon/storageKey/
//     category/nonSequential/lessonCount) OHNE Lektionsinhalte.
//   - loadCourseLessons(id) / loadCourse(id): async, lädt EIN Kurs-JSON per
//     dynamic import() -> eigenes Metro/webpack-Chunk pro Kurs, das nur lädt,
//     wer den jeweiligen Kurs tatsächlich öffnet.
// lessonCount wird in courses.test.ts gegen die echten JSON-Dateien geprüft,
// damit die Zahl nie stillschweigend veraltet (siehe dortiger Test).
import type { IconName } from '@/components/ui/icon-symbol';
import type { Lesson } from '@/features/learn/curriculum';
import { loadCachedCourseJson } from '@/features/study/courseSync';

/**
 * 'quranArabic' = baut direkt auf "Koran lesen lernen" auf (Grammatik,
 * Tajwid-Regeln, Madinah-Arabisch-Reihe, Alltags-Wortschatz) - gehört
 * inhaltlich zusammen, auch wenn technisch ein eigenes Kurs-System.
 * 'islamicStudies' = Glaube/Geschichte/Fiqh, unabhängig vom Arabisch-Lernen.
 * 'bonus' = optionale Zusatzkurse (aktuell nur Dialekte).
 */
export type CourseCategory = 'quranArabic' | 'islamicStudies' | 'bonus';

/** Leichte, synchron verfügbare Kurs-Metadaten OHNE Lektionsinhalte. */
export interface CourseMeta {
  id: string;
  icon: IconName;
  storageKey: string;
  category: CourseCategory;
  /**
   * true = alle Lektionen sind von Anfang an frei wählbar, unabhängig von
   * settings.freeUnlock. Für Kurse, deren Lektionen KEINE echte Progression
   * sind (z. B. Dialekte: Levantinisch setzt Darija nicht voraus) - eine
   * generische sequenzielle Sperre wäre hier pädagogisch falsch.
   */
  nonSequential?: boolean;
  /** Anzahl Lektionen — synchron bekannt, ohne das Kurs-JSON zu laden. */
  lessonCount: number;
}

/** Voll geladener Kurs inkl. Lektionsinhalte — nur über loadCourse()/loadCourseLessons() erreichbar (async). */
export interface Course extends CourseMeta {
  lessons: Lesson[];
}

interface CourseDef {
  id: string;
  icon: IconName;
  category: CourseCategory;
  nonSequential?: boolean;
  lessonCount: number;
  load: () => Promise<unknown>;
}

// Reihenfolge innerhalb jeder Kategorie pädagogisch sortiert. Kategorien
// selbst gruppieren die Anzeige im Studium-Hub (siehe app/study/index.tsx):
// Koran-Arabisch zuerst (direkte Fortsetzung von "Koran lesen lernen"),
// dann Glaube/Geschichte, Bonus-Kurse zuletzt.
//
// Jedes `load` ist ein LITERALER dynamic import() (kein Template/keine
// Variable im Pfad) — nur so kann Metro/webpack jeden Kurs zuverlässig in
// ein eigenes Chunk splitten.
const COURSE_DEFS: CourseDef[] = [
  { id: 'tajwid', icon: 'musical-notes', category: 'quranArabic', lessonCount: 14, load: () => import('./data/tajwid.json') },
  { id: 'grammar', icon: 'language', category: 'quranArabic', lessonCount: 16, load: () => import('./data/grammar.json') },
  { id: 'madinah', icon: 'school', category: 'quranArabic', lessonCount: 83, load: () => import('./data/madinah.json') },
  { id: 'amau', icon: 'chatbubble-ellipses', category: 'quranArabic', lessonCount: 54, load: () => import('./data/amau.json') },
  { id: 'aqida', icon: 'diamond', category: 'islamicStudies', lessonCount: 11, load: () => import('./data/aqida.json') },
  { id: 'fiqh-ibadat', icon: 'water', category: 'islamicStudies', lessonCount: 24, load: () => import('./data/fiqh-ibadat.json') },
  { id: 'nawawi40', icon: 'library', category: 'islamicStudies', lessonCount: 42, load: () => import('./data/nawawi40.json') },
  { id: 'seerah', icon: 'moon', category: 'islamicStudies', lessonCount: 20, load: () => import('./data/seerah.json') },
  { id: 'prophets', icon: 'people', category: 'islamicStudies', lessonCount: 25, load: () => import('./data/prophets.json') },
  { id: 'sahaba', icon: 'people-circle', category: 'islamicStudies', lessonCount: 15, load: () => import('./data/sahaba.json') },
  { id: 'akhlaq', icon: 'heart', category: 'islamicStudies', lessonCount: 14, load: () => import('./data/akhlaq.json') },
  { id: 'nikah', icon: 'home', category: 'islamicStudies', lessonCount: 9, load: () => import('./data/nikah.json') },
  { id: 'dialects', icon: 'globe-outline', category: 'bonus', lessonCount: 28, nonSequential: true, load: () => import('./data/dialects.json') },
];

/** Synchron verfügbare Metadaten aller Kurse, in fester Anzeige-Reihenfolge. */
export const COURSE_META: CourseMeta[] = COURSE_DEFS.map((d) => ({
  id: d.id,
  icon: d.icon,
  storageKey: `salatibox:study-${d.id}`,
  category: d.category,
  nonSequential: d.nonSequential,
  lessonCount: d.lessonCount,
}));

export function courseMetaById(id: string | undefined): CourseMeta | undefined {
  return COURSE_META.find((c) => c.id === id);
}

/** Lädt NUR die Lektionen eines Kurses async (per-Kurs Code-Split im Web-Export).
 *  Bevorzugt eine per OTA nachgeladene neuere Version aus dem Cache (s.
 *  courseSync.ts); ohne Cache das gebündelte JSON (sofort offline). */
export async function loadCourseLessons(id: string): Promise<Lesson[]> {
  const def = COURSE_DEFS.find((d) => d.id === id);
  if (!def) return [];
  const cached = await loadCachedCourseJson(id);
  const mod = cached ?? (await def.load());
  return (mod as { lessons: Lesson[] }).lessons ?? [];
}

/** Lädt Metadaten + Lektionen zusammen (Ersatz für den früheren synchronen courseById()). */
export async function loadCourse(id: string): Promise<Course | undefined> {
  const meta = courseMetaById(id);
  if (!meta) return undefined;
  return { ...meta, lessons: await loadCourseLessons(id) };
}

/**
 * Lädt ALLE Kurse inkl. Lektionen (z. B. Studium-Hub-Fortschrittsbalken,
 * Wochen-Rückblick, Achievements, Wiederholung) — bewusst selten benutzt,
 * lädt beim Aufruf alle 12 Kurs-JSONs. Nur die Screens, die das wirklich
 * brauchen, zahlen diesen Preis, und erst wenn der Nutzer sie öffnet — nicht
 * mehr jede Route, die COURSES importiert.
 */
export async function loadAllCourses(): Promise<Course[]> {
  return Promise.all(COURSE_META.map((m) => loadCourse(m.id) as Promise<Course>));
}

export async function lessonInCourse(courseId: string, lessonId: string): Promise<Lesson | undefined> {
  const lessons = await loadCourseLessons(courseId);
  return lessons.find((l) => l.id === lessonId);
}
