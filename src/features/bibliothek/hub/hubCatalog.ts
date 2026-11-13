import type { AudiobookBookEntry } from '@/features/audiobooks/data';
import type { Handout } from '@/features/handouts/data';
import { canonicalBibliothekReaderBookId } from '@/features/bibliothek/allinone/constants';
import { resolveReaderBook } from '@/features/bibliothek/readerBook';
import type { PdfLesefortschrittStore } from '@/features/bibliothek/pdfLesefortschritt';

export type HubSortKey = 'title' | 'author' | 'recent' | 'added';

export type HubReadStatus = 'unread' | 'in_progress' | 'finished';

export type HubReadFilter = 'all' | HubReadStatus;

export type HubOpenKind =
  | 'handout'
  | 'audiobook-pdf'
  | 'route-quran'
  | 'route-hadith'
  | 'route-audiobooks'
  | 'route-tafsir'
  | 'route-all-handouts';

export type HubCatalogItem = {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  lang?: string;
  categoryKey: string;
  categoryTitle: string;
  description?: string;
  pages?: number;
  recentAt?: string;
  addedAt?: string;
  readPercent?: number;
  readStatus: HubReadStatus;
  offline: boolean;
  openKind: HubOpenKind;
  handoutId?: string;
  audiobookPdf?: { pdfUrl: string; displayTitle: string };
};

export type HubCategorySection = {
  key: string;
  title: string;
  items: HubCatalogItem[];
};

export type HubCatalogFilters = {
  lang: string | null;
  categoryKey: string | null;
  offlineOnly: boolean;
  read: HubReadFilter;
  query: string;
};

const FINISHED_PERCENT = 95;
const SHORTCUTS_KEY = '__shortcuts__';
const AUDIOBOOKS_KEY = '__audiobooks__';

function normalizeSearch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function readStatusForHandout(
  handoutId: string,
  store: PdfLesefortschrittStore,
): { status: HubReadStatus; percent?: number; recentAt?: string } {
  const canonical = canonicalBibliothekReaderBookId(handoutId);
  const entry = store[canonical] ?? store[handoutId];
  if (!entry) return { status: 'unread' };
  const config = resolveReaderBook(handoutId);
  const totalPages = config?.chapters.at(-1)?.endPage ?? 0;
  const percent =
    totalPages > 0
      ? Math.min(100, Math.max(0, Math.round((entry.page / totalPages) * 100)))
      : entry.page > 1
        ? 1
        : 0;
  const status: HubReadStatus = percent >= FINISHED_PERCENT ? 'finished' : 'in_progress';
  return { status, percent, recentAt: entry.updatedAt };
}

function handoutToItem(
  h: Handout,
  store: PdfLesefortschrittStore,
  downloaded: ReadonlySet<string>,
  manifestReviewedAt?: Readonly<Record<string, string>>,
): HubCatalogItem {
  const categoryKey = h.category?.trim() || '__default__';
  const categoryTitle = h.category_title?.trim() || h.category?.trim() || '';
  const author = h.rightsHolder?.trim() || undefined;
  const read = readStatusForHandout(h.id, store);
  return {
    id: `handout:${h.id}`,
    title: h.title,
    subtitle: h.description,
    author,
    lang: h.lang?.trim() || undefined,
    categoryKey,
    categoryTitle,
    description: h.description,
    pages: h.pages,
    recentAt: read.recentAt,
    addedAt: manifestReviewedAt?.[h.id],
    readPercent: read.percent,
    readStatus: read.status,
    offline: downloaded.has(h.id),
    openKind: 'handout',
    handoutId: h.id,
  };
}

function audiobookToItem(
  b: AudiobookBookEntry,
  label: string,
  sectionTitle: string,
): HubCatalogItem {
  return {
    id: `audiobook:${b.track}`,
    title: label,
    subtitle: b.title,
    categoryKey: AUDIOBOOKS_KEY,
    categoryTitle: sectionTitle,
    readStatus: 'unread',
    offline: false,
    openKind: 'audiobook-pdf',
    audiobookPdf: { pdfUrl: b.pdf_url, displayTitle: label },
  };
}

