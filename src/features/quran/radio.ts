// Koran-Radio: 24/7-Streams von mp3quran.net (kostenlos, ohne API-Key).
// Die API liefert lokalisierte Sendernamen; App-Locale → API-Sprachcode.
import { fetchWithTimeout } from '@/lib/fetchJson';
import type { Locale } from '@/lib/locale-detect';

export interface RadioStation {
  id: number;
  name: string;
  url: string;
}

const API_LANG: Record<Locale, string> = {
  de: 'de',
  en: 'eng',
  tr: 'tr',
  ar: 'ar',
  es: 'es',
  fr: 'fr',
  id: 'eng', // mp3quran.net unterstützt kein 'id' — bestmöglicher Fallback
  bn: 'eng', // mp3quran.net unterstützt kein 'bn' — bestmöglicher Fallback
  fa: 'eng', // mp3quran.net liefert für 'fa' unlokalisierte Namen — bestmöglicher Fallback
  ms: 'eng', // mp3quran.net unterstützt kein 'ms' — bestmöglicher Fallback
  ur: 'ur', // mp3quran.net liefert echte urdu-lokalisierte Sendernamen (live geprüft)
  ru: 'ru', // mp3quran.net liefert echte russisch-lokalisierte Sendernamen (live geprüft)
  sw: 'eng', // mp3quran.net unterstützt kein 'sw' — bestmöglicher Fallback
  ps: 'eng', // mp3quran.net unterstützt kein 'ps' — bestmöglicher Fallback
};

interface RadiosResponse {
  radios?: { id?: number; name?: string; url?: string }[];
}

/** Rohantwort → saubere Senderliste (nur https-Streams mit Name). */
export function parseRadios(j: RadiosResponse): RadioStation[] {
  return (j.radios ?? [])
    .filter(
      (r): r is { id: number; name: string; url: string } =>
        typeof r.id === 'number' &&
        typeof r.name === 'string' &&
        r.name.trim() !== '' &&
        typeof r.url === 'string' &&
        r.url.startsWith('https://'),
    )
    .map((r) => ({ id: r.id, name: r.name.replace(/\s+/g, ' ').trim(), url: r.url }));
}

export async function fetchRadios(locale: Locale): Promise<RadioStation[]> {
  const r = await fetchWithTimeout(`https://www.mp3quran.net/api/v3/radios?language=${API_LANG[locale] ?? 'eng'}`, {
    errorPrefix: 'radios',
  });
  if (!r.ok) throw new Error(`radios_${r.status}`);
  return parseRadios((await r.json()) as RadiosResponse);
}
