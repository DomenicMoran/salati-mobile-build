/**
 * Reiter "Grammatik & Sarf" (Liste + Detailansicht): echte Lehrtext-Daten aus
 * data/erklaerungen/de-nomen.json (per dynamic import() nachgeladen, siehe
 * erklaerungenLoader.ts) — bewusst UNGEMOCKT, damit der Test dieselbe echte
 * Datei prüft, die auch in der App ausgeliefert wird (kein erfundenes
 * Test-Fixture für Koran-Inhalte).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import BegriffDetailScreen from '@/app/lexikon/begriff/[bereich]/[id]';
import LexikonScreen from '@/app/lexikon/index';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';

const mockPush = jest.fn();
let mockParams: { bereich: string; id: string } = { bereich: 'nomen', id: 'ism' };

jest.mock('expo-router', () => {
  const { useEffect, createElement } = jest.requireActual('react') as typeof import('react');
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
    useLocalSearchParams: () => mockParams,
    // LexikonScreen zeigt seit dem Datenherkunfts-Hinweis (QAC/NoorBayan) auf
    // dem Standard-Reiter "Wurzeln" einen <Link> (@/components/external-link);
    // dieser Test prueft nur die Grammatik-Liste/-Detailansicht, daher reicht
    // ein schlichtes Text-Element als Ersatz.
    Link: ({ children, ...rest }: { children?: ReactNode }) => createElement(Text, rest, children),
  };
});

const t = (key: string) => translate('de', key);

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
  mockParams = { bereich: 'nomen', id: 'ism' };
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }),
  );
});

describe('Reiter "Grammatik & Sarf" — Liste', () => {
  it('zeigt echte Begriffe gruppiert nach Bereich und springt beim Antippen in die Detailansicht', async () => {
    await render(<LexikonScreen />, { wrapper: Wrapper });
    fireEvent.press(screen.getByText(t('lexikon.tabs.grammar')));

    // "Ism" (Umschrift von اِسْم, Bereich "nomen") aus der echten
    // de-nomen.json — kein erfundener Beispieltext.
    const ismRow = await screen.findByText('Ism');
    fireEvent.press(ismRow);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/lexikon/begriff/[bereich]/[id]',
      params: { bereich: 'nomen', id: 'ism' },
    });
  });
});

describe('Begriff-Detailansicht', () => {
  it('zeigt Erklärung, Erkennungsmerkmale und einen tippbaren Koranbeleg', async () => {
    await render(<BegriffDetailScreen />, { wrapper: Wrapper });

    expect(await screen.findByText('Das Nomen (Ism)')).toBeTruthy();
    expect(screen.getByText('اِسْم')).toBeTruthy();
    expect(
      screen.getByText(
        /Ism ist eine der drei arabischen Wortarten neben dem Verb/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(t('lexikon.grammar.sectionErkennung'))).toBeTruthy();

    // Beleg 1:1 (بِسْمِ, Sure 1 Vers 1) — antippbar, springt in den Reader.
    const beleg = screen.getByText('1:1');
    fireEvent.press(beleg);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quran/[surah]', params: { surah: 1, ayah: 1 } });
  });

  it('rendert die verknüpfte Formentabelle (paradigmen.json)', async () => {
    await render(<BegriffDetailScreen />, { wrapper: Wrapper });
    await screen.findByText('Das Nomen (Ism)');

    // Tabelle "nomen-muslim" aus paradigmen.json — termAr مُسْلِم.
    expect(await screen.findByText('مُسْلِم')).toBeTruthy();
  });

  it('zeigt einen Querverweis ("siehe") und springt beim Antippen zum verwiesenen Begriff', async () => {
    await render(<BegriffDetailScreen />, { wrapper: Wrapper });
    await screen.findByText('Das Nomen (Ism)');

    // "siehe" von "ism" enthält u. a. "genus" — dessen Umschrift laut
    // de-nomen.json.
    const verweis = await screen.findByText('at-Tadhkir wa-t-Taʾnith (Mudhakkar/Muannath)');
    fireEvent.press(verweis);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/lexikon/begriff/[bereich]/[id]',
      params: { bereich: 'nomen', id: 'genus' },
    });
  });

  it('zeigt den ehrlichen Hinweis, wenn der Begriff nicht existiert', async () => {
    mockParams = { bereich: 'nomen', id: 'gibt-es-nicht' };
    await render(<BegriffDetailScreen />, { wrapper: Wrapper });

    expect(await screen.findByText(t('lexikon.grammar.notFound'))).toBeTruthy();
  });
});
