// Anzeige-Logik der Analyse-Übung: verknüpft ./modell.ts mit den i18n-Texten
// (grammatik.* + analyseUebung.* in src/locales/*.json). Wie
// ../analyse/wortAnalyseModel.ts bewusst ohne React-Abhängigkeit — nimmt `t`
// als Parameter entgegen, damit die Zuordnung isoliert testbar bleibt.
import type { Wortart } from '../grammatik';
import type { KasusTempusTyp } from './modell';

export type Uebersetzer = (key: string) => string;

export interface Begriff {
  name: string;
  ar: string;
}

export interface BegriffMitInfo extends Begriff {
  info: string;
}

/** t() liefert bei fehlendem Schlüssel den Schlüssel selbst zurück (s.
 * lib/translate.ts) — Grundlage für den Info-Fallback unten. */
function vorhanden(t: Uebersetzer, key: string): string | null {
  const wert = t(key);
  return wert === key ? null : wert;
}

export function wortartBegriff(wa: Wortart, t: Uebersetzer): BegriffMitInfo {
  return {
    name: t(`grammatik.wortarten.${wa}.name`),
    ar: t(`grammatik.wortarten.${wa}.ar`),
    info: t(`grammatik.wortarten.${wa}.info`),
  };
}

export const WORTART_OPTIONEN_BEGRIFFE = (t: Uebersetzer, optionen: readonly Wortart[]): (Begriff & { wert: Wortart })[] =>
  optionen.map((wa) => ({ wert: wa, ...wortartBegriff(wa, t) }));

function kasusTempusBasisSchluessel(typ: KasusTempusTyp): string {
  return typ === 'kasus' ? 'grammatik.ismEigenschaften.kasus' : 'grammatik.verbEigenschaften.tempus';
}

/** Zeilentitel der Kasus-/Tempus-Frage — der Name des Merkmals selbst
 * ("Kasus" bzw. "Zeitform und Befehlsform"), kein eigener analyseUebung-Schlüssel nötig. */
export function kasusTempusLabel(typ: KasusTempusTyp, t: Uebersetzer): Begriff {
  const basis = kasusTempusBasisSchluessel(typ);
  return { name: t(`${basis}.name`), ar: t(`${basis}.ar`) };
}

export function kasusTempusWertBegriff(typ: KasusTempusTyp, wert: string, t: Uebersetzer): BegriffMitInfo {
  const basis = kasusTempusBasisSchluessel(typ);
  // Nicht jeder Wert hat eine eigene info (z. B. grammatik.ismEigenschaften.
  // kasus.werte.*.info fehlt bewusst — nur der Merkmalstext existiert) —
  // dann die info der Merkmals-Kategorie selbst als Begründung.
  const spezifisch = vorhanden(t, `${basis}.werte.${wert}.info`);
  return {
    name: t(`${basis}.werte.${wert}.name`),
    ar: t(`${basis}.werte.${wert}.ar`),
    info: spezifisch ?? t(`${basis}.info`),
  };
}

export const KASUS_TEMPUS_OPTIONEN_BEGRIFFE = (
  typ: KasusTempusTyp,
  optionen: readonly string[],
  t: Uebersetzer,
): (Begriff & { wert: string })[] => optionen.map((wert) => ({ wert, ...kasusTempusWertBegriff(typ, wert, t) }));

// ---------- Satzrolle ----------

// Die kaana-/inna-Familien (relationBasis() liefert dafür 'pred'/'subj' statt
// eines QAC-Rohtags) haben KEINEN eigenen Eintrag unter grammatik.relationen
// (dort nur grammatik.relationen.muster.predOf/subjOf MIT {wort}-Platzhalter,
// s. wortAnalyseModel.ts relationAnzeige) — für die Auswahl-Schaltfläche
// braucht es aber einen Namen OHNE ein konkretes Bezugswort. Eigener,
// generischer Eintrag unter analyseUebung.satzrolleFamilie.*. Der
// AUSFÜHRLICHE Begründungstext beim Aufdecken kommt trotzdem aus
// relationAnzeige() (echtes Bezugswort eingesetzt) — s. WortFokusKarte.tsx.
export function satzrolleOptionBegriff(basis: string, t: Uebersetzer): Begriff {
  if (basis === 'pred') {
    return { name: t('analyseUebung.satzrolleFamilie.pred.name'), ar: t('analyseUebung.satzrolleFamilie.pred.ar') };
  }
  if (basis === 'subj') {
    return { name: t('analyseUebung.satzrolleFamilie.subj.name'), ar: t('analyseUebung.satzrolleFamilie.subj.ar') };
  }
  return { name: t(`grammatik.relationen.${basis}.name`), ar: t(`grammatik.relationen.${basis}.ar`) };
}

export const SATZROLLE_OPTIONEN_BEGRIFFE = (optionen: readonly string[], t: Uebersetzer): (Begriff & { wert: string })[] =>
  optionen.map((wert) => ({ wert, ...satzrolleOptionBegriff(wert, t) }));
