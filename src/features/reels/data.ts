// Reels-Daten: kurze vertikale Video-Clips (9:16), die den Instagram-/TikTok-
// /Shorts-Content DIREKT in der App abspielbar machen — ohne dass man
// Instagram installiert haben muss. Die Clips liegen als oeffentliche mp4s im
// Cloudflare-R2-Bucket, eine einzige index.json ist der Contract (gleiches
// Muster wie fetchPodcastIndex/fetchRadios: nur `fetch`, kein SDK-Client).
//
// WICHTIG (Robustheit): die index.json wird parallel produziert und existiert
// beim Bauen evtl. noch nicht. `fetchReelsIndex` faengt "noch nicht da"
// (404/403) sauber ab und liefert eine LEERE Liste zurueck — der Feed zeigt
// dann den "Reels kommen bald"-Leerzustand statt zu crashen. Nur echte
// Netzwerk-/Parse-Fehler werden geworfen (Screen zeigt dann Fehler + Retry).
import { useQuery } from '@tanstack/react-query';

import { fetchWithTimeout } from '@/lib/fetchJson';

const REELS_BASE = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/reels';
export const REELS_INDEX_URL = `${REELS_BASE}/index.json`;

/** Ein einzelnes Reel — ein kurzer vertikaler mp4-Clip. */
export interface Reel {
  /** Stabile ID (fuer keyExtractor + Player-Identitaet). */
  id: string;
  /** Zugehoerige Folgen-Nummer (mehrere Reels je Folge moeglich). */
  episode_no: number;
  /** Reihen-Kennung (z. B. "grammar", "seerah"). */
  series: string;
  /** Anzeigename der Reihe (Overlay). */
  series_title: string;
  /** Reel-Nr innerhalb der Folge (Sortierung). */
  index: number;
  title: string;
  description: string;
  duration_sec: number;
  /** Direkte mp4-URL (9:16). */
  video_url: string;
}

export interface ReelsIndex {
  reels: Reel[];
}

/** Ein Roh-Eintrag ist gueltig, wenn er eine ID und eine abspielbare URL hat. */
function isPlayableReel(raw: unknown): raw is Reel {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return typeof r.video_url === 'string' && r.video_url.length > 0 && r.id != null;
}

/** Roh-Eintrag defensiv in einen vollstaendigen Reel normalisieren (fehlende
 *  optionale Felder bekommen sinnvolle Defaults — ein unvollstaendiger Eintrag
 *  soll den Feed nicht kippen). */
function normalizeReel(raw: Reel & Record<string, unknown>): Reel {
  return {
    id: String(raw.id),
    episode_no: Number(raw.episode_no) || 0,
    series: typeof raw.series === 'string' ? raw.series : '',
    series_title: typeof raw.series_title === 'string' ? raw.series_title : '',
    index: Number(raw.index) || 0,
    title: typeof raw.title === 'string' ? raw.title : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    duration_sec: Number(raw.duration_sec) || 0,
    video_url: raw.video_url,
  };
}

/**
 * Laedt die Reels-index.json. "Noch nicht produziert" (404/403) ist KEIN
 * Fehler, sondern ein leerer Feed. Alles andere (Netzwerk, 5xx, kaputtes JSON)
 * wirft — damit der Screen zwischen "kommt bald" und "echter Fehler + Retry"
 * unterscheiden kann.
 */
export async function fetchReelsIndex(): Promise<ReelsIndex> {
  let res: Response;
  try {
    res = await fetchWithTimeout(REELS_INDEX_URL, { cache: 'no-cache', errorPrefix: 'reels_index' });
  } catch {
    throw new Error('reels_network_error');
  }

  // Datei existiert (noch) nicht -> leerer, valider Zustand.
  if (res.status === 404 || res.status === 403) return { reels: [] };
  if (!res.ok) throw new Error(`reels_index_${res.status}`);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('reels_parse_error');
  }

  const rawReels =
    json && typeof json === 'object' && Array.isArray((json as { reels?: unknown }).reels)
      ? ((json as { reels: unknown[] }).reels as unknown[])
      : [];

  const reels = rawReels
    .filter(isPlayableReel)
    .map((r) => normalizeReel(r as Reel & Record<string, unknown>))
    .sort((a, b) => a.episode_no - b.episode_no || a.index - b.index);

  return { reels };
}

/** React-Query-Hook fuer den Feed. Reels aendern sich selten -> lange
 *  staleTime; ein Fehler wird einmal wiederholt (transiente Netzwerk-Fehler). */
export function useReelsIndex() {
  return useQuery({
    queryKey: ['reels', 'index'],
    queryFn: fetchReelsIndex,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
