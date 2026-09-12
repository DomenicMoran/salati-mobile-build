// Fünf einzeln umschaltbare Farbmarkierungs-Modi für den Koran-Reader
// ([surah].tsx + mushaf.tsx): Wortart, Fragmente, Bestimmtheit, Zeitform,
// Verneinung. Immer nur EIN Modus gleichzeitig aktiv — mehrere übereinander
// gelegte Färbungen wären unlesbar (Auftrag).
//
// WORT-GRANULAR, NICHT SEGMENT-GRANULAR: jedes Wort bekommt genau EINE Farbe,
// aus dem morphologischen Stamm-Segment (bzw. bei "Fragmente" aus der
// Segment-ZUSAMMENSETZUNG) hergeleitet — es wird niemals der angezeigte
// arabische Text durch Zeichen aus der QAC-Morphologie ERSETZT. Die
// Morphologie (QAC-Korpus) und der im Reader angezeigte Text (quran.com/
// alquran.cloud) sind zwei unabhängige Textquellen mit eigener Diakritika-/
// Wasla-Normalisierung; nur die Farbe (ein reiner Stil, kein Zeicheninhalt)
// wird aus der Morphologie übernommen, der Text selbst bleibt immer der
// ORIGINAL angezeigte. Dasselbe Vorsichtsprinzip wie beim wortsynchronen
// Rezitations-Highlighting in [surah].tsx (dort wird ebenfalls nur `color`
// auf den unveränderten Text gelegt, nie der Text selbst ausgetauscht).
//
// AUSRICHTUNG ZWEIER TEXTQUELLEN: die Positions-Zuordnung (Wort Nr. N im
// angezeigten Text = MorphWord mit position===N) setzt voraus, dass beide
// Quellen dieselbe Wortanzahl für denselben Vers zählen. Das ist im
// Regelfall so, aber nicht GARANTIERT (unterschiedliche Tokenisierung von
// Waqf-Zeichen o. Ä. — vgl. Kommentar zu splitArabicWords in [surah].tsx).
// `alignedMorphWords` prüft das explizit nach und liefert bei Abweichung
// `undefined` — dann bleibt der ganze Vers ungefärbt statt möglicherweise
// falsch zugeordnet zu färben (Auftrag: "keine Farbe zeigen statt falsche").
import type { IconName } from '@/components/ui/icon-symbol';
import { GrammarColors, type GrammarColorToken } from '@/constants/theme';

import { ismEigenschaften, istVerneinung, verbEigenschaften } from '../grammatik';
import type { MorphWord } from '../morphologieTypen';
import { stammSegment, wortWortart } from './wortAnalyseModel';

export type FarbModus = 'aus' | 'wortart' | 'fragment' | 'bestimmtheit' | 'zeitform' | 'verneinung';

/** Alle Modi außer 'aus', in der Reihenfolge der Umschalt-Leiste (GrammarModeBar). */
export const FARB_MODI: readonly Exclude<FarbModus, 'aus'>[] = [
  'wortart',
  'fragment',
  'bestimmtheit',
  'zeitform',
  'verneinung',
];

export const FARB_MODUS_ICON: Record<Exclude<FarbModus, 'aus'>, IconName> = {
  wortart: 'layers-outline',
  fragment: 'git-branch-outline',
  bestimmtheit: 'checkmark-circle-outline',
  zeitform: 'time-outline',
  verneinung: 'close-circle-outline',
};

/** Übersetzungsfunktion — dieselbe Signatur wie `useTranslation().t`. */
export type Uebersetzer = (key: string) => string;

/**
 * Chip-Beschriftung je Modus — ausschließlich bereits vorhandene i18n-Schlüssel
 * (unter grammatik. bzw. quran.wortAnalyse.), keine neuen Locale-Einträge nötig.
 */
