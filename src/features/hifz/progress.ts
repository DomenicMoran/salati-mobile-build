import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { logError } from '@/lib/errorLog';

// Hifz-Fortschritt: pro Sure der Status jedes Verses ("kann ich" / "übe ich").

export type AyahStatus = 'known' | 'learning';

export type HifzProgress = Record<number, Record<number, AyahStatus>>;

export const HIFZ_STORAGE_KEY = 'salatibox:hifz-progress';

export function parseHifzProgress(raw: string | null): HifzProgress {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as HifzProgress) : {};
  } catch {
    return {};
  }
}

export function setAyahStatus(
  progress: HifzProgress,
  surah: number,
  ayah: number,
  status: AyahStatus,
): HifzProgress {
  return { ...progress, [surah]: { ...(progress[surah] ?? {}), [ayah]: status } };
}

export function knownCount(progress: HifzProgress, surah: number): number {
  return Object.values(progress[surah] ?? {}).filter((s) => s === 'known').length;
}

export async function loadHifzProgress(): Promise<HifzProgress> {
  return parseHifzProgress(await AsyncStorage.getItem(HIFZ_STORAGE_KEY));
}

async function saveHifzProgress(progress: HifzProgress): Promise<void> {
  // Schlaegt das fehl, ist der Hifz-Fortschritt beim naechsten Start weg —
  // fuer den Nutzer ein Datenverlust ohne jeden Hinweis. Mindestens in den
  // lokalen Fehler-Log, damit der Support-Bericht ihn zeigt.
  await AsyncStorage.setItem(HIFZ_STORAGE_KEY, JSON.stringify(progress)).catch((err: unknown) =>
    logError(err, 'hifz: Fortschritt speichern'),
  );
}

export function useHifzProgress() {
  const [progress, setProgress] = useState<HifzProgress>({});
  // Explizites Lade-Flag statt "progress hat Keys" als Heuristik zu nehmen:
  // ein Nutzer ohne EINEN einzigen markierten Vers hätte sonst dauerhaft ein
  // leeres progress-Objekt, obwohl der Load längst fertig ist (Konsument
  // bräuchte sonst einen unmöglich zu erfüllenden "leer = noch am Laden"-Test).
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadHifzProgress().then((p) => {
        if (!cancelled) {
          setProgress(p);
          setLoaded(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const mark = useCallback((surah: number, ayah: number, status: AyahStatus) => {
    setProgress((prev) => {
      const next = setAyahStatus(prev, surah, ayah, status);
      saveHifzProgress(next);
      return next;
    });
  }, []);

  return { progress, mark, loaded };
}
