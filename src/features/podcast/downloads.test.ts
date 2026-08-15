// Fehler- und Abbruchpfade des Podcast-Download-Singletons. Bewusst OHNE
// Render-Test (der Hook usePodcastDownload bleibt aussen vor) — geprueft wird
// die Modul-Logik mit gemocktem FileSystem und dem offiziellen
// AsyncStorage-Jest-Mock aus jest.setup.js.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  cancelEpisodeDownload,
  deleteAllPodcastDownloads,
  deleteEpisodeDownload,
  downloadEpisode,
  isEpisodeDownloaded,
  isEpisodeDownloading,
  listDownloadedEpisodes,
  podcastDownloadProgress,
  resolveEpisodeAudioUri,
  subscribePodcastDownload,
} from './downloads';
import type { PodcastEpisode } from './data';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false, size: 0 })),
  downloadAsync: jest.fn(async () => ({ status: 200 })),
  createDownloadResumable: jest.fn(),
}));

jest.mock('@/lib/haptics', () => ({ hapticSuccess: jest.fn() }));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;

function folge(over: Partial<PodcastEpisode> = {}): PodcastEpisode {
  return {
    episode_no: 1,
    title: 'Folge 1',
    topics: [],
    duration_sec: 60,
    audio_url: 'https://example.test/1.mp3',
    ...over,
  } as PodcastEpisode;
}

/** Baut ein createDownloadResumable-Double, dessen downloadAsync `result` liefert. */
function mockResumable(result: unknown, cancelAsync = jest.fn(async () => undefined)) {
  const downloadAsync = jest.fn(async () => result);
  fs.createDownloadResumable.mockReturnValue({
    downloadAsync,
    cancelAsync,
  } as unknown as ReturnType<typeof FileSystem.createDownloadResumable>);
  return { downloadAsync, cancelAsync };
}

/** Laesst alle anhaengigen Microtasks laufen — downloadEpisode awaited erst
 *  makeDirectoryAsync, bevor es sich als "aktiv" registriert. */
const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  fs.getInfoAsync.mockResolvedValue({ exists: false, size: 0 } as never);
  fs.deleteAsync.mockResolvedValue(undefined as never);
  fs.makeDirectoryAsync.mockResolvedValue(undefined as never);
  fs.downloadAsync.mockResolvedValue({ status: 200 } as never);
});

describe('downloadEpisode — Fehlerpfade', () => {
  it('wirft mit HTTP-Status im Code und raeumt die Teil-Datei weg', async () => {
    mockResumable({ status: 404 });
    await expect(downloadEpisode(folge())).rejects.toThrow('podcast_download_404');
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/podcast/1.mp3', { idempotent: true });
  });

  it('wirft "unknown", wenn downloadAsync gar kein Ergebnis liefert', async () => {
    mockResumable(undefined);
    await expect(downloadEpisode(folge())).rejects.toThrow('podcast_download_unknown');
  });

  it('wirft bei 200 mit 0-Byte-Datei (Teil-Download gilt NICHT als fertig)', async () => {
    mockResumable({ status: 200 });
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 0 } as never);
    await expect(downloadEpisode(folge())).rejects.toThrow('podcast_download_empty');
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/podcast/1.mp3', { idempotent: true });
  });

  it('meldet den Abonnenten nach einem Fehlschlag "none" statt "done"', async () => {
    mockResumable({ status: 500 });
    const gesehen: string[] = [];
    const unsub = subscribePodcastDownload(1, (s) => gesehen.push(s.state));
    await expect(downloadEpisode(folge())).rejects.toThrow();
    unsub();
    expect(gesehen).toEqual(['downloading', 'none']);
  });

  it('haelt den Download nicht als aktiv fest, wenn er geworfen hat', async () => {
    mockResumable({ status: 500 });
    await expect(downloadEpisode(folge())).rejects.toThrow();
    expect(isEpisodeDownloading(1)).toBe(false);
    expect(podcastDownloadProgress(1)).toBeNull();
  });

  it('ein Abonnent, der selbst wirft, stoppt die Benachrichtigung der anderen nicht', async () => {
    mockResumable({ status: 200 });
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 10 } as never);
    const gut = jest.fn();
    const unsubA = subscribePodcastDownload(1, () => {
      throw new Error('Screen unmounted');
    });
    const unsubB = subscribePodcastDownload(1, gut);
    await downloadEpisode(folge());
    unsubA();
    unsubB();
    expect(gut).toHaveBeenCalledWith({ state: 'done', progress: 1 });
  });

  it('ein fehlgeschlagenes Cover laesst die Folge trotzdem als fertig gelten', async () => {
    mockResumable({ status: 200 });
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 1234 } as never);
    fs.downloadAsync.mockRejectedValue(new Error('cover kaputt') as never);
    await expect(downloadEpisode(folge({ cover_url: 'https://example.test/c.jpg' }))).resolves.toBeUndefined();
    const [meta] = await listDownloadedEpisodes();
    expect(meta).toMatchObject({ episodeNo: 1, hasCover: false, bytes: 1234 });
  });
});

