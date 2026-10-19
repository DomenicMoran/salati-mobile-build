// Regelkatalog BEGRUENDUNGEN.md → i18n-Schlüssel unter grammatik.begruendungen.*
// Reine Logik ohne React; Platzhalter werden vom Aufrufer via translate() aufgelöst.
import { relationBasis, wortart } from '../grammatik';
import type { MorphSegment, MorphSyntax, MorphWord } from '../morphologieTypen';

/** Kein auflösbarer Kopf: Pipeline-kodiertes „ohne Bezugswort“ (head null oder Selbstbezug). */
export function istKeinAufloesbaresBezugswort(syntax: MorphSyntax, position: number): boolean {
  return syntax.head == null || syntax.head === position;
}

/** Muster für eine Begründung — der Aufrufer ersetzt {platzhalter} und ruft t() auf. */
export interface BegruendungMuster {
  schluessel: string;
  ersetze: Record<string, string>;
}

const DIAKRITIKA_RE = /[ً-ٰٟۖ-ۭ]/g;

function ohneDiakritika(text: string): string {
  return text.replace(DIAKRITIKA_RE, '');
}

function ersetzePlatzhalter(text: string, platzhalter: Record<string, string>): string {
  let ergebnis = text;
  for (const [key, wert] of Object.entries(platzhalter)) {
    ergebnis = ergebnis.replaceAll(`{${key}}`, wert);
  }
  return ergebnis;
}

/** Löst ein {@link BegruendungMuster} über translate() in einen Anzeigesatz auf. */
export function loeseBegruendung(muster: BegruendungMuster | null, t: (key: string) => string): string | null {
  if (!muster) return null;
  const roh = t(muster.schluessel);
  if (roh === muster.schluessel) return null;
  return ersetzePlatzhalter(roh, muster.ersetze);
}

function stammSegment(word: MorphWord): MorphSegment {
  return word.segments.find((s) => s.kind === 'stem') ?? word.segments[0];
}

function praepositionText(word: MorphWord): string | null {
  const pSeg = word.segments.find((s) => s.pos === 'P');
  if (pSeg) return pSeg.text;
  const stamm = word.segments.find((s) => s.kind === 'stem');
  if (stamm?.pos === 'P') return stamm.text;
  return null;
}

/** Normalisiert Präpositionstext auf einen stabilen Schlüssel (min, bi, li, …). */
export function praepositionSchluessel(text: string): string | null {
  const n = ohneDiakritika(text).replace(/[ٱأإآ]/g, 'ا').trim();
  if (n.startsWith('من') || n === 'من') return 'min';
  if (n.startsWith('ب') && !n.startsWith('بعد') && !n.startsWith('بل')) return 'bi';
  if (n.startsWith('ل') && n.length <= 3) return 'li';
  if (n.startsWith('في') || n.startsWith('فى')) return 'fi';
  if (n.startsWith('على') || n.startsWith('عل')) return 'ala';
  if (n.startsWith('الى') || n.startsWith('إلى') || n.startsWith('الي')) return 'ila';
  if (n.startsWith('عن')) return 'an';
  if (n.startsWith('ك')) return 'ka';
  if (n.startsWith('حتى') || n.startsWith('حت')) return 'hatta';
  if (n.startsWith('مع')) return 'ma3a';
  return null;
}

function regierendePraeposition(word: MorphWord, verseWords: MorphWord[] | undefined): MorphWord | null {
  if (!word.syntax || word.syntax.relation !== 'gen' || !verseWords) return null;
  if (istKeinAufloesbaresBezugswort(word.syntax, word.position)) {
    // Eingebettete Präposition im selben Wort (z. B. بِسْمِ) — kein separates Bezugswort.
    return praepositionText(word) ? word : null;
  }
  const headWord = verseWords.find((w) => w.position === word.syntax!.head);
  if (!headWord) return null;
  if (praepositionText(headWord)) return headWord;
  return null;
}

