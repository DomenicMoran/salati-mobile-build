/**
 * Grammatik-Farbmarkierung im Koran-Reader (features/quran/analyse/
 * grammarColorModes.ts) — fünf einzeln umschaltbare Modi (Wortart/Fragmente/
 * Bestimmtheit/Zeitform/Verneinung), Standardzustand 'aus', sowie der
 * Wort-Tap in [surah].tsx/mushaf.tsx, der IMMER das eine, zusammengeführte
 * WortAnalyseSheet öffnet (frühere Verzweigung zwischen einem schlanken
 * WordInfoSheet und dem tiefen WortAnalyseSheet hinter einem
 * `showWordAnalysis`-Umschalter ist entfallen, 2026-09).
 *
 * Reine Logik-Tests (kein Rendering nötig) für die Farb-/Modus-Zuordnung,
 * plus ein kleiner Render-Test für den Wort-Tap — gleiches
 * Fixture-/Wrapper-Muster wie wort-analyse-sheet.test.tsx.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import { GrammarColors } from '@/constants/theme';
import {
  alignedMorphWords,
  wortFarbe,
  wortFarbSchluessel,
} from '@/features/quran/analyse/grammarColorModes';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';
import type { MorphFeatures, MorphSegment, MorphWord } from '@/features/quran/morphologieTypen';
import { WortAnalyseSheet, type WordInfoWord } from '@/features/quran/WortAnalyseSheet';

const t = (key: string) => translate('de', key);

// ---------- Fixtures (gleiches Muster wie grammatik.test.ts) ----------

const LEERE_FEATURES: MorphFeatures = {
  person: null,
  gender: null,
  number: null,
  case: null,
  state: null,
  mood: null,
  tense: null,
  voice: null,
  verbForm: null,
  derivation: null,
};

interface SegmentOverrides extends Omit<Partial<MorphSegment>, 'features'> {
  features?: Partial<MorphFeatures>;
}

function segment(overrides: SegmentOverrides = {}): MorphSegment {
  return {
    text: overrides.text ?? 'ك',
    kind: overrides.kind ?? 'stem',
    pos: overrides.pos ?? 'N',
    features: { ...LEERE_FEATURES, ...(overrides.features ?? {}) },
    derived: overrides.derived ?? [],
    raw: overrides.raw ?? overrides.pos ?? 'N',
  };
}

function wort(overrides: Partial<MorphWord> = {}): MorphWord {
  return {
    position: overrides.position ?? 1,
    text: overrides.text ?? 'كلمة',
    root: overrides.root ?? null,
    lemma: overrides.lemma ?? 'كلمة',
    segments: overrides.segments ?? [segment()],
    syntax: overrides.syntax,
  };
}

// Ein Ism-Wort ("das Buch"): Artikel-Präfix (DET) + bestimmter Nomen-Stamm.
const ISM_DEFINITE = wort({
  segments: [
    segment({ text: 'ال', kind: 'prefix', pos: 'DET' }),
    segment({ text: 'كتاب', kind: 'stem', pos: 'N', features: { state: 'definite' } }),
  ],
});

// Ein unbestimmtes Ism ohne Artikel.
const ISM_INDEFINITE = wort({
  segments: [segment({ text: 'كتاب', kind: 'stem', pos: 'N', features: { state: 'indefinite' } })],
});

// Ein Fiʿl im Perfekt mit angehängtem Pronomen-Suffix ("er schrieb es").
const FIIL_PERFECT_MIT_SUFFIX = wort({
  segments: [
    segment({ text: 'كتب', kind: 'stem', pos: 'V', features: { tense: 'perfect' } }),
    segment({ text: 'ه', kind: 'suffix', pos: 'PRON' }),
  ],
});

const FIIL_IMPERFECT = wort({
  segments: [segment({ text: 'يكتب', kind: 'stem', pos: 'V', features: { tense: 'imperfect' } })],
});

const FIIL_IMPERATIVE = wort({
  segments: [segment({ text: 'اكتب', kind: 'stem', pos: 'V', features: { tense: 'imperative' } })],
});

// Ein Harf (Konjunktion) — trägt weder Bestimmtheit noch Zeitform.
const HARF_KONJUNKTION = wort({
  segments: [segment({ text: 'و', kind: 'stem', pos: 'CONJ' })],
});

// Verneintes Verb: NEG-Präfixpartikel + Verb-Stamm ("er schrieb nicht").
const VERNEINTES_FIIL = wort({
  segments: [
    segment({ text: 'لم', kind: 'prefix', pos: 'NEG' }),
    segment({ text: 'يكتب', kind: 'stem', pos: 'V', features: { tense: 'imperfect' } }),
  ],
});

// Wort mit Präfix UND Suffix ("und er schrieb es") — beide Fragment-Rollen
// gleichzeitig auf demselben Wort.
const WORT_MIT_PRAEFIX_UND_SUFFIX = wort({
  segments: [
    segment({ text: 'و', kind: 'prefix', pos: 'CONJ' }),
    segment({ text: 'كتب', kind: 'stem', pos: 'V', features: { tense: 'perfect' } }),
    segment({ text: 'ه', kind: 'suffix', pos: 'PRON' }),
  ],
});

// ---------- 1. Je Farbmodus: richtige Gruppe wird zugeordnet ----------

describe('wortFarbSchluessel — je Modus die richtige Gruppe', () => {
  it('Wortart: ordnet Ism/Fiʿl/Harf korrekt zu, unabhängig von Unterkategorie', () => {
    expect(wortFarbSchluessel('wortart', ISM_DEFINITE)).toBe('ism');
    expect(wortFarbSchluessel('wortart', FIIL_PERFECT_MIT_SUFFIX)).toBe('fiil');
    expect(wortFarbSchluessel('wortart', HARF_KONJUNKTION)).toBe('harf');
  });

  it('Fragmente: erkennt Präfix, Suffix und beide zugleich; reiner Stamm bleibt ungefärbt', () => {
    expect(wortFarbSchluessel('fragment', ISM_DEFINITE)).toBe('prefix'); // Artikel-Präfix, kein Suffix
    expect(wortFarbSchluessel('fragment', FIIL_PERFECT_MIT_SUFFIX)).toBe('suffix'); // Pronomen-Suffix, kein Präfix
    expect(wortFarbSchluessel('fragment', WORT_MIT_PRAEFIX_UND_SUFFIX)).toBe('beide');
    expect(wortFarbSchluessel('fragment', ISM_INDEFINITE)).toBeNull(); // reiner Stamm, kein Affix
  });

  it('Bestimmtheit: bestimmt/unbestimmt nur bei Ism, sonst null (kein Raten)', () => {
    expect(wortFarbSchluessel('bestimmtheit', ISM_DEFINITE)).toBe('definite');
    expect(wortFarbSchluessel('bestimmtheit', ISM_INDEFINITE)).toBe('indefinite');
    expect(wortFarbSchluessel('bestimmtheit', FIIL_PERFECT_MIT_SUFFIX)).toBeNull();
    expect(wortFarbSchluessel('bestimmtheit', HARF_KONJUNKTION)).toBeNull();
  });

  it('Zeitform: Vergangenheit/Gegenwart/Befehl nur bei Fiʿl, sonst null', () => {
    expect(wortFarbSchluessel('zeitform', FIIL_PERFECT_MIT_SUFFIX)).toBe('perfect');
    expect(wortFarbSchluessel('zeitform', FIIL_IMPERFECT)).toBe('imperfect');
    expect(wortFarbSchluessel('zeitform', FIIL_IMPERATIVE)).toBe('imperative');
    expect(wortFarbSchluessel('zeitform', ISM_DEFINITE)).toBeNull();
  });

  it('Verneinung: hebt nur Wörter mit NEG-Segment hervor', () => {
    expect(wortFarbSchluessel('verneinung', VERNEINTES_FIIL)).toBe('verneint');
    expect(wortFarbSchluessel('verneinung', FIIL_IMPERFECT)).toBeNull();
    expect(wortFarbSchluessel('verneinung', ISM_DEFINITE)).toBeNull();
  });
});

describe('wortFarbe — liefert die dokumentierten Theme-Farben', () => {
  it.each(['light', 'dark'] as const)('%s: löst jeden Modus-Schlüssel auf eine konkrete Hex-Farbe auf', (scheme) => {
    expect(wortFarbe(scheme, 'wortart', ISM_DEFINITE)).toBe(GrammarColors[scheme].wortartIsm);
    expect(wortFarbe(scheme, 'wortart', FIIL_PERFECT_MIT_SUFFIX)).toBe(GrammarColors[scheme].wortartFiil);
    expect(wortFarbe(scheme, 'wortart', HARF_KONJUNKTION)).toBe(GrammarColors[scheme].wortartHarf);
    expect(wortFarbe(scheme, 'fragment', WORT_MIT_PRAEFIX_UND_SUFFIX)).toBe(GrammarColors[scheme].fragmentBeide);
    expect(wortFarbe(scheme, 'bestimmtheit', ISM_INDEFINITE)).toBe(GrammarColors[scheme].bestimmtheitIndefinite);
    expect(wortFarbe(scheme, 'zeitform', FIIL_IMPERATIVE)).toBe(GrammarColors[scheme].zeitformImperative);
    expect(wortFarbe(scheme, 'verneinung', VERNEINTES_FIIL)).toBe(GrammarColors[scheme].verneinung);
  });
});

// ---------- 2. Standardzustand 'aus': nichts wird eingefärbt ----------

describe('Standardzustand (Modus "aus")', () => {
  it('färbt kein einziges Wort ein, unabhängig von Wortart/Bestimmtheit/Zeitform/Verneinung', () => {
    const alleTestwoerter = [
      ISM_DEFINITE,
      ISM_INDEFINITE,
      FIIL_PERFECT_MIT_SUFFIX,
      FIIL_IMPERFECT,
      FIIL_IMPERATIVE,
      HARF_KONJUNKTION,
      VERNEINTES_FIIL,
      WORT_MIT_PRAEFIX_UND_SUFFIX,
    ];
    for (const w of alleTestwoerter) {
      expect(wortFarbSchluessel('aus', w)).toBeNull();
      expect(wortFarbe('light', 'aus', w)).toBeUndefined();
      expect(wortFarbe('dark', 'aus', w)).toBeUndefined();
    }
  });

  it('jeder Modus liefert für mindestens ein Testwort tatsächlich eine Farbe (Gegenprobe: "aus" ist wirklich der besondere Fall)', () => {
    // Verhindert, dass der obige Test nur deshalb "nichts gefärbt" zeigt, weil
    // die Testwörter ohnehin nie eine Farbe bekämen.
    expect(wortFarbe('light', 'wortart', ISM_DEFINITE)).toBeDefined();
    expect(wortFarbe('light', 'fragment', FIIL_PERFECT_MIT_SUFFIX)).toBeDefined();
    expect(wortFarbe('light', 'bestimmtheit', ISM_DEFINITE)).toBeDefined();
    expect(wortFarbe('light', 'zeitform', FIIL_PERFECT_MIT_SUFFIX)).toBeDefined();
    expect(wortFarbe('light', 'verneinung', VERNEINTES_FIIL)).toBeDefined();
  });
});

// ---------- alignedMorphWords: Textquellen-Ausrichtung ----------

describe('alignedMorphWords', () => {
  it('liefert die Wörter nur bei exakt passender Wortanzahl, sonst undefined', () => {
    const words = [ISM_DEFINITE, FIIL_PERFECT_MIT_SUFFIX];
    expect(alignedMorphWords(words, 2)).toBe(words);
    expect(alignedMorphWords(words, 3)).toBeUndefined();
    expect(alignedMorphWords(undefined, 2)).toBeUndefined();
  });
});

// ---------- 3. Wort-Tap öffnet das Analyse-Sheet ----------

jest.mock('@/features/quran/morphologieHooks', () => ({
  useVerseMorphologie: jest.fn(() => ({ verse: undefined, isLoading: false, isError: false })),
}));

jest.mock('@/features/quran/morphologie', () => ({
  ladeWurzeln: jest.fn(async () => ({})),
}));

const LEXIK_WORT: WordInfoWord = {
  arabic: 'كِتَابٌ',
  translation: 'ein Buch',
  transliteration: 'kitabun',
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SettingsProvider>
  );
}

/**
 * Bildet den Wort-Tap aus [surah].tsx/mushaf.tsx nach: ein Tap setzt
 * `selected` und öffnet IMMER dasselbe, zusammengeführte WortAnalyseSheet —
 * kein Umschalter zwischen zwei Sheets mehr.
 */
