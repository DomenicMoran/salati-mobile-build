// Gegenprobe für die Kategorisierung des Paradigmen-Tabellenkatalogs:
// jede Tabelle aus ALLEN data/paradigmen*.json-Dateien muss in GENAU eine
// der 5 Kategorien fallen, jede Bab-Tabelle in GENAU eine Verbfamilie
// (Ṣaḥīḥ/Mahmūz/Miṯāl/Aǧwaf/Nāqiṣ/Lafīf/Muḍāʿaf/kombiniert) — bewusst gegen
// den ECHTEN Bestand geprüft (kein erfundenes Test-Fixture), damit eine
// künftig neu hinzukommende Tabelle mit unerwarteter ID auffällt statt
// stillschweigend in die falsche Kategorie oder ins Leere zu fallen.
//
// WARUM DIESE DATEILISTE NICHT AUS paradigmenLoader.PARADIGM_SOURCES
// ÜBERNOMMEN WIRD: genau umgekehrt geprüft, siehe paradigmenLoader.test.ts —
// dort wird PARADIGM_SOURCES gegen den echten Ordnerinhalt abgeglichen. Würde
// dieser Test stattdessen PARADIGM_SOURCES als Quelle nehmen, könnte eine im
// Loader vergessene Datei nie auffallen (beide Prüfungen würden denselben
// blinden Fleck teilen) — deshalb hier eine von Hand geführte, unabhängige
// Dateiliste.
import paradigmen from './data/paradigmen.json';
import paradigmenBabMithalAjwaf from './data/paradigmen-bab-mithal-ajwaf.json';
import paradigmenBabMurakkab from './data/paradigmen-bab-murakkab.json';
import paradigmenBabNaqisLafifMudaaf from './data/paradigmen-bab-naqis-lafif-mudaaf.json';
import paradigmenNachtrag from './data/paradigmen-nachtrag.json';
import paradigmenVerben from './data/paradigmen-verben.json';
import paradigmenWeitere from './data/paradigmen-weitere.json';
import type { ParadigmTabelle } from './erklaerungenTypes';
import {
  istGueltigeWurzelTypKategorie,
  kategorisiere,
  PARADIGM_KATEGORIE_ORDER,
  VERB_FAMILIE_ORDER,
  verbFamilieVonWurzelTyp,
  WURZEL_TYP_KATEGORIEN,
  type ParadigmTabelleEingeordnet,
} from './paradigmenKategorien';

const QUELLEN: { datei: string; tables: ParadigmTabelle[] }[] = [
  { datei: 'paradigmen.json', tables: (paradigmen as unknown as { tables: ParadigmTabelle[] }).tables },
  { datei: 'paradigmen-verben.json', tables: (paradigmenVerben as unknown as { tables: ParadigmTabelle[] }).tables },
  { datei: 'paradigmen-bab-mithal-ajwaf.json', tables: (paradigmenBabMithalAjwaf as unknown as { tables: ParadigmTabelle[] }).tables },
  { datei: 'paradigmen-bab-naqis-lafif-mudaaf.json', tables: (paradigmenBabNaqisLafifMudaaf as unknown as { tables: ParadigmTabelle[] }).tables },
  { datei: 'paradigmen-bab-murakkab.json', tables: (paradigmenBabMurakkab as unknown as { tables: ParadigmTabelle[] }).tables },
  { datei: 'paradigmen-weitere.json', tables: (paradigmenWeitere as unknown as { tables: ParadigmTabelle[] }).tables },
  { datei: 'paradigmen-nachtrag.json', tables: (paradigmenNachtrag as unknown as { tables: ParadigmTabelle[] }).tables },
];

const ALLE: ParadigmTabelleEingeordnet[] = QUELLEN.flatMap(({ datei, tables }) => tables.map((t) => kategorisiere(t, datei)));

