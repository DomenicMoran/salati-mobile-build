import { moveId, parseCourseOrder, sortCoursesByOrder } from './courseOrder';
import type { CourseMeta } from './courses';

function stubCourse(id: string, category: CourseMeta['category']): CourseMeta {
  return { id, icon: 'book', storageKey: `salatibox:study-${id}`, category, lessonCount: 0 };
}

describe('parseCourseOrder', () => {
  it('leer/kaputt ergibt null', () => {
    expect(parseCourseOrder(null)).toBeNull();
    expect(parseCourseOrder('kaputt{')).toBeNull();
  });

  it('gültige String-Liste wird übernommen', () => {
    expect(parseCourseOrder('["tajwid","amau"]')).toEqual(['tajwid', 'amau']);
  });

  it('Objekt statt Array ergibt null', () => {
    expect(parseCourseOrder('{"a":1}')).toBeNull();
  });

  it('Array mit Nicht-String-Einträgen ergibt null', () => {
    expect(parseCourseOrder('["tajwid", 5]')).toBeNull();
  });
});

describe('sortCoursesByOrder', () => {
  const courses = [
    stubCourse('tajwid', 'quranArabic'),
    stubCourse('grammar', 'quranArabic'),
    stubCourse('madinah', 'quranArabic'),
    stubCourse('amau', 'quranArabic'),
  ];

  it('ohne gespeicherte Reihenfolge bleibt die Ausgangsreihenfolge', () => {
    expect(sortCoursesByOrder(courses, null)).toEqual(courses);
    expect(sortCoursesByOrder(courses, [])).toEqual(courses);
  });

  it('sortiert nach gespeicherter Reihenfolge', () => {
    const order = ['amau', 'tajwid', 'madinah', 'grammar'];
    expect(sortCoursesByOrder(courses, order).map((c) => c.id)).toEqual([
      'amau',
      'tajwid',
      'madinah',
      'grammar',
    ]);
  });

  it('unbekannte IDs in order werden ignoriert', () => {
    const order = ['ghost', 'amau', 'tajwid'];
    const result = sortCoursesByOrder(courses, order);
    expect(result.map((c) => c.id)).toEqual(['amau', 'tajwid', 'grammar', 'madinah']);
  });

  it('Kurse, die nicht in order vorkommen, landen am Ende in Ausgangsreihenfolge', () => {
    const order = ['grammar'];
    const result = sortCoursesByOrder(courses, order);
    expect(result.map((c) => c.id)).toEqual(['grammar', 'tajwid', 'madinah', 'amau']);
  });

  it('lässt das Original-Array unverändert (keine Mutation)', () => {
    const copy = [...courses];
    sortCoursesByOrder(courses, ['amau', 'tajwid']);
    expect(courses).toEqual(copy);
  });
});

describe('moveId', () => {
  it('vertauscht mit dem oberen Nachbarn', () => {
    expect(moveId(['a', 'b', 'c'], 1, 'up')).toEqual(['b', 'a', 'c']);
  });

  it('vertauscht mit dem unteren Nachbarn', () => {
    expect(moveId(['a', 'b', 'c'], 1, 'down')).toEqual(['a', 'c', 'b']);
  });

  it('am oberen Rand: kein Effekt', () => {
    expect(moveId(['a', 'b', 'c'], 0, 'up')).toEqual(['a', 'b', 'c']);
  });

  it('am unteren Rand: kein Effekt', () => {
    expect(moveId(['a', 'b', 'c'], 2, 'down')).toEqual(['a', 'b', 'c']);
  });

  it('lässt das Original-Array unverändert (keine Mutation)', () => {
    const ids = ['a', 'b', 'c'];
    moveId(ids, 1, 'up');
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});