function WortTapHarness() {
  const [selected, setSelected] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setSelected(true)}>
        <Text>Wort antippen</Text>
      </Pressable>
      <WortAnalyseSheet
        visible={selected}
        surah={2}
        ayah={255}
        position={1}
        word={LEXIK_WORT}
        onWurzelOeffnen={jest.fn()}
        onLexikonOeffnen={jest.fn()}
        onVerbTypOeffnen={jest.fn()}
        onClose={() => setSelected(false)}
      />
    </>
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }));
});

afterEach(() => {
  queryClient.clear();
});

describe('Wort-Tap öffnet immer das eine, zusammengeführte Sheet', () => {
  it('der Tap öffnet das WortAnalyseSheet, kein Schalter zwischen zwei Sheets mehr nötig', async () => {
    await render(<WortTapHarness />, { wrapper: Wrapper });

    // Vor dem Tap ist das Sheet nicht sichtbar.
    expect(screen.queryByText(t('quran.wortAnalyse.title'))).toBeNull();

    fireEvent.press(screen.getByText('Wort antippen'));

    // Das Sheet ist offen (eigener Titel + Fundstelle mit Sure/Vers/Position).
    expect(await screen.findByText(t('quran.wortAnalyse.title'))).toBeTruthy();
    expect(
      screen.getByText(
        t('quran.wortAnalyse.fundstelle').replace('{surah}', '2').replace('{ayah}', '255').replace('{position}', '1'),
      ),
    ).toBeTruthy();
  }, 15000);
});
