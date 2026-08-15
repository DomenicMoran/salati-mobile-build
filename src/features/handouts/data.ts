// Handout-Daten: gesammelte PDF-Lernunterlagen. Index + PDFs liegen OeFFENTLICH
// auf Cloudflare R2 und werden ueber eine einzige index.json geladen — kein
// Client noetig (gleiches Muster wie fetchVideoIndex/fetchPodcastIndex: nur
// `fetch`). Jede Unterlage gehoert per `category` in eine Gruppe (Section-
// Header `category_title`), analog zur Reihen-Gruppierung der Videos.
import { fetchJson } from '@/lib/fetchJson';

const HANDOUT_BASE = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/handouts';
export const HANDOUT_INDEX_URL = `${HANDOUT_BASE}/index.json`;

export interface Handout {
  id: string;
  title: string;
  category: string;
  category_title: string;
  description?: string;
  pdf_url: string;
  /** Dateigroesse in Kilobyte (Anzeige). */
  size_kb?: number;
  /** Seitenzahl (Anzeige). */
  pages?: number;
}

export interface HandoutIndex {
  handouts: Handout[];
}

export async function fetchHandoutIndex(): Promise<HandoutIndex> {
  const j = await fetchJson<HandoutIndex>(HANDOUT_INDEX_URL, {
    cache: 'no-cache',
    errorPrefix: 'handout_index',
  });
  j.handouts = j.handouts ?? [];
  return j;
}

export interface HandoutCategoryGroup {
  /** Kategorie-Kennung (`category`). */
  key: string;
  /** Section-Header-Text (`category_title`, faellt auf `category` zurueck). */
  title: string;
  handouts: Handout[];
}

/**
 * Gruppiert Unterlagen nach `category` in Erst-Auftritts-Reihenfolge. Der
 * Section-Header-Text kommt aus `category_title` (Fallback: `category`).
 */
export function groupHandoutsByCategory(handouts: Handout[]): HandoutCategoryGroup[] {
  const order: string[] = [];
  const map = new Map<string, HandoutCategoryGroup>();
  for (const h of handouts) {
    const key = h.category?.trim() || '__default__';
    let group = map.get(key);
    if (!group) {
      group = { key, title: h.category_title?.trim() || h.category?.trim() || '', handouts: [] };
      map.set(key, group);
      order.push(key);
    }
    group.handouts.push(h);
  }
  return order.map((k) => map.get(k)!);
}

/** Menschliche Groessenangabe aus Kilobyte (z. B. "820 KB", "1,4 MB"). */
export function formatSizeKb(sizeKb: number | undefined): string | null {
  if (!sizeKb || sizeKb <= 0) return null;
  if (sizeKb < 1024) return `${Math.round(sizeKb)} KB`;
  return `${(sizeKb / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Google-Docs-Viewer-URL — rendert eine oeffentliche PDF-URL im Android-
 *  System-WebView (der PDFs sonst nicht nativ darstellt). */
export function gviewUrl(pdfUrl: string): string {
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(pdfUrl)}`;
}
