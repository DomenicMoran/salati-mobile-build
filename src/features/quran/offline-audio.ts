import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { fetchWithTimeout } from '@/lib/fetchJson';
import { hapticSuccess } from '@/lib/haptics';

// Offline-Audio: lädt alle Vers-MP3s einer Sure (beliebiger Rezitator) ins
// Dokumentverzeichnis. Index in AsyncStorage; der Player bekommt dann lokale
// file://-URIs statt der CDN-URLs. Web hat kein Dateisystem — Feature dort aus.

export const OFFLINE_AUDIO_INDEX_KEY = 'salatibox:offline-audio';

type OfflineIndex = Record<string, number>; // "reciter|surah" → Ayah-Anzahl

function indexKey(reciter: string, surah: number): string {
  return `${reciter}|${surah}`;
}

/** Exportiert (statt nur intern genutzt) für die Speicherverwaltung
 * (features/settings/storage.ts) - dort wird pro Rezitator die tatsächliche
 * Verzeichnisgröße auf der Platte berechnet, ohne den Pfad-Aufbau hier zu
 * duplizieren. */
export function reciterDir(reciter: string): string {
  return `${FileSystem.documentDirectory}quran-audio/${encodeURIComponent(reciter)}/`;
}

function surahDir(reciter: string, surah: number): string {
  return `${reciterDir(reciter)}${surah}/`;
}

export function offlineAudioSupported(): boolean {
  return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
}

async function readIndex(): Promise<OfflineIndex> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_AUDIO_INDEX_KEY);
    return raw ? (JSON.parse(raw) as OfflineIndex) : {};
  } catch {
    return {};
  }
}

async function writeIndex(index: OfflineIndex): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_AUDIO_INDEX_KEY, JSON.stringify(index)).catch(() => {});
}

export async function isSurahDownloaded(reciter: string, surah: number): Promise<boolean> {
  const index = await readIndex();
  return (index[indexKey(reciter, surah)] ?? 0) > 0;
}

export function localAyahUri(reciter: string, surah: number, ayahInSurah: number): string {
  return `${surahDir(reciter, surah)}${ayahInSurah}.mp3`;
}

export async function downloadSurahAudio(
  reciter: string,
  surah: number,
  urls: (string | undefined)[],
  onProgress: (ratio: number) => void,
): Promise<void> {
  const dir = surahDir(reciter, surah);
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (url) {
      const dest = `${dir}${i + 1}.mp3`;
      const info = await FileSystem.getInfoAsync(dest);
      if (!info.exists) await FileSystem.downloadAsync(url, dest);
    }
    onProgress((i + 1) / urls.length);
  }
  const index = await readIndex();
  index[indexKey(reciter, surah)] = urls.length;
  await writeIndex(index);
}

export async function deleteSurahAudio(reciter: string, surah: number): Promise<void> {
  await FileSystem.deleteAsync(surahDir(reciter, surah), { idempotent: true }).catch(() => {});
  const index = await readIndex();
  delete index[indexKey(reciter, surah)];
  await writeIndex(index);
}

// ---- Ganzer Mushaf (alle 114 Suren) für einen Rezitator ----

export const QURAN_SURAH_COUNT = 114;

/** Zählt, wie viele der 114 Suren für reciter bereits lokal vorliegen -
 * für den Speicherplatz-/Fortschritts-Hinweis vor dem Voll-Download. */
export async function countDownloadedSurahs(reciter: string): Promise<number> {
  const index = await readIndex();
  let count = 0;
  for (let surah = 1; surah <= QURAN_SURAH_COUNT; surah++) {
    if ((index[indexKey(reciter, surah)] ?? 0) > 0) count++;
  }
  return count;
}

const AUDIO_API_BASE = 'https://api.alquran.cloud/v1';

/** Audio-URLs aller Verse einer Sure für einen Rezitator - eigener, minimaler
 * Fetch statt features/quran/api.ts: fetchSurahReading dort bräuchte
 * zusätzlich eine translationEdition, die für den reinen Audio-Bulk-Download
 * nicht gebraucht wird - dieses Modul bleibt bewusst unabhängig von der
 * Übersetzungsauswahl des Nutzers. */
async function fetchSurahAudioUrls(surah: number, reciter: string): Promise<(string | undefined)[]> {
  const r = await fetchWithTimeout(`${AUDIO_API_BASE}/surah/${surah}/${reciter}`, {
    errorPrefix: 'alquran_cloud_audio',
  });
  if (!r.ok) throw new Error(`alquran_cloud_audio_${r.status}`);
  const j = (await r.json()) as { code: number; data?: { ayahs: { audio?: string }[] } };
  if (j.code !== 200 || !j.data) throw new Error('alquran_cloud_audio_bad_response');
  return j.data.ayahs.map((a) => a.audio);
}

export interface MushafDownloadProgress {
  /** Sure, die gerade fertig wurde (1-114). */
  surah: number;
  completedSurahs: number;
  totalSurahs: number;
}

/**
 * Lädt den kompletten Mushaf (alle 114 Suren) für einen Rezitator herunter -
 * SEQUENTIELL Sure für Sure, nicht 114 parallele Requests (schont die
 * Al-Quran-Cloud-API und lässt Fortschritt sauber melden). Bereits
 * heruntergeladene Suren werden übersprungen (isSurahDownloaded-Check), damit
 * ein Abbruch + erneuter Aufruf nicht von vorne beginnt - dasselbe
 * Resume-Verhalten wie downloadSurahAudio es pro Datei innerhalb einer Sure
 * schon hat (info.exists-Check).
 */
