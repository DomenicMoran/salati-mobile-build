// Podcast-Daten: der deutsche Quran-Arabisch-Podcast (68 Folgen). Audio,
// Cover, Transkript und Metadaten liegen OeFFENTLICH auf Cloudflare R2 unter
// dem Praefix `podcast/` und werden ueber eine einzige index.json geladen —
// kein Client noetig (gleiches Muster wie fetchVideoIndex: nur `fetch`).
// Erzeugt/gepflegt von podcast/scripts/upload.py.
//
// Wechsel von Supabase Storage auf R2 (2026-07-27): Supabase Free deckelt den
// Egress bei 5 GB/Monat, die Folgen sind zusammen ~650 MB Audio. R2 hat keinen
// Egress-Preis. Der Supabase-Bucket bleibt bestehen und bekommt weiterhin
// denselben Index — bereits veroeffentlichte App-Versionen lesen von dort
// (deren Medien-URLs zeigen nach dem naechsten upload.py-Lauf ebenfalls auf R2).
import { fetchJson } from '@/lib/fetchJson';

const PODCAST_BASE = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/podcast';
export const PODCAST_INDEX_URL = `${PODCAST_BASE}/index.json`;

/** Ein Transkript-Segment: deutscher Erzaehltext oder arabische Rezitation.
 *  `ar`-Segmente werden im Reader RTL + mit der Koran-Schrift gerendert. */
export interface TranscriptSegment {
  type: 'de' | 'ar';
  text: string;
  /** Startzeit im Audio (ms), falls die Vertonung Zeitmarken geliefert hat —
   *  ermoeglicht synchrones Mitlesen (Segment-Highlight). Optional. */
  start_ms?: number;
  end_ms?: number;
}

export interface PodcastEpisode {
  episode_no: number;
  title: string;
  description?: string;
  topics: string[];
  duration_sec: number;
  audio_url: string;
  cover_url: string;
  transcript: TranscriptSegment[];
  /** Reihen-Kennung (z. B. "grammar", "madinah", "vocab", "tajwid") zur
   *  Gruppierung mehrerer Folgen-Reihen. OPTIONAL + rückwärtskompatibel: fehlt
   *  das Feld, gehört die Folge in eine gemeinsame Default-Reihe und die Liste
   *  verhält sich wie bisher (keine sichtbaren Section-Header). */
  series?: string;
  /** Anzeigename der Reihe (Section-Header). Fällt auf `series` zurück, wenn
   *  nicht gesetzt. */
  series_title?: string;
  /** Position der REIHE im Lernweg (1 = Einstieg). Alle Folgen einer Reihe
   *  tragen denselben Wert; gepflegt in podcast/scripts/upload.py. OPTIONAL +
   *  rückwärtskompatibel: fehlt das Feld, landet die Folge hinter allen
   *  sortierten Reihen und die Liste verhält sich wie früher (nur episode_no).
   *  Ohne das Feld folgte die Reihenfolge der Entstehungsgeschichte statt dem
   *  Lernweg — die Lese-Reihe (63–68) gehört an den Anfang, nicht ans Ende. */
  series_order?: number;
  /** Sprache DES INHALTS (ISO-Code, aktuell durchgängig "de") — nicht die der
   *  Oberfläche. Die App spricht 14 Sprachen, alle Folgen sind deutsch; das
   *  Feld trägt den Hinweis in die Liste, bevor jemand eine Folge öffnet oder
   *  offline lädt (s. features/media/content-language.ts). OPTIONAL: ältere
   *  Index-Stände haben es nicht, dort gilt Deutsch als Vorgabe. */
  lang?: string;
}

export interface PodcastSeries {
  title: string;
  subtitle: string;
  description: string;
  cover_url: string;
}

export interface PodcastIndex {
  updated_at: string;
  series: PodcastSeries;
  episodes: PodcastEpisode[];
}

/** Reihen ohne `series_order` sortieren hinter allen gepflegten Reihen — so
 *  bleibt eine neue, noch nicht eingeordnete Folge sichtbar (am Ende) statt
 *  vorne dazwischenzurutschen. */
const UNSORTED_SERIES = Number.MAX_SAFE_INTEGER;

function seriesOrderOf(ep: PodcastEpisode): number {
  const o = ep.series_order;
  return typeof o === 'number' && Number.isFinite(o) ? o : UNSORTED_SERIES;
}

/**
 * Sortiert die Folgen entlang des Lernwegs: erst nach `series_order` (Reihe),
 * innerhalb der Reihe nach `episode_no`. Folgen ohne `series_order` hängen
 * hinten an — enthält der Index das Feld gar nicht, ist das Ergebnis exakt die
 * alte Sortierung nach `episode_no`. Sortiert eine Kopie (kein Seiteneffekt).
 */
export function sortEpisodesByLearningPath(episodes: PodcastEpisode[]): PodcastEpisode[] {
  return [...episodes].sort((a, b) => {
    const d = seriesOrderOf(a) - seriesOrderOf(b);
    return d !== 0 ? d : a.episode_no - b.episode_no;
  });
}

export async function fetchPodcastIndex(): Promise<PodcastIndex> {
  const j = await fetchJson<PodcastIndex>(PODCAST_INDEX_URL, {
    cache: 'no-cache',
    errorPrefix: 'podcast_index',
  });
  j.episodes = sortEpisodesByLearningPath(j.episodes ?? []);
  return j;
}

/** mm:ss aus Sekunden. */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const DEFAULT_SERIES_KEY = '__default__';

export interface PodcastSeriesGroup {
  /** Reihen-Kennung; für Folgen ohne `series` der Default-Schlüssel. */
  key: string;
  /** Section-Header-Text; `null` für die Default-Reihe (kein `series`-Feld). */
  title: string | null;
  episodes: PodcastEpisode[];
}

/**
 * Gruppiert Folgen nach `series` in Erst-Auftritts-Reihenfolge. Folgen ohne
 * `series` landen in einer Default-Gruppe (title = null). Rückwärtskompatibel:
 * ohne series-Feld entsteht genau EINE Default-Gruppe.
 */
export function groupEpisodesBySeries(episodes: PodcastEpisode[]): PodcastSeriesGroup[] {
  const order: string[] = [];
  const map = new Map<string, PodcastSeriesGroup>();
  for (const ep of episodes) {
    const seriesId = ep.series?.trim();
    const key = seriesId || DEFAULT_SERIES_KEY;
    let group = map.get(key);
    if (!group) {
      group = { key, title: seriesId ? ep.series_title?.trim() || seriesId : null, episodes: [] };
      map.set(key, group);
      order.push(key);
    } else if (!group.title && seriesId && ep.series_title?.trim()) {
      group.title = ep.series_title.trim();
    }
    group.episodes.push(ep);
  }
  return order.map((k) => map.get(k)!);
}

/** true, sobald mindestens zwei verschiedene Reihen vorkommen — erst dann
 *  werden in der Liste sichtbare Section-Header gezeigt. */
export function hasMultipleSeries(episodes: PodcastEpisode[]): boolean {
  const seen = new Set<string>();
  for (const ep of episodes) {
    seen.add(ep.series?.trim() || DEFAULT_SERIES_KEY);
    if (seen.size > 1) return true;
  }
  return false;
}
