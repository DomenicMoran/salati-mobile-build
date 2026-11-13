/** Kanonische All-in-One bookId (Hub + Reader). */
export const SALATI_ISLAM_LERNWERK_ID = 'salati-islam-lernwerk';

/** Legacy All-in-One — nur Deep Links/Fortschritt; Hub nutzt {@link SALATI_ISLAM_LERNWERK_ID}. */
export const SALATI_LERNBUCH_LEGACY_ID = 'salati-lernbuch';

/** Alt-IDs → kanonische Reader-/Fortschritts-ID (Phase B). */
export const BIBLIOTHEK_READER_BOOK_ALIASES: Readonly<Record<string, string>> = {
  [SALATI_LERNBUCH_LEGACY_ID]: SALATI_ISLAM_LERNWERK_ID,
};

export function canonicalBibliothekReaderBookId(bookId: string): string {
  const id = bookId.trim();
  if (!id) return id;
  return BIBLIOTHEK_READER_BOOK_ALIASES[id] ?? id;
}
