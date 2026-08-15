// Modell-Download der nativen KI: geprueft werden die Fehler- und
// Abbruchpfade BEIDER Strategien (Android-DownloadManager vs. expo-Fallback),
// weil ein falsch als "fertig" gewerteter Abbruch spaeter nur noch als
// generisches "Modell nicht verfuegbar" auffaellt.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false, size: 0 })),
  writeAsStringAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(async () => ''),
  createDownloadResumable: jest.fn(),
}));

const mockDm = {
  isAvailable: jest.fn(() => true),
  getModelPath: jest.fn((name: string) => `/sdcard/ki/${name}`),
  exists: jest.fn(() => true),
  getStatus: jest.fn(() => ({ status: 8, bytesDownloaded: 10, bytesTotal: 10, reason: 0 })),
  start: jest.fn(async () => 42),
  deleteModel: jest.fn(),
};
let mockDmVerfuegbar = true;
jest.mock('expo', () => ({
  requireOptionalNativeModule: () => (mockDmVerfuegbar ? mockDm : null),
}));

const mockLogError = jest.fn(async () => undefined);
jest.mock('@/lib/errorLog', () => ({ logError: (...a: unknown[]) => mockLogError(...(a as [])) }));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;

/** Laedt model.ts frisch — die DM-Verfuegbarkeit wird auf Modulebene gecacht. */
function ladeModul(platform: 'android' | 'ios' | 'web', mitDM: boolean) {
  mockDmVerfuegbar = mitDM;
  Platform.OS = platform;
  let mod!: typeof import('./model');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.isolateModules() braucht ein DYNAMISCHES require; ein statischer import wuerde am Modul-Cache vorbeigehen.
    mod = require('./model') as typeof import('./model');
  });
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
  fs.getInfoAsync.mockResolvedValue({ exists: false, size: 0 } as never);
  fs.deleteAsync.mockResolvedValue(undefined as never);
  fs.makeDirectoryAsync.mockResolvedValue(undefined as never);
  fs.writeAsStringAsync.mockResolvedValue(undefined as never);
  fs.readAsStringAsync.mockResolvedValue('' as never);
  mockDm.isAvailable.mockReturnValue(true);
  mockDm.exists.mockReturnValue(true);
  mockDm.start.mockResolvedValue(42 as never);
});

afterAll(() => {
  Platform.OS = 'ios';
});

describe('Plattform-Faehigkeiten', () => {
  it('Web kann kein Modell speichern', () => {
    const m = ladeModul('web', false);
    expect(m.nativeKiUnterstuetzt()).toBe(false);
    expect(m.istModellHeruntergeladen()).resolves.toBe(false);
  });

  it('iOS nutzt den expo-Fallback-Pfad im Dokumentverzeichnis', () => {
    const m = ladeModul('ios', false);
    expect(m.modellPfad()).toBe(`file:///doc/ki-modell/${m.MODELL_DATEINAME}`);
  });

  it('Android mit gelinktem Modul nutzt den DownloadManager-Pfad', () => {
    const m = ladeModul('android', true);
    expect(m.modellPfad()).toBe(`/sdcard/ki/${m.MODELL_DATEINAME}`);
  });

  it('Android OHNE gelinktes Modul faellt auf den expo-Pfad zurueck', () => {
    const m = ladeModul('android', false);
    expect(m.modellPfad()).toBe(`file:///doc/ki-modell/${m.MODELL_DATEINAME}`);
  });
});

