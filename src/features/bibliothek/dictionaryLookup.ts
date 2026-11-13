const ARABIC_RE = /[؀-ۿ]/;

export type DictionaryLookupTarget =
  | { kind: 'lexicon'; query: string }
  | { kind: 'system'; query: string };

/** Erstes Wort/token aus Markierung (R33). */
export function pickDictionaryToken(selection: string): string | null {
  const trimmed = selection.trim();
  if (!trimmed) return null;
  const withoutPunct = trimmed.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  const chunk = withoutPunct.split(/\s+/).find(Boolean);
  return chunk?.trim() ? chunk.trim().slice(0, 120) : null;
}

export function containsArabicScript(text: string): boolean {
  return ARABIC_RE.test(text);
}

export function resolveDictionaryLookupTarget(selection: string): DictionaryLookupTarget | null {
  const token = pickDictionaryToken(selection);
  if (!token) return null;
  if (containsArabicScript(token)) {
    return { kind: 'lexicon', query: token };
  }
  return { kind: 'system', query: token };
}

/** System-Woerterbuch: plattformneutrales define-Suchformat (Web/Oeffnen). */
export function systemDictionarySearchUrl(query: string, locale = 'en'): string {
  const q = encodeURIComponent(query.trim());
  const lang = locale.trim().toLowerCase().slice(0, 2);
  if (lang === 'de') {
    return `https://www.duden.de/suchen/dudenonline/${q}`;
  }
  return `https://www.google.com/search?q=define+${q}`;
}