const RELATION_ERWARTETER_KASUS: Partial<Record<string, 'nom' | 'acc' | 'gen'>> = {
  Subj: 'nom',
  Obj: 'acc',
  Poss: 'gen',
  Pred: 'nom',
  Pass: 'nom',
  cog: 'acc',
  Spec: 'acc',
};

const RELATION_KASUS_SCHLUESSEL: Partial<Record<string, string>> = {
  Subj: 'grammatik.begruendungen.kasus.relationSubj',
  Obj: 'grammatik.begruendungen.kasus.relationObj',
  Poss: 'grammatik.begruendungen.kasus.relationPoss',
  Pred: 'grammatik.begruendungen.kasus.relationPred',
  Pass: 'grammatik.begruendungen.kasus.relationPass',
  cog: 'grammatik.begruendungen.kasus.relationCog',
  Spec: 'grammatik.begruendungen.kasus.relationSpec',
};

const KASUS_NAME_KEY: Record<'nom' | 'acc' | 'gen', string> = {
  nom: 'grammatik.ismEigenschaften.kasus.werte.nom.name',
  acc: 'grammatik.ismEigenschaften.kasus.werte.acc.name',
  gen: 'grammatik.ismEigenschaften.kasus.werte.gen.name',
};

const KASUS_AR_KEY: Record<'nom' | 'acc' | 'gen', string> = {
  nom: 'grammatik.ismEigenschaften.kasus.werte.nom.ar',
  acc: 'grammatik.ismEigenschaften.kasus.werte.acc.ar',
  gen: 'grammatik.ismEigenschaften.kasus.werte.gen.ar',
};

function kasusPlatzhalter(kasus: 'nom' | 'acc' | 'gen', t: (key: string) => string): Record<string, string> {
  return {
    kasusname: t(KASUS_NAME_KEY[kasus]),
    kasusAr: t(KASUS_AR_KEY[kasus]),
  };
}

function innaKaanaKasusMuster(
  word: MorphWord,
  kasus: 'nom' | 'acc' | 'gen',
  t: (key: string) => string,
): BegruendungMuster | null {
  const syntax = word.syntax;
  if (!syntax) return null;
  const { basis, regens } = relationBasis(syntax.relation);
  if (!regens) return null;

  const partikel = regens;
  const platzhalter = { wort: word.text, partikel, ...kasusPlatzhalter(kasus, t) };

  if (basis === 'subj' && kasus === 'acc') {
    return { schluessel: 'grammatik.begruendungen.kasus.innaSubj', ersetze: platzhalter };
  }
  if (basis === 'pred' && kasus === 'acc') {
    return { schluessel: 'grammatik.begruendungen.kasus.kaanaPred', ersetze: platzhalter };
  }
  return null;
}

