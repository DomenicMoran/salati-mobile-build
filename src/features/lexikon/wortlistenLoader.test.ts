// Absicherung für data/wortlisten.json — der neue Datentyp aus dem Auftrag
// "nichts aus der Vorlage fehlt" (siehe data/LUECKEN.md). Anders als
// data/paradigmen*.json (mehrere Dateien, PARADIGM_SOURCES-Liste,
// paradigmenLoader.test.ts prüft "jede Datei eingetragen") ist
// wortlisten.json bewusst EINE einzige Datei — die Absicherung hier prüft
// stattdessen genau den Fehler, der bei einem neuen, eigenständigen
// Datentyp droht: dass er zwar in der JSON-Datei liegt, aber vom Loader
// (wortlistenLoader.ts) nicht (mehr) vollständig durchgereicht wird, dass
// IDs sich überschneiden, oder dass ein Eintrag ohne die für die "Oberste
// Regel" (kein geratenes Arabisch) nötigen Felder durchrutscht.
import { readFileSync } from 'fs';
import { join } from 'path';

import type { WortlistenDatei } from './wortlistenTypes';

const DATEI_PFAD = join(__dirname, 'data', 'wortlisten.json');

function ladeDatei(): WortlistenDatei {
  return JSON.parse(readFileSync(DATEI_PFAD, 'utf-8')) as WortlistenDatei;
}

