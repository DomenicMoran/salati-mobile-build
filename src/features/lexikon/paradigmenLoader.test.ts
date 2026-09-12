// Absicherung gegen genau den Fehler, der zu dieser Änderung geführt hat:
// paradigmen-weitere.json (17 fertige, getestete Tabellen) lag im Datenordner,
// war aber nicht in PARADIGM_SOURCES eingetragen — die Tabellen erschienen
// deshalb nirgends in der App, obwohl Daten UND Tests dafür längst existierten
// (siehe Auftrag). Dieser Test gleicht den TATSÄCHLICHEN Ordnerinhalt gegen
// die Loader-Liste ab, statt sich auf "wurde schon irgendwo erwähnt" zu
// verlassen — künftig vergisst jemand eine Zeile in PARADIGM_SOURCES, dieser
// Test schlägt fehl, bevor die Tabellen in der App unsichtbar verschwinden.
import { readdirSync } from 'fs';
import { join } from 'path';

import { PARADIGM_SOURCES } from './paradigmenLoader';

const DATEN_ORDNER = join(__dirname, 'data');

/** Nur die eigentlichen Tabellendateien (paradigmen*.json) — keine anderen
 *  JSONs, die zufällig im selben Ordner liegen könnten (aktuell keine, aber
 *  die Filterung selbst dokumentiert die Annahme). */
function vorhandeneParadigmenDateien(): string[] {
  return readdirSync(DATEN_ORDNER)
    .filter((datei) => datei.startsWith('paradigmen') && datei.endsWith('.json'))
    .sort();
}

describe('paradigmenLoader — jede Tabellendatei ist eingetragen', () => {
  it('jede data/paradigmen*.json-Datei kommt in PARADIGM_SOURCES vor', () => {
    const vorhanden = vorhandeneParadigmenDateien();
    const eingetragen = new Set(PARADIGM_SOURCES.map((s) => s.datei));

    const fehlend = vorhanden.filter((datei) => !eingetragen.has(datei));

    expect(fehlend).toEqual([]);
  });

  it('umgekehrt: jeder PARADIGM_SOURCES-Eintrag verweist auf eine tatsächlich vorhandene Datei (keine toten/umbenannten Einträge)', () => {
    const vorhanden = new Set(vorhandeneParadigmenDateien());
    const tote = PARADIGM_SOURCES.map((s) => s.datei).filter((datei) => !vorhanden.has(datei));

    expect(tote).toEqual([]);
  });

  it('kein Dateiname kommt doppelt in PARADIGM_SOURCES vor', () => {
    const namen = PARADIGM_SOURCES.map((s) => s.datei);
    expect(new Set(namen).size).toBe(namen.length);
  });
});