describe('paradigmenKategorien — vollständiger Bestand', () => {
  it('hat 150 Tabellen insgesamt (Stand: paradigmen + paradigmen-verben + die drei Bab-Dateien inkl. murakkab + paradigmen-weitere + paradigmen-nachtrag)', () => {
    expect(ALLE.length).toBe(150);
  });

  it('jede Tabellen-ID ist über alle Dateien hinweg eindeutig', () => {
    const ids = ALLE.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede Tabelle fällt in genau eine der 5 Kategorien (keine bleibt unsichtbar/unkategorisiert)', () => {
    for (const t of ALLE) {
      expect(t.kategorie).toBeTruthy();
      expect(PARADIGM_KATEGORIE_ORDER).toContain(t.kategorie);
    }
  });

  it('Kategorie-Zählung entspricht dem geprüften Bestand', () => {
    const zaehlung: Record<string, number> = {};
    for (const t of ALLE) zaehlung[t.kategorie] = (zaehlung[t.kategorie] ?? 0) + 1;
    expect(zaehlung).toEqual({
      nomenPronomen: 14,
      verbMatrizen: 10,
      verbstammFamilien: 107,
      verbstammAbleitungen: 8,
      partikelnZahlenWortschatz: 11,
    });
  });

  it('"Verbstamm-Familien (Bab)": jede Tabelle hat eine verbFamilie, jede Verbfamilie kommt in VERB_FAMILIE_ORDER vor', () => {
    const babTabellen = ALLE.filter((t) => t.kategorie === 'verbstammFamilien');
    for (const t of babTabellen) {
      expect(t.verbFamilie).not.toBeNull();
      expect(VERB_FAMILIE_ORDER).toContain(t.verbFamilie);
    }
  });

  it('Verbfamilien-Zählung entspricht dem geprüften Bestand (5 Sahih-Kurztabellen [3 Personenmatrizen-Vorstufen + 2 Bab-Tabellen der Kleinen Familie] + 11 Mahmuz + 21 Mithal + 11 Ajwaf + 12 Naaqis + 12 Lafif + 14 Mudaaf + 21 Murakkab)', () => {
    const zaehlung: Record<string, number> = {};
    for (const t of ALLE) {
      if (!t.verbFamilie) continue;
      zaehlung[t.verbFamilie] = (zaehlung[t.verbFamilie] ?? 0) + 1;
    }
    expect(zaehlung).toEqual({
      sahih: 5,
      mahmuz: 11,
      mithal: 21,
      ajwaf: 11,
      naaqis: 12,
      lafif: 12,
      mudaaf: 14,
      murakkab: 21,
    });
  });

  it('"kleine-familie-nasara"/"kleine-familie-karama" (paradigmen-nachtrag.json, Kapitel 5.3 "Kleine Familie") landen in "Verbstamm-Familien (Bab)" mit verbFamilie "sahih" — dieselbe Achse (Wurzelgesundheit von Form I) wie die drei bestehenden Sahih-Kurztabellen, NICHT die "Verbstamm-Ableitungen"-Achse der Sarf-Großfamilien', () => {
    const ids = ['kleine-familie-nasara', 'kleine-familie-karama'];
    const gefunden = ALLE.filter((t) => ids.includes(t.id));
    expect(gefunden.length).toBe(ids.length);
    expect(gefunden.every((t) => t.kategorie === 'verbstammFamilien')).toBe(true);
    expect(gefunden.every((t) => t.verbFamilie === 'sahih')).toBe(true);
    expect(gefunden.every((t) => t.quelldatei === 'paradigmen-nachtrag.json')).toBe(true);
  });

  it('jede murakkab-Tabelle (mehrere schwache/hamzierte Eigenschaften gleichzeitig, z. B. "murakkab-ajwaf-mahmuz") landet trotz ihrer zusätzlichen Einzel-Marker in "murakkab", nicht in der Einzelfamilie', () => {
    const murakkabTabellen = ALLE.filter((t) => t.id.includes('-murakkab-'));
    expect(murakkabTabellen.length).toBe(21);
    expect(murakkabTabellen.every((t) => t.verbFamilie === 'murakkab')).toBe(true);
  });

  it('Tabellen außerhalb "Verbstamm-Familien" tragen keine verbFamilie', () => {
    for (const t of ALLE) {
      if (t.kategorie !== 'verbstammFamilien') expect(t.verbFamilie).toBeNull();
    }
  });

  it('"Verb: vollständige Personenmatrizen" enthält die 10 "-matrix"-Tabellen (6 aus paradigmen-verben.json + 4 aus paradigmen-weitere.json: kāna, Mudari Mansub/Majzum, Nūn at-Tawkīd)', () => {
    const matrixTabellen = ALLE.filter((t) => t.kategorie === 'verbMatrizen' && t.id.endsWith('-matrix'));
    expect(matrixTabellen.length).toBe(10);
    expect(matrixTabellen.filter((t) => t.quelldatei === 'paradigmen-verben.json').length).toBe(6);
    expect(matrixTabellen.filter((t) => t.quelldatei === 'paradigmen-weitere.json').length).toBe(4);
    expect(['kaana-matrix', 'mudari-mansub-nasara-matrix', 'mudari-majzum-nasara-matrix', 'nun-tawkid-thaqila-nasara-matrix'].every((id) =>
      matrixTabellen.some((t) => t.id === id),
    )).toBe(true);
  });

  it('die acht Ṣarf-Großfamilien (sarf-familie-1…8, paradigmen-weitere.json) landen in der eigenen Kategorie "Verbstamm-Ableitungen (Formen II–X)" — andere Achse als "Verbstamm-Familien (Bab)" (abgeleitete Form II–X statt Wurzelgesundheit von Form I), tragen deshalb keine verbFamilie und werden NICHT den vollständigen Personenmatrizen zugeschlagen', () => {
    const sarfFamilien = ALLE.filter((t) => t.id.startsWith('sarf-familie-'));
    expect(sarfFamilien.length).toBe(8);
    expect(sarfFamilien.every((t) => t.kategorie === 'verbstammAbleitungen')).toBe(true);
    expect(sarfFamilien.every((t) => t.verbFamilie === null)).toBe(true);
    expect(sarfFamilien.every((t) => t.quelldatei === 'paradigmen-weitere.json')).toBe(true);
  });

  it('"Verbstamm-Ableitungen (Formen II–X)" enthält AUSSCHLIESSLICH die acht Sarf-Großfamilien (nicht die Personenmatrizen, nicht die Bab-Familien)', () => {
    const ableitungen = ALLE.filter((t) => t.kategorie === 'verbstammAbleitungen');
    expect(ableitungen.length).toBe(8);
    expect(ableitungen.every((t) => t.id.startsWith('sarf-familie-'))).toBe(true);
    expect(ableitungen.every((t) => t.verbFamilie === null)).toBe(true);
  });

  it('die fünf neuen Nomen/Pronomen-Tabellen aus paradigmen-weitere.json (leichte Muslimun-Deklination × 2, Relativpronomen-Raster, Flexibilitätsklassen, gebrochener-Plural-Muster) landen in "Nomen & Pronomen"', () => {
    const ids = ['leichte-muslimun-maennlich', 'leichte-muslimun-weiblich', 'ism-mawsul-raster', 'ism-flexibilitaet-arten', 'ism-plural-muster-unregelmaessig'];
    const gefunden = ALLE.filter((t) => ids.includes(t.id));
    expect(gefunden.length).toBe(ids.length);
    expect(gefunden.every((t) => t.kategorie === 'nomenPronomen')).toBe(true);
  });

  it('die zwei neuen Pronomen/Demonstrativ-Tabellen aus paradigmen-nachtrag.json (freie Pronomen Nasb-Status H-16, Zeigewörter im Dual H-25) landen in "Nomen & Pronomen" ohne verbFamilie', () => {
    const ids = ['freie-pronomen-nasb-status', 'zeigewoerter-dual-status'];
    const gefunden = ALLE.filter((t) => ids.includes(t.id));
    expect(gefunden.length).toBe(ids.length);
    expect(gefunden.every((t) => t.kategorie === 'nomenPronomen')).toBe(true);
    expect(gefunden.every((t) => t.verbFamilie === null)).toBe(true);
    expect(gefunden.every((t) => t.quelldatei === 'paradigmen-nachtrag.json')).toBe(true);
  });

  it('Wortschatz-Tabellen (wortschatz-*) landen in "Partikeln, Zahlen & Wortschatz", nicht in "Nomen & Pronomen"', () => {
    const wortschatz = ALLE.filter((t) => t.id.startsWith('wortschatz-'));
    expect(wortschatz.length).toBe(8);
    expect(wortschatz.every((t) => t.kategorie === 'partikelnZahlenWortschatz')).toBe(true);
  });
});

