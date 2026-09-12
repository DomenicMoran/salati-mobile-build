// Ladeschicht und Auswahl-/Beschriftungslogik der Wort-für-Wort-Bedeutungen.
// Getestet wird ausschließlich gegen eigene Fixtures (kein echter Netzzugriff)
// — Muster wie ./morphologie.test.ts.
import * as FileSystem from 'expo-file-system/legacy';

import {
  gruppenDeckenVersAb,
  ladeWbw,
  ladeWbwMeta,
  waehleVersGruppen,
  wbwMetaUrl,
  wbwSpracheFuerLocale,
  wbwUmschalterZustand,
  wbwUrl,
  type WbwDatei,
  type WbwMetaDatei,
  type WbwVersEintrag,
} from './wbw';
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

/** Minimal gültige Sure-Datei nach Schema 2 (Wortgruppen `[von, bis, Text]`).
 * Jeder Ladetest benutzt eine eigene Surennummer — ladeWbw() dedupliziert
 * parallele Aufrufe derselben Sprache/Sure über eine modulweite Map. */
function gueltigeDatei(surah: number, lang = 'fr'): WbwDatei {
  return {
    schema: 2,
    lang,
    surah,
    verses: {
      '1': [
        [1, 1, 'Au nom'],
        [2, 2, 'de Allah'],
        [3, 3, 'le Tout Miséricordieux'],
        [4, 4, 'le Très Miséricordieux'],
      ],
    },
  };
}

/** Beispielzahlen im Format der ausgelieferten meta.json. Bewusst KEINE
 * Momentaufnahme der Live-Werte: geprüft wird die Einordnung (voll/teilweise),
 * nicht die Abdeckung des Datenlaufs — die Zahlen kommen zur Laufzeit aus
 * meta.json und ändern sich mit jedem Lauf. */
