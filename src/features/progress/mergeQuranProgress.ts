import type { QuranBookmark, QuranNote, QuranProgress } from '@/features/quran/progress';

function bookmarkKey(b: QuranBookmark): string {
  return `${b.surah}:${b.ayah}`;
}

function noteKey(n: QuranNote): string {
  return `${n.surah}:${n.ayah}`;
}

/** Merge für Code-Sync: neueres updatedAt / createdAt gewinnt; Union von Lesezeichen und Notizen. */
export function mergeQuranProgress(local: QuranProgress, imported: QuranProgress): QuranProgress {
  const bookmarks = new Map<string, QuranBookmark>();
  for (const b of [...local.bookmarks, ...imported.bookmarks]) {
    const key = bookmarkKey(b);
    const prev = bookmarks.get(key);
    if (!prev || b.createdAt >= prev.createdAt) bookmarks.set(key, b);
  }

  const notes = new Map<string, QuranNote>();
  for (const n of [...local.notes, ...imported.notes]) {
    const key = noteKey(n);
    const prev = notes.get(key);
    if (!prev || n.updatedAt >= prev.updatedAt) notes.set(key, n);
  }

  const history = [...imported.history, ...local.history]
    .sort((a, b) => b.at - a.at)
    .filter(
      (entry, index, arr) => arr.findIndex((e) => e.surah === entry.surah) === index,
    )
    .slice(0, 15);

  let lastRead = local.lastRead;
  if (imported.lastRead) {
    if (!lastRead || imported.lastRead.updatedAt >= lastRead.updatedAt) {
      lastRead = imported.lastRead;
    }
  }

  return {
    bookmarks: [...bookmarks.values()],
    notes: [...notes.values()],
    history,
    lastRead,
  };
}
