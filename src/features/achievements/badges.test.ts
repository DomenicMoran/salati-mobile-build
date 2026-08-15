import {
  BADGES,
  BOOKMARK_COLLECTIONS_THRESHOLD,
  EMPTY_ACHIEVEMENT_INPUTS,
  FASTING_TRACKER_THRESHOLD,
  HIFZ_EXPLORER_SURAHS_THRESHOLD,
  isBadgeUnlocked,
  longestConsecutiveRun,
  OFFLINE_AUDIO_THRESHOLD,
  SURAH_EXPLORER_THRESHOLD,
  unlockedBadgeCount,
  type AchievementInputs,
} from './badges';

import de from '@/locales/de.json';

describe('achievements/badges', () => {
  it('BADGES: eindeutige IDs, jede hat ein Icon', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    for (const b of BADGES) {
      expect(b.icon.length).toBeGreaterThan(0);
    }
  });

  // Der Abzeichen-Screen liest `achievements.badges.<id>.title/.desc`. Fehlt
  // der Eintrag, rendert `translate()` den ROHEN Schluessel — im UI stuende
  // dann woertlich "achievements.badges.courses-3.title". Die Locale-Parität
  // (lib/locales.test.ts) faengt das nicht: sie vergleicht die Sprachen
  // untereinander, nicht gegen die Badge-Liste im Code. Aufgefallen beim
  // Nachruesten der Kurs-Staffelung 2026-07-28.
  it('jede Badge-ID hat Titel und Beschreibung in de.json', () => {
    const labels = de.achievements.badges as Record<string, { title?: string; desc?: string }>;
    for (const b of BADGES) {
      expect(labels[b.id]?.title?.length ?? 0).toBeGreaterThan(0);
      expect(labels[b.id]?.desc?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('de.json enthaelt keine Beschriftung ohne zugehoerige Badge-ID', () => {
    const ids = new Set<string>(BADGES.map((b) => b.id));
    for (const key of Object.keys(de.achievements.badges)) {
      expect(ids.has(key)).toBe(true);
    }
  });

  it('nichts freigeschaltet ohne Fortschritt', () => {
    expect(unlockedBadgeCount(EMPTY_ACHIEVEMENT_INPUTS)).toBe(0);
    for (const b of BADGES) {
      expect(isBadgeUnlocked(b.id, EMPTY_ACHIEVEMENT_INPUTS)).toBe(false);
    }
  });

  it('alles freigeschaltet bei maximalem Fortschritt', () => {
    const max: AchievementInputs = {
      learnPassedCount: 999,
      firstSurahPassed: true,
      curriculumComplete: true,
      bestPracticeStreak: 999,
      bestPrayerStreak: 999,
      khatmahCompletedOnce: true,
      anyCourseComplete: true,
      coursesCompleteTotal: 999,
      coursesTotal: 999,
      grammarComplete: true,
      tajwidComplete: true,
      hifzKnownTotal: 999,
      bookmarksTotal: 999,
      quizPlaysTotal: 999,
      noteCount: 999,
      bookmarkCollectionsUsed: 999,
      hifzSurahsStarted: 999,
      offlineAudioSurahsTotal: 999,
      readSurahsTotal: 999,
      fastedDaysTotal: 999,
      reviewMaxLevelReached: true,
    };
    expect(unlockedBadgeCount(max)).toBe(BADGES.length);
  });

  it('streak-Abzeichen nutzen die beste jemals erreichte Serie mit korrekten Schwellen', () => {
    const at6: AchievementInputs = { ...EMPTY_ACHIEVEMENT_INPUTS, bestPracticeStreak: 6 };
    const at7: AchievementInputs = { ...EMPTY_ACHIEVEMENT_INPUTS, bestPracticeStreak: 7 };
    expect(isBadgeUnlocked('streak-7', at6)).toBe(false);
    expect(isBadgeUnlocked('streak-7', at7)).toBe(true);
    expect(isBadgeUnlocked('streak-30', { ...EMPTY_ACHIEVEMENT_INPUTS, bestPracticeStreak: 29 })).toBe(false);
    expect(isBadgeUnlocked('streak-30', { ...EMPTY_ACHIEVEMENT_INPUTS, bestPracticeStreak: 30 })).toBe(true);
    expect(isBadgeUnlocked('streak-100', { ...EMPTY_ACHIEVEMENT_INPUTS, bestPracticeStreak: 100 })).toBe(true);
  });

  it('hifz-Abzeichen zählen die Gesamtsumme bekannter Verse über alle Suren', () => {
    expect(isBadgeUnlocked('hifz-10', { ...EMPTY_ACHIEVEMENT_INPUTS, hifzKnownTotal: 9 })).toBe(false);
    expect(isBadgeUnlocked('hifz-10', { ...EMPTY_ACHIEVEMENT_INPUTS, hifzKnownTotal: 10 })).toBe(true);
    expect(isBadgeUnlocked('hifz-50', { ...EMPTY_ACHIEVEMENT_INPUTS, hifzKnownTotal: 50 })).toBe(true);
  });

  it('khatmah-complete bleibt unabhängig vom aktuellen Plan-Status (persistiertes "einmal geschafft")', () => {
    expect(isBadgeUnlocked('khatmah-complete', { ...EMPTY_ACHIEVEMENT_INPUTS, khatmahCompletedOnce: true })).toBe(
      true,
    );
    expect(isBadgeUnlocked('khatmah-complete', { ...EMPTY_ACHIEVEMENT_INPUTS, khatmahCompletedOnce: false })).toBe(
      false,
    );
  });

  it('course-complete/grammar-complete/tajwid-complete sind unabhängige Bedingungen', () => {
    const grammarOnly: AchievementInputs = { ...EMPTY_ACHIEVEMENT_INPUTS, grammarComplete: true };
    expect(isBadgeUnlocked('grammar-complete', grammarOnly)).toBe(true);
    expect(isBadgeUnlocked('tajwid-complete', grammarOnly)).toBe(false);
    // course-complete ist ein eigenes Feld ("irgendein Kurs komplett") - wird
    // vom Store separat gesetzt, nicht aus grammar/tajwid abgeleitet.
    expect(isBadgeUnlocked('course-complete', grammarOnly)).toBe(false);
  });

  it('courses-3/courses-all staffeln nach Anzahl abgeschlossener Kurse', () => {
    const mit = (fertig: number, gesamt: number): AchievementInputs => ({
      ...EMPTY_ACHIEVEMENT_INPUTS,
      coursesCompleteTotal: fertig,
      coursesTotal: gesamt,
    });
    expect(isBadgeUnlocked('courses-3', mit(2, 13))).toBe(false);
    expect(isBadgeUnlocked('courses-3', mit(3, 13))).toBe(true);
    expect(isBadgeUnlocked('courses-all', mit(12, 13))).toBe(false);
    expect(isBadgeUnlocked('courses-all', mit(13, 13))).toBe(true);
    // Der Nenner waechst mit jedem neuen Kurs: wer „alle" hatte, verliert das
    // Abzeichen wieder, bis auch der neue Kurs steht. Das ist gewollt — die
    // Alternative waere, „alle Kurse" fuer jemanden anzuzeigen, der einen
    // Kurs nicht angefasst hat.
    expect(isBadgeUnlocked('courses-all', mit(13, 14))).toBe(false);
    // Kurse noch nicht geladen: 0 von 0 darf NICHT als „alle" gelten.
    expect(isBadgeUnlocked('courses-all', mit(0, 0))).toBe(false);
  });

  describe('"Explorer"-Meilensteine (Nutzungs-Badges)', () => {
    it('note-first: schon bei der ersten persönlichen Notiz', () => {
      expect(isBadgeUnlocked('note-first', { ...EMPTY_ACHIEVEMENT_INPUTS, noteCount: 0 })).toBe(false);
      expect(isBadgeUnlocked('note-first', { ...EMPTY_ACHIEVEMENT_INPUTS, noteCount: 1 })).toBe(true);
    });

    it('bookmark-collections: erst wenn alle 3 Sammlungen genutzt wurden', () => {
      expect(
        isBadgeUnlocked('bookmark-collections', {
          ...EMPTY_ACHIEVEMENT_INPUTS,
          bookmarkCollectionsUsed: BOOKMARK_COLLECTIONS_THRESHOLD - 1,
        }),
      ).toBe(false);
      expect(
        isBadgeUnlocked('bookmark-collections', {
          ...EMPTY_ACHIEVEMENT_INPUTS,
          bookmarkCollectionsUsed: BOOKMARK_COLLECTIONS_THRESHOLD,
        }),
      ).toBe(true);
    });

    it('hifz-explorer: Breite (unterschiedliche Suren) statt Tiefe (bekannte Verse)', () => {
      expect(
        isBadgeUnlocked('hifz-explorer', {
          ...EMPTY_ACHIEVEMENT_INPUTS,
          hifzSurahsStarted: HIFZ_EXPLORER_SURAHS_THRESHOLD - 1,
        }),
      ).toBe(false);
      expect(
        isBadgeUnlocked('hifz-explorer', {
          ...EMPTY_ACHIEVEMENT_INPUTS,
          hifzSurahsStarted: HIFZ_EXPLORER_SURAHS_THRESHOLD,
        }),
      ).toBe(true);
    });

    it('offline-audio: Schwelle bei mehreren heruntergeladenen Suren', () => {
      expect(
        isBadgeUnlocked('offline-audio', {
          ...EMPTY_ACHIEVEMENT_INPUTS,
          offlineAudioSurahsTotal: OFFLINE_AUDIO_THRESHOLD - 1,
        }),
      ).toBe(false);
      expect(
        isBadgeUnlocked('offline-audio', {
          ...EMPTY_ACHIEVEMENT_INPUTS,
          offlineAudioSurahsTotal: OFFLINE_AUDIO_THRESHOLD,
        }),
      ).toBe(true);
    });

    it('surah-explorer: Schwelle bei unterschiedlichen Suren im Leseverlauf', () => {
      expect(
        isBadgeUnlocked('surah-explorer', {
          ...EMPTY_ACHIEVEMENT_INPUTS,
          readSurahsTotal: SURAH_EXPLORER_THRESHOLD - 1,
        }),
      ).toBe(false);
      expect(
        isBadgeUnlocked('surah-explorer', {
          ...EMPTY_ACHIEVEMENT_INPUTS,
          readSurahsTotal: SURAH_EXPLORER_THRESHOLD,
        }),
      ).toBe(true);
    });

    it('fasting-tracker: Schwelle bei getrackten Fastentagen', () => {
      expect(
        isBadgeUnlocked('fasting-tracker', {
          ...EMPTY_ACHIEVEMENT_INPUTS,
          fastedDaysTotal: FASTING_TRACKER_THRESHOLD - 1,
        }),
      ).toBe(false);
      expect(
        isBadgeUnlocked('fasting-tracker', {
          ...EMPTY_ACHIEVEMENT_INPUTS,
          fastedDaysTotal: FASTING_TRACKER_THRESHOLD,
        }),
      ).toBe(true);
    });

    it('review-master: reines Bool-Flag aus dem Wiederholungs-System', () => {
      expect(isBadgeUnlocked('review-master', { ...EMPTY_ACHIEVEMENT_INPUTS, reviewMaxLevelReached: false })).toBe(
        false,
      );
      expect(isBadgeUnlocked('review-master', { ...EMPTY_ACHIEVEMENT_INPUTS, reviewMaxLevelReached: true })).toBe(
        true,
      );
    });
  });

  describe('longestConsecutiveRun', () => {
    const isNext = (a: string, b: string) => {
      const da = new Date(`${a}T12:00:00`);
      da.setDate(da.getDate() + 1);
      return da.toISOString().slice(0, 10) === b;
    };

    it('leere Liste = 0', () => {
      expect(longestConsecutiveRun([], isNext)).toBe(0);
    });

    it('einzelner Tag = 1', () => {
      expect(longestConsecutiveRun(['2026-07-01'], isNext)).toBe(1);
    });

    it('lückenlose Serie', () => {
      const days = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'];
      expect(longestConsecutiveRun(days, isNext)).toBe(4);
    });

    it('bricht bei Lücke ab, findet trotzdem die längste Teilserie (auch nach dem aktuellen Ende)', () => {
      // 3 Tage Serie, Lücke, dann nur 2 Tage aktuell laufend — Bestwert bleibt 3,
      // obwohl die AKTUELLE Serie (am Ende der Liste) nur 2 wäre.
      const days = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-10', '2026-06-11'];
      expect(longestConsecutiveRun(days, isNext)).toBe(3);
    });

    it('unsortierte Duplikate werden vom Aufrufer dedupliziert erwartet (Funktion selbst sortiert nicht)', () => {
      // Bewusst dokumentiertes Verhalten: Funktion setzt sortierte Eingabe voraus.
      const days = ['2026-07-01', '2026-07-03', '2026-07-02'];
      expect(longestConsecutiveRun(days, isNext)).toBe(1);
    });
  });
});
