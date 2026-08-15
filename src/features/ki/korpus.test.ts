// Sprachabhängiges Laden des Quellen-Korpus. Geprüft werden vor allem die
// Rückfall-Pfade: Ein Nutzer mit türkischer Oberfläche darf nie ohne Quellen
// dastehen, nur weil R2 gerade nicht erreichbar ist — er bekommt dann den
// gebündelten deutschen Korpus und im Screen den ehrlichen Hinweis dazu.
import * as FileSystem from 'expo-file-system/legacy';

import {
  _zuruecksetzen,
  aktiverStand,
  deutscherStand,
  dokumentNachId,
  korpusUrl,
  ladeKorpusIndex,
  ladeKorpusStand,
  erwarteterStand,
} from './korpus';
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

/** Minimaler Korpus in der Form, die build-ki-korpus.mjs schreibt. */
function korpusDatei(lang: string, stand: string | undefined = erwarteterStand()) {
  return JSON.stringify({
    v: 2,
    stand,
    lang,
    fallback: 1,
    docs: [
      { id: 'w-test', src: `Test ${lang}`, t: `Antwort auf ${lang} mit genug Zeichen für den Index` },
      { id: 'w-nur-deutsch', src: 'Salati-Wissen: Test', t: 'Noch nicht übersetzter Eintrag', fb: 1 },
    ],
  });
}

beforeEach(() => {
  _zuruecksetzen();
  jest.clearAllMocks();
  fs.getInfoAsync.mockResolvedValue({ exists: false, size: 0 } as never);
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

describe('deutscher Korpus (gebündelt)', () => {
  it('ist ohne I/O sofort verfügbar und vollständig deutsch', () => {
    const stand = deutscherStand();
    expect(stand.sprache).toBe('de');
    expect(stand.nurDeutsch).toBe(true);
    expect(stand.deutsch).toBe(0);
    expect(stand.gesamt).toBeGreaterThan(7000);
    expect(ladeKorpusIndex()).toBe(stand.index);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('wird für Deutsch gar nicht erst über das Netz gesucht', async () => {
    const stand = await ladeKorpusStand('de');
    expect(stand.sprache).toBe('de');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('gilt auch für Sprachen, die die KI nicht kennt', async () => {
    const stand = await ladeKorpusStand('xx');
    expect(stand.sprache).toBe('de');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('übersetzter Korpus', () => {
  it('lädt von R2, schreibt in den Cache und zählt die deutschen Reste', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({ ok: true, text: async () => korpusDatei('tr') });
    const stand = await ladeKorpusStand('tr');
    expect(globalThis.fetch).toHaveBeenCalledWith(korpusUrl('tr'));
    expect(stand.sprache).toBe('tr');
    expect(stand.nurDeutsch).toBe(false);
    expect(stand.deutsch).toBe(1);
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith('file:///doc/ki-korpus/korpus-tr.json', korpusDatei('tr'));
  });

  it('nimmt beim zweiten Start den Cache statt erneut 2 MB zu laden', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 999 } as never);
    fs.readAsStringAsync.mockResolvedValue(korpusDatei('ru'));
    const stand = await ladeKorpusStand('ru');
    expect(stand.sprache).toBe('ru');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // Ohne diese Pruefung behielt ein Geraet seinen einmal geladenen Korpus
  // dauerhaft: die Uebersetzungen und die nachgetragenen Duas haetten
  // bestehende Nutzer nie erreicht.
  it('verwirft einen Cache aus einem aelteren Bau-Lauf und laedt neu', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 999 } as never);
    fs.readAsStringAsync.mockResolvedValue(korpusDatei('ru', '2020-01-01T00:00:00.000Z'));
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => korpusDatei('ru'),
    });
    const stand = await ladeKorpusStand('ru');
    expect(globalThis.fetch).toHaveBeenCalledWith(korpusUrl('ru'));
    expect(stand.sprache).toBe('ru');
    expect(fs.writeAsStringAsync).toHaveBeenCalled();
  });

  it('verwirft auch einen Cache ganz ohne Stempel (Datei von vor der Pruefung)', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 999 } as never);
    // Stempel-Feld wirklich entfernen: ein ausdrueckliches `undefined` wuerde
    // den Standardwert des Parameters ausloesen und die Datei gueltig machen.
    const ohneStempel = JSON.parse(korpusDatei('ru')) as Record<string, unknown>;
    delete ohneStempel.stand;
    fs.readAsStringAsync.mockResolvedValue(JSON.stringify(ohneStempel));
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => korpusDatei('ru') });
    await ladeKorpusStand('ru');
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  // Ein veralteter Korpus in der richtigen Sprache ist besser als deutsche
  // Quellen — der Nutzer bekommt Antworten, die er lesen kann.
  it('nutzt ohne Netz den veralteten Cache statt auf Deutsch zurueckzufallen', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 999 } as never);
    fs.readAsStringAsync.mockResolvedValue(korpusDatei('ru', '2020-01-01T00:00:00.000Z'));
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    const stand = await ladeKorpusStand('ru');
    expect(stand.sprache).toBe('ru');
    expect(mockLogError).toHaveBeenCalled();
  });

  it('parallele Aufrufe lösen nur EINEN Download aus', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({ ok: true, text: async () => korpusDatei('id') });
    const [a, b] = await Promise.all([ladeKorpusStand('id'), ladeKorpusStand('id')]);
    expect(a.sprache).toBe('id');
    expect(b.sprache).toBe('id');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('setzt den aktiven Stand, aus dem dokumentNachId() liest', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({ ok: true, text: async () => korpusDatei('fr') });
    await ladeKorpusStand('fr');
    expect(aktiverStand().sprache).toBe('fr');
    expect(dokumentNachId('w-test')?.src).toBe('Test fr');
    // ID aus dem deutschen Verlauf, die es im übersetzten Korpus nicht gibt:
    // muss weiterhin auffindbar sein, sonst verliert der Verlauf seine Quellen.
    expect(dokumentNachId('q:1:1')?.t).toContain('Namen Allahs');
  });
});

describe('Rückfall auf Deutsch', () => {
  it('bei HTTP-Fehler — die KI bleibt benutzbar, der Fehler wird protokolliert', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({ ok: false, status: 404, text: async () => '' });
    const stand = await ladeKorpusStand('bn');
    expect(stand.sprache).toBe('de');
    expect(stand.nurDeutsch).toBe(true);
    expect(mockLogError).toHaveBeenCalled();
  });

  it('bei fehlendem Netz', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockRejectedValue(new Error('offline'));
    const stand = await ladeKorpusStand('fa');
    expect(stand.sprache).toBe('de');
    expect(mockLogError).toHaveBeenCalled();
  });

  it('bei leerem oder kaputtem Inhalt', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({ ok: true, text: async () => '{"v":2,"lang":"ur","docs":[]}' });
    const stand = await ladeKorpusStand('ur');
    expect(stand.sprache).toBe('de');
  });

  it('ein beschädigter Cache wird gelöscht und nicht als Korpus benutzt', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 12 } as never);
    fs.readAsStringAsync.mockResolvedValue('kein json');
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({ ok: true, text: async () => korpusDatei('es') });
    const stand = await ladeKorpusStand('es');
    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/ki-korpus/korpus-es.json', { idempotent: true });
    expect(stand.sprache).toBe('es');
  });
});

describe('korpusUrl', () => {
  it('zeigt auf denselben R2-Bucket wie der Modell-Download, Präfix rag/', () => {
    expect(korpusUrl('sw')).toBe('https://pub-d0489c0572704285af79896edb72cbed.r2.dev/rag/korpus-sw.json');
  });
});
