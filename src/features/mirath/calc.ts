// Islamischer Erbrechts-Rechner (Fara'id) — bewusst eingeschränkter Umfang:
// deckt die sechs nie vollständig ausschließbaren Erben (Ehemann/Ehefrau,
// Vater/Mutter, Sohn/Tochter) plus volle Geschwister ab. Quranische Brüche
// nach Sure An-Nisa 4:11-12/176, von allen 4 sunnitischen Rechtsschulen
// gleichermaßen anerkannt. NICHT abgedeckt (bewusst, siehe UI-Hinweis):
// Enkelkinder, Halbgeschwister, Großeltern, Radd (Rückgabe bei Fehlen eines
// residuären Erben) — dort bestehen echte Meinungsunterschiede zwischen den
// Rechtsschulen, die dieser Rechner nicht auflösen darf; stattdessen wird
// ein "unresolvedRemainder" gemeldet und auf gelehrte Beratung verwiesen.

export type Heir =
  | 'husband'
  | 'wife'
  | 'father'
  | 'mother'
  | 'son'
  | 'daughter'
  | 'brother'
  | 'sister';

export interface MirathInput {
  deceasedGender: 'male' | 'female';
  hasSpouse: boolean;
  /** Nur relevant, wenn deceasedGender === 'male' (mehrere Ehefrauen). */
  wivesCount: number;
  sons: number;
  daughters: number;
  fatherAlive: boolean;
  motherAlive: boolean;
  fullBrothers: number;
  fullSisters: number;
}

export interface HeirShare {
  heir: Heir;
  count: number;
  /** Anteil der GESAMTEN Erbmasse für diese ganze Erbenklasse (nicht pro Kopf). */
  fraction: number;
  perPerson: number;
}

export interface MirathResult {
  shares: HeirShare[];
  awlApplied: boolean;
  /** Summe der Bruchteile vor der Awl-Normalisierung (nur gesetzt, wenn awlApplied). */
  awlSumBefore: number;
  gharrawaynApplied: boolean;
  /** > 0, wenn nach allen bekannten Erben ein Rest übrig bleibt, für den
   * dieser Rechner keine unstrittige Regel abbildet (radd-Fall). */
  unresolvedRemainder: number;
}

const ZERO_RESULT_BASE = { awlApplied: false, awlSumBefore: 0, gharrawaynApplied: false };