describe('DownloadManager-Pfad (Android)', () => {
  it('wirft, wenn der DM einen Fehlerstatus (16) meldet, und raeumt auf', async () => {
    const m = ladeModul('android', true);
    mockDm.getStatus.mockReturnValue({ status: 16, bytesDownloaded: 3, bytesTotal: 10, reason: 1009 });
    await expect(m.modellHerunterladen(() => {})).rejects.toThrow('Download fehlgeschlagen (Grund 1009)');
    expect(mockDm.deleteModel).toHaveBeenCalled();
  });

  it('wirft bei Status 0 (Eintrag vom System entfernt = abgebrochen)', async () => {
    const m = ladeModul('android', true);
    mockDm.getStatus.mockReturnValue({ status: 0, bytesDownloaded: 0, bytesTotal: 0, reason: 0 });
    await expect(m.modellHerunterladen(() => {})).rejects.toThrow('Download wurde abgebrochen');
  });

  it('wirft, wenn der DM Erfolg meldet, die Datei aber fehlt', async () => {
    const m = ladeModul('android', true);
    mockDm.getStatus.mockReturnValue({ status: 8, bytesDownloaded: 10, bytesTotal: 10, reason: 0 });
    mockDm.exists.mockReturnValue(false);
    await expect(m.modellHerunterladen(() => {})).rejects.toThrow('Download abgeschlossen, aber Datei fehlt');
  });

  it('meldet Fortschritt und faellt ohne Content-Length auf die Schaetzgroesse zurueck', async () => {
    const m = ladeModul('android', true);
    mockDm.getStatus.mockReturnValue({ status: 8, bytesDownloaded: 560_000_000, bytesTotal: 0, reason: 0 });
    const fortschritte: number[] = [];
    await m.modellHerunterladen((p) => fortschritte.push(p.anteil));
    expect(fortschritte[0]).toBeCloseTo(0.5, 2);
  });

  it('protokolliert einen Schreibfehler der DM-ID statt ihn zu verschlucken', async () => {
    const m = ladeModul('android', true);
    fs.readAsStringAsync.mockResolvedValue('' as never);
    fs.getInfoAsync.mockResolvedValue({ exists: false, size: 0 } as never);
    fs.writeAsStringAsync.mockRejectedValue(new Error('kein Platz') as never);
    mockDm.getStatus.mockReturnValue({ status: 8, bytesDownloaded: 10, bytesTotal: 10, reason: 0 });
    await m.modellHerunterladen(() => {});
    expect(mockLogError).toHaveBeenCalledWith(expect.any(Error), 'ki-modell: DownloadManager-ID speichern');
  });
});

describe('expo-Fallback-Pfad', () => {
  it('wirft mit HTTP-Status und raeumt die Teil-Datei weg', async () => {
    const m = ladeModul('ios', false);
    fs.createDownloadResumable.mockReturnValue({
      downloadAsync: jest.fn(async () => ({ status: 416 })),
    } as never);
    await expect(m.modellHerunterladen(() => {})).rejects.toThrow('Download fehlgeschlagen (Status 416)');
    expect(fs.deleteAsync).toHaveBeenCalledWith(`file:///doc/ki-modell/${m.MODELL_DATEINAME}`, {
      idempotent: true,
    });
  });

  it('wirft "unbekannt", wenn downloadAsync gar kein Ergebnis liefert', async () => {
    const m = ladeModul('ios', false);
    fs.createDownloadResumable.mockReturnValue({
      downloadAsync: jest.fn(async () => undefined),
    } as never);
    await expect(m.modellHerunterladen(() => {})).rejects.toThrow('Download fehlgeschlagen (Status unbekannt)');
  });

  it('protokolliert einen Fehler beim Anlegen des Zielverzeichnisses', async () => {
    const m = ladeModul('ios', false);
    fs.makeDirectoryAsync.mockRejectedValue(new Error('read-only') as never);
    fs.createDownloadResumable.mockReturnValue({
      downloadAsync: jest.fn(async () => ({ status: 200 })),
    } as never);
    await m.modellHerunterladen(() => {});
    expect(mockLogError).toHaveBeenCalledWith(expect.any(Error), 'ki-modell: Zielverzeichnis anlegen');
  });
});

describe('istModellHeruntergeladen / modellLoeschen', () => {
  it('0-Byte-Datei gilt NICHT als heruntergeladen (expo-Pfad)', async () => {
    const m = ladeModul('ios', false);
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 0 } as never);
    await expect(m.istModellHeruntergeladen()).resolves.toBe(false);
  });

  it('modellLoeschen nutzt auf Android den DM statt des Dateisystems', async () => {
    const m = ladeModul('android', true);
    await m.modellLoeschen();
    expect(mockDm.deleteModel).toHaveBeenCalledWith(m.MODELL_DATEINAME);
  });

  it('modellLoeschen loescht auf iOS die Datei', async () => {
    const m = ladeModul('ios', false);
    await m.modellLoeschen();
    expect(fs.deleteAsync).toHaveBeenCalledWith(`file:///doc/ki-modell/${m.MODELL_DATEINAME}`, {
      idempotent: true,
    });
  });
});

describe('formatiereBytes', () => {
  it('rundet MB und schaltet ab 1000 MB auf GB um', () => {
    const m = ladeModul('ios', false);
    expect(m.formatiereBytes(0)).toBe('0 MB');
    expect(m.formatiereBytes(-5)).toBe('0 MB');
    expect(m.formatiereBytes(12_400_000)).toBe('12 MB');
    expect(m.formatiereBytes(1_120_000_000)).toBe('1.12 GB');
  });
});
