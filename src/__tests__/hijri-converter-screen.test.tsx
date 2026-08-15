/**
 * Hijri-Umrechner — Audit 2026-07-27, Bildschirm-Bericht M21.
 *
 * Ungueltige Eingabe wurde stumm verschluckt: „31. Februar", ein leeres Feld
 * oder ein Jahr 0 ergaben nur einen Gedankenstrich „—", ohne Grund. Gegen den
 * Stand vor dem Fix sind alle Faelle unten rot — der Screen zeigte dort
 * ausschliesslich „—".
 *
 * Der Test liegt unter src/__tests__ und nicht neben dem Screen: expo-router
 * zieht jede Datei unter src/app per require.context als Route ins Bundle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import HijriConverterScreen from '@/app/hijri-converter';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react') as typeof import('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

const t = (key: string) => translate('de', key);

// Kein Netz im Test: der Screen ruft api.aladhan.com. Ein abgelehnter Abruf
// laesst ihn sofort auf die Offline-Rechnung fallen — genau der Pfad, auf dem
// die Fehlermeldung sichtbar sein muss.
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('offline')) as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

// Ein Client fuer die ganze Datei: `retry` aus, damit der Abruf sofort in
// isError laeuft (statt im Spinner zu haengen), `gcTime: 0` damit react-query
// nach dem Test keine Aufraeum-Timer offen laesst (Jest meldet solche Timer
// als „worker process has failed to exit gracefully").
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

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
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }),
  );
});

/** Setzt die drei gregorianischen Felder (Reihenfolge: Tag, Monat, Jahr).
 *  Abfragen bewusst ueber das Ergebnis von `render()` statt ueber das globale
 *  `screen` — letzteres zeigt in einer Datei mit mehreren Renders nicht
 *  zuverlaessig auf den aktuellen Baum. */
async function setGregorian(view: RenderResult, day: string, month: string, year: string) {
  await act(async () => {
    fireEvent.changeText(view.getByLabelText(t('hijriConverter.day')), day);
    fireEvent.changeText(view.getByLabelText(t('hijriConverter.month')), month);
    fireEvent.changeText(view.getByLabelText(t('hijriConverter.year')), year);
  });
}

async function renderScreen(): Promise<RenderResult> {
  const view = await render(<HijriConverterScreen />, { wrapper: Wrapper });
  await view.findByText(t('hijriConverter.result'));
  return view;
}

describe('Hijri-Umrechner — ungueltige Eingabe', () => {
  it('nennt den 31. Februar beim Namen statt „—" zu zeigen', async () => {
    const view = await renderScreen();
    await setGregorian(view, '31', '2', '2026');
    expect(view.getByText(t('hijriConverter.error.nonexistent'))).toBeTruthy();
    expect(view.queryByText('—')).toBeNull();
  });

  it('sagt bei einem leeren Feld, was fehlt', async () => {
    const view = await renderScreen();
    await setGregorian(view, '', '7', '2026');
    expect(view.getByText(t('hijriConverter.error.incomplete'))).toBeTruthy();
  });

  it('weist einen Monat ausserhalb 1–12 als Bereichsfehler aus', async () => {
    const view = await renderScreen();
    await setGregorian(view, '1', '13', '2026');
    expect(view.getByText(t('hijriConverter.error.range'))).toBeTruthy();
  });

  it('zeigt bei gueltiger Eingabe keine Fehlermeldung', async () => {
    const view = await renderScreen();
    await setGregorian(view, '27', '7', '2026');
    expect(view.queryByText(t('hijriConverter.error.nonexistent'))).toBeNull();
    expect(view.queryByText(t('hijriConverter.error.incomplete'))).toBeNull();
    expect(view.queryByText(t('hijriConverter.error.range'))).toBeNull();
  });
});