export function farbModusLabel(modus: Exclude<FarbModus, 'aus'>, t: Uebersetzer): string {
  switch (modus) {
    case 'wortart':
      return t('quran.wortAnalyse.wortartTitle');
    case 'fragment':
      return t('quran.wortAnalyse.fragmentsTitle');
    case 'bestimmtheit':
      return t('grammatik.ismEigenschaften.bestimmtheit.name');
    case 'zeitform':
      return t('grammatik.verbEigenschaften.tempus.name');
    case 'verneinung':
      return t('grammatik.fragmentrollen.verneinung.name');
  }
}

/**
 * Arabischer Fachbegriff je Modus — dieselbe "text — ar"-Darstellung (via
 * Fachbegriff-Komponente) wie überall sonst in der App, wo ein grammatischer
 * Fachbegriff genannt wird (Auftrag). `wortart`/`fragment` bekommen dafür
 * zwei neue, invariante (sprachunabhängige) Locale-Einträge unter
 * `quran.wortAnalyse.*Ar`; die übrigen drei greifen auf denselben `.ar`-Wert
 * zurück, den auch die jeweilige Legenden-Zeile (farbLegende) schon zeigt.
 */
export function farbModusAr(modus: Exclude<FarbModus, 'aus'>, t: Uebersetzer): string | undefined {
  switch (modus) {
    case 'wortart':
      return t('quran.wortAnalyse.wortartAr');
    case 'fragment':
      return t('quran.wortAnalyse.fragmentsAr');
    case 'bestimmtheit':
      return t('grammatik.ismEigenschaften.bestimmtheit.ar');
    case 'zeitform':
      return t('grammatik.verbEigenschaften.tempus.ar');
    case 'verneinung':
      return t('grammatik.fragmentrollen.verneinung.ar');
  }
}

/**
 * Farb-Schlüssel für ein GANZES Wort unter dem aktiven Modus, oder `null`,
 * wenn der Modus für dieses Wort nicht zutrifft (z. B. Zeitform-Modus auf
 * einem Ism) — dann bleibt das Wort in der normalen Textfarbe, statt eine
 * falsche Farbe zu raten.
 */
export function wortFarbSchluessel(modus: FarbModus, word: MorphWord): string | null {
  switch (modus) {
    case 'aus':
      return null;
    case 'wortart':
      return wortWortart(word);
    case 'fragment': {
      const hatPraefix = word.segments.some((s) => s.kind === 'prefix');
      const hatSuffix = word.segments.some((s) => s.kind === 'suffix');
      if (hatPraefix && hatSuffix) return 'beide';
      if (hatPraefix) return 'prefix';
      if (hatSuffix) return 'suffix';
      return null; // reiner Stamm ohne Affix: keine Farbe, bleibt der visuelle Anker
    }
    case 'bestimmtheit': {
      if (wortWortart(word) !== 'ism') return null;
      return ismEigenschaften(stammSegment(word)).bestimmtheit?.wert ?? null;
    }
    case 'zeitform': {
      if (wortWortart(word) !== 'fiil') return null;
      return verbEigenschaften(stammSegment(word)).tempus?.wert ?? null;
    }
    case 'verneinung':
      return istVerneinung(word) ? 'verneint' : null;
  }
}

const FARB_TOKEN: Record<Exclude<FarbModus, 'aus'>, Record<string, GrammarColorToken>> = {
  wortart: { ism: 'wortartIsm', fiil: 'wortartFiil', harf: 'wortartHarf' },
  fragment: { prefix: 'fragmentPrefix', suffix: 'fragmentSuffix', beide: 'fragmentBeide' },
  bestimmtheit: { definite: 'bestimmtheitDefinite', indefinite: 'bestimmtheitIndefinite' },
  zeitform: { perfect: 'zeitformPerfect', imperfect: 'zeitformImperfect', imperative: 'zeitformImperative' },
  verneinung: { verneint: 'verneinung' },
};

/** Fertige Hex-Farbe für ein Wort unter dem aktiven Modus/Farbschema, oder
 * `undefined` (= normale Textfarbe behalten) wenn der Modus aus ist oder
 * nicht zutrifft. */
