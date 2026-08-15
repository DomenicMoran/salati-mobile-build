import { QueryClient } from '@tanstack/react-query';

import { sortByDistance } from './hooks';
import type { Mosque } from './overpass';

describe('sortByDistance', () => {
  const mosques: Mosque[] = [
    { id: 'node/1', lat: 52.6, lon: 13.4, name: 'Weiter weg' },
    { id: 'way/2', lat: 52.51, lon: 13.4, name: 'Näher dran' },
  ];

  it('sortiert die nächste Moschee zuerst', () => {
    const sorted = sortByDistance(mosques, 52.52, 13.405);
    expect(sorted[0].name).toBe('Näher dran');
    expect(sorted[0].distanceKm).toBeLessThan(sorted[1].distanceKm);
  });
});

// Regressionstest für den Offline-Banner in app/mosques.tsx: react-query
// (@tanstack/query-core, siehe query.js reducer, case "error") setzt
// status:"error" bei einem fehlgeschlagenen (Hintergrund-)Refetch OHNE die
// vorher erfolgreich geladenen Daten zu löschen. Ein UI, das nur auf isError
// verzweigt, würde also eine Fehlermeldung ÜBER einer weiterhin
// funktionierenden (nur potenziell veralteten) Moscheen-Karte/-Liste
// anzeigen. mosques.tsx muss stattdessen zwischen "isError ohne Daten"
// (harter Fehler) und "isError mit Daten" (Offline-Hinweis über den zuletzt
// geladenen Daten) unterscheiden - dieser Test belegt den Mechanismus, auf
// dem diese Unterscheidung beruht.
describe('react-query: gecachte Daten überleben einen fehlgeschlagenen Refetch', () => {
  it('behält die zuletzt geladenen Moscheen, obwohl der Folge-Fetch fehlschlägt', async () => {
    const client = new QueryClient();
    const key = ['mosques', 'nearby', 52.52, 13.405, 15] as const;

    await client.fetchQuery<Mosque[]>({
      queryKey: key,
      queryFn: async () => [{ id: 'node/1', lat: 52.52, lon: 13.405, name: 'Test-Moschee' }],
    });
    expect(client.getQueryState<Mosque[]>(key)?.status).toBe('success');
    expect(client.getQueryState<Mosque[]>(key)?.data).toHaveLength(1);

    await expect(
      client.fetchQuery<Mosque[]>({
        queryKey: key,
        queryFn: async () => {
          throw new Error('offline');
        },
        retry: false,
      }),
    ).rejects.toThrow('offline');

    const state = client.getQueryState<Mosque[]>(key);
    expect(state?.status).toBe('error');
    expect(state?.data).toHaveLength(1);
    expect(state?.data?.[0].name).toBe('Test-Moschee');

    client.clear();
    client.unmount();
  });
});
