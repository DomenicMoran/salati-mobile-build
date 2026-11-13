import type { Handout } from '@/features/handouts/data';
import type { AudiobookBookEntry } from '@/features/audiobooks/data';

import {
  audiobookBooksForBibliothekHub,
  bibliothekListMergeMap,
  handoutsForBibliothekHub,
  isSalatiLernbuchPart,
  SALATI_ISLAM_LERNWERK_ID,
  SALATI_LERNBUCH_ID,
  SALATI_LERNBUCH_PART_IDS,
} from './catalog';

function handout(id: string): Handout {
  return {
    id,
    title: id,
    category: 'x',
    category_title: 'X',
    pdf_url: `https://example.com/${id}.pdf`,
  };
}

describe('catalog / BL-P1-001', () => {
  it('marks all configured lernbuch parts', () => {
    expect(SALATI_LERNBUCH_PART_IDS).toContain('grammatik');
    expect(isSalatiLernbuchPart('grammatik')).toBe(true);
    expect(isSalatiLernbuchPart(SALATI_LERNBUCH_ID)).toBe(false);
  });

  it('collapses handout list to sammelband + non-parts', () => {
    const all = [handout('salati-lernbuch'), handout('grammatik'), handout('lesen-lernen')];
    const hub = handoutsForBibliothekHub(all);
    expect(hub.map((h) => h.id)).toEqual([SALATI_LERNBUCH_ID]);
  });

  it('keeps orphan handouts that are not lernbuch parts', () => {
    const all = [handout('salati-lernbuch'), handout('custom-only')];
    const hub = handoutsForBibliothekHub(all);
    expect(hub.map((h) => h.id)).toEqual([SALATI_LERNBUCH_ID, 'custom-only']);
  });

  it('prefers All-in-One over legacy lernbuch in hub', () => {
    const all = [
      handout(SALATI_LERNBUCH_ID),
      handout(SALATI_ISLAM_LERNWERK_ID),
      handout('grammatik'),
    ];
    const hub = handoutsForBibliothekHub(all);
    expect(hub.map((h) => h.id)).toEqual([SALATI_ISLAM_LERNWERK_ID]);
  });

  it('hides linked audiobook PDFs from bibliothek hub', () => {
    const books: AudiobookBookEntry[] = [
      { track: 'grammatik-hoerbuch', trackLabelKey: 'k', title: 'G', pdf_url: 'https://a.pdf' },
      { track: 'pflichtwissen', trackLabelKey: 'p', title: 'P', pdf_url: 'https://b.pdf' },
      { track: 'other', trackLabelKey: 'o', title: 'O', pdf_url: 'https://c.pdf' },
    ];
    expect(audiobookBooksForBibliothekHub(books).map((b) => b.track)).toEqual(['other']);
  });

  it('exports merge map for audit dokumentation', () => {
    const map = bibliothekListMergeMap();
    expect(
      map.some((r) => r.from === 'handout:grammatik' && r.to === `handout:${SALATI_ISLAM_LERNWERK_ID}`),
    ).toBe(true);
    expect(map.some((r) => r.from === 'audiobook-pdf:pflichtwissen')).toBe(true);
  });

  it('hub shows at most one komplett even when live index lists two', () => {
    const komplett = (id: string): Handout => ({ ...handout(id), category: 'komplett' });
    const all = [komplett(SALATI_LERNBUCH_ID), komplett(SALATI_ISLAM_LERNWERK_ID), handout('grammatik')];
    const hub = handoutsForBibliothekHub(all);
    const komplettInHub = hub.filter(
      (h) => h.id === SALATI_ISLAM_LERNWERK_ID || h.id === SALATI_LERNBUCH_ID,
    );
    expect(komplettInHub).toHaveLength(1);
    expect(komplettInHub[0]?.id).toBe(SALATI_ISLAM_LERNWERK_ID);
  });
});
