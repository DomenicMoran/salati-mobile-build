import AsyncStorage from '@react-native-async-storage/async-storage';

// Nutzer-eigene Kurs-Reihenfolge im Studium-Hub: eine flache Liste aller
// Kurs-IDs in der vom Nutzer gewünschten Reihenfolge. Die Kategorie-Gruppierung
// (quranArabic/islamicStudies/bonus, siehe app/study/index.tsx) bleibt dabei
// bestehen — sortCoursesByOrder() wird pro Kategorie-Teilmenge angewendet,
// deshalb reicht eine einzige globale Liste (die relative Reihenfolge
// zwischen zwei Kategorien ist irrelevant, da nie gemeinsam gerendert).
// Ohne gespeicherte Reihenfolge (null) gilt die feste Standard-Reihenfolge
// aus COURSE_META.

export const COURSE_ORDER_STORAGE_KEY = 'salatibox:study-course-order';

export function parseCourseOrder(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadCourseOrder(): Promise<string[] | null> {
  return parseCourseOrder(await AsyncStorage.getItem(COURSE_ORDER_STORAGE_KEY));
}

export async function saveCourseOrder(order: string[]): Promise<void> {
  await AsyncStorage.setItem(COURSE_ORDER_STORAGE_KEY, JSON.stringify(order)).catch(() => {});
}

/**
 * Sortiert `courses` nach `order` (Liste von Kurs-IDs). Kurse, deren ID
 * nicht in `order` vorkommt (z. B. neu hinzugekommene Kurse, oder wenn
 * `order` null ist), behalten ihre relative Standard-Reihenfolge und werden
 * ans Ende angehängt — so bricht ein neuer Kurs nie eine gespeicherte
 * Nutzer-Reihenfolge.
 *
 * Generisch über `T extends { id: string }`, damit sowohl die leichten
 * CourseMeta-Objekte (Studium-Hub-Liste/Reihenfolge-Screen) als auch volle
 * Course-Objekte sortiert werden können, ohne Lektionsinhalte zu brauchen.
 */
export function sortCoursesByOrder<T extends { id: string }>(courses: T[], order: string[] | null): T[] {
  if (!order || order.length === 0) return courses;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...courses].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return 0; // beide unbekannt: Ausgangsreihenfolge (Array.sort ist stabil) behalten
  });
}

/**
 * Vertauscht in `ids` das Element an `index` mit seinem Nachbarn in
 * Richtung `direction`. Kein Effekt am jeweiligen Rand der Liste.
 */
export function moveId(ids: string[], index: number, direction: 'up' | 'down'): string[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