export function buildHubCatalogItems(input: {
  handouts: readonly Handout[];
  audiobooks: readonly AudiobookBookEntry[];
  pdfProgress: PdfLesefortschrittStore;
  downloadedIds: ReadonlySet<string>;
  shortcuts: {
    sectionTitle: string;
    quranTitle: string;
    quranNote: string;
    hadithTitle: string;
    hadithNote: string;
    audioTitle: string;
    audioNote: string;
    tafsirTitle: string;
    tafsirNote: string;
    tafsirAuthor?: string;
    allHandoutsTitle: string;
    allHandoutsNote: string;
  };
  audiobookSectionTitle: string;
  audiobookLabels: Readonly<Record<string, string>>;
  manifestReviewedAt?: Readonly<Record<string, string>>;
}): HubCatalogItem[] {
  const items: HubCatalogItem[] = [];

  const st = input.shortcuts;
  items.push(
    {
      id: 'shortcut:quran',
      title: st.quranTitle,
      subtitle: st.quranNote,
      categoryKey: SHORTCUTS_KEY,
      categoryTitle: st.sectionTitle,
      readStatus: 'unread',
      offline: false,
      openKind: 'route-quran',
    },
    {
      id: 'shortcut:hadith',
      title: st.hadithTitle,
      subtitle: st.hadithNote,
      categoryKey: SHORTCUTS_KEY,
      categoryTitle: st.sectionTitle,
      readStatus: 'unread',
      offline: false,
      openKind: 'route-hadith',
    },
    {
      id: 'shortcut:audiobooks',
      title: st.audioTitle,
      subtitle: st.audioNote,
      categoryKey: SHORTCUTS_KEY,
      categoryTitle: st.sectionTitle,
      readStatus: 'unread',
      offline: false,
      openKind: 'route-audiobooks',
    },
    {
      id: 'shortcut:tafsir',
      title: st.tafsirTitle,
      subtitle: st.tafsirNote,
      author: st.tafsirAuthor,
      lang: 'de',
      categoryKey: SHORTCUTS_KEY,
      categoryTitle: st.sectionTitle,
      readStatus: 'unread',
      offline: false,
      openKind: 'route-tafsir',
    },
    {
      id: 'shortcut:all-handouts',
      title: st.allHandoutsTitle,
      subtitle: st.allHandoutsNote,
      categoryKey: SHORTCUTS_KEY,
      categoryTitle: st.sectionTitle,
      readStatus: 'unread',
      offline: false,
      openKind: 'route-all-handouts',
    },
  );

  for (const h of input.handouts) {
    items.push(handoutToItem(h, input.pdfProgress, input.downloadedIds, input.manifestReviewedAt));
  }

  for (const b of input.audiobooks) {
    const label = input.audiobookLabels[b.track] ?? b.title;
    items.push(audiobookToItem(b, label, input.audiobookSectionTitle));
  }

  return items;
}

export function hubCatalogLanguages(items: readonly HubCatalogItem[]): string[] {
  const langs = new Set<string>();
  for (const it of items) {
    if (it.lang?.trim()) langs.add(it.lang.trim());
  }
  return [...langs].sort();
}

export function hubCatalogCategories(items: readonly HubCatalogItem[]): { key: string; title: string }[] {
  const order: string[] = [];
  const map = new Map<string, string>();
  for (const it of items) {
    if (!map.has(it.categoryKey)) {
      map.set(it.categoryKey, it.categoryTitle);
      order.push(it.categoryKey);
    }
  }
  return order.map((key) => ({ key, title: map.get(key) ?? key }));
}

export function hubHasOfflineItems(items: readonly HubCatalogItem[]): boolean {
  return items.some((it) => it.offline);
}

export function hubHasReadProgress(items: readonly HubCatalogItem[]): boolean {
  return items.some((it) => it.readStatus !== 'unread');
}

export function filterHubCatalogItems(
  items: readonly HubCatalogItem[],
  filters: HubCatalogFilters,
): HubCatalogItem[] {
  let out = items;

  if (filters.lang) {
    out = out.filter((it) => it.lang === filters.lang || it.categoryKey === SHORTCUTS_KEY);
  }
  if (filters.categoryKey) {
    out = out.filter((it) => it.categoryKey === filters.categoryKey);
  }
  if (filters.offlineOnly) {
    out = out.filter((it) => it.offline);
  }
  if (filters.read !== 'all') {
    out = out.filter((it) => it.readStatus === filters.read);
  }

  const q = normalizeSearch(filters.query);
  if (q) {
    out = out.filter((it) => {
      const hay = normalizeSearch(
        [it.title, it.subtitle, it.description, it.author, it.categoryTitle].filter(Boolean).join(' '),
      );
      return hay.includes(q);
    });
  }

  return [...out];
}

export function sortHubCatalogItems(items: readonly HubCatalogItem[], sort: HubSortKey): HubCatalogItem[] {
  const list = [...items];
  const cmp = (a: HubCatalogItem, b: HubCatalogItem): number => {
    if (sort === 'recent') {
      const at = a.recentAt ?? '';
      const bt = b.recentAt ?? '';
      if (at !== bt) return bt.localeCompare(at);
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    }
    if (sort === 'added') {
      const at = a.addedAt ?? '';
      const bt = b.addedAt ?? '';
      if (at !== bt) return bt.localeCompare(at);
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    }
    if (sort === 'author') {
      const aa = (a.author ?? '\uffff').localeCompare(b.author ?? '\uffff', undefined, { sensitivity: 'base' });
      if (aa !== 0) return aa;
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  };
  list.sort(cmp);
  return list;
}

/** Behält Erst-Reihenfolge der Kategorien; leere Kategorien werden ausgelassen. */
export function groupHubCatalogByCategory(
  items: readonly HubCatalogItem[],
  categoryOrder: readonly { key: string; title: string }[],
): HubCategorySection[] {
  const byKey = new Map<string, HubCatalogItem[]>();
  for (const it of items) {
    const list = byKey.get(it.categoryKey);
    if (list) list.push(it);
    else byKey.set(it.categoryKey, [it]);
  }
  const sections: HubCategorySection[] = [];
  for (const { key, title } of categoryOrder) {
    const sectionItems = byKey.get(key);
    if (!sectionItems?.length) continue;
    sections.push({ key, title, items: sectionItems });
  }
  return sections;
}

export function hubShelfOfflineItems(items: readonly HubCatalogItem[], limit = 12): HubCatalogItem[] {
  return sortHubCatalogItems(
    items.filter((it) => it.offline && it.openKind === 'handout'),
    'title',
  ).slice(0, limit);
}

export function hubShelfRecentlyAdded(items: readonly HubCatalogItem[], limit = 8): HubCatalogItem[] {
  const withDate = items.filter((it) => it.openKind === 'handout' && it.addedAt);
  if (withDate.length === 0) return [];
  return sortHubCatalogItems(withDate, 'added').slice(0, limit);
}

