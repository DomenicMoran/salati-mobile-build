// Video-Daten: die Lernvideos (62 Folgen, 10 Reihen). Cover, MP4 und Metadaten
// liegen OeFFENTLICH auf Cloudflare R2 und werden ueber eine einzige index.json
// geladen — kein Client noetig (gleiches Muster wie fetchPodcastIndex: nur
// `fetch`). Das Schema ist bewusst dem Podcast-Contract nachgebildet
// (episode_no/title/description/topics/series/series_title/duration_sec/
// cover_url) mit `video_url` statt `audio_url`, damit Liste, Player und
// Reihen-Gruppierung dieselben Muster nutzen koennen.

import { fetchJson } from '@/lib/fetchJson';

const VIDEO_BASE = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/videos';
export const VIDEO_INDEX_URL = `${VIDEO_BASE}/index.json`;

export interface VideoEpisode {
  episode_no: number;
  title: string;
  description?: string;
  topics: string[];
  duration_sec: number;
  video_url: string;
  cover_url: string;
  /** Reihen-Kennung (z. B. "grammar", "madinah", "vocab", "tajwid") zur
   *  Gruppierung mehrerer Folgen-Reihen. OPTIONAL + rueckwaertskompatibel:
   *  fehlt das Feld, gehoert die Folge in eine gemeinsame Default-Reihe. */
  series?: string;
  /** Anzeigename der Reihe (Section-Header). Faellt auf `series` zurueck. */
  series_title?: string;
  /** Position der REIHE im Lernweg (1 = Einstieg), aus derselben Quelle wie
   *  beim Podcast (podcast/scripts/series.py). Der Video-Index fuehrte das Feld
   *  bis 2026-07-28 nicht — die Videoliste konnte deshalb gar nicht nach dem
   *  Lernweg sortieren, obwohl die Podcast-Liste es tut. OPTIONAL: Eintraege
   *  ohne das Feld (Tabellen-/Vokabel-Videos, aeltere Index-Staende) sortieren
   *  hinter allen gepflegten Reihen. */
  series_order?: number;
  /** Sprache DES INHALTS (ISO-Code, aktuell durchgaengig "de") — nicht die der
   *  Oberflaeche; s. features/media/content-language.ts. OPTIONAL, Vorgabe
   *  Deutsch. */
  lang?: string;
  /** Art des Eintrags: 'lesson' (Lernvideo), 'table' (Grammatik-Tabelle /
   *  Vokabel-Video) oder 'course' (Lektion der eigenen Kursreihe). Nur fuer
   *  Iconografie; fehlt es, gilt 'lesson'. */
  kind?: 'lesson' | 'table' | 'course';

  // --- Kurs -> Kapitel -> Lektion (seit 2026-08-25) ----------------------
  // Vorher war die Medienliste EINE lange Liste mit Reihen-Kopfzeilen. Wer
  // wissen wollte, wo er steht, musste scrollen. Diese vier Felder tragen die
  // Ordnung des Lernwegs; gepflegt in podcast/scripts/kursordnung.py.
  //
  // Alle OPTIONAL: ein Index ohne sie zeigt weiterhin die flache Liste, und
  // eine aeltere App-Version kommt mit dem neuen Index zurecht.
  /** Kurs-Kennung, z. B. "lesen", "sprache", "tajwid". */
  course?: string;
  /** Anzeigename des Kurses, z. B. "Kurs 1 - Arabisch lesen". */
  course_title?: string;
  /** Position des Kurses im Lernweg (1 = Einstieg). */
  course_order?: number;
  /** Kapitelnummer innerhalb des Kurses. */
  chapter_no?: number;
  /** Kapitelname, z. B. "Die Vokalzeichen". */
  chapter_title?: string;
  /** Position der Lektion innerhalb des Kapitels. */
  lesson_no?: number;
}

export interface VideoIndex {
  episodes: VideoEpisode[];
}

/** Reihen ohne `series_order` sortieren hinter allen gepflegten Reihen — das
 *  betrifft die Tabellen-/Vokabel-Videos (episode_no ab 1000), die an keiner
 *  Podcast-Folge haengen und damit keinen Platz im Lernweg haben. */
const UNSORTED_SERIES = Number.MAX_SAFE_INTEGER;

function seriesOrderOf(ep: VideoEpisode): number {
  const o = ep.series_order;
  return typeof o === 'number' && Number.isFinite(o) ? o : UNSORTED_SERIES;
}

/**
 * Sortiert die Videos entlang des Lernwegs: erst nach `series_order` (Reihe),
 * innerhalb der Reihe nach `episode_no` — identisch zu
 * `sortEpisodesByLearningPath` beim Podcast, damit beide Tabs dieselbe
 * Reihenfolge zeigen. Enthaelt der Index das Feld gar nicht, ist das Ergebnis
 * exakt die alte Sortierung nach `episode_no`. Sortiert eine Kopie.
 */
export function sortEpisodesByLearningPath(episodes: VideoEpisode[]): VideoEpisode[] {
  return [...episodes].sort((a, b) => {
    const d = seriesOrderOf(a) - seriesOrderOf(b);
    return d !== 0 ? d : a.episode_no - b.episode_no;
  });
}

