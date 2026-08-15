import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Wiedergabe-Position der Lernvideos merken („Weiterschauen"): pro Folge die
// zuletzt erreichte Sekunde in EINEM JSON-Blob unter einem festen
// AsyncStorage-Key. Bewusst getrennt von den Offline-Downloads (downloads.ts) —
// die Position wird auch fuer gestreamte (nicht heruntergeladene) Folgen
// gemerkt und funktioniert deshalb auf ALLEN Plattformen inkl. Web
// (AsyncStorage ist dort localStorage-basiert, kein Dateisystem noetig).

const KEY = 'salatibox:video-progress';

// Eine Folge gilt als „gesehen"/fertig, wenn nur noch ein kleiner Rest bleibt —
// dann NICHT als Weiterschauen-Position speichern (sonst springt ein erneutes
// Oeffnen ans Ende). Ebenso keine Position fuer die ersten Sekunden merken.
const NEAR_END_RATIO = 0.95;
const MIN_POSITION_SEC = 5;

export interface VideoProgressEntry {
  /** Zuletzt erreichte Position in Sekunden. */
  position: number;
  /** Gesamtdauer in Sekunden (fuer die Fortschrittsanzeige). */
  duration: number;
  updatedAt: number;
}

type ProgressMap = Record<string, VideoProgressEntry>;

/**
 * Audit 2026-07-27 (O5): der Cast auf `ProgressMap` war ungeprueft — ein
 * gespeichertes `"null"` (oder `"[]"`/`"7"`, etwa nach einem Backup-Import
 * oder einem fremden Schreiber auf denselben localStorage-Key im Web) haette
 * `saveVideoProgress` beim naechsten `map[...] = …` mit einem TypeError
 * abstuerzen lassen. Fremddaten werden geprueft, nicht behauptet.
 */
function isProgressMap(value: unknown): value is ProgressMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readMap(): Promise<ProgressMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return isProgressMap(parsed) ? (parsed as ProgressMap) : {};
  } catch {
    return {};
  }
}

async function writeMap(map: ProgressMap): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(map)).catch(() => {});
}

/**
 * Speichert die aktuelle Wiedergabe-Position. Nahe am Ende (>95 %) oder ganz am
 * Anfang (<5 s) wird stattdessen die Position ENTFERNT — die Folge zaehlt dann
 * nicht mehr als „weiterschauen".
 */
export async function saveVideoProgress(
  episodeNo: number,
  position: number,
  duration: number,
): Promise<void> {
  const map = await readMap();
  const done = duration > 0 && position / duration >= NEAR_END_RATIO;
  if (!Number.isFinite(position) || position < MIN_POSITION_SEC || done) {
    if (map[String(episodeNo)]) {
      delete map[String(episodeNo)];
      await writeMap(map);
    }
    return;
  }
  map[String(episodeNo)] = { position, duration, updatedAt: Date.now() };
  await writeMap(map);
}

/** Gemerkte Position einer Folge in Sekunden (0 = keine). */
export async function loadVideoProgress(episodeNo: number): Promise<number> {
  const map = await readMap();
  return map[String(episodeNo)]?.position ?? 0;
}

/** Ganzer Fortschritts-Datensatz (Liste: „Weiterschauen"-Badge + Balken). */
export async function loadAllVideoProgress(): Promise<ProgressMap> {
  return readMap();
}

/**
 * React-Hook: laedt einmalig die gesamte Fortschritts-Tabelle (fuer die Liste).
 * `reload` erlaubt eine Aktualisierung, wenn die Liste wieder in den Fokus
 * kommt (Position hat sich im Player geaendert).
 */
export function useAllVideoProgress(): { progress: ProgressMap; reload: () => void } {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadAllVideoProgress().then((m) => {
      if (!cancelled) setProgress(m);
    });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { progress, reload: () => setNonce((n) => n + 1) };
}