function gueltigeMeta(): WbwMetaDatei {
  return {
    schema: 2,
    korpus: { verse: 6236, woerter: 77429 },
    sprachen: {
      fr: { verse: 6236, woerter: 77429, anteilVerse: 1, anteilWoerter: 1 },
      fa: { verse: 6232, woerter: 77378, anteilVerse: 0.9994, anteilWoerter: 0.9993 },
      id: { verse: 6233, woerter: 77386, anteilVerse: 0.9995, anteilWoerter: 0.9994 },
      bn: { verse: 6233, woerter: 77386, anteilVerse: 0.9995, anteilWoerter: 0.9994 },
      ur: { verse: 5990, woerter: 71983, anteilVerse: 0.9606, anteilWoerter: 0.9297 },
      tr: { verse: 2611, woerter: 18563, anteilVerse: 0.4187, anteilWoerter: 0.2397 },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (fs as unknown as { documentDirectory: string | undefined }).documentDirectory = 'file:///doc/';
  fs.getInfoAsync.mockResolvedValue({ exists: false, size: 0 } as never);
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

describe('wbwUrl / wbwMetaUrl', () => {
  it('zeigen auf den versionierten wbw/v2/-Ordner desselben R2-Buckets wie die Morphologie', () => {
    // Versionspfad im URL-Präfix: die Auslieferung ist "immutable" gecacht,
    // eine neue Schema-Fassung braucht deshalb ein neues Präfix (v1 trug noch
    // eine Glosse je Wort, v2 Wortgruppen).
    expect(wbwUrl('tr', 18)).toBe('https://pub-d0489c0572704285af79896edb72cbed.r2.dev/wbw/v2/tr/18.json');
    expect(wbwMetaUrl()).toBe('https://pub-d0489c0572704285af79896edb72cbed.r2.dev/wbw/v2/meta.json');
  });
});

describe('wbwSpracheFuerLocale', () => {
  it('erkennt die sechs Sprachen mit Datensatz', () => {
    for (const l of ['fr', 'fa', 'id', 'bn', 'ur', 'tr']) expect(wbwSpracheFuerLocale(l)).toBe(l);
  });

  it('liefert null für App-Sprachen ohne Datensatz', () => {
    // de hat die handgepflegten Glossen (wbw-de.ts), en kommt von quran.com,
    // der Rest bleibt englisch.
    for (const l of ['de', 'en', 'ar', 'es', 'ms', 'ps', 'ru', 'sw', '']) {
      expect(wbwSpracheFuerLocale(l)).toBeNull();
    }
  });
});

describe('ladeWbw — R2-Laden und Cache schreiben', () => {
  it('lädt von R2, validiert und schreibt in den Cache', async () => {
    const datei = gueltigeDatei(101);
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(datei),
    });

    const result = await ladeWbw('fr', 101);

    expect(globalThis.fetch).toHaveBeenCalledWith(wbwUrl('fr', 101), expect.anything());
    expect(result).toEqual(datei);
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith('file:///doc/wbw/v2/fr/101.json', JSON.stringify(datei));
  });

  it('wirft bei HTTP-Fehler, statt einen leeren Stand zurückzugeben — und meldet ihn', async () => {
    // MUSS anschlagen: fetchWithTimeout protokolliert nur Netz-/Timeout-
    // Fehler; ein 4xx/5xx kam bisher nirgends an, der Reader fiel still auf
    // Englisch zurück und der Support-Fehlerbericht blieb leer.
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({ ok: false, status: 404, text: async () => '' });
    await expect(ladeWbw('fr', 102)).rejects.toThrow('wbw_fr/102_http_404');
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'wbw_fr/102_http_404' }),
      `wbw ${wbwUrl('fr', 102)}`,
    );
  });

  it('meldet auch eine inhaltlich ungültige Antwort', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(111, 'tr')),
    });
    await expect(ladeWbw('fr', 111)).rejects.toThrow('wbw_fr/111_ungueltig');
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'wbw_fr/111_ungueltig' }),
      `wbw ${wbwUrl('fr', 111)}`,
    );
  });

  it('darf einen ERFOLGREICHEN Abruf NICHT melden — sonst ist der Fehlerbericht Rauschen', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(112)),
    });
    await ladeWbw('fr', 112);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('wirft, wenn die Sprache in der Antwort nicht zur angefragten passt', async () => {
    // Ein vertauschter Sprachordner würde sonst türkische Glossen unter
    // französischer Oberfläche zeigen.
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(103, 'tr')),
    });
    await expect(ladeWbw('fr', 103)).rejects.toThrow('wbw_fr/103_ungueltig');
  });

  it('wirft, wenn die Surennummer in der Antwort nicht zur angefragten passt', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(999)),
    });
    await expect(ladeWbw('fr', 104)).rejects.toThrow('wbw_fr/104_ungueltig');
  });

  it('wirft bei einer Datei der alten Schema-Fassung (Glosse je Wort statt Gruppen)', async () => {
    // Der v1-Stand ist strukturell inkompatibel; die Schema-Prüfung MUSS ihn
    // abweisen, statt ihn als Gruppenliste zu missdeuten.
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ schema: 1, lang: 'fr', surah: 110, verses: { '1': ['a', 'b'] } }),
    });
    await expect(ladeWbw('fr', 110)).rejects.toThrow('wbw_fr/110_ungueltig');
  });

  it('parallele Aufrufe derselben Sprache/Sure lösen nur EINEN Download aus', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(105)),
    });
    const [a, b] = await Promise.all([ladeWbw('fr', 105), ladeWbw('fr', 105)]);
    expect(a).toEqual(b);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('ladeWbw — Cache statt erneutem Download', () => {
  it('nutzt einen gültigen Cache, ohne das Netz zu bemühen', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 999 } as never);
    fs.readAsStringAsync.mockResolvedValue(JSON.stringify(gueltigeDatei(106)));

    const result = await ladeWbw('fr', 106);

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

    const result = await ladeWbw('fr', 107);

    expect(fs.deleteAsync).toHaveBeenCalledWith('file:///doc/wbw/v2/fr/107.json', { idempotent: true });
    expect(mockLogError).toHaveBeenCalled();
    expect(result).toEqual(gueltigeDatei(107));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('behandelt eine leere Cache-Datei (size 0) wie "nicht vorhanden"', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 0 } as never);
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(gueltigeDatei(108)),
    });

    await ladeWbw('fr', 108);

    expect(fs.readAsStringAsync).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('ladeWbwMeta', () => {
  it('lädt meta.json von R2 und legt sie im selben Versionsordner ab', async () => {
    const meta = gueltigeMeta();
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(meta),
    });

    const result = await ladeWbwMeta();

    expect(result).toEqual(meta);
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith('file:///doc/wbw/v2/meta.json', JSON.stringify(meta));
  });

  it('wirft bei ungültigem Inhalt (leere Sprachliste)', async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ schema: 2, korpus: { verse: 1, woerter: 1 }, sprachen: {} }),
    });
    await expect(ladeWbwMeta()).rejects.toThrow('wbw_meta_ungueltig');
  });
});

