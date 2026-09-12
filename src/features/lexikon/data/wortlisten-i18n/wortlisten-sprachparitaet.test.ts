import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import type {
  Ablaufschema,
  Beispielsatzliste,
  Vergleichstabelle,
  WortlistenDatei,
  Wortliste,
} from '../../wortlistenTypes';

/**
 * Sprachparität der Wortlisten-Übersetzungsbündel (data/wortlisten-i18n/<lang>.json)
 * gegen die deutsche Referenz data/wortlisten.json.
 *
 * data/wortlisten.json selbst bleibt einsprachig Deutsch (Arabisch/Umschrift sind
 * sprachunabhängig und werden hier NICHT wiederholt) — jede Sprachdatei in diesem
 * Verzeichnis trägt nur die übersetzten Bedeutungs-/Beschriftungsfelder, an
 * denselben IDs/Indizes wie das deutsche Original aufgehängt (siehe
 * wortlistenI18nTypes.ts). Dieser Test stellt sicher: gleiche Schlüssel, gleiche
 * Anzahl Einträge, kein leeres Feld, keine kaputte Kodierung und kein Feld, das
 * sichtbar unübersetzt auf Deutsch stehen geblieben ist. Die arabischen Formen und
 * Umschriften selbst können hier gar nicht abweichen — sie existieren in diesen
 * Dateien schlicht nicht (siehe Kopf-Kommentar wortlistenTypes.ts).
 *
 * Findet alle vorhandenen Sprachdateien automatisch über den Dateinamen
 * (`<lang>.json`, 2-4 Kleinbuchstaben) — eine später hinzugefügte Sprache wird
 * ohne Änderung an diesem Test automatisch mitgeprüft.
 */

const VERZEICHNIS = __dirname;
const WORTLISTEN_JSON = join(VERZEICHNIS, '..', 'wortlisten.json');
const DATEINAME_MUSTER = /^([a-z]{2,4})\.json$/;

const quelle = JSON.parse(readFileSync(WORTLISTEN_JSON, 'utf8')) as WortlistenDatei;

const sprachDateien: { datei: string; lang: string }[] = readdirSync(VERZEICHNIS)
  .filter((f) => DATEINAME_MUSTER.test(f))
  .map((datei) => ({ datei, lang: DATEINAME_MUSTER.exec(datei)![1] }));

interface UebersetzungsDatei {
  schema: number;
  lang: string;
  kapitel: Record<string, string>;
  wortlisten: Record<string, { title: string; entries: string[]; beispiele?: string[] }>;
  beispielsatzlisten: Record<string, { title: string; entries: { beschreibung: string; beispiel: string }[] }>;
  ablaufschemata: Record<string, { title: string; schritte: string[]; beispiel?: string }>;
  vergleichstabellen: Record<
    string,
    { title: string; columns: Record<string, string>; rows?: Record<string, string>; cells?: Record<string, Record<string, string>> }
  >;
}

function ladeDatei(datei: string): UebersetzungsDatei {
  return JSON.parse(readFileSync(join(VERZEICHNIS, datei), 'utf8')) as UebersetzungsDatei;
}

/** Eindeutige Kapitel-Strings über alle vier Bestandteile von wortlisten.json,
 *  in erster Vorkommensreihenfolge — dieselbe Menge, die kapitel in jeder
 *  Sprachdatei abdecken muss (siehe WortlistenKatalogView.tsx, kapitelOrder). */
const ALLE_KAPITEL = Array.from(
  new Set([
    ...quelle.wortlisten.map((l) => l.kapitel),
    ...quelle.beispielsatzlisten.map((l) => l.kapitel),
    ...quelle.ablaufschemata.map((s) => s.kapitel),
    ...quelle.vergleichstabellen.map((t) => t.kapitel),
  ]),
);

/** Klassische Mojibake-Muster (UTF-8 als Latin-1 gelesen) und Steuerzeichen. */
const MOJIBAKE = /Ã[¤¶¼]|â€[žœ“]|ï»¿/;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;

