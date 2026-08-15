import {
  getNoteText,
  isBookmarked,
  parseProgress,
  pushHistory,
  READ_HISTORY_MAX,
  setBookmarkLabel,
  setNoteText,
  toggleBookmark,
} from './progress';

describe('toggleBookmark', () => {
  it('fügt ein neues Lesezeichen vorne hinzu', () => {
    const result = toggleBookmark([], 2, 255, 1000);
    expect(result).toEqual([{ surah: 2, ayah: 255, createdAt: 1000 }]);
  });

  it('entfernt ein vorhandenes Lesezeichen', () => {
    const bookmarks = [{ surah: 2, ayah: 255, createdAt: 1000 }];
    expect(toggleBookmark(bookmarks, 2, 255)).toEqual([]);
  });

  it('lässt andere Lesezeichen unangetastet', () => {
    const bookmarks = [
      { surah: 1, ayah: 1, createdAt: 1 },
      { surah: 2, ayah: 255, createdAt: 2 },
    ];
    const result = toggleBookmark(bookmarks, 2, 255);
    expect(result).toEqual([{ surah: 1, ayah: 1, createdAt: 1 }]);
  });

  it('neuestes Lesezeichen steht vorne', () => {
    const result = toggleBookmark([{ surah: 1, ayah: 1, createdAt: 1 }], 112, 1, 99);
    expect(result[0]).toEqual({ surah: 112, ayah: 1, createdAt: 99 });
  });
});

describe('isBookmarked', () => {
  it('unterscheidet Sure und Vers', () => {
    const bookmarks = [{ surah: 2, ayah: 255, createdAt: 1 }];
    expect(isBookmarked(bookmarks, 2, 255)).toBe(true);
    expect(isBookmarked(bookmarks, 2, 254)).toBe(false);
    expect(isBookmarked(bookmarks, 3, 255)).toBe(false);
  });
});

describe('getNoteText / setNoteText', () => {
  it('liefert leeren String, wenn keine Notiz existiert', () => {
    expect(getNoteText([], 2, 255)).toBe('');
  });

  it('legt eine neue Notiz an', () => {
    const notes = setNoteText([], 2, 255, 'Lieblingsvers', 1000);
    expect(notes).toEqual([{ surah: 2, ayah: 255, text: 'Lieblingsvers', updatedAt: 1000 }]);
    expect(getNoteText(notes, 2, 255)).toBe('Lieblingsvers');
  });

  it('aktualisiert eine bestehende Notiz statt eine zweite anzulegen', () => {
    const first = setNoteText([], 2, 255, 'Erster Text', 1000);
    const second = setNoteText(first, 2, 255, 'Geänderter Text', 2000);
    expect(second).toEqual([{ surah: 2, ayah: 255, text: 'Geänderter Text', updatedAt: 2000 }]);
  });

  it('löscht die Notiz bei leerem Text', () => {
    const withNote = setNoteText([], 2, 255, 'Text', 1000);
    expect(setNoteText(withNote, 2, 255, '', 2000)).toEqual([]);
  });

  it('löscht die Notiz auch bei reinem Whitespace-Text', () => {
    const withNote = setNoteText([], 2, 255, 'Text', 1000);
    expect(setNoteText(withNote, 2, 255, '   ', 2000)).toEqual([]);
  });

  it('lässt Notizen zu anderen Versen unangetastet', () => {
    const notes = setNoteText([{ surah: 1, ayah: 1, text: 'A', updatedAt: 1 }], 2, 255, 'B', 2);
    expect(notes).toContainEqual({ surah: 1, ayah: 1, text: 'A', updatedAt: 1 });
    expect(getNoteText(notes, 2, 255)).toBe('B');
  });
});