/** Kasus-Begründung gemäß Katalog §3 (Grundform + Präposition/Inna/Kaana/Relation). */
export function kasusBegruendung(
  word: MorphWord,
  segment: MorphSegment,
  verseWords: MorphWord[] | undefined,
  t: (key: string) => string,
): BegruendungMuster | null {
  const kasus = segment.features.case;
  const wort = word.text;

  if (kasus === null) {
    return { schluessel: 'grammatik.begruendungen.kasus.fehlend', ersetze: { wort } };
  }

  const grund: BegruendungMuster = {
    schluessel: 'grammatik.begruendungen.kasus.grund',
    ersetze: { wort, ...kasusPlatzhalter(kasus, t) },
  };

  const wa = wortart(segment.pos);
  const syntax = word.syntax;

  // Präposition → Dscharr (nur bei Ism, nicht bei Fiʿl — ḥattā-Falle)
  if (kasus === 'gen' && wa === 'ism') {
    const prepWord = regierendePraeposition(word, verseWords);
    if (prepWord) {
      const prepText = praepositionText(prepWord);
      const prepKey = prepText ? praepositionSchluessel(prepText) : null;
      if (prepKey) {
        const prepNameKey = `grammatik.begruendungen.praepositionen.${prepKey}.name`;
        const prepName = t(prepNameKey);
        return {
          schluessel: 'grammatik.begruendungen.kasus.praeposition',
          ersetze: {
            wort,
            praeposition: prepText ?? prepWord.text,
            praepositionName: prepName !== prepNameKey ? prepName : prepText ?? prepWord.text,
            ...kasusPlatzhalter('gen', t),
          },
        };
      }
    }
  }

  // Inna-/Kaana-Familie
  const innaKaana = innaKaanaKasusMuster(word, kasus, t);
  if (innaKaana) return innaKaana;

  if (syntax) {
    const { basis } = relationBasis(syntax.relation);

    if (basis === 'Adj' || basis === 'App') {
      if (!istKeinAufloesbaresBezugswort(syntax, word.position)) {
        const headWord = verseWords?.find((w) => w.position === syntax.head);
        const headText = headWord?.text ?? String(syntax.head ?? '');
        const schluessel =
          basis === 'Adj'
            ? 'grammatik.begruendungen.kasus.relationAdj'
            : 'grammatik.begruendungen.kasus.relationApp';
        return {
          schluessel,
          ersetze: { wort, headText, ...kasusPlatzhalter(kasus, t) },
        };
      }
    }

    const erwartet = RELATION_ERWARTETER_KASUS[basis];
    const relationKey = RELATION_KASUS_SCHLUESSEL[basis];
    if (erwartet && relationKey) {
      if (kasus === erwartet) {
        return {
          schluessel: relationKey,
          ersetze: { wort, ...kasusPlatzhalter(kasus, t) },
        };
      }
      return {
        schluessel: 'grammatik.begruendungen.kasus.relationWiderspruch',
        ersetze: {
          wort,
          relation: basis,
          case: kasus,
          erwartet,
          ...kasusPlatzhalter(kasus, t),
        },
      };
    }
  }

  return grund;
}

function possessivSuffix(word: MorphWord): string | null {
  const stamm = stammSegment(word);
  if (!['N', 'ADJ', 'PN'].includes(stamm.pos)) return null;
  const suffix = word.segments.find((s) => s.kind === 'suffix' && s.pos === 'PRON');
  return suffix?.text ?? null;
}

function mudafHeadWort(word: MorphWord, verseWords: MorphWord[] | undefined): string | null {
  if (!verseWords) return null;
  const mudaf = verseWords.find(
    (w) => w.syntax?.relation === 'Poss' && w.syntax.head === word.position,
  );
  return mudaf?.text ?? null;
}

/** Bestimmtheit-Begründung gemäß Katalog §5. */
export function bestimmtheitBegruendung(
  word: MorphWord,
  segment: MorphSegment,
  verseWords: MorphWord[] | undefined,
): BegruendungMuster | null {
  const wort = word.text;
  const state = segment.features.state;

  if (state === 'indefinite') {
    return { schluessel: 'grammatik.begruendungen.bestimmtheit.indefinite', ersetze: { wort } };
  }

  if (state !== 'definite') {
    return { schluessel: 'grammatik.begruendungen.bestimmtheit.fehlend', ersetze: { wort } };
  }

  const hatArtikel = word.segments.some((s) => s.kind === 'prefix' && s.pos === 'DET');
  if (hatArtikel) {
    return { schluessel: 'grammatik.begruendungen.bestimmtheit.artikel', ersetze: { wort } };
  }

  const suffix = possessivSuffix(word);
  if (suffix) {
    return { schluessel: 'grammatik.begruendungen.bestimmtheit.possessiv', ersetze: { wort, suffix } };
  }

  if (segment.pos === 'PN') {
    return { schluessel: 'grammatik.begruendungen.bestimmtheit.eigenname', ersetze: { wort } };
  }

  const headWort = mudafHeadWort(word, verseWords);
  if (headWort) {
    return { schluessel: 'grammatik.begruendungen.bestimmtheit.mudaf', ersetze: { wort, headWort } };
  }

  return { schluessel: 'grammatik.begruendungen.bestimmtheit.artikel', ersetze: { wort } };
}

