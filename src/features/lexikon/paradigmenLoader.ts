// Gemeinsame Ladeschicht für ALLE Paradigmen-/Bab-Tabellendateien
// (data/paradigmen*.json) — die Aufteilung auf mehrere Dateien entstand nur,
// damit mehrere Agenten parallel daran arbeiten konnten (siehe Kopf-Kommentar
// in data/LUECKEN.md); für die App erscheinen sie als EIN geordneter,
// kategorisierter Bestand (siehe paradigmenKategorien.ts).
//
// Literale dynamic import()s statt Template-Pfad, EXAKT wie
// @/features/study/courses.ts (COURSE_DEFS) und @/features/lexikon/
// erklaerungenLoader.ts (ERKLAERUNGEN_LOADERS) es bereits für ihre
// jeweiligen Dateien tun: Metro/Webpack können nur einen literalen Pfad in
// dynamic import() zu einem eigenen Chunk auflösen, ein Template-String
// (`import(\`./data/${file}\`)`) würde ALLE denkbaren JSONs ins Bundle
// hieven. Die ~450 KB Tabellendaten sollen NICHT im Start-Bundle jeder
// Route landen, die auch nur eine einzelne Tabelle referenziert (z. B.
// die Begriff-Detailansicht über `tabellen`) — nur wer den Tabellenkatalog
// oder eine Verbfamilie tatsächlich öffnet, lädt sie nach.
//
// NEUE TABELLENDATEI ERGÄNZEN: eine einzige Zeile zu PARADIGM_SOURCES unten
// hinzufügen (literaler Pfad!) — kein weiterer Code nötig, Kategorisierung
// und Katalog-Anzeige greifen automatisch (siehe paradigmenKategorien.ts).
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { ParadigmTabelle } from './erklaerungenTypes';
import { kategorisiere, type ParadigmKategorie, type ParadigmTabelleEingeordnet, type VerbFamilie } from './paradigmenKategorien';

const STATIC_STALE_TIME = 7 * 24 * 60 * 60 * 1000;

interface ParadigmSource {
  /** Nur für Fehlermeldungen/Herkunftsnachweis — nicht für den Ladepfad
   *  selbst (der steht literal in `load` unten, s. Kopf-Kommentar). */
  datei: string;
  load: () => Promise<unknown>;
}

// Exportiert (nur) damit paradigmenDateien.test.ts den Ist-Bestand von
// data/paradigmen*.json gegen diese Liste abgleichen kann (Absicherung
// gegen genau den Fehler, der zu dieser Änderung geführt hat: eine fertige
// Tabellendatei, die hier zu ergänzen vergessen wurde).
export const PARADIGM_SOURCES: ParadigmSource[] = [
  { datei: 'paradigmen.json', load: () => import('./data/paradigmen.json') },
  { datei: 'paradigmen-verben.json', load: () => import('./data/paradigmen-verben.json') },
  { datei: 'paradigmen-bab-mithal-ajwaf.json', load: () => import('./data/paradigmen-bab-mithal-ajwaf.json') },
  { datei: 'paradigmen-bab-naqis-lafif-mudaaf.json', load: () => import('./data/paradigmen-bab-naqis-lafif-mudaaf.json') },
  { datei: 'paradigmen-bab-murakkab.json', load: () => import('./data/paradigmen-bab-murakkab.json') },
  { datei: 'paradigmen-weitere.json', load: () => import('./data/paradigmen-weitere.json') },
  { datei: 'paradigmen-nachtrag.json', load: () => import('./data/paradigmen-nachtrag.json') },
  // Eine weitere Tabellendatei? Hier eine weitere Zeile ergänzen — siehe Kopf-Kommentar.
];

let cache: Promise<ParadigmTabelleEingeordnet[]> | null = null;

