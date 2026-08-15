/**
 * Der KI-Screen muss die Beispielfrage in der Sprache des GELADENEN Korpus
 * stellen.
 *
 * Anlass (2026-07-29, am Gerät belegt): In en/tr/ar lieferte das Antippen einer
 * Beispielfrage „Dazu finde ich in meinen lokalen Quellen keine Stelle". Der
 * Screen schickte immer den deutschen Wortlaut ab (features/ki/
 * beispielfragen.ts), obwohl features/ki/korpus.ts je App-Sprache längst einen
 * ÜBERSETZTEN Korpus lädt — deutsche Wörter gegen türkischen Bestand.
 *
 * Geprüft wird deshalb an der Oberfläche, nicht in der Hilfsfunktion: der
 * Fehler saß in der Verdrahtung des Chips, eine grüne Einheitsprüfung hätte ihn
 * nicht gesehen. Der übersetzte Korpus wird gestellt (die 13 R2-Dateien liegen
 * nicht im Repo), enthält aber echte türkische Dokumente — damit belegt der
 * Test zugleich, dass die abgeschickte Frage darin auch etwas findet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { ensureLocale, translate } from '@/lib/translate';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react') as typeof import('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: null }));

// Türkischer Ersatz-Korpus: dieselben Doc-IDs wie der deutsche Lauf, Text und
// Quellenangabe aber türkisch — genau die Lage auf einem Gerät mit App-Sprache
// Türkisch und erfolgreich geladenem korpus-tr.json.
const TR_DOCS = [
  {
    id: 'w-fuenf-saeulen',
    src: 'Salati bilgi: İslamın beş şartı',
    t: 'İslamın beş şartı şunlardır: kelime-i şehadet, namaz, zekât, Ramazan orucu ve gücü yetenler için hac.',
  },
  {
    id: 'w-wudu-kurz',
    src: 'Salati bilgi: Abdest',
    t: 'Abdest şöyle alınır: eller, ağız, burun, yüz, kollar yıkanır, baş mesh edilir ve ayaklar yıkanır.',
  },
];

jest.mock('@/features/ki/korpus', () => {
  const gerichtet = jest.requireActual('@/features/ki/retrieval') as typeof import('@/features/ki/retrieval');
  const echt = jest.requireActual('@/features/ki/korpus') as typeof import('@/features/ki/korpus');
  const trStand = {
    sprache: 'tr',
    index: gerichtet.baueIndex(TR_DOCS),
    gesamt: TR_DOCS.length,
    deutsch: 0,
    nurDeutsch: false,
  };
  return { ...echt, ladeKorpusStand: jest.fn(async () => trStand) };
});

const WARTE = { timeout: 20_000 };
jest.setTimeout(60_000);

function Wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, language: 'tr' }));
  // tr wird zur Laufzeit per import() nachgeladen (lib/translate.ts); ohne
  // dieses Warten liefert translate() noch die englische Fallback-Kette.
  await ensureLocale('tr');
});

it('stellt die Beispielfrage türkisch, sobald der türkische Korpus geladen ist', async () => {
  // Erst hier importieren, damit der Korpus-Mock greift.
  const KiNativeScreen = (await import('@/app/ki-native')).default;
  const chipText = translate('tr', 'ki.example1');
  const deutscherWortlaut = 'Was sind die fünf Säulen des Islam?';

  render(<KiNativeScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByText(chipText)).toBeTruthy(), WARTE);
  // Der Screen zieht den übersetzten Korpus nach dem ersten Rendern nach.
  await waitFor(() => expect(screen.queryByText(translate('tr', 'ki.germanSourcesNote'))).toBeNull(), WARTE);

  fireEvent.press(screen.getByText(chipText));

  // Die eigene Nachricht steht türkisch im Chat — nicht auf Deutsch.
  await waitFor(() => expect(screen.getAllByText(chipText).length).toBeGreaterThan(0), WARTE);
  expect(screen.queryByText(deutscherWortlaut)).toBeNull();
  // Und sie findet etwas: es kommt eine Antwort mit Quelle, kein „keine Stelle".
  await waitFor(() => expect(screen.getByText(translate('tr', 'ki.sourcesLabel'))).toBeTruthy(), WARTE);
  expect(screen.queryByText(translate('tr', 'ki.noAnswer'))).toBeNull();
  expect(screen.getByText('Salati bilgi: İslamın beş şartı')).toBeTruthy();
});