/** Tempus-Begründung gemäß Katalog §9. */
export function tempusBegruendung(word: MorphWord, segment: MorphSegment): BegruendungMuster | null {
  const tense = segment.features.tense;
  if (!tense) return null;
  const schluessel = `grammatik.begruendungen.tempus.${tense}`;
  return { schluessel, ersetze: { wort: word.text } };
}

/** Modus-Begründung — nur wenn features.mood gesetzt (Katalog §4, kein Hardcode). */
export function modusBegruendung(word: MorphWord, segment: MorphSegment): BegruendungMuster | null {
  const mood = segment.features.mood;
  if (mood === null) return null;
  const schluessel = `grammatik.begruendungen.modus.${mood}`;
  return { schluessel, ersetze: { wort: word.text } };
}

/** Genus-verbi-Begründung — Passiv bei voice=passive, Aktiv-Default bei voice=null (§10). */
export function genusVerbiBegruendung(
  word: MorphWord,
  segment: MorphSegment,
): BegruendungMuster | null {
  if (segment.pos !== 'V') return null;
  const voice = segment.features.voice;
  if (voice === 'passive') {
    return { schluessel: 'grammatik.begruendungen.genusVerbi.passiv', ersetze: { wort: word.text } };
  }
  if (voice === null) {
    return { schluessel: 'grammatik.begruendungen.genusVerbi.aktiv', ersetze: { wort: word.text } };
  }
  return null;
}

const VERBFORM_MAX_BESCHRIEBEN = 10;

/** Verbform-Begründung mit Formmerkmal oder ehrlichem Fallback für XI/XII (§11). */
export function verbformBegruendung(
  word: MorphWord,
  form: number,
  herkunft: 'beleg' | 'hergeleitet',
  formmerkmal: string,
): BegruendungMuster | null {
  const wort = word.text;
  if (form > VERBFORM_MAX_BESCHRIEBEN) {
    return {
      schluessel: 'grammatik.begruendungen.verbform.selten',
      ersetze: { wort, form: String(form) },
    };
  }
  if (herkunft === 'hergeleitet' && form === 1) {
    return { schluessel: 'grammatik.begruendungen.verbform.form1', ersetze: { wort } };
  }
  return {
    schluessel: 'grammatik.begruendungen.verbform.explizit',
    ersetze: { wort, form: String(form), formmerkmal },
  };
}

/** Satzrollen-Begründung gemäß Katalog §13 (strukturell + Kasus-Konsistenz). */
export function relationBegruendung(
  word: MorphWord,
  verseWords: MorphWord[] | undefined,
  relationName: string,
): BegruendungMuster | null {
  const wort = word.text;
  const syntax = word.syntax;
  if (!syntax) return null;

  if (!istKeinAufloesbaresBezugswort(syntax, word.position)) {
    const headWord = verseWords?.find((w) => w.position === syntax.head);
    const headText = headWord?.text ?? null;

    if (headText) {
      return {
        schluessel: 'grammatik.begruendungen.relation.strukturell',
        ersetze: { wort, relation: relationName, headText },
      };
    }
  }

  return {
    schluessel: 'grammatik.begruendungen.relation.strukturellOhneHead',
    ersetze: { wort, relation: relationName },
  };
}

/** Zusatz-Begründung Kasus↔Relation, wenn Kasus und Relation zusammenpassen (§13). */
export function relationKasusZusatzBegruendung(
  word: MorphWord,
  t: (key: string) => string,
): BegruendungMuster | null {
  const syntax = word.syntax;
  if (!syntax) return null;

  const stamm = stammSegment(word);
  const kasus = stamm.features.case;
  if (!kasus) return null;

  const { basis } = relationBasis(syntax.relation);

  if (basis === 'Adj' || basis === 'App') {
    return null;
  }

  const erwartet = RELATION_ERWARTETER_KASUS[basis];
  if (!erwartet || kasus !== erwartet) return null;

  return {
    schluessel: 'grammatik.begruendungen.relation.kasusPassend',
    ersetze: {
      wort: word.text,
      relation: basis,
      ...kasusPlatzhalter(kasus, t),
    },
  };
}