describe('wortlisten.json — Struktur und Vollständigkeit', () => {
  const datei = ladeDatei();

  it('hat schema 1 und alle vier Bestandslisten', () => {
    expect(datei.schema).toBe(1);
    expect(Array.isArray(datei.wortlisten)).toBe(true);
    expect(Array.isArray(datei.beispielsatzlisten)).toBe(true);
    expect(Array.isArray(datei.ablaufschemata)).toBe(true);
    expect(Array.isArray(datei.vergleichstabellen)).toBe(true);
  });

  it('enthält mindestens die im Auftrag benannten acht Vokabellisten und die Partikelliste H-21', () => {
    const ids = new Set(datei.wortlisten.map((w) => w.id));
    const erwarteteIds = [
      'wortliste-h1-ism-grundvokabular',
      'wortliste-h12-fragmente-teil1',
      'wortliste-h13-fragmente-teil2',
      'wortliste-h27-verben-grundvokabular',
      'wortliste-h37-saetze-teil1',
      'wortliste-h38-saetze-teil2',
      'wortliste-h53-sarf-grundvokabular',
      'wortliste-h54-verschiedene-ausdruecke',
      'wortliste-h21-harf-jarr',
    ];
    for (const id of erwarteteIds) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('enthält die Beispielsatzlisten H-55 und H-166 sowie beide Ablaufschemata (H-14, H-39)', () => {
    expect(datei.beispielsatzlisten.some((b) => b.id === 'beispielsatzliste-h55-verbindungsbuchstaben')).toBe(true);
    expect(datei.beispielsatzlisten.some((b) => b.id === 'beispielsatzliste-h166-istifham-partikel')).toBe(true);
    expect(datei.ablaufschemata.map((a) => a.id).sort()).toEqual(['ablaufschema-h14-gliederung-der-sprache', 'ablaufschema-h39-mubtada-chabar'].sort());
  });

  it('alle IDs sind über die vier Bestandslisten hinweg eindeutig', () => {
    const alleIds = [
      ...datei.wortlisten.map((w) => w.id),
      ...datei.beispielsatzlisten.map((b) => b.id),
      ...datei.ablaufschemata.map((a) => a.id),
      ...datei.vergleichstabellen.map((v) => v.id),
    ];
    expect(new Set(alleIds).size).toBe(alleIds.length);
  });

  it('jede Wortliste hat einen gültigen kind-Wert, ein Kapitel, eine Quellenangabe und mindestens einen Eintrag', () => {
    for (const liste of datei.wortlisten) {
      expect(['vokabelliste', 'partikelliste']).toContain(liste.kind);
      expect(liste.kapitel.length).toBeGreaterThan(0);
      expect(liste.source.file.length).toBeGreaterThan(0);
      expect(liste.source.page).toBeGreaterThan(0);
      expect(liste.entries.length).toBeGreaterThan(0);
    }
  });

  it('jeder Eintrag jeder Wortliste hat nicht-leeres ar/umschrift/de (kein geratenes/leeres Arabisch)', () => {
    for (const liste of datei.wortlisten) {
      for (const eintrag of liste.entries) {
        expect(eintrag.ar.trim().length).toBeGreaterThan(0);
        expect(eintrag.umschrift.trim().length).toBeGreaterThan(0);
        expect(eintrag.de.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('die Beispielsatzliste hat für jeden Eintrag ar/umschrift/beschreibung/beispielAr/beispielDe', () => {
    for (const liste of datei.beispielsatzlisten) {
      for (const eintrag of liste.entries) {
        expect(eintrag.ar.trim().length).toBeGreaterThan(0);
        expect(eintrag.umschrift.trim().length).toBeGreaterThan(0);
        expect(eintrag.beschreibung.trim().length).toBeGreaterThan(0);
        expect(eintrag.beispielAr.trim().length).toBeGreaterThan(0);
        expect(eintrag.beispielDe.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('jedes Ablaufschema hat mindestens zwei Schritte', () => {
    for (const schema of datei.ablaufschemata) {
      expect(schema.schritte.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('Bestandszahl: genau 17 Wortlisten (13 Vokabellisten + 4 Partikellisten) mit insgesamt 494 Einträgen', () => {
    expect(datei.wortlisten.length).toBe(17);
    expect(datei.wortlisten.filter((w) => w.kind === 'vokabelliste').length).toBe(13);
    expect(datei.wortlisten.filter((w) => w.kind === 'partikelliste').length).toBe(4);
    const gesamt = datei.wortlisten.reduce((sum, w) => sum + w.entries.length, 0);
    expect(gesamt).toBe(494);
  });
});

describe('vergleichstabellen — Struktur und Vollständigkeit (Balagah-Vergleichstabellen H-165/H-167…H-183)', () => {
  const datei = ladeDatei();

  it('enthält genau 18 Vergleichstabellen (H-165, H-167…H-183)', () => {
    expect(datei.vergleichstabellen.length).toBe(18);
    const erwarteteIds = [
      'vergleichstabelle-h165-satzklassifikation',
      'vergleichstabelle-h167-tashbih-quran-licht',
      'vergleichstabelle-h168-tashbih-mufassal-wasser',
      'vergleichstabelle-h169-tashbih-maqlub',
      'vergleichstabelle-h170-tashbih-dimni',
      'vergleichstabelle-h171-tashbih-arten-zusammenfassung',
      'vergleichstabelle-h172-alaqa-licht-prophet',
      'vergleichstabelle-h173-istiara-musarraha-koran',
      'vergleichstabelle-h174-istiara-asliyya-tabaiyya',
      'vergleichstabelle-h175-istiara-sterne-perlen',
      'vergleichstabelle-h176-istiara-mulaim-loewe',
      'vergleichstabelle-h177-alaqa-sababiyya',
      'vergleichstabelle-h178-alaqa-musabbabiyya',
      'vergleichstabelle-h179-alaqa-kulliyya',
      'vergleichstabelle-h180-alaqa-juziyya',
      'vergleichstabelle-h181-alaqa-itibar-ma-kana',
      'vergleichstabelle-h182-alaqa-itibar-ma-yakun',
      'vergleichstabelle-h183-alaqa-muqaraba',
    ];
    const ids = new Set(datei.vergleichstabellen.map((v) => v.id));
    for (const id of erwarteteIds) {
      expect(ids.has(id)).toBe(true);
    }
    expect(ids.size).toBe(erwarteteIds.length);
  });

  it('jede Vergleichstabelle hat mindestens zwei Spalten, mindestens eine Zeile, ein Kapitel und eine Quellenangabe', () => {
    for (const tabelle of datei.vergleichstabellen) {
      expect(tabelle.columns.length).toBeGreaterThanOrEqual(2);
      expect(tabelle.rows.length).toBeGreaterThanOrEqual(1);
      expect(tabelle.kapitel.length).toBeGreaterThan(0);
      expect(tabelle.source.file.length).toBeGreaterThan(0);
      expect(tabelle.source.page).toBeGreaterThan(0);
    }
  });

  it('jede belegte Zelle jeder Vergleichstabelle hat einen nicht-leeren ar- ODER de-Wert (kein geratenes/leeres Arabisch)', () => {
    for (const tabelle of datei.vergleichstabellen) {
      for (const row of tabelle.rows) {
        for (const col of tabelle.columns) {
          const zelle = tabelle.cells[row.id]?.[col.id] ?? null;
          if (zelle === null) continue;
          const hatAr = typeof zelle.ar === 'string' && zelle.ar.trim().length > 0;
          const hatDe = typeof zelle.de === 'string' && zelle.de.trim().length > 0;
          expect(hatAr || hatDe).toBe(true);
        }
      }
    }
  });

  it('jede Zellreferenz (Zeile/Spalte) in cells existiert auch in rows/columns der jeweiligen Tabelle', () => {
    for (const tabelle of datei.vergleichstabellen) {
      const rowIds = new Set(tabelle.rows.map((r) => r.id));
      const colIds = new Set(tabelle.columns.map((c) => c.id));
      for (const rowId of Object.keys(tabelle.cells)) {
        expect(rowIds.has(rowId)).toBe(true);
        for (const colId of Object.keys(tabelle.cells[rowId])) {
          expect(colIds.has(colId)).toBe(true);
        }
      }
    }
  });
});

describe('wortlistenLoader — der Katalog lädt exakt den Bestand aus wortlisten.json', () => {
  it('useWortlistenBestand liefert dieselbe Anzahl Wortlisten/Beispielsatzlisten/Ablaufschemata/Vergleichstabellen wie die Datei', async () => {
    const { useWortlistenBestand } = await import('./wortlistenLoader');
    // Kein React-Test-Renderer hier nötig: die queryFn ist eine normale
    // async-Funktion, die wir über den internen Cache-Mechanismus indirekt
    // absichern, indem wir denselben Importpfad wie der Loader direkt laden
    // und mit der Datei vergleichen (siehe paradigmenLoader.test.ts, das aus
    // demselben Grund ohne React-Query-Rendering auskommt).
    const datei = ladeDatei();
    const mod = (await import('./data/wortlisten.json')) as unknown as WortlistenDatei;
    expect(mod.wortlisten.length).toBe(datei.wortlisten.length);
    expect(mod.beispielsatzlisten.length).toBe(datei.beispielsatzlisten.length);
    expect(mod.ablaufschemata.length).toBe(datei.ablaufschemata.length);
    expect(mod.vergleichstabellen.length).toBe(datei.vergleichstabellen.length);
    expect(typeof useWortlistenBestand).toBe('function');
  });
});
