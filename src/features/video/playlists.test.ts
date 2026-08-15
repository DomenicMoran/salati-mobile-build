import AsyncStorage from '@react-native-async-storage/async-storage';

// Playlists sind rein lokale Nutzerdaten ohne Server-Backup — ein Fehler hier
// ist echter Datenverlust. Das Modul hält seinen Zustand in einem
// Modul-Singleton; jeder Test braucht deshalb eine frische Modul-Instanz,
// sonst prüft der zweite Test nur noch den Cache des ersten.
type PlaylistsModule = typeof import('./playlists');

/**
 * Frische Modul-Instanz (leerer Singleton-Cache) OHNE den AsyncStorage-Mock
 * mitzurücksetzen. `jest.resetModules()` würde auch den Mock neu instanziieren
 * und damit den gespeicherten Inhalt verlieren — genau das, was die
 * Neustart-Tests unten prüfen wollen. `isolateModules` betrifft nur das
 * `require` in der Callback-Funktion.
 */
function reloadModule(): PlaylistsModule {
  let mod: PlaylistsModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- muss innerhalb von isolateModules laufen
    mod = require('./playlists') as PlaylistsModule;
  });
  return mod!;
}

/** Neustart mit leerem Speicher — Ausgangspunkt der meisten Tests. */
async function freshModule(): Promise<PlaylistsModule> {
  await AsyncStorage.clear();
  return reloadModule();
}

describe('createPlaylist', () => {
  it('legt eine leere Playlist mit getrimmtem Namen an', async () => {
    const m = await freshModule();
    const pl = await m.createPlaylist('  Tajwid  ');
    expect(pl.name).toBe('Tajwid');
    expect(pl.episodeNos).toEqual([]);
    expect(await m.listPlaylists()).toHaveLength(1);
  });

  it('nutzt "Playlist" als Fallback für leere Namen', async () => {
    const m = await freshModule();
    expect((await m.createPlaylist('')).name).toBe('Playlist');
    expect((await m.createPlaylist('   ')).name).toBe('Playlist');
  });

  it('vergibt eindeutige IDs auch bei schneller Folge', async () => {
    const m = await freshModule();
    const ids = new Set<string>();
    for (let i = 0; i < 25; i++) ids.add((await m.createPlaylist(`P${i}`)).id);
    expect(ids.size).toBe(25);
  });
});

describe('addToPlaylist / removeFromPlaylist', () => {
  it('hängt Folgen in Reihenfolge an und ignoriert Duplikate', async () => {
    const m = await freshModule();
    const pl = await m.createPlaylist('A');
    await m.addToPlaylist(pl.id, 3);
    await m.addToPlaylist(pl.id, 1);
    await m.addToPlaylist(pl.id, 3);
    expect((await m.listPlaylists())[0].episodeNos).toEqual([3, 1]);
  });

  it('entfernt eine Folge, ohne die Reihenfolge der übrigen zu ändern', async () => {
    const m = await freshModule();
    const pl = await m.createPlaylist('A');
    for (const n of [5, 6, 7]) await m.addToPlaylist(pl.id, n);
    await m.removeFromPlaylist(pl.id, 6);
    expect((await m.listPlaylists())[0].episodeNos).toEqual([5, 7]);
  });

  it('ist ein No-op für eine unbekannte Playlist-ID', async () => {
    const m = await freshModule();
    const pl = await m.createPlaylist('A');
    await m.addToPlaylist('gibt-es-nicht', 1);
    await m.removeFromPlaylist('gibt-es-nicht', 1);
    expect((await m.listPlaylists())[0].episodeNos).toEqual([]);
    expect(pl.episodeNos).toEqual([]);
  });
});

describe('renamePlaylist / deletePlaylist', () => {
  it('benennt um, behält bei leerem Namen aber den alten', async () => {
    const m = await freshModule();
    const pl = await m.createPlaylist('Alt');
    await m.renamePlaylist(pl.id, 'Neu');
    expect((await m.listPlaylists())[0].name).toBe('Neu');
    await m.renamePlaylist(pl.id, '   ');
    expect((await m.listPlaylists())[0].name).toBe('Neu');
  });

  it('löscht nur die genannte Playlist', async () => {
    const m = await freshModule();
    const a = await m.createPlaylist('A');
    await m.createPlaylist('B');
    await m.deletePlaylist(a.id);
    expect((await m.listPlaylists()).map((p) => p.name)).toEqual(['B']);
  });
});

describe('Sortierung und Persistenz', () => {
  it('sortiert nach zuletzt geändert absteigend', async () => {
    const m = await freshModule();
    const a = await m.createPlaylist('A');
    const b = await m.createPlaylist('B');
    // updatedAt hat Millisekunden-Auflösung — erst nach einer echten Änderung
    // mit späterem Zeitstempel ist die Reihenfolge aussagekräftig.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);
    await m.addToPlaylist(a.id, 1);
    jest.spyOn(Date, 'now').mockRestore();
    const sorted = await m.listPlaylists();
    expect(sorted.map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it('lädt gespeicherte Playlists nach einem App-Neustart wieder', async () => {
    const first = await freshModule();
    const pl = await first.createPlaylist('Seerah');
    await first.addToPlaylist(pl.id, 12);

    // Neustart simulieren: Modul-Singleton weg, AsyncStorage bleibt.
    const second = reloadModule();
    const restored = await second.listPlaylists();
    expect(restored).toHaveLength(1);
    expect(restored[0].name).toBe('Seerah');
    expect(restored[0].episodeNos).toEqual([12]);
  });

  it('verwirft kaputte Einträge, statt die ganze Liste zu verlieren', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(
      'salatibox:video-playlists',
      JSON.stringify([
        { id: 'ok', name: 'Gut', episodeNos: [1], createdAt: 1, updatedAt: 1 },
        { id: 'kaputt' }, // episodeNos fehlt
        null,
        'string statt objekt',
      ]),
    );
    const m = reloadModule();
    expect((await m.listPlaylists()).map((p) => p.id)).toEqual(['ok']);
  });

  it('startet mit leerer Liste, wenn der Speicherinhalt unlesbar ist', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('salatibox:video-playlists', '{{{');
    const m = reloadModule();
    expect(await m.listPlaylists()).toEqual([]);
  });
});

describe('subscribePlaylists', () => {
  it('meldet jede Änderung an alle Abonnenten und lässt sich abbestellen', async () => {
    const m = await freshModule();
    const seen: number[] = [];
    const unsub = m.subscribePlaylists((list) => seen.push(list.length));
    await m.createPlaylist('A');
    await m.createPlaylist('B');
    unsub();
    await m.createPlaylist('C');
    expect(seen).toEqual([1, 2]);
  });

  it('lässt einen werfenden Abonnenten die übrigen nicht blockieren', async () => {
    const m = await freshModule();
    const ok = jest.fn();
    m.subscribePlaylists(() => {
      throw new Error('Screen unmounted');
    });
    m.subscribePlaylists(ok);
    await m.createPlaylist('A');
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
