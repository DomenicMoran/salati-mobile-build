/**
 * Wurzel-Detailansicht (app/lexikon/wurzel/[wurzel].tsx): abgeleitete
 * Wortformen gruppiert nach Wortart, Gesamt-Vorkommen und eine tippbare
 * Belegliste, die in den Reader springt.
 *
 * Nutzt denselben real gemessenen Fixture-Ausschnitt wie
 * grammatik.realdaten.test.ts/wort-analyse-sheet.test.tsx
 * (`__fixtures__/morphologie-1.json`) für die Wortart-Zuordnung — echte
 * Korpusdaten statt erfundener Beispielsätze.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import WurzelDetailScreen from '@/app/lexikon/wurzel/[wurzel]';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';
import sure1Fixture from '@/features/quran/__fixtures__/morphologie-1.json';
import type { LemmataDatei, MorphologieDatei, WurzelnDatei } from '@/features/quran/morphologieTypen';

const mockSure1 = sure1Fixture as unknown as MorphologieDatei;

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: () => ({ wurzel: 'سمو' }),
}));

// Echte Wurzel "سمو" (سmw) — Lemma "ٱسْم" ist genau das Wort aus
// __fixtures__/morphologie-1.json (Position 1, Sure 1, Vers 1: "بِسْمِ",
// Stamm-Segment POS "N" -> Wortart "ism").
const WURZELN: WurzelnDatei = {
  سمو: { count: 3, lemmas: ['ٱسْم'], occurrences: [[1, 1, 1], [2, 255, 16], [3, 5, 2]] },
};
const LEMMATA: LemmataDatei = {
  'ٱسْم': { count: 3, occurrences: [[1, 1, 1], [2, 255, 16], [3, 5, 2]] },
};

jest.mock('@/features/quran/morphologie', () => ({
  ladeWurzeln: jest.fn(async () => WURZELN),
  ladeLemmata: jest.fn(async () => LEMMATA),
  ladeMorphologie: jest.fn(async () => mockSure1),
}));

const t = (key: string) => translate('de', key);

// EIN Client fuer die ganze Datei (wie in hijri-converter-screen.test.tsx):
// `retry: false` laesst einen fehlgeschlagenen Abruf sofort in isError laufen,
// `gcTime: 0` verhindert offene Aufraeum-Timer, die Jest am sauberen Beenden
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

describe('Wurzel-Detailansicht', () => {
  it('zeigt die Gesamtzahl der Vorkommen und ordnet die Wortform ihrer Wortart zu', async () => {
    await render(<WurzelDetailScreen />, { wrapper: Wrapper });

    expect(await screen.findByText(t('lexikon.wurzel.occurrencesInQuran').replace('{n}', '3'))).toBeTruthy();
    // Aus grammatik.wortarten.ism.name — "Ism (Nomen)" (siehe locales/de.json)
    expect(await screen.findByText(translate('de', 'grammatik.wortarten.ism.name'))).toBeTruthy();
    expect(screen.getByText('ٱسْم')).toBeTruthy();
  });

  it('begrenzt die Belegliste nicht faelschlich, wenn unter dem Limit', async () => {
    await render(<WurzelDetailScreen />, { wrapper: Wrapper });
    await screen.findByText('ٱسْم');

    // Drei Fundstellen, alle als Sure:Vers-Chips sichtbar.
    expect(screen.getByText('1:1')).toBeTruthy();
    expect(screen.getByText('2:255')).toBeTruthy();
    expect(screen.getByText('3:5')).toBeTruthy();
  });

  it('springt beim Antippen einer Fundstelle in den Reader', async () => {
    await render(<WurzelDetailScreen />, { wrapper: Wrapper });
    const chip = await screen.findByText('2:255');

    fireEvent.press(chip);

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quran/[surah]', params: { surah: 2, ayah: 255 } });
  });
});