describe('parseProgress', () => {
  it('liefert leeren Zustand bei null', () => {
    expect(parseProgress(null)).toEqual({ bookmarks: [], lastRead: null, notes: [], history: [] });
  });

  it('liefert leeren Zustand bei kaputtem JSON', () => {
    expect(parseProgress('{nope')).toEqual({ bookmarks: [], lastRead: null, notes: [], history: [] });
  });

  it('parst gespeicherten Fortschritt inkl. Notizen und Verlauf', () => {
    const raw = JSON.stringify({
      bookmarks: [{ surah: 18, ayah: 10, createdAt: 5 }],
      lastRead: { surah: 18, ayah: 10, updatedAt: 6 },
      notes: [{ surah: 18, ayah: 10, text: 'Wichtig', updatedAt: 7 }],
      history: [{ surah: 18, ayah: 10, at: 6 }],
    });
    expect(parseProgress(raw)).toEqual({
      bookmarks: [{ surah: 18, ayah: 10, createdAt: 5 }],
      lastRead: { surah: 18, ayah: 10, updatedAt: 6 },
      notes: [{ surah: 18, ayah: 10, text: 'Wichtig', updatedAt: 7 }],
      history: [{ surah: 18, ayah: 10, at: 6 }],
    });
  });

  it('toleriert fehlende Felder', () => {
    expect(parseProgress('{}')).toEqual({ bookmarks: [], lastRead: null, notes: [], history: [] });
  });

  it('alte Speicherstände ohne history-Feld ergeben leeren Verlauf (Back-Compat)', () => {
    const raw = JSON.stringify({ bookmarks: [], lastRead: { surah: 2, ayah: 5, updatedAt: 1 }, notes: [] });
    expect(parseProgress(raw).history).toEqual([]);
  });
});

describe('pushHistory', () => {
  it('legt den neuesten Eintrag vorne ab', () => {
    const h1 = pushHistory([], 2, 10, 100);
    const h2 = pushHistory(h1, 18, 1, 200);
    expect(h2).toEqual([
      { surah: 18, ayah: 1, at: 200 },
      { surah: 2, ayah: 10, at: 100 },
    ]);
  });

  it('dedupliziert pro Sure: erneutes Lesen schiebt nach vorn und aktualisiert die Ayah', () => {
    const h1 = pushHistory([], 2, 10, 100);
    const h2 = pushHistory(h1, 18, 1, 200);
    const h3 = pushHistory(h2, 2, 255, 300);
    expect(h3).toEqual([
      { surah: 2, ayah: 255, at: 300 },
      { surah: 18, ayah: 1, at: 200 },
    ]);
  });

  it('deckelt bei READ_HISTORY_MAX Einträgen (älteste fliegen raus)', () => {
    let history = [] as ReturnType<typeof pushHistory>;
    for (let s = 1; s <= READ_HISTORY_MAX + 3; s++) {
      history = pushHistory(history, s, 1, s);
    }
    expect(history).toHaveLength(READ_HISTORY_MAX);
    expect(history[0].surah).toBe(READ_HISTORY_MAX + 3);
    expect(history.some((h) => h.surah === 1)).toBe(false);
    expect(history.some((h) => h.surah === 2)).toBe(false);
    expect(history.some((h) => h.surah === 3)).toBe(false);
  });
});

describe('setBookmarkLabel', () => {
  const base = [
    { surah: 2, ayah: 153, createdAt: 1 },
    { surah: 1, ayah: 1, createdAt: 2 },
  ];

  it('setzt eine Sammlung nur auf dem Ziel-Lesezeichen', () => {
    const next = setBookmarkLabel(base, 2, 153, 'memorize');
    expect(next[0].label).toBe('memorize');
    expect(next[1].label).toBeUndefined();
  });

  it('null entfernt die Sammlung wieder (Feld verschwindet)', () => {
    const withLabel = setBookmarkLabel(base, 2, 153, 'favorite');
    const cleared = setBookmarkLabel(withLabel, 2, 153, null);
    expect('label' in cleared[0]).toBe(false);
  });

  it('alte Lesezeichen ohne label-Feld überleben parseProgress', () => {
    const parsed = parseProgress(JSON.stringify({ bookmarks: base, lastRead: null, notes: [] }));
    expect(parsed.bookmarks).toHaveLength(2);
    expect(parsed.bookmarks[0].label).toBeUndefined();
  });
});