// Zuordnung Lernphase/Kurs -> passende Einstiegsfolge (episode_no). Die Video-
// episode_no ist inhaltsgleich mit der jeweiligen Podcast-Folge (dieselbe
// Lektion, nur als Video), daher entsprechen sich die Nummern 1:1 mit den
// Phase.episodeNo-Werten in app/learn/index.tsx. Keyed nach Phase-key bzw.
// Kurs-id (core/tajwid/grammar/madinah/amau; `vocab` als Alias fuer amau, weil
// die Video-Reihe so heisst). Kurse ohne Video fehlen bewusst -> keine Karte.
export const PHASE_INTRO_VIDEO: Record<string, number> = {
  core: 1,
  tajwid: 2,
  grammar: 3,
  madinah: 16,
  amau: 26,
  vocab: 26,
};

// Zuordnung Lernphase/Kurs -> genau EINE thematisch exakt passende Grammatik-
// Tabelle (kind:'table', episode_no>=1000). Nur wo der Phasen-Einstieg exakt
// auf eine Tabelle abbildet: Grammatik-Einstieg (Ism/Nomen) -> muslimun-Tabelle
// 1000; Madinah-Einstieg (dies/das = Hinweiswoerter) -> Tabelle 1003. Andere
// Phasen fehlen bewusst -> keine Tabellen-Karte.
export const PHASE_TABLE_VIDEO: Record<string, number> = {
  grammar: 1000,
  madinah: 1003,
};

export async function fetchVideoIndex(): Promise<VideoIndex> {
  const j = await fetchJson<VideoIndex>(VIDEO_INDEX_URL, {
    cache: 'no-cache',
    errorPrefix: 'video_index',
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

export interface VideoSeriesGroup {
  /** Reihen-Kennung; fuer Folgen ohne `series` der Default-Schluessel. */
  key: string;
  /** Section-Header-Text; `null` fuer die Default-Reihe (kein `series`-Feld). */
  title: string | null;
  episodes: VideoEpisode[];
}

/**
 * Gruppiert Folgen nach `series` in Erst-Auftritts-Reihenfolge. Folgen ohne
 * `series` landen in einer Default-Gruppe (title = null). Rueckwaertskompatibel:
 * ohne series-Feld entsteht genau EINE Default-Gruppe.
 */
export function groupEpisodesBySeries(episodes: VideoEpisode[]): VideoSeriesGroup[] {
  const order: string[] = [];
  const map = new Map<string, VideoSeriesGroup>();
  for (const ep of episodes) {
    const seriesId = ep.series?.trim();
    const key = seriesId || DEFAULT_SERIES_KEY;
    let group = map.get(key);
    if (!group) {
      group = { key, title: seriesId ? ep.series_title?.trim() || seriesId : null, episodes: [] };
      map.set(key, group);
      order.push(key);
      // Audit 2026-07-27: Die Nachhol-Bedingung lautete `!group.title` und war
      // damit unerreichbar — sobald `seriesId` gesetzt ist, steht in `title`
      // mindestens der Fallback (die Reihen-Kennung), also nie ein falsy Wert.
      // Folge: traegt erst eine SPAETERE Folge der Reihe ein `series_title`,
      // blieb im Section-Header dauerhaft der interne Schluessel ("vocab")
      // statt des Anzeigenamens ("Vokabeln") stehen. Der Vergleich gegen `key`
      // erkennt genau diesen Fallback-Zustand.
    } else if (seriesId && group.title === key && ep.series_title?.trim()) {
      group.title = ep.series_title.trim();
    }
    group.episodes.push(ep);
  }
  return order.map((k) => map.get(k)!);
}

/** true, sobald mindestens zwei verschiedene Reihen vorkommen — erst dann
 *  werden in der Liste sichtbare Section-Header gezeigt. */
export function hasMultipleSeries(episodes: VideoEpisode[]): boolean {
  const seen = new Set<string>();
  for (const ep of episodes) {
    seen.add(ep.series?.trim() || DEFAULT_SERIES_KEY);
    if (seen.size > 1) return true;
  }
  return false;
}

/**
 * Nachbarn EINER Folge innerhalb ihrer eigenen Reihe (fuer „nach/vor" + Auto-
 * Play). Bleibt bewusst in der Reihe: am Reihenende gibt es kein `next` — so
 * springt das Auto-Play nicht ungewollt in eine thematisch fremde Reihe (z. B.
 * von den Lernvideos in die Tabellen). Reihenfolge = episode_no aufsteigend.
 */
export function seriesNeighbors(
  episodes: VideoEpisode[],
  episodeNo: number,
): { prev?: VideoEpisode; next?: VideoEpisode } {
  const ep = episodes.find((e) => e.episode_no === episodeNo);
  if (!ep) return {};
  const key = ep.series?.trim() || DEFAULT_SERIES_KEY;
  const siblings = episodes
    .filter((e) => (e.series?.trim() || DEFAULT_SERIES_KEY) === key)
    .sort((a, b) => a.episode_no - b.episode_no);
  const i = siblings.findIndex((e) => e.episode_no === episodeNo);
  if (i < 0) return {};
  return {
    prev: i > 0 ? siblings[i - 1] : undefined,
    next: i < siblings.length - 1 ? siblings[i + 1] : undefined,
  };
}