describe('gruppenDeckenVersAb', () => {
  it('nimmt eine lückenlose Folge aus Einzelwörtern und Gruppen an', () => {
    // Beispiel 2:4 (türkisch): Position 8 und 9 teilen sich eine Bedeutung.
    const eintraege: WbwVersEintrag[] = [
      [1, 1, 'a'],
      [2, 7, 'b'],
      [8, 9, 'senden önce'],
      [10, 10, 'c'],
    ];
    expect(gruppenDeckenVersAb(eintraege, 10)).toBe(true);
  });

  it('lehnt eine Lücke ab', () => {
    expect(
      gruppenDeckenVersAb(
        [
          [1, 1, 'a'],
          [3, 3, 'b'],
        ],
        3,
      ),
    ).toBe(false);
  });

  it('lehnt eine Überschneidung ab', () => {
    expect(
      gruppenDeckenVersAb(
        [
          [1, 2, 'a'],
          [2, 3, 'b'],
        ],
        3,
      ),
    ).toBe(false);
  });

  it('lehnt ab, wenn das letzte "bis" nicht die Wortzahl trifft', () => {
    const zuKurz: WbwVersEintrag[] = [
      [1, 1, 'a'],
      [2, 2, 'b'],
    ];
    expect(gruppenDeckenVersAb(zuKurz, 3)).toBe(false);
    expect(gruppenDeckenVersAb([[1, 4, 'a']], 3)).toBe(false);
  });

  it('lehnt leere Texte, verdrehte Grenzen und leere Listen ab', () => {
    expect(gruppenDeckenVersAb([[1, 1, '']], 1)).toBe(false);
    expect(gruppenDeckenVersAb([[2, 1, 'a']], 2)).toBe(false);
    expect(gruppenDeckenVersAb([], 1)).toBe(false);
    expect(gruppenDeckenVersAb(undefined, 1)).toBe(false);
  });
});

