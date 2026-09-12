/**
 * WortAnalyseSheet — vollständige Fragment-für-Fragment-Wortanalyse im
 * Koran-Reader (Wurzel/Grundform, Fragment-Aufschlüsselung, Wortart mit
 * Beleg-/Herleitungs-Kennzeichnung, Verneinung, Satzrolle/Iʿrab).
 *
 * Getestet wird gegen echte Ausschnitte der Morphologie-Pipeline
 * (__fixtures__/morphologie-*.json, wie in grammatik.realdaten.test.ts) wo
 * sinnvoll, sowie gegen handgebaute Fixtures für Fälle, die in den kleinen
 * Fixture-Ausschnitten nicht vorkommen (hergeleitete Bestimmtheit, fehlende
 * Syntaxdaten, ein Wort mit eingebetteter Verneinung).
 *
 * useVerseMorphologie/ladeWurzeln werden gemockt: dieser Test prüft die
 * Anzeige-Logik des Sheets, nicht Netzwerk-/Cache-Verhalten (das deckt
 * morphologie.test.ts bereits ab).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps, ReactNode } from 'react';

import sure1Fixture from '@/features/quran/__fixtures__/morphologie-1.json';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';
import type {
  MorphFeatures,
  MorphologieDatei,
  MorphSegment,
  MorphWord,
} from '@/features/quran/morphologieTypen';
import { WortAnalyseSheet, type WordInfoWord } from '@/features/quran/WortAnalyseSheet';

const sure1 = sure1Fixture as unknown as MorphologieDatei;

const t = (key: string) => translate('de', key);

// ---------- Mocks: Morphologie-Hook + Wurzel-Konkordanz ----------

let mockVerse: MorphWord[] | undefined;
let mockMorphState: { isLoading: boolean; isError: boolean } = { isLoading: false, isError: false };
let mockWurzeln: Record<string, { count: number; lemmas: string[]; occurrences: unknown[] }> = {};

jest.mock('@/features/quran/morphologieHooks', () => ({
  useVerseMorphologie: jest.fn(() => ({ verse: mockVerse, ...mockMorphState })),
}));

jest.mock('@/features/quran/morphologie', () => ({
  ladeWurzeln: jest.fn(async () => mockWurzeln),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SettingsProvider>
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }),
  );
  mockVerse = undefined;
  mockMorphState = { isLoading: false, isError: false };
  mockWurzeln = {};
});

afterEach(() => {
  queryClient.clear();
});

// ---------- Eigene Fixture-Bauhilfen (wie in grammatik.test.ts) ----------

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

const LEXIK_WORT: WordInfoWord = {
  arabic: 'وَيُقِيمُونَ',
  translation: 'and they establish',
  transliteration: 'wa yuqimuna',
};

function baseProps(overrides: Partial<ComponentProps<typeof WortAnalyseSheet>> = {}) {
  return {
    visible: true,
    onClose: jest.fn(),
    surah: 2,
    ayah: 3,
    position: 4,
    word: LEXIK_WORT,
    onWurzelOeffnen: jest.fn(),
    onLexikonOeffnen: jest.fn(),
    onVerbTypOeffnen: jest.fn(),
    ...overrides,
  };
}

describe('WortAnalyseSheet', () => {
  it('zerlegt وَيُقِيمُونَ (2:3:4-Struktur, angelehnt an die echte Fixture) in Präfix + Stamm + Suffix und zeigt die Wurzel-Häufigkeit', async () => {
    const sure2Word = {
      position: 4,
      text: 'وَيُقِيمُونَ',
      root: 'قوم',
      lemma: 'أَقَامَ',
      segments: [
        segment({ text: 'وَ', kind: 'prefix', pos: 'CONJ', raw: 'PREFIX|w:CONJ+' }),
        segment({
          text: 'يُقِيمُ',
          kind: 'stem',
          pos: 'V',
          features: { person: '3', gender: 'm', number: 'pl', tense: 'imperfect', verbForm: 4 },
          raw: 'STEM|POS:V|IMPF|(IV)|LEM:>aqaAma|ROOT:qwm|3MP',
        }),
        segment({
          text: 'ونَ',
          kind: 'suffix',
          pos: 'PRON',
          features: { person: '3', gender: 'm', number: 'pl' },
          raw: 'SUFFIX|PRON:3MP',
        }),
      ],
      syntax: { relation: 'conj', relationAr: 'معطوف', head: 2 },
    } satisfies MorphWord;
    mockVerse = [sure2Word];
    // Direkt in den Query-Cache statt über den `ladeWurzeln`-Mock: vermeidet
    // eine Renn-/Timing-Abhängigkeit vom asynchronen Erst-Fetch beim Rendern
    // (das react-query-Timing selbst prüft morphologie.test.ts bereits) — hier
    // interessiert nur, dass eine BEREITS bekannte Häufigkeit korrekt angezeigt wird.
    queryClient.setQueryData(['quran', 'wurzeln'], { قوم: { count: 41, lemmas: ['أَقَامَ'], occurrences: [] } });

    await render(<WortAnalyseSheet {...baseProps()} />, { wrapper: Wrapper });

    // Drei Fragmente in Lesereihenfolge, jedes mit eigenem Kind-Label.
    expect(screen.getByText(t('quran.wortAnalyse.segmentKind.prefix'))).toBeTruthy();
    expect(screen.getByText(t('quran.wortAnalyse.segmentKind.stem'))).toBeTruthy();
    expect(screen.getByText(t('quran.wortAnalyse.segmentKind.suffix'))).toBeTruthy();

    // Rollen: Konjunktion (Präfix), Wortstamm, Angehängtes Pronomen (Suffix).
    expect(
      screen.getByText(`${t('grammatik.fragmentrollen.konjunktion.name')} — ${t('grammatik.fragmentrollen.konjunktion.ar')}`),
    ).toBeTruthy();
    expect(
      screen.getByText(`${t('grammatik.fragmentrollen.stamm.name')} — ${t('grammatik.fragmentrollen.stamm.ar')}`),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `${t('grammatik.fragmentrollen.pronomenSuffix.name')} — ${t('grammatik.fragmentrollen.pronomenSuffix.ar')}`,
      ),
    ).toBeTruthy();

    // Wurzel klickbar + Häufigkeit (aus dem vorbefüllten Query-Cache).
    expect(screen.getByText('قوم')).toBeTruthy();
    expect(screen.getByText(t('quran.wortAnalyse.rootFrequency').replace('{count}', '41'))).toBeTruthy();

    // Wortart-Karte: Fiʿl, Tempus Gegenwart, Verbform IV, Genus männlich, Numerus Plural.
    expect(
      screen.getByText(`${t('grammatik.wortarten.fiil.name')} — ${t('grammatik.wortarten.fiil.ar')}`),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `${t('grammatik.verbEigenschaften.tempus.werte.imperfect.name')} — ${t('grammatik.verbEigenschaften.tempus.werte.imperfect.ar')}`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `${t('grammatik.verbEigenschaften.verbform.formen.4.name')} — ${t('grammatik.verbEigenschaften.verbform.formen.4.ar')}`,
      ),
    ).toBeTruthy();
  }, 15000);

  it('kennzeichnet eine hergeleitete Bestimmtheit sichtbar als Herleitung, nicht als Befund', async () => {
    mockVerse = [
      wort({
        position: 5,
        text: 'كِتَابًا',
        root: 'كتب',
        lemma: 'كِتَاب',
        segments: [
          segment({
            text: 'كِتَابًا',
            kind: 'stem',
            pos: 'N',
            features: { state: 'indefinite', gender: 'm', number: 'sg' },
            derived: ['state'],
          }),
        ],
        syntax: { relation: 'Obj', relationAr: 'مفعول به', head: 2 },
      }),
    ];

    await render(<WortAnalyseSheet {...baseProps({ position: 5, word: { arabic: 'كِتَابًا', translation: 'a book', transliteration: 'kitaban' } })} />, {
      wrapper: Wrapper,
    });

    // Bestimmtheit ist HERGELEITET (state in `derived`) → eigenes Label, klar
    // von "beleg" unterschieden.
    expect(screen.getByText(t('grammatik.herkunft.hergeleitet.label'))).toBeTruthy();
    // Genus UND Numerus sind dagegen Belege (nicht in `derived`) — beide zeigen
    // dasselbe Label, daher getAllByText statt getByText.
    expect(screen.getAllByText(t('grammatik.herkunft.beleg.label')).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        `${t('grammatik.ismEigenschaften.bestimmtheit.werte.indefinite.name')} — ${t('grammatik.ismEigenschaften.bestimmtheit.werte.indefinite.ar')}`,
      ),
    ).toBeTruthy();
  });

  it('hebt eine Verneinung hervor und benennt das tragende Fragment', async () => {
    mockVerse = [
      wort({
        position: 6,
        text: 'لَا يَخَافُ',
        root: 'خوف',
        lemma: 'خَافَ',
        segments: [
          segment({ text: 'لَا', kind: 'prefix', pos: 'NEG' }),
          segment({
            text: 'يَخَافُ',
            kind: 'stem',
            pos: 'V',
            features: { tense: 'imperfect', mood: 'ind', person: '3', gender: 'm', number: 'sg' },
          }),
        ],
        // MorphSyntax.head ist als `number` typisiert, kommt in echten Fixtures
        // (z. B. 1:3:1 in morphologie-1.json) aber tatsächlich als `null` vor —
        // der Cast spiegelt genau diesen belegten Fall.
        syntax: { relation: 'root', relationAr: 'جذر', head: null as unknown as number },
      }),
    ];

    await render(
      <WortAnalyseSheet
        {...baseProps({ position: 6, word: { arabic: 'لَا يَخَافُ', translation: 'he does not fear', transliteration: 'la yakhafu' } })}
      />,
      { wrapper: Wrapper },
    );

    // Erscheint zweimal: einmal in der Fragment-Aufschlüsselung (Rolle des
    // NEG-Segments), einmal in der eigens hervorgehobenen Verneinungs-Box.
    expect(
      screen.getAllByText(`${t('grammatik.fragmentrollen.verneinung.name')} — ${t('grammatik.fragmentrollen.verneinung.ar')}`)
        .length,
    ).toBe(2);
    // Satzrolle startet zugeklappt (Übersicht zuerst) — erst öffnen.
    fireEvent.press(screen.getByLabelText(t('quran.wortAnalyse.satzrolleTitle')));
    // Kein Bezugswort, weil head === null — ehrlich benannt, nicht konstruiert.
    expect(await screen.findByText(t('quran.wortAnalyse.satzrolleHeadNone'))).toBeTruthy();
  });

  it('benennt bei einer badal-Relation (App, echte Fixture 1:2:3) das Bezugswort', async () => {
    mockVerse = sure1.verses['2']; // ٱلْحَمْدُ, لِلَّهِ, رَبِّ (App→2), ٱلْعَٰلَمِينَ
    const headWort = sure1.verses['2'].find((w) => w.position === 2)!;

    await render(
      <WortAnalyseSheet
        {...baseProps({
          surah: 1,
          ayah: 2,
          position: 3,
          word: { arabic: 'رَبِّ', translation: 'Lord', transliteration: 'rabbi' },
        })}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.press(screen.getByLabelText(t('quran.wortAnalyse.satzrolleTitle')));
    expect(
      await screen.findByText(`${t('grammatik.relationen.App.name')} — ${t('grammatik.relationen.App.ar')}`),
    ).toBeTruthy();
    expect(
      screen.getByText(t('quran.wortAnalyse.satzrolleHeadLabel').replace('{wort}', headWort.text)),
    ).toBeTruthy();
  });

  it('sagt ehrlich, dass keine Syntaxdaten hinterlegt sind, statt eine Relation zu konstruieren', async () => {
    mockVerse = [wort({ position: 7, syntax: undefined })];

    await render(
      <WortAnalyseSheet
        {...baseProps({ position: 7, word: { arabic: 'كلمة', translation: 'word', transliteration: 'kalima' } })}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.press(screen.getByLabelText(t('quran.wortAnalyse.satzrolleTitle')));
    expect(await screen.findByText(t('quran.wortAnalyse.satzrolleNoData'))).toBeTruthy();
    expect(screen.queryByText(t('quran.wortAnalyse.satzrolleHeadNone'))).toBeNull();
  });

  // Auflage des Auftraggebers: Arabische Fachbegriffe laufen ÜBERALL mit, wo
  // ein grammatischer Fachbegriff genannt wird — nicht nur an ausgewählten
  // Stellen. Dieser Test deckt in EINEM Wort alle Kategorien ab, die einen
  // `ar`-Wert in den Locale-Daten tragen: Wortart, alle vier Ism-Eigenschaften
  // samt ihrer Werte, eine POS-Tag-Rückfallrolle (REM hat keinen eigenen
  // fragmentrollen-Eintrag) und eine syntaktische Relation. Fällt später ein
  // Merkmal ohne arabischen Begriff durchs Raster, schlägt genau diese Prüfung an.
  it('zeigt zu jedem angezeigten Grammatikmerkmal auch den arabischen Fachbegriff', async () => {
    mockVerse = [
      wort({
        position: 8,
        text: 'وَالْكَبِيرَةُ',
        root: 'كبر',
        lemma: 'كَبِير',
        segments: [
          // REM hat KEINEN eigenen Eintrag unter grammatik.fragmentrollen →
          // fragmentAnzeige() fällt auf grammatik.posTags.REM zurück.
          segment({ text: 'وَ', kind: 'prefix', pos: 'REM', raw: 'REM' }),
          segment({
            text: 'الْكَبِيرَةُ',
            kind: 'stem',
            pos: 'N',
            features: { gender: 'f', number: 'sg', state: 'definite', case: 'nom' },
          }),
        ],
        syntax: { relation: 'Adj', relationAr: 'صفة', head: 9 },
      }),
    ];

    await render(
      <WortAnalyseSheet
        {...baseProps({
          position: 8,
          word: { arabic: 'وَالْكَبِيرَةُ', translation: 'and the great one', transliteration: 'wal-kabiratu' },
        })}
      />,
      { wrapper: Wrapper },
    );

    // Findet den arabischen Begriff irgendwo im gerenderten Baum — die genaue
    // Position (eigene Zeile vs. gedämpfter Anhang) ist hier nicht der Punkt,
    // nur dass er ÜBERHAUPT sichtbar ist.
    function erwarteArabischenBegriff(ar: string) {
      expect(screen.getAllByText(ar, { exact: false }).length).toBeGreaterThan(0);
    }

    // Wortart.
    erwarteArabischenBegriff(t('grammatik.wortarten.ism.ar'));
    // Alle vier Ism-Eigenschaften samt Werten.
    erwarteArabischenBegriff(t('grammatik.ismEigenschaften.genus.ar'));
    erwarteArabischenBegriff(t('grammatik.ismEigenschaften.genus.werte.f.ar'));
    erwarteArabischenBegriff(t('grammatik.ismEigenschaften.numerus.ar'));
    erwarteArabischenBegriff(t('grammatik.ismEigenschaften.numerus.werte.sg.ar'));
    erwarteArabischenBegriff(t('grammatik.ismEigenschaften.bestimmtheit.ar'));
    erwarteArabischenBegriff(t('grammatik.ismEigenschaften.bestimmtheit.werte.definite.ar'));
    erwarteArabischenBegriff(t('grammatik.ismEigenschaften.kasus.ar'));
    erwarteArabischenBegriff(t('grammatik.ismEigenschaften.kasus.werte.nom.ar'));
    // Fragmentrolle des Stamms (eigener Eintrag) …
    erwarteArabischenBegriff(t('grammatik.fragmentrollen.stamm.ar'));
    // … und die POS-Tag-Rückfallrolle für REM (kein eigener fragmentrollen-Eintrag).
    erwarteArabischenBegriff(t('grammatik.posTags.REM.ar'));
    // Syntaktische Relation — steckt in der standardmäßig zugeklappten
    // Satzrolle-Sektion, daher erst öffnen.
    fireEvent.press(screen.getByLabelText(t('quran.wortAnalyse.satzrolleTitle')));
    await screen.findByText(`${t('grammatik.relationen.Adj.name')} — ${t('grammatik.relationen.Adj.ar')}`);
    erwarteArabischenBegriff(t('grammatik.relationen.Adj.ar'));
  });

  // Zusammenführung von WordInfoSheet (schlank) und WortAnalyseSheet (tief) zu
  // EINEM Sheet (2026-09): die Einzelbuchstaben-Aufschlüsselung des früheren
  // WordInfoSheet darf dabei nicht verlorengehen.
  it('schlüsselt das Wort in der Buchstaben-Sektion in Einzelbuchstaben auf', async () => {
    await render(
      <WortAnalyseSheet
        {...baseProps({ word: { arabic: 'كِتَابٌ', translation: 'a book', transliteration: 'kitabun' } })}
      />,
      { wrapper: Wrapper },
    );

    // Buchstaben-Sektion startet zugeklappt (Tiefe), erst öffnen.
    fireEvent.press(screen.getByLabelText(t('quran.wordInfo.lettersLabel')));
    // كِتَابٌ zerlegt sich in Kāf, Tā', Alif, Bā' (Diakritika zählen nicht als
    // eigener Buchstabe).
    expect((await screen.findAllByText('Kāf')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alif').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bā’').length).toBeGreaterThan(0);
  });

  // Graceful degradation: offline oder Sure noch nicht geladen — die
  // Morphologie-Abfrage schlägt fehl, das Sheet darf trotzdem nicht leer
  // wirken. Bedeutung, Umschrift und Buchstaben bleiben verfügbar (sie
  // brauchen keine Morphologiedaten), und für den Grammatikteil steht ein
  // ehrlicher Hinweis statt eines stillen Fehlers oder leeren Abschnitts.
  it('zeigt Bedeutung, Umschrift und Buchstaben auch ohne Morphologiedaten und weist ehrlich auf die fehlenden Grammatikdaten hin', async () => {
    mockVerse = undefined;
    mockMorphState = { isLoading: false, isError: true };

    await render(
      <WortAnalyseSheet
        {...baseProps({ word: { arabic: 'كِتَابٌ', translation: 'a book', transliteration: 'kitabun' } })}
      />,
      { wrapper: Wrapper },
    );

    // Kernaussage bleibt sichtbar.
    expect(screen.getByText('a book')).toBeTruthy();
    expect(screen.getByText('kitabun')).toBeTruthy();
    // Buchstaben-Sektion ist weiterhin da (braucht keine Morphologie).
    fireEvent.press(screen.getByLabelText(t('quran.wordInfo.lettersLabel')));
    expect((await screen.findAllByText('Kāf')).length).toBeGreaterThan(0);
    // Ehrlicher Hinweis statt leerem/fehlendem Grammatikteil.
    expect(screen.getByText(t('quran.wortAnalyse.morphologyNoData'))).toBeTruthy();
    // Kein Fragmente-Abschnitt, wenn keine Morphologiedaten vorliegen — das
    // Sheet erfindet nichts.
    expect(screen.queryByText(t('quran.wortAnalyse.fragmentsTitle'))).toBeNull();
  });

  // Verbindung Reader -> Lexikon-Verbfamilien (app/lexikon/verbtyp/[typ].tsx):
  // wurzelTyp() aus grammatik.ts bestimmt aus der Wurzel eines Verbs die
  // Verbfamilie(n) (sahih/mahmuz/mithal/ajwaf/naaqis/lafif.../mudaaf/rubai) —
  // das Sheet zeigt sie an und meldet einen Tap nach oben (onVerbTypOeffnen),
  // statt selbst zu navigieren.
  describe('Verbtyp (Sprung zur Verbfamilie im Lexikon)', () => {
    function verbWort(overrides: Partial<MorphWord> & { root: string | null; pos?: string } = { root: null }) {
      return wort({
        // Muss zur Standardposition aus baseProps() passen (position: 4) —
        // sonst greift der "kein Treffer für diese Position"-Fallback und
        // die Verbtyp-Sektion wird nie erreicht.
        position: overrides.position ?? 4,
        text: overrides.text ?? 'فعل',
        root: overrides.root,
        lemma: overrides.lemma ?? 'فعل',
        segments: [
          segment({
            text: overrides.text ?? 'فعل',
            kind: 'stem',
            pos: overrides.pos ?? 'V',
            features: { tense: 'perfect', person: '3', gender: 'm', number: 'sg' },
          }),
        ],
      });
    }

    it('zeigt den Verbtyp bei einem hohlen Verb (Aǧwaf, Wurzel قول)', async () => {
      mockVerse = [verbWort({ root: 'قول' })];

      await render(<WortAnalyseSheet {...baseProps()} />, { wrapper: Wrapper });

      expect(screen.getByText(t('quran.wortAnalyse.verbTypLabel'))).toBeTruthy();
      expect(
        screen.getByText(`${t('grammatik.schwacheVerben.ajwaf.name')} — ${t('grammatik.schwacheVerben.ajwaf.ar')}`),
      ).toBeTruthy();
    });

    it('zeigt KEINEN Verbtyp bei einem Nomen, auch wenn eine (schwache) Wurzel vorliegt', async () => {
      mockVerse = [verbWort({ root: 'قول', pos: 'N' })];

      await render(<WortAnalyseSheet {...baseProps()} />, { wrapper: Wrapper });

      expect(screen.queryByText(t('quran.wortAnalyse.verbTypLabel'))).toBeNull();
    });

    it('zeigt KEINEN Verbtyp bei einem Verb ohne hinterlegte Wurzel', async () => {
      mockVerse = [verbWort({ root: null })];

      await render(<WortAnalyseSheet {...baseProps()} />, { wrapper: Wrapper });

      expect(screen.queryByText(t('quran.wortAnalyse.verbTypLabel'))).toBeNull();
    });

    it('zeigt MEHRERE Verbtypen, wenn die Wurzel mehrere Kategorien gleichzeitig erfüllt (مهموز UND ناقص, Wurzel امي)', async () => {
      mockVerse = [verbWort({ root: 'امي' })];

      await render(<WortAnalyseSheet {...baseProps()} />, { wrapper: Wrapper });

      expect(
        screen.getByText(`${t('grammatik.schwacheVerben.mahmuz.name')} — ${t('grammatik.schwacheVerben.mahmuz.ar')}`),
      ).toBeTruthy();
      expect(
        screen.getByText(`${t('grammatik.schwacheVerben.naqis.name')} — ${t('grammatik.schwacheVerben.naqis.ar')}`),
      ).toBeTruthy();
    });

    it('meldet beim Antippen den ANGETIPPTEN Verbtyp nach oben, statt selbst zu navigieren', async () => {
      mockVerse = [verbWort({ root: 'امي' })];
      const onVerbTypOeffnen = jest.fn();

      await render(<WortAnalyseSheet {...baseProps({ onVerbTypOeffnen })} />, { wrapper: Wrapper });

      fireEvent.press(screen.getByLabelText(t('grammatik.schwacheVerben.mahmuz.name')));
      expect(onVerbTypOeffnen).toHaveBeenCalledWith('mahmuz');

      fireEvent.press(screen.getByLabelText(t('grammatik.schwacheVerben.naqis.name')));
      expect(onVerbTypOeffnen).toHaveBeenCalledWith('naaqis');
    });
  });
});
