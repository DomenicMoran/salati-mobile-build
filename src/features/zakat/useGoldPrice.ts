import { useQuery } from '@tanstack/react-query';

import type { ZakatCurrency } from './calc';
import { getGoldPricePerGram } from './price';

// Goldpreis muss für die Zakat-Berechnung nicht sekundenaktuell sein — 6h
// staleTime schont Netzwerk/Rate-Limits, ist aber weit genug unter "Stand
// Juli 2026" (statischer Fallback), um immer den echten Tageskurs zu zeigen.
const STALE_TIME_MS = 6 * 60 * 60 * 1000;

/** Aktueller Goldpreis in `currency`/Gramm — live, mit Cache-Fallback (siehe price.ts). */
export function useGoldPrice(currency: ZakatCurrency) {
  return useQuery({
    queryKey: ['zakat', 'goldPrice', currency],
    queryFn: () => getGoldPricePerGram(currency),
    staleTime: STALE_TIME_MS,
  });
}
