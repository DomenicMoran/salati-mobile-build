// Ladeschicht der Wort-Morphologie/Syntax-Daten. Getestet wird ausschließlich
// gegen eigene Fixtures (kein echter Netzzugriff) — Muster wie
// features/ki/korpus.test.ts und features/quran/offline-audio.test.ts.
import * as FileSystem from 'expo-file-system/legacy';

import { ladeMorphologie, morphologieUrl } from './morphologie';
import type { MorphologieDatei } from './morphologieTypen';
// jest.mock wird von babel-plugin-jest-hoist ueber die Importe gehoben —
// die Mocks unten greifen also trotz der Reihenfolge hier.

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

/** Minimal gültige Datei nach dem vom Pipeline-Agenten festgelegten Schema.
 * Jeder Test verwendet eine eigene Surennummer (siehe Kommentar unten), daher
 * bewusst als Fabrik statt fixer Konstante. */
function gueltigeDatei(surah: number): MorphologieDatei {
  return {
    schema: 3,
    surah,
    verses: {
      '1': [
        {
          position: 1,
          text: 'ذَٰلِكَ',
          root: null,
          lemma: 'ذَٰلِكَ',
          segments: [
            {
              text: 'ذَٰلِكَ',
              kind: 'stem',
              pos: 'DEM',
              features: {
                person: null,
                gender: 'm',
                number: 'sg',
                case: null,
                state: null,
                mood: null,
                tense: null,
                voice: null,
                verbForm: null,
                derivation: null,
              },
              derived: [],
              raw: 'DEM',
            },
          ],
          syntax: { relation: 'mid', relationAr: 'مبتدأ', head: 0 },
        },
      ],
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (fs as unknown as { documentDirectory: string | undefined }).documentDirectory = 'file:///doc/';
  fs.getInfoAsync.mockResolvedValue({ exists: false, size: 0 } as never);
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

// Jeder Test benutzt eine eigene, im gesamten Lauf einmalige Surennummer.
// Grund: ladeMorphologie() dedupliziert parallele Aufrufe DERSELBEN Sure über
// eine modulweite Map (`laufend`) — mit einer gemeinsamen Nummer könnten sich
// Tests, die schnell hintereinander laufen, gegenseitig eine noch nicht
// abgeräumte Map-Eintragung "stehlen". Reale Surennummern reichen 1-114;
// hier werden nur Fixture-Werte gebraucht, negative/hohe Zahlen sind für den
// Test unproblematisch, da ladeMorphologie() surah nur zum Bau von URL/Pfad
// und zum Abgleich mit dem `surah`-Feld der Antwort nutzt.

describe('morphologieUrl', () => {
  it('zeigt auf den versionierten morphologie/v3/-Ordner desselben R2-Buckets wie Korpus/Modell', () => {
    // Versionspfad im URL-Präfix (siehe MORPHOLOGIE_SCHEMA_VERSION in
    // morphologieTypen.ts): die Auslieferung ist "immutable" gecacht, eine
    // neue Schema-Fassung braucht deshalb ein neues Präfix statt derselben URL.
    expect(morphologieUrl(2)).toBe('https://pub-d0489c0572704285af79896edb72cbed.r2.dev/morphologie/v3/2.json');
  });
});

describe('ladeMorphologie — R2-Laden und Cache schreiben', () => {
  it('lädt von R2, validiert und schreibt in den Cache', async () => {
    const datei = gueltigeDatei(101);
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(datei),
    });

    const result = await ladeMorphologie(101);

    expect(globalThis.fetch).toHaveBeenCalledWith(morphologieUrl(101), expect.anything());
    expect(result).toEqual(datei);
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith('file:///doc/morphologie/101.json', JSON.stringify(datei));
  });

  it('wirft bei HTTP-Fehler, statt einen leeren Stand zurückzugeben', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({ ok: false, status: 404, text: async () => '' });
    await expect(ladeMorphologie(102)).rejects.toThrow('morphologie_102_http_404');
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('wirft bei leeren/kaputten Netz-Daten (schema/surah/verses ungültig)', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ schema: 1, surah: 103, verses: {} }),
    });
    await expect(ladeMorphologie(103)).rejects.toThrow('morphologie_103_ungueltig');
  });

  it('wirft, wenn die Surennummer in der Antwort nicht zur angefragten passt', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(999)),
    });
    await expect(ladeMorphologie(104)).rejects.toThrow('morphologie_104_ungueltig');
  });

  it('parallele Aufrufe derselben Sure lösen nur EINEN Download aus', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(105)),
    });
    const [a, b] = await Promise.all([ladeMorphologie(105), ladeMorphologie(105)]);
    expect(a).toEqual(b);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('ladeMorphologie — Cache statt erneutem Download', () => {
  it('nutzt einen gültigen Cache, ohne das Netz zu bemühen', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 999 } as never);
    fs.readAsStringAsync.mockResolvedValue(JSON.stringify(gueltigeDatei(106)));

    const result = await ladeMorphologie(106);

    expect(result).toEqual(gueltigeDatei(106));
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('verwirft einen beschädigten (nicht parsbaren) Cache und lädt neu von R2', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 12 } as never);
    fs.readAsStringAsync.mockResolvedValue('kein json {{{');
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(107)),
    });

    const result = await ladeMorphologie(107);

    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/morphologie/107.json', { idempotent: true });
    expect(mockLogError).toHaveBeenCalled();
    expect(result).toEqual(gueltigeDatei(107));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('verwirft einen inhaltlich ungültigen Cache (falsches Schema) und lädt neu', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 999 } as never);
    fs.readAsStringAsync.mockResolvedValue(JSON.stringify({ schema: 0, surah: 108, verses: { '1': [] } }));
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(108)),
    });

    const result = await ladeMorphologie(108);

    expect(result).toEqual(gueltigeDatei(108));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('behandelt eine leere Cache-Datei (size 0) wie "nicht vorhanden"', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 0 } as never);
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(109)),
    });

    await ladeMorphologie(109);

    expect(fs.readAsStringAsync).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('ladeMorphologie — ohne Dateisystem (Web)', () => {
  it('liest/schreibt keinen Cache, wenn kein Dokumentverzeichnis verfügbar ist', async () => {
    // documentDirectory ist im echten Modul ein `const` (readonly-Export) —
    // im Mock per Cast überschreibbar, um die Web-Plattform zu simulieren.
    (fs as unknown as { documentDirectory: string | undefined }).documentDirectory = undefined;
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(110)),
    });

    const result = await ladeMorphologie(110);

    expect(result).toEqual(gueltigeDatei(110));
    expect(fs.getInfoAsync).not.toHaveBeenCalled();
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
