import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useSettings } from '@/features/settings/store';
import type { PrayerTimeOffsets } from '@/features/settings/types';

import { fetchTimingsWithRetry, fetchUpcomingTimings, type HijriDate, type Timings } from './api';
import { calcOptionsFromSettings } from './calc';
import { readTimingsCache, writeTimingsCache } from './storage';
import { useDayKey } from './useDayKey';
import { useTimezoneKey } from './useTimezoneKey';

export interface TimingsData {
  today: Timings;
  tomorrow: Timings;
  hijri?: HijriDate;
}

/**
 * Rechenparameter aus den Einstellungen. Memoisiert an der Settings-Identität
 * (die sich nur bei einem echten update() ändert), damit das Objekt nicht bei
 * jedem Render neu entsteht. Die react-query-Keys unten nutzen bewusst die
 * primitiven Felder statt des Objekts.
 */
function useCalcOptions() {
  const { settings } = useSettings();
  return useMemo(() => calcOptionsFromSettings(settings), [settings]);
}

/** Stabile Key-Repräsentation der Minuten-Korrektur für react-query. */
function offsetKey(offsets: PrayerTimeOffsets): string {
  return `${offsets.fajr},${offsets.sunrise},${offsets.dhuhr},${offsets.asr},${offsets.maghrib},${offsets.isha}`;
}

export function useTimings() {
  const { settings } = useSettings();
  const { lat, lon } = settings.location;
  const opts = useCalcOptions();
  const dayKey = useDayKey();
  // Zeitzonenschlüssel: nach einem Zonen-/Versatzwechsel (Reise, Sommerzeit)
  // sind die gecachten Zeiten für die alte Zone gerechnet — siehe useTimezoneKey.
  const tzKey = useTimezoneKey();

  return useQuery<TimingsData>({
    // dayKey im Query-Key: erzwingt Refetch bei Tageswechsel statt nur beim
    // stündlichen Poll zu warten (Audit-Bug, siehe useDayKey.ts).
    queryKey: [
      'timings',
      lat,
      lon,
      opts.method,
      opts.school,
      opts.highLatitude,
      offsetKey(opts.offsets),
      dayKey,
      tzKey,
    ],
    queryFn: async () => {
      const today = new Date();
      // setDate() statt +86_400_000ms: an DST-Umstellungstagen hat der lokale
      // Kalendertag nur 23 bzw. 25 Stunden — feste Millisekunden-Arithmetik
      // kann dann kurz vor Mitternacht auf den übernächsten statt den
      // nächsten Kalendertag springen (falsches "morgen" für Aladhan-Anfrage).
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const [t, tm] = await Promise.all([
        fetchTimingsWithRetry(lat, lon, today, opts),
        fetchTimingsWithRetry(lat, lon, tomorrow, opts),
      ]);

      // fetchTimingsWithRetry liefert seit der Offline-Berechnung immer Zeiten
      // (API oder adhan-js). Nur das Hijri-Datum kommt ausschließlich von der
      // API — offline aus dem letzten Cache-Stand ergänzen, sonst fehlt die
      // Hijri-Zeile im Screen.
      const hijri = t.hijri ?? (await readTimingsCache(lat, lon, opts))?.hijri;
      const data: TimingsData = { today: t.timings, tomorrow: tm.timings, hijri };
      if (t.hijri) await writeTimingsCache(lat, lon, opts, data);
      return data;
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * 7-Tage-Fenster für die Wochenübersicht-Tabelle (app/prayer-times-week.tsx).
 * Nutzt denselben Kalender-Endpoint wie die Notification-Planung in
 * prayer-times-screen.tsx (fetchUpcomingTimings, s. api.ts) — ein eigener
 * Query-Key, da die Notification-Planung ihr Fenster in einem useEffect statt
 * über react-query lädt und nicht gecacht werden soll.
 */
export function useWeekTimings() {
  const { settings } = useSettings();
  const { lat, lon } = settings.location;
  const opts = useCalcOptions();
  const dayKey = useDayKey();
  const tzKey = useTimezoneKey();

  return useQuery({
    queryKey: [
      'timings-week',
      lat,
      lon,
      opts.method,
      opts.school,
      opts.highLatitude,
      offsetKey(opts.offsets),
      dayKey,
      tzKey,
    ],
    queryFn: () => fetchUpcomingTimings(lat, lon, opts, 7),
    staleTime: 60 * 60 * 1000,
  });
}