describe('verbFamilieVonWurzelTyp — Anbindung an die Reader-Wurzelanalyse', () => {
  it('deckt jede WurzelTypKategorie ab (lafifMafruq/lafifMaqrun -> lafif, rubai -> null)', () => {
    expect(verbFamilieVonWurzelTyp('sahih')).toBe('sahih');
    expect(verbFamilieVonWurzelTyp('mahmuz')).toBe('mahmuz');
    expect(verbFamilieVonWurzelTyp('mithal')).toBe('mithal');
    expect(verbFamilieVonWurzelTyp('ajwaf')).toBe('ajwaf');
    expect(verbFamilieVonWurzelTyp('naaqis')).toBe('naaqis');
    expect(verbFamilieVonWurzelTyp('lafifMafruq')).toBe('lafif');
    expect(verbFamilieVonWurzelTyp('lafifMaqrun')).toBe('lafif');
    expect(verbFamilieVonWurzelTyp('mudaaf')).toBe('mudaaf');
    expect(verbFamilieVonWurzelTyp('rubai')).toBeNull();
  });

  it('WURZEL_TYP_KATEGORIEN/istGueltigeWurzelTypKategorie validieren rohe Routen-Parameter', () => {
    expect(WURZEL_TYP_KATEGORIEN.length).toBe(9);
    expect(istGueltigeWurzelTypKategorie('ajwaf')).toBe(true);
    expect(istGueltigeWurzelTypKategorie('nicht-existent')).toBe(false);
  });
});
