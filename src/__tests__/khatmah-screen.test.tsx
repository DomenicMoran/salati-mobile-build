/**
 * Khatmah-Leseplan — Render-Test der beiden Screen-Zustaende (kein Plan /
 * laufender Plan).
 *
 * Anlass (Audit 2026-07-28): Nur der Auswahl-Zweig rendert den `ScreenHeader`.
 * Der Zweig MIT laufendem Plan zeigte bis heute einen nackten Titel — auf nativ
 * war der Screen damit ohne sichtbaren Ausgang, sobald ein Plan gestartet war
 * (Root-Stack: `headerShown: false`, der Zurueck-Chip ist Web-only).
 *
 * Der Test liegt unter src/__tests__ und NICHT neben dem Screen: expo-router
 * zieht jede Datei unter src/app per require.context als Route ins Bundle.
 *
 * Erwartete Beschriftungen kommen aus `translate()` statt als feste deutsche
 * Zeichenkette: die Sprache haengt an der Geraete-Erkennung, und ein Test, der
 * nur auf Deutsch gruen ist, prueft die Sprache statt den Screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import KhatmahScreen from '@/app/khatmah';
import { KHATMAH_STORAGE_KEY } from '@/features/khatmah/plan';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react') as typeof import('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    // Ohne Navigator gibt es kein Fokus-Ereignis; im Test entspricht
    // "Screen ist fokussiert" genau "Screen ist montiert".
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

const t = (key: string) => translate('de', key);

function Wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

/** Gespeicherte Einstellungen mit fester Sprache — sonst entscheidet die
 *  Geraete-Erkennung des Testlaeufers ueber die Beschriftungen. */
async function seedSettings() {
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }),
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await seedSettings();
});

describe('Khatmah-Screen', () => {
  it('zeigt ohne Plan die Auswahl — mit Zurueck-Kopf', async () => {
    await render(<KhatmahScreen />, { wrapper: Wrapper });
    expect(await screen.findByLabelText(t('a11y.back'))).toBeTruthy();
    expect(screen.getByText(t('khatmah.title'))).toBeTruthy();
    // Die vier Voreinstellungen (7/15/30/60 Tage) sind sichtbar.
    for (const days of ['7', '15', '30', '60']) {
      expect(screen.getByText(days)).toBeTruthy();
    }
  });

  it('zeigt mit laufendem Plan den Fortschritt UND weiterhin einen Zurueck-Kopf', async () => {
    await AsyncStorage.setItem(
      KHATMAH_STORAGE_KEY,
      JSON.stringify({ startDay: '2026-07-01', days: 30, completed: {} }),
    );
    await render(<KhatmahScreen />, { wrapper: Wrapper });
    // Plan-Zweig erkennbar am „Neuer Plan"-Fuss.
    expect(await screen.findByText(t('khatmah.newPlan'))).toBeTruthy();
    // Der Fund vom 2026-07-28: genau dieser Zweig hatte keinen Ausgang.
    expect(screen.getByLabelText(t('a11y.back'))).toBeTruthy();
    expect(screen.getByText(t('khatmah.title'))).toBeTruthy();
  });
});

/**
 * Audit 2026-07-27, Bildschirm-Bericht M23.
 *
 * „Neuer Plan" rief `reset()` direkt auf: ein Fehlgriff auf dem Fuss-Element
 * warf bis zu 60 Tage abgehakten Fortschritt weg, ohne Rueckfrage und ohne
 * Rueckweg. Gegen den Stand vor dem Fix ist „fragt nach" rot (Alert wurde nie
 * aufgerufen) und „loescht erst nach Bestaetigung" ebenfalls (der Plan war
 * schon beim Tippen weg).
 */
describe('Khatmah zuruecksetzen', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  async function renderRunningPlan() {
    await AsyncStorage.setItem(
      KHATMAH_STORAGE_KEY,
      JSON.stringify({ startDay: '2026-07-01', days: 30, completed: { 0: true, 1: true } }),
    );
    await render(<KhatmahScreen />, { wrapper: Wrapper });
    return screen.findByText(t('khatmah.newPlan'));
  }

  beforeEach(() => {
    alertSpy.mockClear();
  });

  it('fragt nach, statt den Plan sofort zu verwerfen', async () => {
    fireEvent.press(await renderRunningPlan());
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body, buttons] = alertSpy.mock.calls[0];
    expect(title).toBe(t('khatmah.resetConfirmTitle'));
    // Der Text nennt den konkreten Verlust — 2 von 30 abgehakten Tagen.
    expect(body).toContain('2');
    expect(body).toContain('30');
    expect(body).not.toContain('{done}');
    expect(body).not.toContain('{total}');
    expect(buttons?.map((b) => b.text)).toEqual([
      t('common.cancel'),
      t('khatmah.resetConfirmAction'),
    ]);
    expect(buttons?.[0].style).toBe('cancel');
    expect(buttons?.[1].style).toBe('destructive');
  });

  it('behaelt den Plan, solange nicht bestaetigt wurde', async () => {
    fireEvent.press(await renderRunningPlan());
    expect(await AsyncStorage.getItem(KHATMAH_STORAGE_KEY)).toContain('"days":30');
  });

  it('loescht erst nach Bestaetigung', async () => {
    fireEvent.press(await renderRunningPlan());
    const confirm = alertSpy.mock.calls[0][2]?.[1];
    await act(async () => {
      confirm?.onPress?.();
    });
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(KHATMAH_STORAGE_KEY)).toBeNull();
    });
  });
});
