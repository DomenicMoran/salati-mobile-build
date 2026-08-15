import {
  computeStreak,
  computeStreakWithJoker,
  MAX_PRACTICE_DAYS,
  parsePracticeDays,
  previousDay,
  toDayString,
  updatePracticeDays,
} from './streak';

describe('toDayString / previousDay', () => {
  it('formatiert lokale Kalendertage mit führenden Nullen', () => {
    expect(toDayString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDayString(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('previousDay geht über Monats- und Jahresgrenzen', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(previousDay('2026-07-17')).toBe('2026-07-16');
  });
});

describe('computeStreak', () => {
  const today = '2026-07-17';

  it('0 ohne Übungstage', () => {
    expect(computeStreak([], today)).toBe(0);
  });

  it('1 wenn nur heute geübt wurde', () => {
    expect(computeStreak(['2026-07-17'], today)).toBe(1);
  });

  it('zählt aufeinanderfolgende Tage bis heute', () => {
    expect(computeStreak(['2026-07-15', '2026-07-16', '2026-07-17'], today)).toBe(3);
  });

  it('Lücke unterbricht die Serie', () => {
    expect(computeStreak(['2026-07-13', '2026-07-16', '2026-07-17'], today)).toBe(2);
  });

  it('Serie darf gestern enden (heute noch nicht geübt)', () => {
    expect(computeStreak(['2026-07-15', '2026-07-16'], today)).toBe(2);
  });

  it('0 wenn zuletzt vorgestern geübt wurde', () => {
    expect(computeStreak(['2026-07-14', '2026-07-15'], today)).toBe(0);
  });

  it('Reihenfolge der Eingabe ist egal', () => {
    expect(computeStreak(['2026-07-17', '2026-07-15', '2026-07-16'], today)).toBe(3);
  });
});

describe('computeStreakWithJoker', () => {
  const today = '2026-07-17';

  /** Baut Tages-Strings für gegebene Offsets rückwärts ab `today` (0 = heute). */
  function offsetDays(offsets: number[]): string[] {
    const maxOffset = Math.max(...offsets);
    const byOffset: string[] = [today];
    let cursor = today;
    for (let i = 1; i <= maxOffset; i++) {
      cursor = previousDay(cursor);
      byOffset.push(cursor);
    }
    return offsets.map((o) => byOffset[o]);
  }

  it('verhält sich wie computeStreak ohne Joker (jokersPerWeek 0)', () => {
    const days = ['2026-07-15', '2026-07-16', '2026-07-17'];
    expect(computeStreakWithJoker(days, today, 0)).toEqual({ streak: 3, jokersUsed: 0 });
    expect(computeStreak(days, today)).toBe(3);
  });

  it('0 Tage -> 0 Streak, kein Joker verbraucht', () => {
    expect(computeStreakWithJoker([], today)).toEqual({ streak: 0, jokersUsed: 0 });
  });

  it('überbrückt genau eine Gedenklücke von einem Tag', () => {
    // heute + vorgestern geübt, gestern (offset 1) fehlt -> 1 Joker verbrückt sie
    const days = offsetDays([0, 2]);
    expect(computeStreakWithJoker(days, today)).toEqual({ streak: 3, jokersUsed: 1 });
  });

  it('bricht trotz Joker bei zwei aufeinanderfolgenden Lücken (nur 1 Joker verfügbar)', () => {
    // offset 0 geübt, offset 1+2 fehlen (2 Tage Lücke), offset 3 geübt (unerreichbar)
    const days = offsetDays([0, 3]);
    const result = computeStreakWithJoker(days, today);
    expect(result.jokersUsed).toBe(1);
    expect(result.streak).toBe(2); // offset 0 + der eine überbrückte Tag, dann Abbruch
  });

  it('lädt den Joker nach 7 tatsächlich geübten Tagen wieder auf', () => {
    // Lücken bei offset 1 und offset 9, dazwischen 7 durchgehend geübte Tage
    const days = offsetDays([0, 2, 3, 4, 5, 6, 7, 8, 10]);
    expect(computeStreakWithJoker(days, today)).toEqual({ streak: 11, jokersUsed: 2 });
  });

  it('zweite Lücke bricht die Serie, wenn der Joker noch nicht wieder aufgeladen ist', () => {
    // Lücke bei offset 1 (Joker verbraucht), dann nur 3 geübte Tage (offset 2-4),
    // dann Lücke bei offset 5 -> Joker ist noch nicht wieder verfügbar (erst nach 7)
    const days = offsetDays([0, 2, 3, 4]);
    const result = computeStreakWithJoker(days, today);
    expect(result.jokersUsed).toBe(1);
    expect(result.streak).toBe(5); // offset 0, überbrückter offset 1, offset 2-4
  });
});

describe('updatePracticeDays', () => {
  const noon = new Date(2026, 6, 17, 12).getTime(); // lokal 2026-07-17

  it('trägt heute ein, wenn plays seit letztem Fokus gestiegen sind', () => {
    const result = updatePracticeDays([], { letters: { plays: 3, lastPlayedAt: noon } }, 2, noon);
    expect(result.days).toContain('2026-07-17');
    expect(result.playsTotal).toBe(3);
    expect(result.changed).toBe(true);
  });

  it('trägt heute NICHT ein, wenn plays unverändert sind und kein lastPlayedAt heute liegt', () => {
    const yesterday = new Date(2026, 6, 16, 9).getTime();
    const result = updatePracticeDays(['2026-07-16'], { letters: { plays: 2, lastPlayedAt: yesterday } }, 2, noon);
    expect(result.days).toEqual(['2026-07-16']);
    expect(result.changed).toBe(false);
  });

  it('mischt lastPlayedAt-Tage als Untergrenze ein (Erst-Migration, storedTotal null)', () => {
    const monday = new Date(2026, 6, 13, 20).getTime();
    const result = updatePracticeDays([], { words: { plays: 5, lastPlayedAt: monday } }, null, noon);
    expect(result.days).toEqual(['2026-07-13']);
    expect(result.playsTotal).toBe(5);
    expect(result.changed).toBe(true);
  });

  it('dedupliziert Tage und sortiert aufsteigend', () => {
    const result = updatePracticeDays(
      ['2026-07-17', '2026-07-15'],
      { letters: { plays: 1, lastPlayedAt: noon } },
      1,
      noon,
    );
    expect(result.days).toEqual(['2026-07-15', '2026-07-17']);
  });

  it('deckelt auf die neuesten MAX_PRACTICE_DAYS Einträge', () => {
    const many: string[] = [];
    const d = new Date(2024, 0, 1, 12);
    for (let i = 0; i < MAX_PRACTICE_DAYS + 10; i++) {
      many.push(toDayString(d));
      d.setDate(d.getDate() + 1);
    }
    const result = updatePracticeDays(many, {}, 0, noon);
    expect(result.days).toHaveLength(MAX_PRACTICE_DAYS);
    // die ältesten fliegen raus, die neuesten bleiben
    expect(result.days[result.days.length - 1]).toBe(many[many.length - 1]);
    expect(result.days).not.toContain(many[0]);
  });

  it('ignoriert leere/defekte Stats-Einträge', () => {
    const result = updatePracticeDays([], { broken: undefined, empty: {} }, 0, noon);
    expect(result.days).toEqual([]);
    expect(result.playsTotal).toBe(0);
  });
});

describe('parsePracticeDays', () => {
  it('leere Liste bei null oder kaputtem JSON', () => {
    expect(parsePracticeDays(null)).toEqual([]);
    expect(parsePracticeDays('{nope')).toEqual([]);
    expect(parsePracticeDays('{"a":1}')).toEqual([]);
  });

  it('filtert Nicht-Strings heraus', () => {
    expect(parsePracticeDays('["2026-07-17", 5, null]')).toEqual(['2026-07-17']);
  });
});
