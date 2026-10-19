// Reine Lookup-Schicht: verbForm (1–10) aus der Morphologie → Paradigmen-
// Tabellen-ID in paradigmen-weitere.json / paradigmen-nachtrag.json.
// Die acht Sarf-Großfamilien (Form II–X ohne IX) heißen dort
// sarf-familie-1-allama … sarf-familie-8-istaghfara; Form I verweist auf die
// Referenztabelle der „Kleinen Familie“ (kleine-familie-nasara). Form IX hat
// bewusst keine eigene Großfamilien-Tabelle (siehe data/LUECKEN.md).
//
// Bewusst ohne React — nur Zahlen und Strings, damit Jest die Zuordnung ohne
// Paradigmen-Loader prüfen kann.

/** Alle Paradigmen-IDs, die {@link paradigmenTabelleId} für Form II–X liefern kann. */
export const SARF_GROSSFAMILIEN_IDS = [
  'sarf-familie-1-allama',
  'sarf-familie-2-jaadala',
  'sarf-familie-3-akhbara',
  'sarf-familie-4-taallama',
  'sarf-familie-5-tasaaala',
  'sarf-familie-6-inkasara',
  'sarf-familie-7-iqtaraba',
  'sarf-familie-8-istaghfara',
] as const;

export const FORM_I_PARADIGM_ID = 'kleine-familie-nasara';

const VERBFORM_ZU_PARADIGM: Readonly<Record<number, string | null>> = {
  1: FORM_I_PARADIGM_ID,
  2: 'sarf-familie-1-allama',
  3: 'sarf-familie-2-jaadala',
  4: 'sarf-familie-3-akhbara',
  5: 'sarf-familie-4-taallama',
  6: 'sarf-familie-5-tasaaala',
  7: 'sarf-familie-6-inkasara',
  8: 'sarf-familie-7-iqtaraba',
  9: null,
  10: 'sarf-familie-8-istaghfara',
};

/**
 * Liefert die Paradigmen-Tabellen-ID für eine QAC-Verbform (1–10), oder
 * `null`, wenn im Lexikon keine Sarf-Großfamilien-Referenztabelle existiert
 * (aktuell nur Form IX).
 */
export function paradigmenTabelleId(verbForm: number): string | null {
  return VERBFORM_ZU_PARADIGM[verbForm] ?? null;
}

/** Begriff-ID im Lexikon-Reiter „Grammatik & Ṣarf“ (de-verb.json: form1…form10). */
export function erklaerungBegriffId(verbForm: number): string | null {
  if (verbForm < 1 || verbForm > 10) return null;
  return `form${verbForm}`;
}

/** Ist die Zahl eine im Korpus vorkommende Verbform (I–X)? */
export function istGueltigeVerbform(verbForm: number): boolean {
  return Number.isInteger(verbForm) && verbForm >= 1 && verbForm <= 10;
}