/** "ß" kommt in keiner Zielsprache dieses Lexikons vor und ist deshalb fuer
 *  sich allein schon ein verlaessliches Signal fuer stehengebliebenen
 *  deutschen Text. ä/ö/ü sind dagegen KEIN eigenstaendiges Signal (siehe
 *  data/erklaerungen/sprachparitaet.test.ts, wo genau das frueher hunderte
 *  Fehlalarme in tuerkischen Dateien erzeugt hat) — dieselbe geschaerfte
 *  Erkennung wird hier unveraendert uebernommen, inkl. der Zwei-Marker-
 *  Schwelle und dem bewusst aus der Liste entfernten "des" (frz. Teilungs-/
 *  Pluralartikel, kein deutscher Rest). */
const SHARP_S = /ß/;
const GERMAN_MARKER_WORD_LIST = [
  'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen',
  'einer', 'nicht', 'mit', 'für', 'von', 'auf', 'bei', 'zum', 'zur', 'beim',
  'deine', 'deinen', 'wenn', 'wird', 'werden', 'kann', 'kannst', 'muss',
  'sind', 'ist', 'auch', 'noch', 'sich', 'dass', 'diese', 'dieser', 'dieses',
  'welche', 'welcher', 'welches', 'man', 'sehr', 'schon', 'beide', 'durch',
  'steht', 'zeigt', 'bedeutet',
];
const GERMAN_MARKER = new RegExp(`(^|\\s)(${GERMAN_MARKER_WORD_LIST.join('|')})(\\s|$)`, 'i');

function zaehleVerschiedeneDeutscheMarker(text: string): number {
  let anzahl = 0;
  for (const wort of GERMAN_MARKER_WORD_LIST) {
    if (new RegExp(`(^|\\s)${wort}(\\s|$)`, 'i').test(text)) anzahl++;
  }
  return anzahl;
}

/** Enthaelt eindeutig deutsche Reste, unabhaengig vom Vergleichstext. */
function hatDeutscheSpuren(text: string): boolean {
  return SHARP_S.test(text) || zaehleVerschiedeneDeutscheMarker(text) >= 2;
}

/** Ist ein Feld 1:1 aus der deutschen Fassung uebernommen worden, obwohl es lang
 *  genug ist, um Fliesstext/eine Wortgruppe mit Funktionswort zu sein? */
function istUnuebersetzteKopie(fremd: string, de: string): boolean {
  return fremd === de && de.trim().length > 20 && GERMAN_MARKER.test(de);
}

function pruefeFeld(pfad: string, wert: unknown, deWert: string | undefined) {
  it(`${pfad}: kein leeres/kaputtes/unuebersetztes Feld`, () => {
    expect(typeof wert).toBe('string');
    const text = wert as string;
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text.includes('�')).toBe(false);
    expect(MOJIBAKE.test(text)).toBe(false);
    expect(CONTROL.test(text)).toBe(false);
    expect(hatDeutscheSpuren(text)).toBe(false);
    if (deWert !== undefined) {
      expect(istUnuebersetzteKopie(text, deWert)).toBe(false);
    }
  });
}

describe('Wortlisten-Sprachparität: gefundene Dateien', () => {
  it('findet mindestens eine Sprachdatei', () => {
    expect(sprachDateien.length).toBeGreaterThan(0);
  });
});