export function wortFarbe(scheme: 'light' | 'dark', modus: FarbModus, word: MorphWord): string | undefined {
  if (modus === 'aus') return undefined;
  const schluessel = wortFarbSchluessel(modus, word);
  if (!schluessel) return undefined;
  const token = FARB_TOKEN[modus][schluessel];
  return token ? GrammarColors[scheme][token] : undefined;
}

/**
 * Morphologie-Wörter eines Verses, aber NUR, wenn ihre Anzahl exakt zur
 * Wortzahl des angezeigten Textes passt — sonst `undefined` (siehe
 * Kopf-Kommentar "AUSRICHTUNG ZWEIER TEXTQUELLEN").
 */
export function alignedMorphWords(
  words: MorphWord[] | undefined,
  erwarteteAnzahl: number,
): MorphWord[] | undefined {
  return words && words.length === erwarteteAnzahl ? words : undefined;
}

export interface FarbLegendeEintrag {
  color: string;
  label: string;
  ar?: string;
}

/** Legende (Farbe + Fachbegriff + arabischer Terminus) für den aktiven Modus. */
export function farbLegende(
  scheme: 'light' | 'dark',
  modus: Exclude<FarbModus, 'aus'>,
  t: Uebersetzer,
): FarbLegendeEintrag[] {
  const c = GrammarColors[scheme];
  switch (modus) {
    case 'wortart':
      return [
        { color: c.wortartIsm, label: t('grammatik.wortarten.ism.name'), ar: t('grammatik.wortarten.ism.ar') },
        { color: c.wortartFiil, label: t('grammatik.wortarten.fiil.name'), ar: t('grammatik.wortarten.fiil.ar') },
        { color: c.wortartHarf, label: t('grammatik.wortarten.harf.name'), ar: t('grammatik.wortarten.harf.ar') },
      ];
    case 'fragment':
      return [
        { color: c.fragmentPrefix, label: t('quran.wortAnalyse.segmentKind.prefix') },
        { color: c.fragmentSuffix, label: t('quran.wortAnalyse.segmentKind.suffix') },
        {
          color: c.fragmentBeide,
          label: `${t('quran.wortAnalyse.segmentKind.prefix')} + ${t('quran.wortAnalyse.segmentKind.suffix')}`,
        },
      ];
    case 'bestimmtheit':
      return [
        {
          color: c.bestimmtheitDefinite,
          label: t('grammatik.ismEigenschaften.bestimmtheit.werte.definite.name'),
          ar: t('grammatik.ismEigenschaften.bestimmtheit.werte.definite.ar'),
        },
        {
          color: c.bestimmtheitIndefinite,
          label: t('grammatik.ismEigenschaften.bestimmtheit.werte.indefinite.name'),
          ar: t('grammatik.ismEigenschaften.bestimmtheit.werte.indefinite.ar'),
        },
      ];
    case 'zeitform':
      return [
        {
          color: c.zeitformPerfect,
          label: t('grammatik.verbEigenschaften.tempus.werte.perfect.name'),
          ar: t('grammatik.verbEigenschaften.tempus.werte.perfect.ar'),
        },
        {
          color: c.zeitformImperfect,
          label: t('grammatik.verbEigenschaften.tempus.werte.imperfect.name'),
          ar: t('grammatik.verbEigenschaften.tempus.werte.imperfect.ar'),
        },
        {
          color: c.zeitformImperative,
          label: t('grammatik.verbEigenschaften.tempus.werte.imperative.name'),
          ar: t('grammatik.verbEigenschaften.tempus.werte.imperative.ar'),
        },
      ];
    case 'verneinung':
      return [
        {
          color: c.verneinung,
          label: t('grammatik.fragmentrollen.verneinung.name'),
          ar: t('grammatik.fragmentrollen.verneinung.ar'),
        },
      ];
  }
}
