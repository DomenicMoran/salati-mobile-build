import {
  completedDays,
  dayIndexForDate,
  daysBehind,
  isJourneyActive,
  isJourneyComplete,
  journeyStorageKey,
  parseJourneyProgress,
  toggleDay,
  type JourneyProgress,
} from './journeyProgress';
import { JOURNEYS } from './journeys';

describe('journey progress', () => {
  const progress7: JourneyProgress = { journeyId: 'sabrJourney', startDay: '2026-07-01', completed: {} };

  it('journeyStorageKey ist pro Reise eindeutig', () => {
    expect(journeyStorageKey('sabrJourney')).toBe('salatibox:journey:sabrJourney');
    expect(journeyStorageKey('sabrJourney')).not.toBe(journeyStorageKey('gratitudeJourney'));
  });

  it('dayIndexForDate: Start-Tag = Index 0, klemmt am Ende', () => {
    expect(dayIndexForDate(progress7, 7, '2026-07-01')).toBe(0);
    expect(dayIndexForDate(progress7, 7, '2026-07-04')).toBe(3);
    // weit nach Ende des Plans → geklemmt auf letzten Index
    expect(dayIndexForDate(progress7, 7, '2026-12-31')).toBe(6);
  });

  it('dayIndexForDate: Datum vor Start klemmt auf 0 (kein negativer Index)', () => {
    expect(dayIndexForDate(progress7, 7, '2026-06-20')).toBe(0);
  });

  it('daysBehind: kein Fortschritt am 4. Tag = 3 vergangene Tage Rückstand, alles erledigt = 0', () => {
    expect(daysBehind(progress7, 7, '2026-07-04')).toBe(3);
    // Am Starttag ist man nie im Rückstand
    expect(daysBehind(progress7, 7, '2026-07-01')).toBe(0);
    const some = { ...progress7, completed: { 0: true, 1: true, 2: true, 3: true } };
    expect(daysBehind(some, 7, '2026-07-04')).toBe(0);
  });

  it('toggleDay + completedDays', () => {
    const next = toggleDay(progress7, 2);
    expect(completedDays(next)).toBe(1);
    expect(next.completed[2]).toBe(true);
    const toggledBack = toggleDay(next, 2);
    expect(completedDays(toggledBack)).toBe(0);
  });

  it('isJourneyComplete: nur true, wenn ALLE Tage erledigt sind', () => {
    const half = { ...progress7, completed: { 0: true, 1: true } };
    expect(isJourneyComplete(half, 7)).toBe(false);
    const all = {
      ...progress7,
      completed: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, true])),
    };
    expect(isJourneyComplete(all, 7)).toBe(true);
    expect(isJourneyComplete(progress7, 0)).toBe(false);
  });

  it('isJourneyActive: gestartet+nicht fertig = aktiv, auch mit 0 erledigten Tagen', () => {
    expect(isJourneyActive(null, 7)).toBe(false);
    expect(isJourneyActive(progress7, 7)).toBe(true);
    const all = {
      ...progress7,
      completed: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, true])),
    };
    expect(isJourneyActive(all, 7)).toBe(false);
  });

  it('parseJourneyProgress: defensiv gegen kaputte/leere Eingaben', () => {
    expect(parseJourneyProgress(null)).toBeNull();
    expect(parseJourneyProgress('kaputt')).toBeNull();
    expect(parseJourneyProgress('{}')).toBeNull();
    const raw = JSON.stringify(progress7);
    expect(parseJourneyProgress(raw)).toEqual(progress7);
  });

  it('JOURNEYS: jede Reise hat mindestens einen Tag, jeder Tag mindestens einen Vers', () => {
    expect(JOURNEYS.length).toBeGreaterThanOrEqual(3);
    for (const journey of JOURNEYS) {
      expect(journey.days.length).toBeGreaterThan(0);
      for (const day of journey.days) {
        expect(day.verses.length).toBeGreaterThan(0);
        for (const verse of day.verses) {
          expect(verse.surah).toBeGreaterThan(0);
          expect(verse.ayah).toBeGreaterThan(0);
        }
      }
    }
  });

  it('JOURNEYS: alle Reise-Ids sind eindeutig', () => {
    const ids = JOURNEYS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