describe('waehleVersGruppen', () => {
  const datei = gueltigeDatei(1); // Vers 1: vier Einzelwörter
  const deutsch = ['Im Namen', 'Allahs', 'des Allerbarmers', 'des Barmherzigen'];

  it('nimmt die Gruppen der App-Sprache, wenn der Vers vorhanden ist', () => {
    expect(waehleVersGruppen({ deutscheGlossen: undefined, datei, ayah: 1, wortzahl: 4 })).toEqual([
      { von: 1, bis: 1, text: 'Au nom' },
      { von: 2, bis: 2, text: 'de Allah' },
      { von: 3, bis: 3, text: 'le Tout Miséricordieux' },
      { von: 4, bis: 4, text: 'le Très Miséricordieux' },
    ]);
  });

  it('gibt eine Mehrwortgruppe unverändert weiter', () => {
    const mitGruppe: WbwDatei = {
      schema: 2,
      lang: 'tr',
      surah: 2,
      verses: {
        '4': [
          [1, 7, 'x'],
          [8, 9, 'senden önce'],
          [10, 10, 'y'],
        ],
      },
    };
    expect(waehleVersGruppen({ deutscheGlossen: undefined, datei: mitGruppe, ayah: 4, wortzahl: 10 })).toEqual([
      { von: 1, bis: 7, text: 'x' },
      { von: 8, bis: 9, text: 'senden önce' },
      { von: 10, bis: 10, text: 'y' },
    ]);
  });

  it('liefert undefined, wenn der Vers im Datensatz fehlt (Aufrufer bleibt bei Englisch)', () => {
    // Unvollständige Verse schreibt die Pipeline gar nicht erst.
    expect(waehleVersGruppen({ deutscheGlossen: undefined, datei, ayah: 2, wortzahl: 4 })).toBeUndefined();
  });

  it('liefert undefined, wenn die Gruppen die geladene Wortliste nicht abdecken', () => {
    // Zweite Sicherung gegen abweichende Segmentierung: lieber der ganze Vers
    // englisch als eine um eine Position verschobene Zuordnung.
    expect(waehleVersGruppen({ deutscheGlossen: undefined, datei, ayah: 1, wortzahl: 5 })).toBeUndefined();
    expect(waehleVersGruppen({ deutscheGlossen: undefined, datei, ayah: 1, wortzahl: 3 })).toBeUndefined();
  });

  it('gibt den handgepflegten deutschen Glossen den Vorrang — je Wort eine Gruppe', () => {
    expect(waehleVersGruppen({ deutscheGlossen: deutsch, datei, ayah: 1, wortzahl: 4 })).toEqual([
      { von: 1, bis: 1, text: 'Im Namen' },
      { von: 2, bis: 2, text: 'Allahs' },
      { von: 3, bis: 3, text: 'des Allerbarmers' },
      { von: 4, bis: 4, text: 'des Barmherzigen' },
    ]);
  });

  it('fällt auf den Datensatz zurück, wenn die deutschen Glossen nicht zur Wortzahl passen', () => {
    const gruppen = waehleVersGruppen({ deutscheGlossen: deutsch.slice(0, 3), datei, ayah: 1, wortzahl: 4 });
    expect(gruppen?.map((g) => g.text)).toEqual([
      'Au nom',
      'de Allah',
      'le Tout Miséricordieux',
      'le Très Miséricordieux',
    ]);
  });

  it('liefert undefined ohne Datensatz und ohne deutsche Glossen', () => {
    expect(waehleVersGruppen({ deutscheGlossen: undefined, datei: undefined, ayah: 1, wortzahl: 4 })).toBeUndefined();
  });

  // Prüfung der Prüfung: die Abdeckungsprüfung MUSS bei einer Abweichung
  // anschlagen und darf bei exakter Abdeckung NICHT anschlagen. Ohne dieses
  // Paar wäre ein "gibt immer undefined zurück"-Fehler (Glossen kämen nie an)
  // genauso grün wie ein "prüft gar nicht"-Fehler (verschobene Wörter).
  describe('Abdeckungsprüfung — beide Richtungen', () => {
    const vierWorte: WbwDatei = {
      schema: 2,
      lang: 'tr',
      surah: 1,
      verses: { '7': [[1, 2, 'a'], [3, 3, 'b'], [4, 4, 'c']] },
    };

    it('schlägt an (Rückfall auf Englisch), wenn die Wortliste ein Wort mehr hat', () => {
      expect(waehleVersGruppen({ deutscheGlossen: undefined, datei: vierWorte, ayah: 7, wortzahl: 5 })).toBeUndefined();
    });

    it('schlägt NICHT an, wenn die Wortzahl exakt stimmt', () => {
      expect(waehleVersGruppen({ deutscheGlossen: undefined, datei: vierWorte, ayah: 7, wortzahl: 4 })).toEqual([
        { von: 1, bis: 2, text: 'a' },
        { von: 3, bis: 3, text: 'b' },
        { von: 4, bis: 4, text: 'c' },
      ]);
    });
  });
});

