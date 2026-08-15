// Fehler- und Abbruchpfade des Handout-Download-Singletons. Anders als
// Podcast/Video sind Handouts nach String-`id` verschluesselt — der
// Dateiname-Sanitizer (safeId) ist hier deshalb ein eigener Testfall.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  cancelHandoutDownload,
  deleteHandoutDownload,
  downloadHandout,
  handoutDownloadProgress,
  isHandoutDownloaded,
  isHandoutDownloading,
  localHandoutUri,
  subscribeHandoutDownload,
} from './downloads';
import type { Handout } from './data';

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

function unterlage(over: Partial<Handout> = {}): Handout {
  return {
    id: 'ep01',
    title: 'Unterlage 1',
    pdf_url: 'https://example.test/ep01.pdf',
    ...over,
  } as Handout;
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
});

describe('localHandoutUri — Dateinamen-Sanitizer', () => {
  it('ersetzt Pfad-Trenner und Sonderzeichen durch _', () => {
    // Kern-Invariante: aus dem handouts/-Verzeichnis kann keine id ausbrechen.
    expect(localHandoutUri('../../etc/passwd')).toBe('file:///doc/handouts/______etc_passwd.pdf');
    expect(localHandoutUri('a/b.c d')).toBe('file:///doc/handouts/a_b_c_d.pdf');
  });

  it('laesst Slug-artige ids unveraendert', () => {
    expect(localHandoutUri('ep-01_a')).toBe('file:///doc/handouts/ep-01_a.pdf');
  });
});

describe('downloadHandout — Fehlerpfade', () => {
  it('wirft mit HTTP-Status und raeumt die Teil-Datei weg', async () => {
    mockResumable({ status: 404 });
    await expect(downloadHandout(unterlage())).rejects.toThrow('handout_download_404');
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/handouts/ep01.pdf', { idempotent: true });
  });

  it('wirft "unknown" ohne Ergebnis von downloadAsync', async () => {
    mockResumable(undefined);
    await expect(downloadHandout(unterlage())).rejects.toThrow('handout_download_unknown');
  });

  it('wirft bei 200 mit 0-Byte-Datei (Teil-PDF gilt NICHT als fertig)', async () => {
    mockResumable({ status: 200 });
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 0 } as never);
    await expect(downloadHandout(unterlage())).rejects.toThrow('handout_download_empty');
  });

  it('meldet nach Fehlschlag "none" statt "done" und gibt den Slot frei', async () => {
    mockResumable({ status: 500 });
    const gesehen: string[] = [];
    const unsub = subscribeHandoutDownload('ep01', (s) => gesehen.push(s.state));
    await expect(downloadHandout(unterlage())).rejects.toThrow();
    unsub();
    expect(gesehen).toEqual(['downloading', 'none']);
    expect(isHandoutDownloading('ep01')).toBe(false);
    expect(handoutDownloadProgress('ep01')).toBeNull();
  });

  it('schreibt den Index-Eintrag nur bei echtem Erfolg', async () => {
    mockResumable({ status: 200 });
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 2048 } as never);
    await downloadHandout(unterlage());
    const roh = await AsyncStorage.getItem('salatibox:handout-downloads');
    expect(JSON.parse(roh ?? '{}')).toEqual({ ep01: { title: 'Unterlage 1', bytes: 2048 } });
  });
});

describe('Abbruch', () => {
  it('cancelHandoutDownload bricht ab, loescht die Teil-Datei und meldet genau einmal "none"', async () => {
    let freigeben: (v: unknown) => void = () => {};
    const blockiert = new Promise((r) => {
      freigeben = r;
    });
    const cancelAsync = jest.fn(async () => undefined);
    fs.createDownloadResumable.mockReturnValue({ downloadAsync: () => blockiert, cancelAsync } as never);

    const gesehen: string[] = [];
    const unsub = subscribeHandoutDownload('ep01', (s) => gesehen.push(s.state));
    const lauf = downloadHandout(unterlage());
    await flush();
    expect(isHandoutDownloading('ep01')).toBe(true);

    await cancelHandoutDownload('ep01');
    expect(cancelAsync).toHaveBeenCalled();
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/handouts/ep01.pdf', { idempotent: true });
    expect(isHandoutDownloading('ep01')).toBe(false);

    freigeben({ status: 200 });
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 5 } as never);
    await lauf.catch(() => undefined);
    unsub();
    expect(gesehen.filter((s) => s === 'none')).toHaveLength(1);
  });

  it('ein Fehler in cancelAsync bricht den Abbruch nicht ab', async () => {
    const blockiert = new Promise(() => {});
    const cancelAsync = jest.fn(async () => {
      throw new Error('nativ weg');
    });
    fs.createDownloadResumable.mockReturnValue({ downloadAsync: () => blockiert, cancelAsync } as never);
    void downloadHandout(unterlage()).catch(() => undefined);
    await flush();
    await expect(cancelHandoutDownload('ep01')).resolves.toBeUndefined();
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/handouts/ep01.pdf', { idempotent: true });
  });

  it('cancelHandoutDownload ohne laufenden Download tut nichts', async () => {
    await cancelHandoutDownload('gibtsnicht');
    expect(fs.deleteAsync).not.toHaveBeenCalled();
  });

  it('ein zweiter downloadHandout-Aufruf startet den laufenden nicht neu', async () => {
    const downloadAsync = jest.fn(() => new Promise(() => {}));
    fs.createDownloadResumable.mockReturnValue({
      downloadAsync,
      cancelAsync: jest.fn(async () => undefined),
    } as never);
    void downloadHandout(unterlage()).catch(() => undefined);
    await flush();
    await downloadHandout(unterlage());
    expect(downloadAsync).toHaveBeenCalledTimes(1);
    await cancelHandoutDownload('ep01');
  });
});

describe('Zustandsabfragen und Loeschen', () => {
  it('isHandoutDownloaded ist false, wenn getInfoAsync wirft', async () => {
    fs.getInfoAsync.mockRejectedValue(new Error('FS weg') as never);
    await expect(isHandoutDownloaded('ep01')).resolves.toBe(false);
  });

  it('isHandoutDownloaded ist false bei existierender 0-Byte-Datei', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 0 } as never);
    await expect(isHandoutDownloaded('ep01')).resolves.toBe(false);
  });

  it('deleteHandoutDownload entfernt Datei und Index-Eintrag', async () => {
    await AsyncStorage.setItem('salatibox:handout-downloads', JSON.stringify({ ep01: { title: 'x', bytes: 1 } }));
    await deleteHandoutDownload('ep01');
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/handouts/ep01.pdf', { idempotent: true });
    expect(await AsyncStorage.getItem('salatibox:handout-downloads')).toBe('{}');
  });
});