/** Lädt und kategorisiert ALLE Tabellen aus ALLEN Quelldateien — einmalig
 *  gecacht (modul-lokal, zusätzlich zum react-query-Cache der Hooks unten),
 *  damit ein zweiter Aufruf (z. B. Katalog + Verbtyp-Route gleichzeitig
 *  offen) nicht doppelt neu importiert. */
function ladeAlleParadigmTabellen(): Promise<ParadigmTabelleEingeordnet[]> {
  if (!cache) {
    cache = Promise.all(PARADIGM_SOURCES.map((s) => s.load().then((mod) => ({ mod, datei: s.datei })))).then((geladen) => {
      const out: ParadigmTabelleEingeordnet[] = [];
      for (const { mod, datei } of geladen) {
        const tables = (mod as { tables: ParadigmTabelle[] }).tables ?? [];
        for (const table of tables) out.push(kategorisiere(table, datei));
      }
      return out;
    });
  }
  return cache;
}

/** Alle Tabellen, kategorisiert — für den Katalog im Reiter "Grammatik &
 *  Ṣarf" (ParadigmKatalogView) und die Verbtyp-Route. */
export function useAlleParadigmTabellen(): UseQueryResult<ParadigmTabelleEingeordnet[]> {
  return useQuery({
    queryKey: ['lexikon', 'paradigmTabellenAlle'],
    queryFn: ladeAlleParadigmTabellen,
    staleTime: STATIC_STALE_TIME,
  });
}

/** Lädt EINE Paradigmen-Tabelle per ID — durchsucht alle Quelldateien
 *  (Reihenfolge wie PARADIGM_SOURCES). `undefined`, wenn die ID in keiner
 *  Datei vorkommt. Für die Begriff-Detailansicht (`tabellen`-Verweise aus
 *  data/erklaerungen/de-*.json). */
export function useParadigmTabelle(tableId: string): UseQueryResult<ParadigmTabelleEingeordnet | undefined> {
  return useQuery({
    queryKey: ['lexikon', 'paradigmTabelle', tableId],
    queryFn: async () => {
      const tables = await ladeAlleParadigmTabellen();
      return tables.find((t) => t.id === tableId);
    },
    staleTime: STATIC_STALE_TIME,
  });
}

/** Alle Tabellen einer Verbstamm-Familie (Bab), über ALLE Kategorien hinweg
 *  — für die Verbtyp-Route: ein hohles Verb im Reader soll sowohl die
 *  Aǧwaf-Bab-Tabellen als auch (bei 'sahih') die vollständigen
 *  Personenmatrizen des Referenzverbs نصر finden, nicht nur die Bab-Familie
 *  im engeren Sinn. */
export function useParadigmTabellenByVerbFamilie(familie: VerbFamilie | null): UseQueryResult<ParadigmTabelleEingeordnet[]> {
  return useQuery({
    queryKey: ['lexikon', 'paradigmTabellenVerbFamilie', familie],
    queryFn: async () => {
      if (!familie) return [];
      const tables = await ladeAlleParadigmTabellen();
      return tables.filter((t) => t.verbFamilie === familie || (familie === 'sahih' && t.id.endsWith('-matrix')));
    },
    staleTime: STATIC_STALE_TIME,
    enabled: familie !== null,
  });
}

export function gruppenNachKategorie(
  tables: ParadigmTabelleEingeordnet[],
): Partial<Record<ParadigmKategorie, ParadigmTabelleEingeordnet[]>> {
  const out: Partial<Record<ParadigmKategorie, ParadigmTabelleEingeordnet[]>> = {};
  for (const t of tables) {
    (out[t.kategorie] ??= []).push(t);
  }
  return out;
}

export function gruppenNachVerbFamilie(tables: ParadigmTabelleEingeordnet[]): Partial<Record<VerbFamilie, ParadigmTabelleEingeordnet[]>> {
  const out: Partial<Record<VerbFamilie, ParadigmTabelleEingeordnet[]>> = {};
  for (const t of tables) {
    if (!t.verbFamilie) continue;
    (out[t.verbFamilie] ??= []).push(t);
  }
  return out;
}
