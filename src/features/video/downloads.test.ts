// Fehler- und Abbruchpfade des Video-Download-Singletons (strukturgleich zu
// features/podcast/downloads.ts — die Tests spiegeln deshalb bewusst dieselben
// Faelle, damit ein spaeteres Zusammenfuehren zu einem generischen
// createDownloadManager() beide Seiten abgedeckt vorfindet).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  cancelVideoDownload,
  deleteAllVideoDownloads,
  deleteVideoDownload,
  downloadVideo,
  isVideoDownloaded,
  isVideoDownloading,
  listDownloadedVideos,
  resolveVideoUri,
  subscribeVideoDownload,
} from './downloads';
import type { VideoEpisode } from './data';

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
const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

function folge(over: Partial<VideoEpisode> = {}): VideoEpisode {
  return {
    episode_no: 3,
    title: 'Video 3',
    topics: [],
    duration_sec: 120,
    video_url: 'https://example.test/3.mp4',
    ...over,
  } as VideoEpisode;
}

function mockResumable(result: unknown) {
  const downloadAsync = jest.fn(async () => result);
  const cancelAsync = jest.fn(async () => undefined);
  fs.createDownloadResumable.mockReturnValue({ downloadAsync, cancelAsync } as never);
  return { downloadAsync, cancelAsync };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  fs.getInfoAsync.mockResolvedValue({ exists: false, size: 0 } as never);
  fs.deleteAsync.mockResolvedValue(undefined as never);
  fs.makeDirectoryAsync.mockResolvedValue(undefined as never);
  fs.downloadAsync.mockResolvedValue({ status: 200 } as never);
});

describe('downloadVideo — Fehlerpfade', () => {
  it('wirft mit HTTP-Status und raeumt die Teil-Datei weg', async () => {
    mockResumable({ status: 403 });
    await expect(downloadVideo(folge())).rejects.toThrow('video_download_403');
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/video/3.mp4', { idempotent: true });
  });

  it('wirft "unknown" ohne Ergebnis von downloadAsync', async () => {
    mockResumable(null);
    await expect(downloadVideo(folge())).rejects.toThrow('video_download_unknown');
  });

  it('wirft bei 200 mit 0-Byte-Datei', async () => {
    mockResumable({ status: 200 });
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 0 } as never);
    await expect(downloadVideo(folge())).rejects.toThrow('video_download_empty');
  });

  it('meldet nach Fehlschlag "none" statt "done" und gibt den Slot frei', async () => {
    mockResumable({ status: 500 });
    const gesehen: string[] = [];
    const unsub = subscribeVideoDownload(3, (s) => gesehen.push(s.state));
    await expect(downloadVideo(folge())).rejects.toThrow();
    unsub();
    expect(gesehen).toEqual(['downloading', 'none']);
    expect(isVideoDownloading(3)).toBe(false);
  });

  it('ein fehlgeschlagenes Cover laesst das Video trotzdem als fertig gelten', async () => {
    mockResumable({ status: 200 });
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 500 } as never);
    fs.downloadAsync.mockRejectedValue(new Error('cover weg') as never);
    await expect(downloadVideo(folge({ cover_url: 'https://example.test/c.jpg' }))).resolves.toBeUndefined();
    const [meta] = await listDownloadedVideos();
    expect(meta).toMatchObject({ episodeNo: 3, hasCover: false, bytes: 500 });
  });
});

describe('Abbruch', () => {
  it('cancelVideoDownload bricht ab, loescht die Teil-Datei und meldet genau einmal "none"', async () => {
    let freigeben: (v: unknown) => void = () => {};
    const blockiert = new Promise((r) => {
      freigeben = r;
    });
    const cancelAsync = jest.fn(async () => undefined);
    fs.createDownloadResumable.mockReturnValue({ downloadAsync: () => blockiert, cancelAsync } as never);

    const gesehen: string[] = [];
    const unsub = subscribeVideoDownload(3, (s) => gesehen.push(s.state));
    const lauf = downloadVideo(folge());
    await flush();
    expect(isVideoDownloading(3)).toBe(true);

    await cancelVideoDownload(3);
    expect(cancelAsync).toHaveBeenCalled();
    expect(isVideoDownloading(3)).toBe(false);

    freigeben({ status: 200 });
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 5 } as never);
    await lauf.catch(() => undefined);
    unsub();
    expect(gesehen.filter((s) => s === 'none')).toHaveLength(1);
  });

  it('cancelVideoDownload ohne laufenden Download tut nichts', async () => {
    await cancelVideoDownload(77);
    expect(fs.deleteAsync).not.toHaveBeenCalled();
  });

  it('ein zweiter downloadVideo-Aufruf startet den laufenden nicht neu', async () => {
    const downloadAsync = jest.fn(() => new Promise(() => {}));
    fs.createDownloadResumable.mockReturnValue({
      downloadAsync,
      cancelAsync: jest.fn(async () => undefined),
    } as never);
    void downloadVideo(folge()).catch(() => undefined);
    await flush();
    await downloadVideo(folge());
    expect(downloadAsync).toHaveBeenCalledTimes(1);
    await cancelVideoDownload(3);
  });
});

describe('Zustandsabfragen und Loeschen', () => {
  it('isVideoDownloaded ist false, wenn getInfoAsync wirft', async () => {
    fs.getInfoAsync.mockRejectedValue(new Error('FS weg') as never);
    await expect(isVideoDownloaded(3)).resolves.toBe(false);
  });

  it('resolveVideoUri faellt auf die Remote-URL zurueck', async () => {
    await expect(resolveVideoUri(folge())).resolves.toBe('https://example.test/3.mp4');
  });

  it('listDownloadedVideos ueberspringt verwaiste Index-Eintraege', async () => {
    await AsyncStorage.setItem(
      'salatibox:video-downloads',
      JSON.stringify({ '3': { title: 'da', bytes: 1, hasCover: false }, '4': { title: 'weg', bytes: 1, hasCover: false } }),
    );
    fs.getInfoAsync.mockImplementation(async (uri: string) =>
      uri.includes('/3.mp4') ? ({ exists: true, size: 7 } as never) : ({ exists: false, size: 0 } as never),
    );
    expect((await listDownloadedVideos()).map((v) => v.episodeNo)).toEqual([3]);
  });

  it('deleteVideoDownload entfernt Datei, Cover und Index-Eintrag', async () => {
    await AsyncStorage.setItem('salatibox:video-downloads', JSON.stringify({ '3': { title: 'x', bytes: 1, hasCover: true } }));
    await deleteVideoDownload(3);
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/video/3.mp4', { idempotent: true });
    expect(await AsyncStorage.getItem('salatibox:video-downloads')).toBe('{}');
  });

  it('deleteAllVideoDownloads raeumt Verzeichnis und Index', async () => {
    await AsyncStorage.setItem('salatibox:video-downloads', JSON.stringify({ '3': { title: 'x', bytes: 1, hasCover: false } }));
    await deleteAllVideoDownloads();
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/video/', { idempotent: true });
    expect(await AsyncStorage.getItem('salatibox:video-downloads')).toBeNull();
  });
});
