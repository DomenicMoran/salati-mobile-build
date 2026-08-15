import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// Klebrige Player-Einstellungen (Autoplay, Hintergrund-Ton, Geschwindigkeit).
// Persistiert, weil der Player-Screen beim Auto-Advance per router.replace neu
// gemountet wird — ohne Persistenz waeren die gewaehlten Einstellungen bei jeder
// naechsten Folge wieder auf Standard. Ein kleiner Modul-Cache haelt den Wert
// synchron im Speicher; AsyncStorage macht ihn dauerhaft (auch Web).

const KEY = 'salatibox:video-prefs';

export interface VideoPrefs {
  autoplay: boolean;
  background: boolean;
  speed: number;
}

const DEFAULTS: VideoPrefs = { autoplay: false, background: false, speed: 1 };

let cache: VideoPrefs = DEFAULTS;
let loaded = false;
const subscribers = new Set<(p: VideoPrefs) => void>();

function sanitize(raw: Partial<VideoPrefs> | null | undefined): VideoPrefs {
  return {
    autoplay: typeof raw?.autoplay === 'boolean' ? raw.autoplay : DEFAULTS.autoplay,
    background: typeof raw?.background === 'boolean' ? raw.background : DEFAULTS.background,
    speed: typeof raw?.speed === 'number' && raw.speed > 0 ? raw.speed : DEFAULTS.speed,
  };
}

async function ensureLoaded(): Promise<VideoPrefs> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = sanitize(raw ? (JSON.parse(raw) as Partial<VideoPrefs>) : null);
  } catch {
    cache = DEFAULTS;
  }
  loaded = true;
  return cache;
}

async function update(patch: Partial<VideoPrefs>): Promise<void> {
  cache = sanitize({ ...cache, ...patch });
  loaded = true;
  for (const cb of subscribers) {
    try {
      cb(cache);
    } catch {
      // ignore
    }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => {});
}

/**
 * React-Hook fuer die Player-Einstellungen. Liefert die persistierten Werte
 * (Cache sofort, dann aktualisiert nach dem Laden) und Setter.
 */
export function useVideoPrefs() {
  const [prefs, setPrefs] = useState<VideoPrefs>(cache);

  useEffect(() => {
    let cancelled = false;
    ensureLoaded().then((p) => {
      if (!cancelled) setPrefs(p);
    });
    const cb = (p: VideoPrefs) => {
      if (!cancelled) setPrefs(p);
    };
    subscribers.add(cb);
    return () => {
      cancelled = true;
      subscribers.delete(cb);
    };
  }, []);

  return {
    prefs,
    setAutoplay: useCallback((autoplay: boolean) => update({ autoplay }), []),
    setBackground: useCallback((background: boolean) => update({ background }), []),
    setSpeed: useCallback((speed: number) => update({ speed }), []),
  };
}
