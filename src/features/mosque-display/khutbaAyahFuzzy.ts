/** Fuzzy-Vergleich Khutba-Zeile ↔ vorhandener Koranvers (kein generierter Text). */

export function normalizeAyahToken(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function fuzzyAyahScore(line: string, ayahText: string): number {
  const a = normalizeAyahToken(line);
  const b = normalizeAyahToken(ayahText);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 1;
  const ta = new Set(a.split(' ').filter((w) => w.length > 2));
  const tb = new Set(b.split(' ').filter((w) => w.length > 2));
  let overlap = 0;
  for (const w of ta) if (tb.has(w)) overlap += 1;
  return overlap / Math.max(ta.size, tb.size, 1);
}

export function bestAyahMatch(
  line: string,
  corpus: { surah: number; ayah: number; text: string }[],
  threshold = 0.45,
): { surah: number; ayah: number; score: number } | null {
  let best: { surah: number; ayah: number; score: number } | null = null;
  for (const v of corpus) {
    const score = fuzzyAyahScore(line, v.text);
    if (score >= threshold && (!best || score > best.score)) {
      best = { surah: v.surah, ayah: v.ayah, score };
    }
  }
  return best;
}

export function khutbaAyahDeepLink(hit: { surah: number; ayah: number }): string {
  return `/quran/${hit.surah}#${hit.ayah}`;
}