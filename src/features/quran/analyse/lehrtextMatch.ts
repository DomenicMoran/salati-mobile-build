// Ordnet ein analysiertes Wort passenden Lehrtext-Einträgen aus
// data/erklaerungen/de-*.json zu — für den Abschnitt „Fortgeschrittene
// Grammatik“ im WortAnalyseSheet. Bewusst konservativ: höchstens zwei Treffer,
// Relation vor POS, keine Spekulation bei unbekannten Labels.
import { relationBasis, wortart } from '../grammatik';
import type { MorphSegment, MorphWord } from '../morphologieTypen';
import type { ErklaerungenBereich } from '@/features/lexikon/erklaerungenTypes';

export interface LehrtextVerweis {
  bereich: ErklaerungenBereich;
  id: string;
}

const RELATION_ZU_EINTRAG: Readonly<Record<string, LehrtextVerweis>> = {
  App: { bereich: 'partikel-syntax', id: 'badal' },
  conj: { bereich: 'partikel-syntax', id: 'huruf-atf' },
  Subj: { bereich: 'partikel-syntax', id: 'faail' },
  Pred: { bereich: 'partikel-syntax', id: 'khabar' },
  Adj: { bereich: 'partikel-syntax', id: 'sifah' },
  Obj: { bereich: 'partikel-syntax', id: 'maful-bihi' },
  Poss: { bereich: 'partikel-syntax', id: 'mudaf-ilayh' },
  circ: { bereich: 'partikel-syntax', id: 'haal' },
  Spec: { bereich: 'partikel-syntax', id: 'tamyiz' },
  voc: { bereich: 'partikel-syntax', id: 'munada' },
  exp: { bereich: 'partikel-syntax', id: 'mustathna' },
  emph: { bereich: 'partikel-syntax', id: 'taukid' },
  Pass: { bereich: 'partikel-syntax', id: 'naib-al-fail' },
  cog: { bereich: 'partikel-syntax', id: 'maful-mutlaq' },
  prp: { bereich: 'partikel-syntax', id: 'maful-liajlihi' },
  cond: { bereich: 'partikel-syntax', id: 'shart' },
  rslt: { bereich: 'partikel-syntax', id: 'shart' },
  Pro: { bereich: 'partikel-syntax', id: 'nahy' },
};

const POS_ZU_EINTRAG: Readonly<Record<string, LehrtextVerweis>> = {
  P: { bereich: 'partikel-syntax', id: 'huruf-jarr' },
  CONJ: { bereich: 'partikel-syntax', id: 'huruf-atf' },
  NEG: { bereich: 'partikel-syntax', id: 'verneinung' },
  INTG: { bereich: 'partikel-syntax', id: 'istifham' },
  CAUS: { bereich: 'partikel-syntax', id: 'faa-sababiyya' },
  RSLT: { bereich: 'partikel-syntax', id: 'faa-jawab' },
  IMPV: { bereich: 'partikel-syntax', id: 'lam-al-amr' },
};

const KAANA_REGENS = new Set(['kan', 'kwn', 'kana', 'ykwl', 'yakun']);
const INNA_REGENS = new Set(['in', 'inna', 'anna', 'la', 'lakinna']);

function stammSegment(word: MorphWord): MorphSegment {
  return word.segments.find((s) => s.kind === 'stem') ?? word.segments[0];
}

function relationVerweis(relation: string): LehrtextVerweis | null {
  const { basis, regens } = relationBasis(relation);
  if (regens) {
    if (KAANA_REGENS.has(regens)) {
      return { bereich: 'partikel-syntax', id: 'kaana-wa-akhawatuha' };
    }
    if (INNA_REGENS.has(regens)) {
      return { bereich: 'partikel-syntax', id: 'inna-wa-akhawatuha' };
    }
  }
  return RELATION_ZU_EINTRAG[basis] ?? null;
}

function posVerweise(word: MorphWord): LehrtextVerweis[] {
  const out: LehrtextVerweis[] = [];
  const seen = new Set<string>();
  for (const segment of word.segments) {
    const treffer = POS_ZU_EINTRAG[segment.pos];
    if (!treffer) continue;
    const key = `${treffer.bereich}:${treffer.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(treffer);
  }
  return out;
}

function dedupe(liste: LehrtextVerweis[]): LehrtextVerweis[] {
  const out: LehrtextVerweis[] = [];
  const seen = new Set<string>();
  for (const item of liste) {
    const key = `${item.bereich}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Bis zu zwei passende Lehrtext-Einträge für dieses Wort — Relation hat Vorrang
 * vor POS-Tags. Leere Liste, wenn nichts sicher passt (kein leerer Block).
 */
export function lehrtextVerweise(word: MorphWord, max = 2): LehrtextVerweis[] {
  const kandidaten: LehrtextVerweis[] = [];

  if (word.syntax?.relation) {
    const relationTreffer = relationVerweis(word.syntax.relation);
    if (relationTreffer) kandidaten.push(relationTreffer);
  }

  const stamm = stammSegment(word);
  const wa = wortart(stamm.pos);
  if (wa === 'harf') {
    kandidaten.push(...posVerweise(word));
  } else if (kandidaten.length === 0) {
    // Bei Nomina/Verben nur POS-Fallback, wenn keine Syntaxrelation bekannt ist.
    kandidaten.push(...posVerweise(word));
  }

  return dedupe(kandidaten).slice(0, max);
}