for (const { datei, lang } of sprachDateien) {
  describe(`wortlisten-i18n/${datei} — Parität gegen wortlisten.json`, () => {
    const fremd = ladeDatei(datei);

    it('hat schema und lang korrekt gesetzt', () => {
      expect(fremd.schema).toBe(quelle.schema);
      expect(fremd.lang).toBe(lang);
    });

    it('deckt exakt alle Kapitel-Strings ab (keine fehlenden, keine zusätzlichen)', () => {
      expect(Object.keys(fremd.kapitel).sort()).toEqual([...ALLE_KAPITEL].sort());
    });

    for (const kapitel of ALLE_KAPITEL) {
      pruefeFeld(`kapitel["${kapitel}"]`, fremd.kapitel[kapitel], kapitel);
    }

    it('hat exakt dieselben Wortlisten-IDs wie die deutsche Fassung', () => {
      expect(Object.keys(fremd.wortlisten).sort()).toEqual(quelle.wortlisten.map((l) => l.id).sort());
    });

    for (const liste of quelle.wortlisten as Wortliste[]) {
      const t = fremd.wortlisten[liste.id];
      describe(`wortlisten["${liste.id}"]`, () => {
        it('existiert in dieser Sprachfassung', () => {
          expect(t).toBeDefined();
        });
        if (!t) return;

        pruefeFeld('title', t.title, liste.titleDe);

        it('hat dieselbe Anzahl entries wie die deutsche Fassung', () => {
          expect(t.entries.length).toBe(liste.entries.length);
        });
        liste.entries.forEach((e, i) => {
          if (i < (t.entries?.length ?? 0)) pruefeFeld(`entries[${i}]`, t.entries[i], e.de);
        });

        if (liste.beispiele && liste.beispiele.length > 0) {
          it('hat dieselbe Anzahl beispiele wie die deutsche Fassung', () => {
            expect(t.beispiele?.length ?? 0).toBe(liste.beispiele!.length);
          });
          liste.beispiele.forEach((b, i) => {
            if (t.beispiele && i < t.beispiele.length) pruefeFeld(`beispiele[${i}]`, t.beispiele[i], b.de);
          });
        }
      });
    }

    it('hat exakt dieselben Beispielsatzlisten-IDs wie die deutsche Fassung', () => {
      expect(Object.keys(fremd.beispielsatzlisten).sort()).toEqual(quelle.beispielsatzlisten.map((l) => l.id).sort());
    });

    for (const liste of quelle.beispielsatzlisten as Beispielsatzliste[]) {
      const t = fremd.beispielsatzlisten[liste.id];
      describe(`beispielsatzlisten["${liste.id}"]`, () => {
        it('existiert in dieser Sprachfassung', () => {
          expect(t).toBeDefined();
        });
        if (!t) return;

        pruefeFeld('title', t.title, liste.titleDe);

        it('hat dieselbe Anzahl entries wie die deutsche Fassung', () => {
          expect(t.entries.length).toBe(liste.entries.length);
        });
        liste.entries.forEach((e, i) => {
          if (i < t.entries.length) {
            pruefeFeld(`entries[${i}].beschreibung`, t.entries[i].beschreibung, e.beschreibung);
            pruefeFeld(`entries[${i}].beispiel`, t.entries[i].beispiel, e.beispielDe);
          }
        });
      });
    }

    it('hat exakt dieselben Ablaufschema-IDs wie die deutsche Fassung', () => {
      expect(Object.keys(fremd.ablaufschemata).sort()).toEqual(quelle.ablaufschemata.map((s) => s.id).sort());
    });

    for (const schema of quelle.ablaufschemata as Ablaufschema[]) {
      const t = fremd.ablaufschemata[schema.id];
      describe(`ablaufschemata["${schema.id}"]`, () => {
        it('existiert in dieser Sprachfassung', () => {
          expect(t).toBeDefined();
        });
        if (!t) return;

        pruefeFeld('title', t.title, schema.titleDe);

        it('hat dieselbe Anzahl schritte wie die deutsche Fassung', () => {
          expect(t.schritte.length).toBe(schema.schritte.length);
        });
        schema.schritte.forEach((s, i) => {
          if (i < t.schritte.length) pruefeFeld(`schritte[${i}]`, t.schritte[i], s.kastenDe);
        });

        if (schema.beispielDe) {
          pruefeFeld('beispiel', t.beispiel, schema.beispielDe);
        }
      });
    }

    it('hat exakt dieselben Vergleichstabellen-IDs wie die deutsche Fassung', () => {
      expect(Object.keys(fremd.vergleichstabellen).sort()).toEqual(quelle.vergleichstabellen.map((v) => v.id).sort());
    });

    for (const tabelle of quelle.vergleichstabellen as Vergleichstabelle[]) {
      const t = fremd.vergleichstabellen[tabelle.id];
      describe(`vergleichstabellen["${tabelle.id}"]`, () => {
        it('existiert in dieser Sprachfassung', () => {
          expect(t).toBeDefined();
        });
        if (!t) return;

        pruefeFeld('title', t.title, tabelle.titleDe);

        it('hat exakt dieselben Spalten-IDs wie die deutsche Fassung', () => {
          expect(Object.keys(t.columns).sort()).toEqual(tabelle.columns.map((c) => c.id).sort());
        });
        for (const col of tabelle.columns) {
          if (t.columns[col.id] !== undefined) pruefeFeld(`columns.${col.id}`, t.columns[col.id], col.labelDe);
        }

        const zeilenMitLabel = tabelle.rows.filter((r) => r.labelDe);
        if (zeilenMitLabel.length > 0) {
          it('hat exakt dieselben Zeilen-IDs (mit Beschriftung) wie die deutsche Fassung', () => {
            expect(Object.keys(t.rows ?? {}).sort()).toEqual(zeilenMitLabel.map((r) => r.id).sort());
          });
          for (const row of zeilenMitLabel) {
            if (t.rows?.[row.id] !== undefined) pruefeFeld(`rows.${row.id}`, t.rows[row.id], row.labelDe);
          }
        }

        const zellenMitDe: { rowId: string; colId: string; de: string }[] = [];
        for (const row of tabelle.rows) {
          for (const col of tabelle.columns) {
            const zelle = tabelle.cells[row.id]?.[col.id];
            if (zelle?.de) zellenMitDe.push({ rowId: row.id, colId: col.id, de: zelle.de });
          }
        }
        if (zellenMitDe.length > 0) {
          it('hat für jede Zelle mit deutschem Wert einen übersetzten Wert', () => {
            for (const { rowId, colId } of zellenMitDe) {
              expect(t.cells?.[rowId]?.[colId]).toBeDefined();
            }
          });
          for (const { rowId, colId, de } of zellenMitDe) {
            const tv = t.cells?.[rowId]?.[colId];
            if (tv !== undefined) pruefeFeld(`cells.${rowId}.${colId}`, tv, de);
          }
        }
      });
    }
  });
}

