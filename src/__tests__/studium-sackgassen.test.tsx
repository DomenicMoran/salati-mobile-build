/**
 * Sackgassen-Test fuer die Studium-Detailrouten.
 *
 * Befund vom 2026-07-28: Ein Deep-Link auf eine unbekannte Kurs-Id landete auf
 * nativ bei einem einzelnen Wort „Fehler" — ohne Kopf, ohne Zurueck, ohne
 * Swipe-Alternative (Studium-Stack setzt `headerShown: false`, der schwebende
 * Zurueck-Chip ist Web-only). Dasselbe Muster hatte der Ladezweig.
 *
 * Geprueft wird der ZUSTAND, nicht die Navigation: dass jeder dieser Zweige
 * einen beschrifteten Zurueck-Knopf rendert.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import CourseScreen from '@/app/study/[course]/index';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';

// `mock`-Praefix ist Pflicht: nur so darf die jest.mock-Fabrik darauf zugreifen.
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react') as typeof import('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

const t = (key: string) => translate('de', key);

function Wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }),
  );
});

describe('Kurs-Detailseite mit unbekannter Id', () => {
  it('zeigt einen Fehlerhinweis UND einen Zurueck-Knopf', async () => {
    mockParams = { course: 'gibt-es-nicht' };
    await render(<CourseScreen />, { wrapper: Wrapper });
    expect(await screen.findByText(t('common.error'))).toBeTruthy();
    expect(screen.getByLabelText(t('a11y.back'))).toBeTruthy();
    expect(screen.getByText(t('study.title'))).toBeTruthy();
  });

  it('zeigt auch bei fehlendem Parameter einen Zurueck-Knopf', async () => {
    mockParams = {};
    await render(<CourseScreen />, { wrapper: Wrapper });
    expect(await screen.findByLabelText(t('a11y.back'))).toBeTruthy();
  });
});
