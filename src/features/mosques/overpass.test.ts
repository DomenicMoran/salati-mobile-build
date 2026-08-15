/**
 * Audit 2026-07-27, Befund O2.
 *
 * Vor dem Fix uebernahm `toMosque` `el.id` unveraendert. Die Overpass-Abfrage
 * holt aber `node` UND `way`, und OSM fuehrt beide in GETRENNTEN ID-Raeumen:
 * `node/240094030` und `way/240094030` koennen im selben Radius liegen. Folge
 * waeren doppelte React-Keys in der Liste und — schlimmer — ein falsches Ziel
 * beim Routen-Knopf im Karten-Popup, weil `mosques.find(m => m.id === data.id)`
 * den erstbesten Treffer nimmt.
 *
 * Der Fix aendert das persistierte Cache-Format, deshalb steckt eine Version
 * im Schluessel. Beides ist hier belegt: gegen den alten Stand sind
 * „unterscheidet node und way" und „Cache-Schluessel traegt die Formatversion"
 * rot.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchNearbyHalal, fetchNearbyMosques } from './overpass';

const realFetch = globalThis.fetch;

interface Element {
  id: number;
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function mockOverpass(elements: Element[]): void {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ elements }),
  }) as unknown as typeof fetch;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  jest.restoreAllMocks();
});

describe('fetchNearbyMosques — Identitaet der Treffer', () => {
  it('unterscheidet node und way mit derselben Zahl', async () => {
    mockOverpass([
      { id: 240094030, type: 'node', lat: 52.52, lon: 13.4, tags: { name: 'Moschee A' } },
      {
        id: 240094030,
        type: 'way',
        center: { lat: 52.53, lon: 13.41 },
        tags: { name: 'Moschee B' },
      },
    ]);
    const mosques = await fetchNearbyMosques(52.52, 13.405, 5000);
    expect(mosques.map((m) => m.id)).toEqual(['node/240094030', 'way/240094030']);
    // Genau das ist der Schaden, den der Befund beschreibt: eine Suche nach
    // der Identitaet darf nicht den falschen Treffer liefern.
    expect(mosques.find((m) => m.id === 'way/240094030')?.name).toBe('Moschee B');
    expect(new Set(mosques.map((m) => m.id)).size).toBe(mosques.length);
  });

  it('nimmt bei fehlendem Typ ein neutrales Praefix statt der nackten Zahl', async () => {
    mockOverpass([{ id: 42, lat: 1, lon: 2, tags: { name: 'Ohne Typ' } }]);
    const [m] = await fetchNearbyMosques(1, 2, 1000);
    expect(m.id).toBe('element/42');
  });

  it('uebernimmt bei way-Treffern den center-Punkt', async () => {
    mockOverpass([{ id: 7, type: 'way', center: { lat: 48.1, lon: 11.6 }, tags: { name: 'X' } }]);
    const [m] = await fetchNearbyMosques(48, 11, 3000);
    expect([m.lat, m.lon]).toEqual([48.1, 11.6]);
  });

  it('verwirft Treffer ganz ohne Koordinaten', async () => {
    mockOverpass([{ id: 9, type: 'way', tags: { name: 'Ohne Punkt' } }]);
    await expect(fetchNearbyMosques(48, 11, 3000)).resolves.toEqual([]);
  });
});

describe('Cache-Versionierung', () => {
  it('schreibt unter einem Schluessel mit Formatversion', async () => {
    mockOverpass([{ id: 1, type: 'node', lat: 52.52, lon: 13.4, tags: { name: 'A' } }]);
    await fetchNearbyMosques(52.52, 13.405, 5000);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toContain('salatibox:mosques:v2:52.52:13.40:5000');
  });

  it('liest Eintraege im ALTEN Format nicht mehr — sonst kaeme die nackte Zahl zurueck', async () => {
    // Genau der Grund fuer die Versionierung: ein alter Eintrag mit
    // numerischer id wuerde den Routen-Knopf ins Leere laufen lassen.
    await AsyncStorage.setItem(
      'salatibox:mosques:52.52:13.40:5000',
      JSON.stringify({ savedAt: Date.now(), mosques: [{ id: 1, lat: 52.5, lon: 13.4, name: 'Alt' }] }),
    );
    mockOverpass([{ id: 1, type: 'node', lat: 52.52, lon: 13.4, tags: { name: 'Neu' } }]);
    const mosques = await fetchNearbyMosques(52.52, 13.405, 5000);
    expect(mosques[0].id).toBe('node/1');
    expect(mosques[0].name).toBe('Neu');
  });

  it('nutzt einen frischen Eintrag im NEUEN Format ohne weiteren Abruf', async () => {
    await AsyncStorage.setItem(
      'salatibox:mosques:v2:52.52:13.40:5000',
      JSON.stringify({
        savedAt: Date.now(),
        mosques: [{ id: 'node/5', lat: 52.5, lon: 13.4, name: 'Aus dem Cache' }],
      }),
    );
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
    const mosques = await fetchNearbyMosques(52.52, 13.405, 5000);
    expect(mosques[0].name).toBe('Aus dem Cache');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('versioniert auch den Halal-Cache — dieselbe Struktur, dieselbe id', async () => {
    mockOverpass([
      { id: 3, type: 'way', center: { lat: 52.5, lon: 13.4 }, tags: { name: 'Imbiss', cuisine: 'kebab' } },
    ]);
    const places = await fetchNearbyHalal(52.52, 13.405, 5000);
    expect(places[0].id).toBe('way/3');
    expect(places[0].cuisine).toBe('kebab');
    expect(await AsyncStorage.getAllKeys()).toContain('salatibox:halal:v2:52.52:13.40:5000');
  });
});