export function calcMirath(input: MirathInput): MirathResult {
  const hasChildren = input.sons > 0 || input.daughters > 0;
  const siblingsCanInherit = !hasChildren && !input.fatherAlive;

  // --- Ehepartner (fest, nie residuär) ---
  let spouseFraction = 0;
  let spouseHeir: Heir | null = null;
  let spouseCount = 0;
  if (input.hasSpouse) {
    if (input.deceasedGender === 'male') {
      spouseHeir = 'wife';
      spouseCount = Math.max(1, input.wivesCount);
      spouseFraction = hasChildren ? 1 / 8 : 1 / 4;
    } else {
      spouseHeir = 'husband';
      spouseCount = 1;
      spouseFraction = hasChildren ? 1 / 4 : 1 / 2;
    }
  }

  // --- Kinder: Söhne machen die Klasse residuär (2:1 zu Töchtern);
  // nur Töchter erhalten feste Anteile (1/2 bzw. 2/3). ---
  const childrenResiduary = input.sons > 0;
  const daughtersFixedFraction = childrenResiduary
    ? 0
    : input.daughters === 1
      ? 1 / 2
      : input.daughters >= 2
        ? 2 / 3
        : 0;

  // --- Vater: 1/6 fest, sobald Kinder da sind; zusätzlich (oder allein)
  // residuär, sobald kein Sohn vorhanden ist. ---
  const fatherFixedFraction = input.fatherAlive && hasChildren ? 1 / 6 : 0;
  const fatherIsResiduary = input.fatherAlive && input.sons === 0;

  // --- Mutter: 1/6 bei Kindern ODER 2+ Geschwistern, sonst 1/3 — außer im
  // Gharrawayn-Fall (Ehepartner + beide Elternteile, keine Kinder/Geschwister):
  // dort 1/3 vom Rest NACH dem Ehepartner-Anteil (Mehrheitsmeinung: Umar,
  // Uthman, Ali, Ibn Mas'ud, Zayd — Ibn Abbas widersprach als Einzelmeinung). ---
  const siblingCountForMotherRule = input.fullBrothers + input.fullSisters;
  const isGharrawayn =
    input.motherAlive &&
    input.fatherAlive &&
    input.hasSpouse &&
    !hasChildren &&
    siblingCountForMotherRule === 0;
  let motherFraction = 0;
  if (input.motherAlive) {
    if (isGharrawayn) {
      motherFraction = (1 - spouseFraction) / 3;
    } else {
      motherFraction = hasChildren || siblingCountForMotherRule >= 2 ? 1 / 6 : 1 / 3;
    }
  }

  // --- Volle Geschwister: nur relevant, wenn weder Kinder noch Vater
  // vorhanden sind. Brüder machen die Klasse residuär (2:1 zu Schwestern). ---
  const siblingsResiduary = siblingsCanInherit && input.fullBrothers > 0;
  const sistersFixedFraction =
    !siblingsCanInherit || siblingsResiduary
      ? 0
      : input.fullSisters === 1
        ? 1 / 2
        : input.fullSisters >= 2
          ? 2 / 3
          : 0;

  let fixedSum =
    spouseFraction + daughtersFixedFraction + fatherFixedFraction + motherFraction + sistersFixedFraction;

  const hasResiduaryClass = childrenResiduary || fatherIsResiduary || siblingsResiduary;

  // Awl (proportionale Kürzung) tritt unter den Fara'id-Erben auf, sobald ihre
  // festen Anteile zusammen 1 übersteigen — unabhängig davon, ob daneben eine
  // residuäre Klasse existiert. Bei Söhnen/Brüdern als Residuar-Klasse kann das
  // nie passieren (die haben selbst keinen festen Anteil, der zur Summe beiträgt),
  // aber der Vater HAT einen eigenen festen Anteil (1/6) und bleibt trotzdem
  // "residuär" (falls kein Sohn da ist) — daher ist z.B. Ehepartner + 2+ Töchter
  // + Vater + Mutter ein klassischer Awl-Fall (Lehrbuch: 24 -> 27), obwohl der
  // Vater technisch zur Residuar-Klasse zählt. Der Vater bekommt dann nur noch
  // seinen (skalierten) festen Anteil; der residuaryPool-Ausgleich unten wird
  // durch den max(0, ...)-Clamp ohnehin auf 0 begrenzt.
  let awlApplied = false;
  let awlSumBefore = 0;
  if (fixedSum > 1) {
    awlApplied = true;
    awlSumBefore = fixedSum;
    const factor = 1 / fixedSum;
    spouseFraction *= factor;
    // daughtersFixedFraction, fatherFixedFraction, motherFraction, sistersFixedFraction
    // werden unten direkt aus den skalierten Werten neu berechnet.
    fixedSum = 1;
  }
  const scale = awlApplied ? 1 / awlSumBefore : 1;
  const daughtersFinal = daughtersFixedFraction * scale;
  const fatherFixedFinal = fatherFixedFraction * scale;
  const motherFinal = motherFraction * scale;
  const sistersFinal = sistersFixedFraction * scale;
  const spouseFinal = spouseFraction;

  const residuaryPool = hasResiduaryClass
    ? Math.max(0, 1 - (spouseFinal + daughtersFinal + fatherFixedFinal + motherFinal + sistersFinal))
    : 0;
  const unresolvedRemainder = hasResiduaryClass
    ? 0
    : Math.max(0, 1 - (spouseFinal + daughtersFinal + fatherFixedFinal + motherFinal + sistersFinal));

  const shares: HeirShare[] = [];

  if (spouseHeir && spouseFinal > 0) {
    shares.push({
      heir: spouseHeir,
      count: spouseCount,
      fraction: spouseFinal,
      perPerson: spouseFinal / spouseCount,
    });
  }

  if (childrenResiduary) {
    // Söhne:Töchter = 2:1 vom Restpool.
    const units = input.sons * 2 + input.daughters;
    if (units > 0) {
      const unitValue = residuaryPool / units;
      if (input.sons > 0) {
        shares.push({ heir: 'son', count: input.sons, fraction: unitValue * 2 * input.sons, perPerson: unitValue * 2 });
      }
      if (input.daughters > 0) {
        shares.push({
          heir: 'daughter',
          count: input.daughters,
          fraction: unitValue * input.daughters,
          perPerson: unitValue,
        });
      }
    }
  } else if (input.daughters > 0) {
    shares.push({
      heir: 'daughter',
      count: input.daughters,
      fraction: daughtersFinal,
      perPerson: daughtersFinal / input.daughters,
    });
  }

  if (input.fatherAlive) {
    const fatherTotal = fatherFixedFinal + (fatherIsResiduary ? residuaryPool : 0);
    if (fatherTotal > 0) {
      shares.push({ heir: 'father', count: 1, fraction: fatherTotal, perPerson: fatherTotal });
    }
  }

  if (input.motherAlive && motherFinal > 0) {
    shares.push({ heir: 'mother', count: 1, fraction: motherFinal, perPerson: motherFinal });
  }

  if (siblingsCanInherit) {
    if (siblingsResiduary) {
      const units = input.fullBrothers * 2 + input.fullSisters;
      if (units > 0) {
        const unitValue = residuaryPool / units;
        if (input.fullBrothers > 0) {
          shares.push({
            heir: 'brother',
            count: input.fullBrothers,
            fraction: unitValue * 2 * input.fullBrothers,
            perPerson: unitValue * 2,
          });
        }
        if (input.fullSisters > 0) {
          shares.push({
            heir: 'sister',
            count: input.fullSisters,
            fraction: unitValue * input.fullSisters,
            perPerson: unitValue,
          });
        }
      }
    } else if (input.fullSisters > 0) {
      shares.push({
        heir: 'sister',
        count: input.fullSisters,
        fraction: sistersFinal,
        perPerson: sistersFinal / input.fullSisters,
      });
    }
  }

  return {
    ...ZERO_RESULT_BASE,
    shares,
    awlApplied,
    awlSumBefore,
    gharrawaynApplied: isGharrawayn,
    unresolvedRemainder,
  };
}
