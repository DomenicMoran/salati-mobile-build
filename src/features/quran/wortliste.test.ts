// Datei-Cache der quran.com-Wortliste (./wortliste.ts). Getestet wird gegen
// eigene Fixtures, ohne echten Netzzugriff — Muster wie ./wbw.test.ts.
//
// Jede Prüfung hier kommt paarweise: ein Fall, der anschlagen MUSS (ungültige
// oder abgelaufene Datei wird nicht benutzt), und einer, der NICHT anschlagen
// darf (eine gültige, frische Datei spart den Abruf und ein Netzfehler wirft
// den brauchbaren Altstand nicht weg).
import * as FileSystem from 'expo-file-system/legacy';

import { wordByWordUrl, type QuranWord } from './api';
import {
  istFrischeWortliste,
  istGueltigeWortliste,
  ladeSurahWortliste,
  wortlisteCachePfad,
  WORTLISTE_MAX_ALTER_MS,
  WORTLISTE_SCHEMA_VERSION,
  type WortlisteDatei,
} from './wortliste';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false, size: 0 })),
  writeAsStringAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(async () => ''),
}));

const mockLogError = jest.fn(async () => undefined);
jest.mock('@/lib/errorLog', () => ({ logError: (...a: unknown[]) => mockLogError(...(a as [])) }));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;

const JETZT = Date.UTC(2026, 8, 7, 12, 0, 0);

function wort(arabic: string): QuranWord {
  return { arabic, translation: 'in the name', transliteration: 'bis-mi', audioUrl: null, tajweedRules: [] };
}

/** Antwort, wie parseWordByWordResponse sie liefert: Wörter je Vers. */
function antwort(): QuranWord[][] {
  return [[wort('بِسْمِ'), wort('ٱللَّهِ')], [wort('ٱلْحَمْدُ')]];
}

function gueltigeDatei(surah: number, ueberschreiben: Partial<WortlisteDatei> = {}): WortlisteDatei {
  return {
    schema: WORTLISTE_SCHEMA_VERSION,
    surah,
    quelle: wordByWordUrl(surah),
    geladenAm: JETZT,
    verses: antwort(),
    ...ueberschreiben,
  };
}

/** Legt eine Datei so ab, dass ausCacheLesen() sie findet. */
function cacheEnthaelt(datei: unknown): void {
  fs.getInfoAsync.mockResolvedValue({ exists: true, size: 42 } as never);
  fs.readAsStringAsync.mockResolvedValue(JSON.stringify(datei));
}

