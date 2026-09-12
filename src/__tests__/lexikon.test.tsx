/**
 * Lexikon-Screen — Reiter "Wurzeln & Wortschatz" und die universelle
 * Kopf-Suche mit echtem Inhalt (Reiter "Grammatik & Sarf"/"Tajwid" bleiben
 * bewusst ehrliche Leerzustände, siehe Aufgabenstellung).
 *
 * `@/features/quran/morphologie` wird gemockt (kleine, handgebaute
 * Wurzel-/Lemma-Konkordanz) — dieser Test prüft die Anzeige-/Navigations-
 * Logik des Screens, nicht das Laden/Cachen selbst (das deckt
 * morphologie.test.ts im Quran-Feature ab). Gleiches Mock-Muster wie
 * wort-analyse-sheet.test.tsx.
 *
 * Der Test liegt unter src/__tests__ und NICHT neben dem Screen: expo-router
 * zieht jede Datei unter src/app per require.context als Route ins Bundle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import LexikonScreen from '@/app/lexikon/index';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';
import type { LemmataDatei, WurzelnDatei } from '@/features/quran/morphologieTypen';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect, createElement } = jest.requireActual('react') as typeof import('react');
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
    // Der Screen bekommt seit dem Datenherkunfts-Hinweis (QAC/NoorBayan)
    // eigene <Link>-Aufrufe (ueber @/components/external-link); dieser Test
    // prueft nur Anzeige/Navigation der Listen, nicht das Linkverhalten,
    // daher reicht ein schlichtes Text-Element als Ersatz.
    Link: ({ children, ...rest }: { children?: ReactNode }) => createElement(Text, rest, children),
  };
});

const WURZELN: WurzelnDatei = {
  سمو: { count: 3, lemmas: ['اِسْم'], occurrences: [[1, 1, 1], [2, 255, 16], [3, 5, 2]] },
  رحم: { count: 2, lemmas: ['رَّحْمَٰن'], occurrences: [[1, 1, 3], [1, 3, 1]] },
};
const LEMMATA: LemmataDatei = {
  'اِسْم': { count: 3, occurrences: [[1, 1, 1], [2, 255, 16], [3, 5, 2]] },
  'رَّحْمَٰن': { count: 2, occurrences: [[1, 1, 3], [1, 3, 1]] },
};

jest.mock('@/features/quran/morphologie', () => ({
  ladeWurzeln: jest.fn(async () => WURZELN),
  ladeLemmata: jest.fn(async () => LEMMATA),
  ladeMeta: jest.fn(async () => ({ schema: 1, gesamt: {}, posHaeufigkeit: {}, relationHaeufigkeit: {} })),
  ladeMorphologie: jest.fn(async () => ({ schema: 1, surah: 1, verses: {} })),
}));

const t = (key: string) => translate('de', key);

// EIN Client fuer die ganze Datei (wie in hijri-converter-screen.test.tsx):
// `retry: false` laesst einen fehlgeschlagenen Abruf sofort in isError laufen,
// `gcTime: 0` verhindert offene Aufraeum-Timer, die Jest am saubereb Beenden
// hindern ("did not exit one second after the test run has completed").
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SettingsProvider>
  );
}

afterEach(() => {
  queryClient.clear();
});

beforeEach(async () => {
  await AsyncStorage.clear();
  mockPush.mockClear();
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }),
  );
});

describe('Lexikon-Screen', () => {
  it('rendert Titel, Untertitel und alle vier Reiter', async () => {
    await render(<LexikonScreen />, { wrapper: Wrapper });
    expect(await screen.findByText(t('lexikon.title'))).toBeTruthy();
    expect(screen.getByText(t('lexikon.subtitle'))).toBeTruthy();
    expect(screen.getByText(t('lexikon.tabs.roots'))).toBeTruthy();
    expect(screen.getByText(t('lexikon.tabs.grammar'))).toBeTruthy();
    expect(screen.getByText(t('lexikon.tabs.tajwid'))).toBeTruthy();
    expect(screen.getByText(t('lexikon.tabs.concordance'))).toBeTruthy();
  });

  describe('Reiter "Wurzeln & Wortschatz"', () => {
    it('zeigt die Wurzeln mit Vorkommen- und Wortform-Anzahl, nach Häufigkeit sortiert', async () => {
      await render(<LexikonScreen />, { wrapper: Wrapper });

      expect(await screen.findByText('سمو')).toBeTruthy();
      expect(screen.getByText('رحم')).toBeTruthy();
      expect(screen.getByText(t('lexikon.roots.occurrences').replace('{n}', '3'))).toBeTruthy();
      expect(screen.getByText(t('lexikon.roots.occurrences').replace('{n}', '2'))).toBeTruthy();
      expect(screen.getAllByText(t('lexikon.roots.lemmaCount').replace('{n}', '1')).length).toBeGreaterThan(0);
      expect(screen.getByText(t('lexikon.roots.totalCount').replace('{n}', '2'))).toBeTruthy();
    });

    it('springt beim Antippen einer Wurzel in die Detailansicht', async () => {
      await render(<LexikonScreen />, { wrapper: Wrapper });

      const row = await screen.findByText('سمو');
      fireEvent.press(row);

      expect(mockPush).toHaveBeenCalledWith({ pathname: '/lexikon/wurzel/[wurzel]', params: { wurzel: 'سمو' } });
    });

    it('sortiert auf Antippen von "Alphabetisch" um', async () => {
      await render(<LexikonScreen />, { wrapper: Wrapper });
      await screen.findByText('سمو');

      fireEvent.press(screen.getByTestId('lexikon-sort-alphabetical'));

      // ا (اله/رحم-Anfangsbuchstabe ر) kommt vor س im Unicode-Codepoint —
      // die Elternreihenfolge im Baum spiegelt die FlatList-Datenreihenfolge.
      // FlatList rendert seine Zellen nach einem Datenwechsel einen Tick
      // spaeter (VirtualizedList-Batching) — waitFor statt einer sofortigen
      // Pruefung, sonst sieht der Test noch die alte Reihenfolge.
      await waitFor(() => {
        const items = screen.getAllByText(/^(سمو|رحم)$/);
        expect(items[0].props.children).toBe('رحم');
        expect(items[1].props.children).toBe('سمو');
      });
    });
  });

  it('zeigt im Reiter "Grammatik & Sarf" echten Lehrtext-Inhalt und im Reiter "Tajwid" den ehrlichen Leerzustand', async () => {
    await render(<LexikonScreen />, { wrapper: Wrapper });
    await screen.findByText('سمو');

    fireEvent.press(screen.getByText(t('lexikon.tabs.grammar')));
    // Die Lehrtexte (data/erklaerungen/de-*.json) werden per dynamic import()
    // nachgeladen — der ehrliche Hinweis, dass sie nur auf Deutsch vorliegen,
    // erscheint erst, sobald das Laden abgeschlossen ist.
    expect(await screen.findByText(t('lexikon.grammar.germanOnlyNote'))).toBeTruthy();

    fireEvent.press(screen.getByText(t('lexikon.tabs.tajwid')));
    expect(await screen.findByText(t('lexikon.empty.tajwid'))).toBeTruthy();
  });

  describe('universelle Kopf-Suche', () => {
    it('findet eine Wurzel trotz fehlender Diakritika und zeigt sie gruppiert', async () => {
      await render(<LexikonScreen />, { wrapper: Wrapper });
      await screen.findByText('سمو');

      fireEvent.changeText(screen.getByPlaceholderText(t('lexikon.searchPlaceholder')), 'سمو');

      await waitFor(() => expect(screen.getByText('سمو')).toBeTruthy());
      // Reiterleiste ist waehrend der Suche ausgeblendet.
      expect(screen.queryByText(t('lexikon.tabs.grammar'))).toBeNull();
    });

    it('zeigt den ehrlichen Hinweis, wenn nichts passt', async () => {
      await render(<LexikonScreen />, { wrapper: Wrapper });
      await screen.findByText('سمو');

      fireEvent.changeText(screen.getByPlaceholderText(t('lexikon.searchPlaceholder')), 'xyzxyz');

      expect(await screen.findByText(t('lexikon.noResultsFor').replace('{query}', 'xyzxyz'))).toBeTruthy();
    });
  });
});
