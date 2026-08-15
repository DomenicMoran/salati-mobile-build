import type { Lesson } from '@/features/learn/curriculum';
import dialectsData from './data/dialects.json';
import {
  DEFAULT_DIALECT_GROUP_ORDER,
  moveDialectGroup,
  sortDialectLessons,
  type DialectGroupId,
} from './dialectOrder';

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
    ],
  };
}

/** 4 Gruppen à 7 Lektionen, exakt wie dialects.json strukturiert. */
function makeDialectLessons(): Lesson[] {
  const groups: DialectGroupId[] = ['maghrebi', 'levantine', 'gulf', 'egyptian'];
  return groups.flatMap((group) =>
    Array.from({ length: 7 }, (_, i) => vocabLesson(`${group}-${i}`)),
  );
}

describe('sortDialectLessons', () => {
  it('behält die Datei-Reihenfolge bei Default-Order', () => {
    const lessons = makeDialectLessons();
    const sorted = sortDialectLessons(lessons, DEFAULT_DIALECT_GROUP_ORDER);
    expect(sorted.map((l) => l.id)).toEqual(lessons.map((l) => l.id));
  });

  it('sortiert die Gruppen-Blöcke nach der übergebenen Reihenfolge, Lektionen innerhalb einer Gruppe bleiben stabil', () => {
    const lessons = makeDialectLessons();
    const order: DialectGroupId[] = ['gulf', 'egyptian', 'maghrebi', 'levantine'];
    const sorted = sortDialectLessons(lessons, order);

    // Golf-Block zuerst, in ursprünglicher Reihenfolge
    expect(sorted.slice(0, 7).map((l) => l.id)).toEqual([
      'gulf-0', 'gulf-1', 'gulf-2', 'gulf-3', 'gulf-4', 'gulf-5', 'gulf-6',
    ]);
    // dann Ägyptisch
    expect(sorted.slice(7, 14).map((l) => l.id)).toEqual([
      'egyptian-0', 'egyptian-1', 'egyptian-2', 'egyptian-3', 'egyptian-4', 'egyptian-5', 'egyptian-6',
    ]);
    // dann Maghrebinisch, dann Levantinisch
    expect(sorted[14].id).toBe('maghrebi-0');
    expect(sorted[21].id).toBe('levantine-0');
    expect(sorted).toHaveLength(28);
  });

  it('ergänzt fehlende Gruppen aus einem unvollständigen/korrupten Order in Default-Reihenfolge, ohne Lektionen zu verlieren', () => {
    const lessons = makeDialectLessons();
    const incompleteOrder: DialectGroupId[] = ['egyptian'];
    const sorted = sortDialectLessons(lessons, incompleteOrder);

    expect(sorted).toHaveLength(28);
    expect(sorted.slice(0, 7).map((l) => l.id)).toEqual([
      'egyptian-0', 'egyptian-1', 'egyptian-2', 'egyptian-3', 'egyptian-4', 'egyptian-5', 'egyptian-6',
    ]);
    // Rest in Default-Reihenfolge angehängt
    expect(sorted[7].id).toBe('maghrebi-0');
    expect(sorted[14].id).toBe('levantine-0');
    expect(sorted[21].id).toBe('gulf-0');
  });

  it('dedupliziert wiederholte Gruppen-IDs im Order (nur der erste Treffer zählt)', () => {
    const lessons = makeDialectLessons();
    const order: DialectGroupId[] = ['levantine', 'levantine', 'maghrebi', 'gulf', 'egyptian'];
    const sorted = sortDialectLessons(lessons, order);

    expect(sorted).toHaveLength(28);
    expect(sorted.slice(0, 7)[0].id).toBe('levantine-0');
    expect(sorted.slice(7, 14)[0].id).toBe('maghrebi-0');
  });

  it('funktioniert mit den echten dialects.json-Daten (4 Gruppen à 7 Lektionen)', () => {
    const lessons = (dialectsData as { lessons: Lesson[] }).lessons;
    expect(lessons).toHaveLength(28);

    const sorted = sortDialectLessons(lessons, ['egyptian', 'gulf', 'levantine', 'maghrebi']);
    expect(sorted).toHaveLength(28);
    // Erste Lektion der Ägyptisch-Gruppe (letzter Block in der Datei) steht jetzt vorn
    expect(sorted[0].id).toBe('dialects-04');
    // Maghrebinisch (erster Block in der Datei) steht jetzt zuletzt
    expect(sorted[21].id).toBe('dialects-01');
  });
});

describe('moveDialectGroup', () => {
  it('verschiebt eine Gruppe um eine Position nach oben', () => {
    const next = moveDialectGroup(DEFAULT_DIALECT_GROUP_ORDER, 'gulf', 'up');
    expect(next).toEqual(['maghrebi', 'gulf', 'levantine', 'egyptian']);
  });

  it('verschiebt eine Gruppe um eine Position nach unten', () => {
    const next = moveDialectGroup(DEFAULT_DIALECT_GROUP_ORDER, 'levantine', 'down');
    expect(next).toEqual(['maghrebi', 'gulf', 'levantine', 'egyptian']);
  });

  it('bleibt unverändert, wenn die erste Gruppe nach oben verschoben wird', () => {
    const next = moveDialectGroup(DEFAULT_DIALECT_GROUP_ORDER, 'maghrebi', 'up');
    expect(next).toEqual(DEFAULT_DIALECT_GROUP_ORDER);
  });

  it('bleibt unverändert, wenn die letzte Gruppe nach unten verschoben wird', () => {
    const next = moveDialectGroup(DEFAULT_DIALECT_GROUP_ORDER, 'egyptian', 'down');
    expect(next).toEqual(DEFAULT_DIALECT_GROUP_ORDER);
  });

  it('bleibt unverändert bei unbekannter Gruppen-ID', () => {
    const next = moveDialectGroup(DEFAULT_DIALECT_GROUP_ORDER, 'unknown' as DialectGroupId, 'up');
    expect(next).toEqual(DEFAULT_DIALECT_GROUP_ORDER);
  });

  it('gibt bei jedem Aufruf ein neues Array zurück (keine Mutation des Inputs)', () => {
    const original = [...DEFAULT_DIALECT_GROUP_ORDER];
    moveDialectGroup(DEFAULT_DIALECT_GROUP_ORDER, 'gulf', 'up');
    expect(DEFAULT_DIALECT_GROUP_ORDER).toEqual(original);
  });
});