describe('Abbruch', () => {
  it('cancelEpisodeDownload bricht ab, loescht die Teil-Datei und meldet "none"', async () => {
    let freigeben: (v: unknown) => void = () => {};
    const blockiert = new Promise((r) => {
      freigeben = r;
    });
    const cancelAsync = jest.fn(async () => undefined);
    const downloadAsync = jest.fn(() => blockiert);
    fs.createDownloadResumable.mockReturnValue({ downloadAsync, cancelAsync } as never);

    const gesehen: string[] = [];
    const unsub = subscribePodcastDownload(1, (s) => gesehen.push(s.state));
    const lauf = downloadEpisode(folge());
    await flush();
    expect(isEpisodeDownloading(1)).toBe(true);

    await cancelEpisodeDownload(1);
    expect(cancelAsync).toHaveBeenCalled();
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/podcast/1.mp3', { idempotent: true });
    expect(isEpisodeDownloading(1)).toBe(false);

    // Der abgebrochene Lauf darf danach KEIN zweites 'none' mehr melden.
    freigeben({ status: 200 });
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 5 } as never);
    await lauf.catch(() => undefined);
    unsub();
    expect(gesehen.filter((s) => s === 'none')).toHaveLength(1);
  });

  it('cancelEpisodeDownload auf einem nicht laufenden Download tut nichts', async () => {
    await cancelEpisodeDownload(99);
    expect(fs.deleteAsync).not.toHaveBeenCalled();
  });

  it('ein zweiter downloadEpisode-Aufruf startet den laufenden nicht neu', async () => {
    const blockiert = new Promise(() => {});
    const downloadAsync = jest.fn(() => blockiert);
    fs.createDownloadResumable.mockReturnValue({
      downloadAsync,
      cancelAsync: jest.fn(async () => undefined),
    } as never);

    void downloadEpisode(folge()).catch(() => undefined);
    await flush();
    await downloadEpisode(folge());
    expect(downloadAsync).toHaveBeenCalledTimes(1);
    await cancelEpisodeDownload(1);
  });
});

describe('Zustandsabfragen', () => {
  it('isEpisodeDownloaded ist false, wenn getInfoAsync wirft', async () => {
    fs.getInfoAsync.mockRejectedValue(new Error('FS weg') as never);
    await expect(isEpisodeDownloaded(1)).resolves.toBe(false);
  });

  it('isEpisodeDownloaded ist false bei existierender 0-Byte-Datei', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 0 } as never);
    await expect(isEpisodeDownloaded(1)).resolves.toBe(false);
  });

  it('resolveEpisodeAudioUri faellt auf die Remote-URL zurueck, wenn nichts lokal liegt', async () => {
    await expect(resolveEpisodeAudioUri(folge())).resolves.toBe('https://example.test/1.mp3');
  });

  it('resolveEpisodeAudioUri bevorzugt die lokale Datei', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 99 } as never);
    await expect(resolveEpisodeAudioUri(folge())).resolves.toBe('file:///doc/podcast/1.mp3');
  });

  it('listDownloadedEpisodes ueberspringt verwaiste Index-Eintraege', async () => {
    await AsyncStorage.setItem(
      'salatibox:podcast-downloads',
      JSON.stringify({ '1': { title: 'da', bytes: 10, hasCover: false }, '2': { title: 'weg', bytes: 10, hasCover: false } }),
    );
    fs.getInfoAsync.mockImplementation(async (uri: string) =>
      uri.includes('/1.mp3') ? ({ exists: true, size: 10 } as never) : ({ exists: false, size: 0 } as never),
    );
    const liste = await listDownloadedEpisodes();
    expect(liste.map((e) => e.episodeNo)).toEqual([1]);
  });

  it('listDownloadedEpisodes liefert [] bei kaputtem Index-JSON', async () => {
    await AsyncStorage.setItem('salatibox:podcast-downloads', '{kein json');
    await expect(listDownloadedEpisodes()).resolves.toEqual([]);
  });
});

describe('Loeschen', () => {
  it('deleteEpisodeDownload entfernt Audio, Cover und Index-Eintrag', async () => {
    await AsyncStorage.setItem(
      'salatibox:podcast-downloads',
      JSON.stringify({ '1': { title: 'x', bytes: 1, hasCover: true } }),
    );
    await deleteEpisodeDownload(1);
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/podcast/1.mp3', { idempotent: true });
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/podcast/1-cover.jpg', { idempotent: true });
    expect(await AsyncStorage.getItem('salatibox:podcast-downloads')).toBe('{}');
  });

  it('deleteAllPodcastDownloads raeumt Verzeichnis und Index', async () => {
    await AsyncStorage.setItem('salatibox:podcast-downloads', JSON.stringify({ '1': { title: 'x', bytes: 1, hasCover: false } }));
    await deleteAllPodcastDownloads();
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/podcast/', { idempotent: true });
    expect(await AsyncStorage.getItem('salatibox:podcast-downloads')).toBeNull();
  });
});
