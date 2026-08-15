import { useQuery } from '@tanstack/react-query';

import { distanceKm } from './geo';
import { fetchNearbyMosques, type Mosque } from './overpass';

export function useNearbyMosques(lat: number | undefined, lon: number | undefined, radiusKm: number) {
  return useQuery({
    queryKey: ['mosques', 'nearby', lat, lon, radiusKm],
    queryFn: () => fetchNearbyMosques(lat as number, lon as number, radiusKm * 1000),
    enabled: lat != null && lon != null,
    staleTime: 60 * 60 * 1000,
  });
}

/** Sortiert Moscheen nach Distanz zu einem Referenzpunkt (nächste zuerst). */
export function sortByDistance(
  mosques: Mosque[],
  refLat: number,
  refLon: number,
): (Mosque & { distanceKm: number })[] {
  return mosques
    .map((m) => ({ ...m, distanceKm: distanceKm(refLat, refLon, m.lat, m.lon) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
