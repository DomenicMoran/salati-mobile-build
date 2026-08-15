// Nativer Spracherkennungs-Kern (whisperCheck.ts). Die bestehende Datei
// whisperCheck.test.ts prueft das WEB-Pendant (whisperCheck.web.ts) — der
// native Pfad war dadurch bei 0 % Abdeckung, obwohl er die Fehlerfaelle traegt,
// die auf dem Geraet auftreten (Modell kaputt, Mikro verweigert, Audio-Modul
// nicht gelinkt).
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';

import { istWhisperModellHeruntergeladen, whisperModellHerunterladen, whisperModellLoeschen } from './whisperModel';
import { WhisperFehler, fehlerCode } from './whisperError';

const mockInitWhisper = jest.fn();
const mockAudio = {
  init: jest.fn(async () => undefined),
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn((_event: string, _cb: (b64: string) => void) => ({ remove: jest.fn() })),
};

jest.mock('whisper.rn/index', () => ({ initWhisper: (...a: unknown[]) => mockInitWhisper(...a) }), {
  virtual: true,
});
jest.mock('@fugood/react-native-audio-pcm-stream', () => ({ default: mockAudio }), { virtual: true });
jest.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true })),
  requestRecordingPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true })),
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 1 })),
  makeDirectoryAsync: jest.fn(async () => undefined),
}));
jest.mock('./whisperModel', () => ({
  istWhisperModellHeruntergeladen: jest.fn(async () => true),
  whisperModellHerunterladen: jest.fn(async () => undefined),
  whisperModellLoeschen: jest.fn(async () => undefined),
  whisperModellPfad: jest.fn(() => 'file:///doc/whisper/modell.bin'),
}));

const modellDa = istWhisperModellHeruntergeladen as jest.Mock;
const modellLaden = whisperModellHerunterladen as jest.Mock;
const modellLoeschen = whisperModellLoeschen as jest.Mock;
const permsLesen = getRecordingPermissionsAsync as jest.Mock;
const permsFragen = requestRecordingPermissionsAsync as jest.Mock;

/** whisperCheck haelt den geladenen Kontext als Modul-Singleton — jeder Test
 *  braucht daher ein frisches Modul. */
function ladeModul() {
  let mod!: typeof import('./whisperCheck');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.isolateModules() braucht ein DYNAMISCHES require; ein statischer import wuerde am Modul-Cache vorbeigehen.
    mod = require('./whisperCheck') as typeof import('./whisperCheck');
  });
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  modellDa.mockResolvedValue(true);
  modellLaden.mockResolvedValue(undefined);
  modellLoeschen.mockResolvedValue(undefined);
  permsLesen.mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });
  permsFragen.mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });
  mockAudio.init.mockResolvedValue(undefined);
  mockInitWhisper.mockResolvedValue({ transcribe: jest.fn() });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('loadWhisperContext — Fehlerpfade', () => {
  it('meldet einen fehlgeschlagenen Modell-Download als modelDownload-Code', async () => {
    const m = ladeModul();
    modellDa.mockResolvedValue(false);
    modellLaden.mockRejectedValue(new Error('kein Netz'));
    await expect(m.loadWhisperContext()).rejects.toMatchObject({ code: WhisperFehler.modelDownload });
  });

  it('verwirft das Modell, wenn initWhisper trotz vorhandener Datei scheitert', async () => {
    const m = ladeModul();
    mockInitWhisper.mockRejectedValue(new Error('invalid ggml'));
    const fehler = await m.loadWhisperContext().catch((e: unknown) => e);
    expect(fehlerCode(fehler)).toBe(WhisperFehler.modelInit);
    // Damit der NAECHSTE Versuch frisch laedt statt am selben File zu scheitern.
    expect(modellLoeschen).toHaveBeenCalled();
  });

  it('nach einem Fehlschlag darf der naechste Aufruf neu laden (kein vergifteter Cache)', async () => {
    const m = ladeModul();
    mockInitWhisper.mockRejectedValueOnce(new Error('invalid ggml'));
    await expect(m.loadWhisperContext()).rejects.toBeDefined();
    mockInitWhisper.mockResolvedValue({ transcribe: jest.fn() });
    await expect(m.loadWhisperContext()).resolves.toBeDefined();
    expect(mockInitWhisper).toHaveBeenCalledTimes(2);
  });

  it('parallele Aufrufe teilen sich EIN Laden', async () => {
    const m = ladeModul();
    const [a, b] = await Promise.all([m.loadWhisperContext(), m.loadWhisperContext()]);
    expect(a).toBe(b);
    expect(mockInitWhisper).toHaveBeenCalledTimes(1);
  });

  it('meldet den Fortschritt beim Download und danach "ready"', async () => {
    const m = ladeModul();
    modellDa.mockResolvedValue(false);
    modellLaden.mockImplementation(async (cb: (p: { anteil: number }) => void) => {
      cb({ anteil: 0.25 });
    });
    const gesehen: unknown[] = [];
    await m.loadWhisperContext((p) => gesehen.push(p));
    expect(gesehen).toEqual([{ status: 'downloading', percent: 25 }, { status: 'ready' }]);
  });
});