describe('wbwUmschalterZustand', () => {
  const meta = gueltigeMeta();
  /** Normalfall: beide Abrufe sind geglueckt. Jeder Test setzt nur das, worum
   * es ihm geht — sonst verschwindet die Aussage zwischen sechs Feldern. */
  const ok = { deutscheGlossenVerfuegbar: false, meta, wortlisteFehler: false, sprachdateiFehler: false };

  it('englische Oberfläche: kein Zusatz (die Glossen sind ohnehin englisch)', () => {
    expect(wbwUmschalterZustand({ ...ok, locale: 'en' })).toEqual({ art: 'eigen' });
  });

  it('Deutsch mit gepflegter Sure: kein Zusatz', () => {
    expect(wbwUmschalterZustand({ ...ok, locale: 'de', deutscheGlossenVerfuegbar: true })).toEqual({ art: 'eigen' });
  });

  it('Deutsch ohne gepflegte Sure: "(EN)" wie bisher', () => {
    expect(wbwUmschalterZustand({ ...ok, locale: 'de' })).toEqual({ art: 'englisch' });
  });

  it('Sprache ohne Datensatz: "(EN)"', () => {
    for (const locale of ['es', 'ms', 'ru', 'sw', 'ps', 'ar']) {
      expect(wbwUmschalterZustand({ ...ok, locale })).toEqual({ art: 'englisch' });
    }
  });

  it('volle Abdeckung (ab 99 % der Verse): kein Zusatz', () => {
    for (const locale of ['fr', 'fa', 'id', 'bn']) {
      expect(wbwUmschalterZustand({ ...ok, locale })).toEqual({ art: 'eigen' });
    }
  });

  it('Teilabdeckung: nennt den gerundeten Vers-Anteil aus meta.json, nicht eine im Code erfundene Zahl', () => {
    expect(wbwUmschalterZustand({ ...ok, locale: 'ur' })).toEqual({ art: 'teilweise', prozentVerse: 96 });
    expect(wbwUmschalterZustand({ ...ok, locale: 'tr' })).toEqual({ art: 'teilweise', prozentVerse: 42 });
  });

  it('folgt geänderten meta-Zahlen (die Schwelle steht im Code, der Wert in den Daten)', () => {
    // Genau dieser Fall tritt mit dem nächsten Datenlauf ein: tr steigt von
    // Teil- auf Vollabdeckung, ohne dass hier eine Zahl angefasst wird.
    const nachgebessert: WbwMetaDatei = {
      ...meta,
      sprachen: { ...meta.sprachen, tr: { verse: 6230, woerter: 77300, anteilVerse: 0.999, anteilWoerter: 0.998 } },
    };
    expect(wbwUmschalterZustand({ ...ok, locale: 'tr', meta: nachgebessert })).toEqual({ art: 'eigen' });
  });

  it('ohne geladene meta.json: kein Zusatz und kein "(EN)" — Daten gibt es sicher', () => {
    expect(wbwUmschalterZustand({ ...ok, locale: 'tr', meta: undefined })).toEqual({ art: 'eigen' });
  });

  // --- Ladefehler: MUSS anschlagen / darf NICHT anschlagen ---
  // Der Befund der Geräteabnahme war nicht der Fehlschlag selbst, sondern dass
  // er unsichtbar blieb. Beide Richtungen werden geprüft, damit der Hinweis
  // weder ausbleibt noch als Dauerlärm über jedem Reader steht.

  it('Sprachdatei-Fehler in einer Sprache MIT Datensatz: eigener Zustand statt stillem Rückfall', () => {
    expect(wbwUmschalterZustand({ ...ok, locale: 'ur', sprachdateiFehler: true })).toEqual({
      art: 'fehler',
      quelle: 'sprachdatei',
    });
  });

  it('Sprachdatei-Fehler schlägt VOR der Teilabdeckung an — eine Prozentzahl über nichts wäre irreführend', () => {
    // tr steht in dieser meta bei 42 % (Teilabdeckung). Ohne Fehler kommt
    // genau das heraus (Test oben); mit Fehler ist die Zahl gegenstandslos.
    expect(wbwUmschalterZustand({ ...ok, locale: 'tr', sprachdateiFehler: true })).toEqual({
      art: 'fehler',
      quelle: 'sprachdatei',
    });
  });

  it('Sprachdatei-Fehler ohne Wirkung: englische Oberfläche, deutsche Glossen, Sprache ohne Datensatz', () => {
    // Englisch: die Glossen sind ohnehin englisch, es fehlt nichts.
    expect(wbwUmschalterZustand({ ...ok, locale: 'en', sprachdateiFehler: true })).toEqual({ art: 'eigen' });
    // Deutsch mit gepflegter Sure: der fehlgeschlagene Datensatz wird gar
    // nicht gebraucht (wbw-de.ts hat Vorrang).
    expect(
      wbwUmschalterZustand({ ...ok, locale: 'de', deutscheGlossenVerfuegbar: true, sprachdateiFehler: true }),
    ).toEqual({ art: 'eigen' });
    // Sprache ohne Datensatz: es gibt nichts zu laden, also auch nichts zu
    // melden — es bleibt beim bisherigen "(EN)".
    expect(wbwUmschalterZustand({ ...ok, locale: 'ms', sprachdateiFehler: true })).toEqual({ art: 'englisch' });
  });

  // --- Der eigentliche Abnahme-Befund 1.54.0: die Wortliste ---
  // Sie traegt die arabischen Woerter selbst. Faellt sie aus, zeigt die
  // Wort-Ansicht in JEDER Sprache nichts — auch kein englisches Gloss. Genau
  // hier gab die alte Fassung Entwarnung ("(EN)" weg), obwohl der Leser vor
  // einer Sure ganz ohne Glossen sass.

  it('Wortlisten-Fehler MUSS in jeder Sprache anschlagen — auch dort, wo die Sprachdatei geglückt ist', () => {
    for (const locale of ['en', 'de', 'ms', 'ar', 'ur', 'tr', 'fr']) {
      expect(wbwUmschalterZustand({ ...ok, locale, wortlisteFehler: true })).toEqual({
        art: 'fehler',
        quelle: 'wortliste',
      });
    }
    // Auch mit gepflegten deutschen Glossen: die brauchen die Wortliste als
    // Gerüst, ohne sie erscheint keine einzige davon.
    expect(
      wbwUmschalterZustand({ ...ok, locale: 'de', deutscheGlossenVerfuegbar: true, wortlisteFehler: true }),
    ).toEqual({ art: 'fehler', quelle: 'wortliste' });
  });

  it('Wortliste hat Vorrang vor der Sprachdatei — offline fallen beide aus, gemeldet wird der schlimmere Fall', () => {
    expect(
      wbwUmschalterZustand({ ...ok, locale: 'ur', wortlisteFehler: true, sprachdateiFehler: true }),
    ).toEqual({ art: 'fehler', quelle: 'wortliste' });
  });

  it('Wortlisten-Fehler darf NICHT anschlagen, wenn die Wortliste da ist', () => {
    // Der Gegentest zum Fall darueber: nur weil die Sprachdatei fehlt, ist die
    // Wort-Ansicht nicht leer — sie bleibt englisch, und das Label sagt "(EN)".
    expect(wbwUmschalterZustand({ ...ok, locale: 'ur', sprachdateiFehler: true })).not.toEqual({
      art: 'fehler',
      quelle: 'wortliste',
    });
    // Und ohne jeden Fehler bleibt es beim ganz normalen Zustand.
    for (const locale of ['en', 'de', 'ms', 'fr', 'ur']) {
      expect(wbwUmschalterZustand({ ...ok, locale }).art).not.toBe('fehler');
    }
  });
});
