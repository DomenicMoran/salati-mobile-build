import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { logError } from '@/lib/errorLog';
import { fetchJson, fetchWithTimeout } from '@/lib/fetchJson';

// OTA-Content-Updates für die Studium-Kurse (Nutzerwunsch 2026-07-22).
//
// Warum: Die Kurs-JSONs (src/features/study/data/*.json, ~6,8 MB) sind im App-
// Bundle gebündelt und sofort OFFLINE verfügbar — das bleibt so (Offline-First
// ist Pflicht, s. docs/SUPABASE-AUSLAGERUNG.md). Diese Schicht legt NUR eine
// Aktualisierungs-Möglichkeit obendrauf: ist Internet da und liegt in Supabase
// eine NEUERE Version eines Kurses als die gebündelte, wird sie einmalig ins
// Dokumentverzeichnis geladen und danach bevorzugt gelesen. So lassen sich
// Kursinhalte korrigieren/erweitern OHNE Store-Release. Kein Netz / kein
// neueres Manifest → unverändert das gebündelte JSON. Die APK wird dadurch NICHT
// kleiner (Seed bleibt gebündelt) — der Gewinn ist die Update-Fähigkeit.
//
// Öffentlich lesbar, nur per fetch (kein SDK, kein Schlüssel) — gleiches Muster
// wie der Podcast-Index (features/podcast/data.ts).
//
// Seit 2026-07-28 auf Cloudflare R2 statt Supabase. Gründe: dort liegen bereits
// alle übrigen Inhalte (Videos, Podcast, Handouts, APK, KI-Korpus), und R2 hat
// keine Egress-Kosten — bei 10,2 MB Kursdaten je aktualisierendem Gerät ist das
// der Unterschied zwischen „unbegrenzt" und dem Supabase-Freikontingent.
// Der Supabase-Pfad wird vom Veröffentlichungsskript WEITER bedient, weil
// App-Stände bis einschließlich 1.36.0 noch dorthin zeigen; entfernt werden
// darf er erst, wenn die nicht mehr im Umlauf sind.
const REMOTE_BASE = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/kurse';
const MANIFEST_URL = `${REMOTE_BASE}/manifest.json`;

// Version, die das GEBÜNDELTE JSON repräsentiert. Bei einem App-Release mit
// aktualisierten Kurs-Daten hier hochzählen — dann ignoriert der Client einen
// älteren zwischengespeicherten Download automatisch (ein neueres Bundle
// schlägt immer einen älteren Cache). Muss zur höchsten Version passen, die
// `scripts/upload_courses.py` vergeben hat; das Skript gibt sie beim Lauf aus.
export const COURSE_BUNDLED_VERSION = 2;

const CACHE_DIR = `${FileSystem.documentDirectory}study-courses/`;
const verKey = (id: string) => `salatibox:course-ver-${id}`;
const cachePath = (id: string) => `${CACHE_DIR}${id}.json`;

interface CourseManifest {
  versions?: Record<string, number>;
}

/** Version des zwischengespeicherten Kurs-JSONs (0 = kein Cache). */
async function cachedVersion(id: string): Promise<number> {
  const raw = await AsyncStorage.getItem(verKey(id)).catch(() => null);
  const v = raw ? Number(raw) : 0;
  return Number.isFinite(v) ? v : 0;
}

/**
 * Liefert das zwischengespeicherte Kurs-JSON (geparst) ODER null. null, wenn:
 * Web (kein Dateisystem), kein neuerer Cache als das Bundle, Datei fehlt/kaputt.
 * courses.ts fällt bei null auf den gebündelten dynamic import() zurück.
 */
export async function loadCachedCourseJson(id: string): Promise<unknown | null> {
  if (Platform.OS === 'web') return null;
  try {
    // Ein Cache zählt nur, wenn er NEUER als das gebündelte JSON ist — sonst ist
    // das (evtl. per App-Update erneuerte) Bundle aktueller.
    if ((await cachedVersion(id)) <= COURSE_BUNDLED_VERSION) return null;
    const info = await FileSystem.getInfoAsync(cachePath(id));
    if (!info.exists) return null;
    const text = await FileSystem.readAsStringAsync(cachePath(id));
    const parsed = JSON.parse(text);
    // Minimal-Validierung: muss ein lessons-Array haben, sonst Bundle bevorzugen.
    if (!parsed || !Array.isArray((parsed as { lessons?: unknown }).lessons)) return null;
    return parsed;
  } catch {
    return null;
  }
}

let syncLaufend: Promise<void> | null = null;

/**
 * Prüft einmalig das Supabase-Manifest und lädt jeden Kurs nach, dessen
 * Remote-Version NEUER ist als die gebündelte UND als der vorhandene Cache.
 * Läuft beim App-Start fire-and-forget (native, mit Netz); wirft nie, blockiert
 * nichts. Mehrfachaufrufe teilen sich denselben Lauf.
 */
export function syncCoursesFromRemote(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  if (syncLaufend) return syncLaufend;
  syncLaufend = (async () => {
    try {
      const manifest = await fetchJson<CourseManifest>(MANIFEST_URL, {
        cache: 'no-cache',
        errorPrefix: 'course_manifest',
      });
      const versions = manifest.versions ?? {};
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {});
      for (const [id, remoteRaw] of Object.entries(versions)) {
        const remote = Number(remoteRaw);
        if (!Number.isFinite(remote)) continue;
        const haveVersion = Math.max(COURSE_BUNDLED_VERSION, await cachedVersion(id));
        if (remote <= haveVersion) continue;
        try {
          const cr = await fetchWithTimeout(`${REMOTE_BASE}/${id}.json`, {
            cache: 'no-cache',
            errorPrefix: `course_${id}`,
          });
          if (!cr.ok) continue;
          const text = await cr.text();
          const parsed = JSON.parse(text);
          if (!parsed || !Array.isArray((parsed as { lessons?: unknown }).lessons)) continue;
          await FileSystem.writeAsStringAsync(cachePath(id), text);
          await AsyncStorage.setItem(verKey(id), String(remote));
        } catch (err) {
          // Einzelner Kurs fehlgeschlagen — nächster; Bundle bleibt gültig.
          // Protokolliert, weil der Nutzer sonst stumm auf einem veralteten
          // Kurs sitzt (kein Screen zeigt diesen Sync an).
          void logError(err, `courseSync: Kurs ${id}`);
        }
      }
    } catch (err) {
      // Kein Netz / Manifest-Fehler → gebündelte Kurse bleiben unverändert.
      void logError(err, 'courseSync: Manifest');
    } finally {
      syncLaufend = null;
    }
  })();
  return syncLaufend;
}
