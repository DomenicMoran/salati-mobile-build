export type PdfReaderTheme = 'day' | 'night' | 'sepia';
export type PdfScrollMode = 'page' | 'scroll';

export type PdfBridgeOutbound =
  | { type: 'load'; pdfUrl: string; page?: number; theme?: PdfReaderTheme; zoom?: number; scrollMode?: PdfScrollMode }
  | { type: 'goToPage'; page: number }
  | { type: 'search'; query: string }
  | { type: 'setTheme'; theme: PdfReaderTheme }
  | { type: 'setZoom'; zoom: number }
  | { type: 'setScrollMode'; mode: PdfScrollMode };

export type PdfOutlineItem = {
  title: string;
  depth: number;
};

export type PdfSearchMatch = {
  page: number;
  excerpt: string;
};

export type PdfBridgeInbound =
  | { type: 'ready'; page: number; pageCount: number; ttfpMs: number; shell?: boolean }
  | { type: 'pagechange'; page: number; pageCount: number }
  | { type: 'outline'; items: PdfOutlineItem[] }
  | { type: 'searchHit'; query: string; total: number; matches: PdfSearchMatch[] }
  | { type: 'textSelected'; page: number; text: string }
  | { type: 'error'; code: string; message: string };

const INBOUND_TYPES = new Set([
  'ready',
  'pagechange',
  'outline',
  'searchHit',
  'textSelected',
  'error',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseOutlineItems(raw: unknown): PdfOutlineItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PdfOutlineItem[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const title = asString(item.title);
    const depth = asNumber(item.depth);
    if (!title) continue;
    out.push({ title, depth: depth != null && depth >= 0 ? Math.floor(depth) : 0 });
  }
  return out;
}

function parseSearchMatches(raw: unknown): PdfSearchMatch[] {
  if (!Array.isArray(raw)) return [];
  const out: PdfSearchMatch[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const page = asNumber(item.page);
    const excerpt = asString(item.excerpt);
    if (page == null || page < 1 || !excerpt) continue;
    out.push({ page: Math.floor(page), excerpt });
  }
  return out;
}

/** Parst WebView-postMessage-Payloads — wirft nie, liefert null bei Müll (R34). */
export function parsePdfBridgeInbound(raw: string | null | undefined): PdfBridgeInbound | null {
  if (raw == null || raw.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const type = asString(parsed.type);
  if (!type || !INBOUND_TYPES.has(type)) return null;

  switch (type) {
    case 'ready':
    case 'pagechange': {
      const page = asNumber(parsed.page);
      const pageCount = asNumber(parsed.pageCount);
      if (page == null || pageCount == null || pageCount < 0 || page < 0) return null;
      if (type === 'ready') {
        const ttfpMs = asNumber(parsed.ttfpMs) ?? 0;
        return {
          type: 'ready',
          page: Math.floor(page),
          pageCount: Math.floor(pageCount),
          ttfpMs: Math.max(0, Math.floor(ttfpMs)),
          shell: parsed.shell === true,
        };
      }
      return {
        type: 'pagechange',
        page: Math.floor(page),
        pageCount: Math.floor(pageCount),
      };
    }
    case 'outline':
      return { type: 'outline', items: parseOutlineItems(parsed.items) };
    case 'searchHit': {
      const query = asString(parsed.query) ?? '';
      const total = asNumber(parsed.total);
      return {
        type: 'searchHit',
        query,
        total: total != null && total >= 0 ? Math.floor(total) : 0,
        matches: parseSearchMatches(parsed.matches),
      };
    }
    case 'textSelected': {
      const page = asNumber(parsed.page);
      const text = asString(parsed.text);
      if (page == null || page < 1 || !text) return null;
      return { type: 'textSelected', page: Math.floor(page), text };
    }
    case 'error': {
      const code = asString(parsed.code) ?? 'unknown';
      const message = asString(parsed.message) ?? '';
      return { type: 'error', code, message };
    }
    default:
      return null;
  }
}

export function serializePdfBridgeOutbound(message: PdfBridgeOutbound): string {
  return JSON.stringify(message);
}