describe('startPcmCapture — Abbruchgruende', () => {
  it('wirft "unavailable", wenn das native Audio-Modul nicht gelinkt ist', async () => {
    const m = ladeModul();
    const echt = mockAudio.init;
    (mockAudio as { init: unknown }).init = undefined;
    const fehler = await m.startPcmCapture().catch((e: unknown) => e);
    (mockAudio as { init: unknown }).init = echt;
    expect(fehlerCode(fehler)).toBe(WhisperFehler.unavailable);
  });

  it('wirft "permission" mit Status im Detail, wenn das Mikro verweigert wird', async () => {
    const m = ladeModul();
    permsFragen.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false });
    const fehler = await m.startPcmCapture().catch((e: unknown) => e);
    expect(fehlerCode(fehler)).toBe(WhisperFehler.permission);
    // .detail direkt lesen statt fehlerDetail(): jest.isolateModules laedt auch
    // whisperError.ts frisch, ein instanceof gegen die AEUSSERE Klasse ist dort false.
    expect((fehler as { detail?: string }).detail).toContain('status=denied');
    expect(mockAudio.start).not.toHaveBeenCalled();
  });

  it('wirft "audioInit", wenn die native Aufnahme nicht startet', async () => {
    const m = ladeModul();
    mockAudio.init.mockRejectedValue(new Error('AudioRecord initialization failed'));
    const fehler = await m.startPcmCapture().catch((e: unknown) => e);
    expect(fehlerCode(fehler)).toBe(WhisperFehler.audioInit);
  });

  it('stopCapture ist idempotent (zweiter Aufruf stoppt nicht erneut)', async () => {
    const m = ladeModul();
    const capture = await m.startPcmCapture();
    capture.stopCapture();
    capture.stopCapture();
    expect(mockAudio.stop).toHaveBeenCalledTimes(1);
  });

  it('snapshot liefert Samples, ohne die Aufnahme zu beenden', async () => {
    const m = ladeModul();
    let dataCb: (b64: string) => void = () => {};
    mockAudio.on.mockImplementation((_e: string, cb: (b64: string) => void) => {
      dataCb = cb;
      return { remove: jest.fn() };
    });
    const capture = await m.startPcmCapture();
    dataCb('AAEAAg=='); // 4 Bytes → 2 Int16-Samples
    expect(capture.snapshot().length).toBe(2);
    expect(mockAudio.stop).not.toHaveBeenCalled();
  });
});

describe('whisperDiagnose — wirft nie', () => {
  it('liefert konservative Defaults, wenn beide Abfragen werfen', async () => {
    const m = ladeModul();
    modellDa.mockRejectedValue(new Error('FS weg'));
    permsLesen.mockRejectedValue(new Error('kein Modul'));
    await expect(m.whisperDiagnose()).resolves.toEqual({
      modellVorhanden: false,
      mikrofonStatus: 'unknown',
      audioModulGelinkt: true,
    });
  });

  it('meldet das fehlende Audio-Modul', async () => {
    const m = ladeModul();
    const echt = mockAudio.init;
    (mockAudio as { init: unknown }).init = undefined;
    const d = await m.whisperDiagnose();
    (mockAudio as { init: unknown }).init = echt;
    expect(d.audioModulGelinkt).toBe(false);
  });
});

describe('PCM-Hilfsfunktionen', () => {
  it('trimSilence laesst reine Stille unveraendert (nie ein Leer-Array)', () => {
    const m = ladeModul();
    const pcm = new Float32Array(m.SAMPLE_RATE);
    expect(m.trimSilence(pcm, 0.01, m.SAMPLE_RATE).length).toBe(m.SAMPLE_RATE);
  });

  it('tailWindow kappt auf die letzten Sekunden, laesst Kuerzeres unveraendert', () => {
    const m = ladeModul();
    const lang = new Float32Array(m.SAMPLE_RATE * 30);
    expect(m.tailWindow(lang, 24, m.SAMPLE_RATE).length).toBe(m.SAMPLE_RATE * 24);
    const kurz = new Float32Array(m.SAMPLE_RATE * 5);
    expect(m.tailWindow(kurz, 24, m.SAMPLE_RATE)).toBe(kurz);
  });

  it('speedUp verkuerzt proportional und liefert nie ein Leer-Array', () => {
    const m = ladeModul();
    const pcm = new Float32Array(1000).fill(0.5);
    expect(m.speedUp(pcm, 2).length).toBe(500);
    expect(m.speedUp(new Float32Array(1), 4).length).toBe(1);
  });
});

describe('Abbruch-API (transkriptionLaeuft / transkriptionenAbbrechen)', () => {
  it('meldet im Leerlauf "laeuft nicht" und bricht ohne aktiven Lauf sauber ab', async () => {
    const m = ladeModul();
    expect(m.transkriptionLaeuft()).toBe(false);
    await expect(m.transkriptionenAbbrechen()).resolves.toBeUndefined();
  });
});
