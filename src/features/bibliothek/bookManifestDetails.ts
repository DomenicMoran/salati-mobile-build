import idxHandouts from '../../../idx-handouts.json';
import shippedBooksManifest from '@/features/bibliothek/manifest/shipped-books.manifest.json';
import { canonicalBibliothekReaderBookId } from '@/features/bibliothek/allinone/constants';
import type { ManifestItem } from '@/features/bibliothek/manifest/validateShippedBooksManifest';
import { effectiveBelegUrl } from '@/features/bibliothek/manifest/validateShippedBooksManifest';

export type BibliothekBookDetails = {
  bookId: string;
  title: string;
  author?: string;
  translator?: string;
  lang?: string;
  pages?: number;
  category?: string;
  sourceLink?: string;
  license?: string;
  licenseLink?: string;
  belegUrl?: string;
  edition?: string;
  description?: string;
};

type HandoutIdx = {
  id: string;
  title?: string;
  lang?: string;
  description?: string;
  pages?: number;
  license?: string;
  rightsHolder?: string;
  category_title?: string;
  category?: string;
};

const HANDOUT_BY_ID = new Map(
  ((idxHandouts as { handouts?: HandoutIdx[] }).handouts ?? []).map((h) => [h.id, h]),
);

function manifestItem(bookId: string): ManifestItem | undefined {
  return (shippedBooksManifest.items as ManifestItem[]).find((i) => i.id === bookId);
}

function parseTranslator(rightsHolder?: string): string | undefined {
  if (!rightsHolder?.trim()) return undefined;
  const m = /translator\s+([^,)]+)/i.exec(rightsHolder);
  if (m?.[1]) return m[1].trim();
  return undefined;
}

function parseAuthor(rightsHolder?: string): string | undefined {
  if (!rightsHolder?.trim()) return undefined;
  if (/translator/i.test(rightsHolder)) return undefined;
  return rightsHolder.trim();
}

function inferLang(bookId: string, handout?: HandoutIdx, manifest?: ManifestItem): string | undefined {
  if (handout?.lang?.trim()) return handout.lang.trim();
  const m = /-(de|en|ar|tr|fr|es|id|ms|ur|fa|bn|ru|sw|ps)-/i.exec(bookId);
  if (m?.[1]) return m[1].toLowerCase();
  if (manifest?.title?.includes('Übersetzung') || bookId.includes('-de-')) return 'de';
  if (bookId.includes('-en-')) return 'en';
  if (bookId.includes('-ar-')) return 'ar';
  return undefined;
}

function inferEdition(title: string, notes?: string): string | undefined {
  const yearInTitle = /\((\d{4})(?:[^)]*)\)/.exec(title);
  if (yearInTitle?.[1]) return yearInTitle[1];
  if (notes?.trim()) {
    const y = /\b(19|20)\d{2}\b/.exec(notes);
    if (y?.[0]) return y[0];
  }
  return undefined;
}

function licenseDocUrl(sourceUrl?: string, beleg?: string | null): string | undefined {
  const src = sourceUrl?.trim() ?? '';
  if (src.startsWith('apps/') || src.startsWith('public/')) {
    return src.replace(/^apps\/mobile\//, '');
  }
  if (beleg?.startsWith('http://') || beleg?.startsWith('https://')) return undefined;
  return undefined;
}

/** R28: Metadaten aus Manifest + idx-handouts. */
export function resolveBibliothekBookDetails(bookId: string): BibliothekBookDetails | null {
  const id = canonicalBibliothekReaderBookId(bookId);
  if (!id) return null;
  const manifest = manifestItem(id);
  const handout = HANDOUT_BY_ID.get(id);
  const title = manifest?.title?.trim() || handout?.title?.trim() || id;
  const rights = manifest?.rightsHolder?.trim() || handout?.rightsHolder?.trim();
  const beleg = effectiveBelegUrl(manifest ?? {});
  const sourceLink =
    beleg && (beleg.startsWith('http://') || beleg.startsWith('https://')) ? beleg : undefined;
  const license = manifest?.license?.trim() || manifest?.lizenz?.trim() || handout?.license?.trim();
  const licenseLink = licenseDocUrl(manifest?.sourceUrl, beleg);
  return {
    bookId: id,
    title,
    author: parseAuthor(rights),
    translator: parseTranslator(rights),
    lang: inferLang(id, handout, manifest),
    pages: manifest?.pages ?? handout?.pages,
    category: manifest?.category?.trim() || handout?.category_title?.trim() || handout?.category?.trim(),
    sourceLink: sourceLink ?? (beleg?.startsWith('http') ? beleg : undefined),
    license,
    licenseLink,
    belegUrl: beleg ?? undefined,
    edition: inferEdition(title, typeof manifest?.notes === 'string' ? manifest.notes : undefined),
    description: handout?.description?.trim(),
  };
}
