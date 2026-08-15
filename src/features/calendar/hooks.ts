import { useQuery } from '@tanstack/react-query';

import { fetchGregorianMonth, fetchGregorianToHijri, fetchHijriToGregorian } from './api';
import { fmtDateAladhan } from '@/features/prayer-times/api';

/** Gregorianischer Monat (1–12) + Jahr → Hijri-Kalender-Tage. Lange Cache-TTL,
 * die Zuordnung eines Kalendermonats ändert sich nie rückwirkend. */
export function useHijriMonth(month: number, year: number) {
  return useQuery({
    queryKey: ['calendar', 'month', month, year],
    queryFn: () => fetchGregorianMonth(month, year),
    staleTime: 30 * 24 * 60 * 60 * 1000,
  });
}

/** Einzeldatum Gregorianisch → Hijri, für den freien Datumsumrechner.
 * Ein fixes Datum ändert seine Hijri-Zuordnung nie rückwirkend, daher
 * unendliche Cache-TTL wie bei useHijriMonth. `enabled` erlaubt dem Aufrufer,
 * die Anfrage bei (noch) ungültiger Nutzereingabe zu unterdrücken. */
export function useGregorianToHijri(date: Date, enabled: boolean = true) {
  return useQuery({
    queryKey: ['calendar', 'gToH', fmtDateAladhan(date)],
    queryFn: () => fetchGregorianToHijri(date),
    staleTime: Infinity,
    enabled,
  });
}

/** Einzeldatum Hijri → Gregorianisch, Kehrseite von useGregorianToHijri.
 * Deaktiviert die Anfrage automatisch bei unvollständigen/ungültigen
 * Eingaben; `enabled` erlaubt dem Aufrufer zusätzlich, z. B. bei
 * inaktivem Umrechnungsmodus zu unterdrücken. */
export function useHijriToGregorian(day: number, month: number, year: number, enabled: boolean = true) {
  return useQuery({
    queryKey: ['calendar', 'hToG', day, month, year],
    queryFn: () => fetchHijriToGregorian(day, month, year),
    staleTime: Infinity,
    enabled: enabled && day >= 1 && day <= 30 && month >= 1 && month <= 12 && year >= 1,
  });
}
