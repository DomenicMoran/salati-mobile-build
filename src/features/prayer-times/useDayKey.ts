import { useEffect, useState } from 'react';

function computeDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Liefert einen String, der sich exakt einmal pro Kalendertag ändert.
 * Als Teil eines Query-Keys erzwingt das einen Refetch bei Mitternacht, statt
 * nur auf den stündlichen Poll zu warten — sonst zeigen "heute"/"morgen" bis
 * zu eine Stunde nach Mitternacht die falschen Werte (siehe Audit-Bug in
 * apps/device/src/components/SalatiDashboard.tsx, dort nachträglich gefixt).
 */
export function useDayKey(): string {
  const [dayKey, setDayKey] = useState(() => computeDayKey(new Date()));

  useEffect(() => {
    const iv = setInterval(() => {
      const next = computeDayKey(new Date());
      setDayKey((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  return dayKey;
}
