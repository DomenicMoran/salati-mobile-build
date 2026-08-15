// Mushaf-Seiten-Wiedergabe (Task: "Seite vorlesen"): verwandelt die nach
// Suren gruppierten Verse einer Druckseite in eine flache, abspielbare Liste
// über Suren-Grenzen hinweg — Basis für useAyahPlayer (usePlayer.ts), der
// bereits Vers-für-Vers mit Auto-Advance abspielt, hier aber statt einer
// einzelnen Sure eine ganze Mushaf-Seite bekommt.
export interface MushafPlaylistEntry {
  surah: number;
  ayah: number;
  audio?: string;
}

export interface MushafPlaylistGroup {
  surah: number;
  verses: { ayah: number }[];
}

/**
 * Baut die Wiedergabeliste einer Seite. `audioBySurah` liefert je Sure eine
 * Map Vers-Nummer → Audio-URL (aus den bereits geladenen Suren-Lesungen,
 * siehe useMushafGroupReadings) — fehlt eine URL (Edition ohne Audio für
 * diesen Vers), bleibt `audio` undefined und useAyahPlayer überspringt ihn
 * automatisch beim Auto-Advance.
 */
export function buildMushafPlaylist(
  groups: MushafPlaylistGroup[],
  audioBySurah: Map<number, Map<number, string | undefined>>,
): MushafPlaylistEntry[] {
  const list: MushafPlaylistEntry[] = [];
  for (const g of groups) {
    const audioByAyah = audioBySurah.get(g.surah);
    for (const v of g.verses) {
      list.push({ surah: g.surah, ayah: v.ayah, audio: audioByAyah?.get(v.ayah) });
    }
  }
  return list;
}

/** Index eines Verses (Sure+Ayah) in der Wiedergabeliste, oder -1. */
export function findMushafPlaylistIndex(playlist: MushafPlaylistEntry[], surah: number, ayah: number): number {
  return playlist.findIndex((v) => v.surah === surah && v.ayah === ayah);
}