/** Antwort des Netz-Abrufs (fetchSurahWordByWord ruft fetchWithTimeout). */
function netzLiefert(verses: QuranWord[][]): void {
  (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      verses: verses.map((v) => ({
        words: v.map((w) => ({
          char_type_name: 'word',
          text_uthmani: w.arabic,
          translation: { text: w.translation },
          transliteration: { text: w.transliteration },
          audio_url: null,
        })),
      })),
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(JETZT);
  (fs as unknown as { documentDirectory: string | undefined }).documentDirectory = 'file:///doc/';
  fs.getInfoAsync.mockResolvedValue({ exists: false, size: 0 } as never);
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('istGueltigeWortliste', () => {
  it('nimmt eine unversehrte Datei an — sonst wäre der Cache wirkungslos', () => {
    expect(istGueltigeWortliste(gueltigeDatei(2), 2)).toBe(true);
  });

  it('weist eine Datei der alten Schema-Fassung ab', () => {
    // MUSS anschlagen: ändert sich QuranWord/parseWordByWordResponse, darf
    // eine alte Datei nicht als neue Form durchgehen.
    expect(istGueltigeWortliste(gueltigeDatei(2, { schema: WORTLISTE_SCHEMA_VERSION - 1 }), 2)).toBe(false);
  });

  it('weist die Datei einer ANDEREN Sure ab', () => {
    expect(istGueltigeWortliste(gueltigeDatei(3), 2)).toBe(false);
  });

  it('weist eine Datei aus einer anderen Anfrage ab (word_fields/per_page geändert)', () => {
    // Genau der Fall, für den `quelle` mitgeschrieben wird: eine Datei ohne
    // die neu angeforderten Felder darf nicht so tun, als hätte sie sie.
    const alteAnfrage = wordByWordUrl(2).replace(',audio_url', '');
    expect(istGueltigeWortliste(gueltigeDatei(2, { quelle: alteAnfrage }), 2)).toBe(false);
  });

  it('weist eine Datei ohne brauchbaren Zeitstempel ab', () => {
    expect(istGueltigeWortliste(gueltigeDatei(2, { geladenAm: Number.NaN }), 2)).toBe(false);
    expect(istGueltigeWortliste({ ...gueltigeDatei(2), geladenAm: '2026' }, 2)).toBe(false);
  });

  it('weist leere und halb geschriebene Wortlisten ab', () => {
    expect(istGueltigeWortliste(gueltigeDatei(2, { verses: [] }), 2)).toBe(false);
    expect(istGueltigeWortliste(gueltigeDatei(2, { verses: [[]] }), 2)).toBe(false);
    // Ein einzelnes kaputtes Wort MITTEN in der Datei (abgestürzt beim
    // Schreiben): die Prüfung geht bewusst durch alle Wörter, nicht nur durch
    // den Kopf.
    const halb = gueltigeDatei(2);
    (halb.verses[1] as unknown[])[0] = { arabic: 'ٱلْحَمْدُ' };
    expect(istGueltigeWortliste(halb, 2)).toBe(false);
  });

  it('weist alles ab, was gar keine Datei ist', () => {
    for (const unfug of [null, undefined, 42, 'text', [], {}]) {
      expect(istGueltigeWortliste(unfug, 2)).toBe(false);
    }
  });
});

describe('istFrischeWortliste', () => {
  it('gilt innerhalb des Höchstalters als frisch (kein Netz nötig)', () => {
    expect(istFrischeWortliste(gueltigeDatei(2), JETZT)).toBe(true);
    expect(istFrischeWortliste(gueltigeDatei(2), JETZT + WORTLISTE_MAX_ALTER_MS - 1)).toBe(true);
  });

  it('gilt ab dem Höchstalter als abgelaufen — quran.com korrigiert unter derselben URL', () => {
    expect(istFrischeWortliste(gueltigeDatei(2), JETZT + WORTLISTE_MAX_ALTER_MS)).toBe(false);
  });

  it('gilt bei einem Zeitstempel aus der Zukunft als abgelaufen', () => {
    // Zurückgestellte Gerätezeit würde die Datei sonst bis zu diesem Datum
    // unantastbar machen.
    expect(istFrischeWortliste(gueltigeDatei(2), JETZT - 1)).toBe(false);
  });
});

describe('ladeSurahWortliste — Netz und Cache schreiben', () => {
  it('lädt bei leerem Cache vom Netz und legt die Datei mit Herkunft und Zeitstempel ab', async () => {
    netzLiefert(antwort());

    const ergebnis = await ladeSurahWortliste(101);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(ergebnis).toEqual(antwort());
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith(
      wortlisteCachePfad(101),
      JSON.stringify(gueltigeDatei(101, { verses: antwort() })),
    );
  });

  it('wirft, wenn es weder Cache noch Antwort gibt', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(ladeSurahWortliste(102)).rejects.toThrow('qurancom_words_503');
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('parallele Aufrufe derselben Sure lösen nur EINEN Abruf aus', async () => {
    netzLiefert(antwort());
    const [a, b] = await Promise.all([ladeSurahWortliste(103), ladeSurahWortliste(103)]);
    expect(a).toEqual(b);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('ladeSurahWortliste — Cache statt erneutem Abruf', () => {
  it('liest eine frische Datei und rührt das Netz NICHT an', async () => {
    // Der eigentliche Zweck: offline (und im Flugmodus) muss die Wortliste da
    // sein, ohne dass sie je in der AsyncStorage-Ablage lag.
    cacheEnthaelt(gueltigeDatei(2));

    const ergebnis = await ladeSurahWortliste(2);

    expect(ergebnis).toEqual(antwort());
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('lädt bei ungültiger Datei neu, statt sie zu benutzen', async () => {
    cacheEnthaelt(gueltigeDatei(2, { schema: 0 }));
    netzLiefert(antwort());

    await ladeSurahWortliste(2);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('lädt eine abgelaufene Datei neu und überschreibt sie', async () => {
    cacheEnthaelt(gueltigeDatei(4, { geladenAm: JETZT - WORTLISTE_MAX_ALTER_MS - 1 }));
    netzLiefert(antwort());

    await ladeSurahWortliste(4);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith(
      wortlisteCachePfad(4),
      JSON.stringify(gueltigeDatei(4, { verses: antwort() })),
    );
  });

  it('behält den veralteten Stand, wenn die Auffrischung scheitert — und meldet es', async () => {
    // Ohne Netz ist eine 31 Tage alte Wortliste besser als der Fehlerzustand:
    // vor dem Datei-Cache war der Eintrag nach QUERY_PERSIST_MAX_AGE (24 Tage)
    // ohnehin aus der Ablage geflogen.
    cacheEnthaelt(gueltigeDatei(5, { geladenAm: JETZT - WORTLISTE_MAX_ALTER_MS - 1 }));
    (globalThis.fetch as unknown as jest.Mock).mockRejectedValue(new Error('network request failed'));

    const ergebnis = await ladeSurahWortliste(5);

    expect(ergebnis).toEqual(antwort());
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'network request failed' }),
      'wortliste: Auffrischung fehlgeschlagen, veralteter Stand (Sure 5)',
    );
  });

  it('darf einen erfolgreichen Lauf NICHT melden — sonst ist der Fehlerbericht Rauschen', async () => {
    cacheEnthaelt(gueltigeDatei(6));
    await ladeSurahWortliste(6);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('verwirft eine unlesbare Datei und lädt neu', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 42 } as never);
    fs.readAsStringAsync.mockResolvedValue('{ das ist kein JSON');
    netzLiefert(antwort());

    await ladeSurahWortliste(7);

    expect(fs.deleteAsync).toHaveBeenCalledWith(wortlisteCachePfad(7), { idempotent: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('kommt ohne Dateisystem aus (Web): lädt vom Netz, schreibt nichts', async () => {
    (fs as unknown as { documentDirectory: string | undefined }).documentDirectory = undefined;
    netzLiefert(antwort());

    const ergebnis = await ladeSurahWortliste(8);

    expect(ergebnis).toEqual(antwort());
    expect(fs.readAsStringAsync).not.toHaveBeenCalled();
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  });
});
