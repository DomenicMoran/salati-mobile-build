import type { Handout } from '@/features/handouts/data';
import type { AudiobookBookEntry } from '@/features/audiobooks/data';
import { SALATI_ISLAM_LERNWERK_ID } from '@/features/bibliothek/allinone/constants';

/** Kanonischer Listeneintrag für den Salati-Sammelband (BL-P1-001). */
export const SALATI_LERNBUCH_ID = 'salati-lernbuch';

/** All-in-One Reader-Hub-Einstieg (supersedes {@link SALATI_LERNBUCH_ID} when im Index). */
export { SALATI_ISLAM_LERNWERK_ID };

/**
 * Einzel-PDFs, die im Sammelband enthalten sind — weiter unter `/handouts`,
 * aber nicht doppelt in der Bibliothek-Hub-Liste.
 */
export const SALATI_LERNBUCH_PART_IDS: readonly string[] = [
  'lesen-lernen',
  'tadschwied',
  'grammatik',
  'madinah-arabisch',
  'alltags-arabisch',
  'dialekte',
  'wortschatz',
  'kurze-suren',
  'aqida',
  'namen-allahs',
  'duas',
  'akhlaq',
  'ehe-familie',
  'seerah',
  'propheten',
  'sahaba',
  'tabellen-sprache',
  'kurzfassung-sprache',
  'pruefung-sprache',
  'erste-schritte-lesen',
  'erste-schritte-kurzfassung',
  'fiqh-ibadat',
] as const;

const LERNBUCH_PART_SET = new Set<string>(SALATI_LERNBUCH_PART_IDS);

/** Thematische Sammlungen (Metadaten only — Teile bleiben eigene PDFs). */
export const BIBLIOTHEK_COLLECTIONS: Readonly<
  Record<string, { title: string; memberIds: readonly string[]; canonicalId: string }>
> = {
  'sammlung-arabisch-lesen': {
    title: 'Arabisch lesen',
    memberIds: ['erste-schritte-lesen', 'erste-schritte-kurzfassung', 'lesen-lernen'],
    canonicalId: 'erste-schritte-lesen',
  },
  'sammlung-sprache-quran': {
    title: 'Sprache des Qur’an',
    memberIds: ['kurzfassung-sprache', 'pruefung-sprache', 'tabellen-sprache', 'grammatik'],
    canonicalId: 'grammatik',
  },
};

/** Hörbuch-Spur → zugehöriges Handout (Edition PDF vs. Themen-PDF, D-003/D-004). */
export const AUDIOBOOK_TRACK_HANDOUT_ID: Readonly<Record<string, string>> = {
  'grammatik-hoerbuch': 'grammatik',
  pflichtwissen: SALATI_ISLAM_LERNWERK_ID,
};

export function isSalatiLernbuchPart(handoutId: string): boolean {
  return LERNBUCH_PART_SET.has(handoutId.trim());
}

/**
 * Handouts für den Bibliothek-Hub: ein Sammelband-Eintrag, keine Teil-Duplikate.
 * Vollständige Liste bleibt unter `/handouts`.
 */
export function handoutsForBibliothekHub(handouts: readonly Handout[]): Handout[] {
  const out: Handout[] = [];
  let lernwerk: Handout | undefined;
  let lernbuch: Handout | undefined;
  for (const h of handouts) {
    if (h.id === SALATI_ISLAM_LERNWERK_ID) {
      lernwerk = h;
      continue;
    }
    if (h.id === SALATI_LERNBUCH_ID) {
      lernbuch = h;
      continue;
    }
    if (isSalatiLernbuchPart(h.id)) continue;
    out.push(h);
  }
  const sammelband = lernwerk ?? lernbuch;
  if (sammelband) {
    return [sammelband, ...out];
  }
  return out;
}

/** Hub-Karten, die die Reader-Shell statt `/handouts/[id]` öffnen. */
export function isBibliothekReaderHubHandout(handoutId: string): boolean {
  const id = handoutId.trim();
  return id === SALATI_ISLAM_LERNWERK_ID || id === SALATI_LERNBUCH_ID;
}

/**
 * Hörbuch-PDF-Kacheln nicht im Bibliothek-Hub — gleicher Inhalt über Sammelband
 * bzw. `/audiobooks` (Audio + Buch-PDF dort).
 */
export function audiobookBooksForBibliothekHub(books: readonly AudiobookBookEntry[]): AudiobookBookEntry[] {
  return books.filter((b) => {
    const linked = AUDIOBOOK_TRACK_HANDOUT_ID[b.track];
    if (!linked) return true;
    return linked !== SALATI_ISLAM_LERNWERK_ID && !LERNBUCH_PART_SET.has(linked);
  });
}

/** Hilfsmapping alt → neu für Audit `zusammenfuehrung.md`. */
export function bibliothekListMergeMap(): readonly { from: string; to: string; note: string }[] {
  const rows: { from: string; to: string; note: string }[] = [];
  for (const id of SALATI_LERNBUCH_PART_IDS) {
    rows.push({
      from: `handout:${id}`,
      to: `handout:${SALATI_ISLAM_LERNWERK_ID}`,
      note: 'Listeneintrag Sammelband; Einzel-PDF unter /handouts',
    });
  }
  for (const [track, handoutId] of Object.entries(AUDIOBOOK_TRACK_HANDOUT_ID)) {
    rows.push({
      from: `audiobook-pdf:${track}`,
      to: `handout:${handoutId}`,
      note: 'Hub: Hörbuch unter /audiobooks; kein zweites PDF in /bibliothek',
    });
  }
  return rows;
}