/**
 * Test der Erkennungsfunktion selbst — siehe data/erklaerungen/sprachparitaet.test.ts
 * für dieselben Fälle inkl. Begründung (türkisches ö/ü, französisches "des").
 */
describe('hatDeutscheSpuren (Erkennungsfunktion, Wortlisten)', () => {
  it('schlägt bei einem stehengebliebenen deutschen Satz an', () => {
    expect(hatDeutscheSpuren('Der Eimer wird hier nicht übersetzt, sondern steht auf Deutsch.')).toBe(true);
  });

  it('schlägt bei "ß" allein an', () => {
    expect(hatDeutscheSpuren('Straße')).toBe(true);
  });

  it('schlägt NICHT bei regulären türkischen Wörtern mit ö/ü an', () => {
    expect(hatDeutscheSpuren('müzekker')).toBe(false);
    expect(hatDeutscheSpuren('çoğul')).toBe(false);
  });

  it('schlägt NICHT bei einem französischen Satz mit "des" an', () => {
    expect(hatDeutscheSpuren("l'une des trois classes de mots")).toBe(false);
  });

  it('schlägt NICHT bei einem kurzen, einzelnen übersetzten Wort an', () => {
    expect(hatDeutscheSpuren('bucket')).toBe(false);
    expect(hatDeutscheSpuren('seau')).toBe(false);
  });
});