export async function downloadFullMushafAudio(
  reciter: string,
  onProgress: (progress: MushafDownloadProgress) => void,
  shouldCancel?: () => boolean,
): Promise<void> {
  for (let surah = 1; surah <= QURAN_SURAH_COUNT; surah++) {
    if (shouldCancel?.()) return;
    if (!(await isSurahDownloaded(reciter, surah))) {
      const urls = await fetchSurahAudioUrls(surah, reciter);
      await downloadSurahAudio(reciter, surah, urls, () => {});
    }
    onProgress({ surah, completedSurahs: surah, totalSurahs: QURAN_SURAH_COUNT });
  }
}

/** Löscht den kompletten Mushaf-Pack eines Rezitators (alle heruntergeladenen
 * Suren + zugehörige Index-Einträge) - ein Verzeichnis-Delete statt 114
 * einzelner deleteSurahAudio-Aufrufe, da der komplette reciterDir gelöscht
 * werden kann und der Index anschließend in einem Rutsch bereinigt wird. */
export async function deleteFullMushafAudio(reciter: string): Promise<void> {
  await FileSystem.deleteAsync(reciterDir(reciter), { idempotent: true }).catch(() => {});
  const index = await readIndex();
  const prefix = `${reciter}|`;
  for (const key of Object.keys(index)) {
    if (key.startsWith(prefix)) delete index[key];
  }
  await writeIndex(index);
}

export interface DownloadedReciterPack {
  reciter: string;
  /** Anzahl der lokal vorliegenden Suren (1-114). */
  surahCount: number;
}

/** Gruppiert den flachen "reciter|surah"-Index nach Rezitator - für die
 * Übersicht "welche Rezitatoren sind (teilweise) offline verfügbar" in den
 * Einstellungen. Liest das bestehende Index-Format unverändert (rückwärts-
 * kompatibel), es wird kein neues Speicherformat eingeführt. */
export async function listDownloadedReciters(): Promise<DownloadedReciterPack[]> {
  const index = await readIndex();
  const counts = new Map<string, number>();
  for (const [key, ayahCount] of Object.entries(index)) {
    if (!ayahCount) continue;
    const sep = key.indexOf('|');
    if (sep === -1) continue;
    const reciter = key.slice(0, sep);
    counts.set(reciter, (counts.get(reciter) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reciter, surahCount]) => ({ reciter, surahCount }))
    .sort((a, b) => b.surahCount - a.surahCount);
}

/** UI-Hook für den Voll-Mushaf-Download - eigenständig neben useOfflineAudio
 * (das ist pro-Sure), damit bestehende Aufrufer unverändert bleiben. */
export function useFullMushafDownload(reciter: string) {
  const supported = offlineAudioSupported();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  // Ref statt State fürs Abbruch-Flag: der laufende Download-Loop liest
  // shouldCancel() live aus derselben Closure - mit useState würde `cancel()`
  // nur eine NEUE `download`-Funktion mit aktuellem Wert erzeugen, während
  // der bereits laufende Aufruf weiter die beim Start eingefrorene (immer
  // `false`) Kopie sähe und nie abbräche.
  const cancelledRef = useRef(false);

  const download = useCallback(async () => {
    if (!supported || downloading) return;
    setDownloading(true);
    setProgress(0);
    cancelledRef.current = false;
    try {
      await downloadFullMushafAudio(
        reciter,
        (p) => setProgress(p.completedSurahs / p.totalSurahs),
        () => cancelledRef.current,
      );
      // Nur bei echtem Abschluss haptisch bestätigen, nicht bei einem
      // Abbruch mitten im Loop (der ebenfalls ohne throw zurückkehrt).
      if (!cancelledRef.current) hapticSuccess();
    } catch {
      // Netzwerk-Hänger/Abbruch mitten im Fetch (z.B. Cancel während der
      // Download einer großen Sure noch lief) darf nicht als unhandled
      // promise rejection hochploppen - bereits heruntergeladene Suren
      // bleiben erhalten, ein erneuter download()-Aufruf setzt fort.
    } finally {
      setDownloading(false);
    }
  }, [supported, downloading, reciter]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return { supported, downloading, progress, download, cancel };
}

export function useOfflineAudio(reciter: string, surah: number) {
  const supported = offlineAudioSupported();
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!supported || !Number.isFinite(surah)) return;
    let cancelled = false;
    isSurahDownloaded(reciter, surah).then((d) => {
      if (!cancelled) setDownloaded(d);
    });
    return () => {
      cancelled = true;
    };
  }, [supported, reciter, surah]);

  const download = useCallback(
    async (urls: (string | undefined)[]) => {
      if (!supported || downloading) return;
      setDownloading(true);
      setProgress(0);
      try {
        await downloadSurahAudio(reciter, surah, urls, setProgress);
        setDownloaded(true);
        hapticSuccess();
      } finally {
        setDownloading(false);
      }
    },
    [supported, downloading, reciter, surah],
  );

  const remove = useCallback(async () => {
    await deleteSurahAudio(reciter, surah);
    setDownloaded(false);
  }, [reciter, surah]);

  /** Audio-URL eines Verses: lokal wenn heruntergeladen, sonst CDN. */
  const audioFor = useCallback(
    (ayahInSurah: number, remoteUrl?: string) =>
      downloaded ? localAyahUri(reciter, surah, ayahInSurah) : remoteUrl,
    [downloaded, reciter, surah],
  );

  return { supported, downloaded, downloading, progress, download, remove, audioFor };
}
