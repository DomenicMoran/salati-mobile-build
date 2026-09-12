/**
 * Der Speicher-Bildschirm zeigt die Datei-Zwischenspeicher AN und laesst sie
 * loeschen.
 *
 * Bis 2026-09 zaehlte die Uebersicht drei Verzeichnisse im Dokumentordner gar
 * nicht mit (morphologie/, wbw/, wortliste/ — allein Sure 2 der Wortliste ist
 * 1,08 MB gross). Der Nutzer bekam eine zu kleine Zahl zu sehen und fand den
 * groessten Brocken nicht, wenn er Platz schaffen wollte.
 *
 * Bewusst gegen den echten Bildschirm getestet und nicht nur gegen
 * `getStorageOverview()`: der Fehler war nicht die Rechnung allein, sondern
 * dass diese Bestaende in der Oberflaeche nirgends vorkamen — mit Zahl UND
 * Loesch-Knopf. Eine Anzeige ohne Loeschmoeglichkeit waere nur die halbe
 * Wahrheit.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';

import de from '@/locales/de.json';
import StorageScreen from '@/app/storage';
import { SettingsProvider } from '@/features/settings/store';
import { preloadLocale } from '@/lib/translate';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'de' }],
}));

// Mini-Dateisystem wie in features/settings/storage.test.ts: zwei Maps statt
// einer Kette von mockResolvedValueOnce (die Reihenfolge der rekursiven
// Aufrufe ist nicht vorhersagbar).
jest.mock('expo-file-system/legacy', () => {
  function norm(uri: string): string {
    return uri.length > 1 && uri.endsWith('/') ? uri.slice(0, -1) : uri;
  }
  const files = new Map<string, number>();
  const dirs = new Map<string, string[]>();
  return {
    documentDirectory: 'file:///doc/',
    cacheDirectory: 'file:///cache/',
    __setFile: (uri: string, size: number) => files.set(norm(uri), size),
    __setDir: (uri: string, children: string[]) => dirs.set(norm(uri), children),
    __reset: () => {
      files.clear();
      dirs.clear();
    },
    getInfoAsync: jest.fn(async (uri: string) => {
      const key = norm(uri);
      if (dirs.has(key)) return { exists: true, isDirectory: true, uri };
      if (files.has(key)) return { exists: true, isDirectory: false, size: files.get(key), uri };
      return { exists: false, isDirectory: false, uri };
    }),
    readDirectoryAsync: jest.fn(async (uri: string) => dirs.get(norm(uri)) ?? []),
    deleteAsync: jest.fn().mockResolvedValue(undefined),
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
    downloadAsync: jest.fn().mockResolvedValue({ uri: 'file:///doc/x' }),
  };
});

type FsMock = typeof FileSystem & {
  __setFile: (uri: string, size: number) => void;
  __setDir: (uri: string, children: string[]) => void;
  __reset: () => void;
};
const fsMock = FileSystem as FsMock;

beforeEach(async () => {
  await preloadLocale('de');
  fsMock.__reset();
  jest.clearAllMocks();
  // Nur die Wortliste liegt auf der Platte: 1,08 MB, der gemessene Wert fuer
  // Sure 2 — genau der Bestand, der vorher unsichtbar war.
  fsMock.__setDir('file:///doc/', ['wortliste']);
  fsMock.__setDir('file:///doc/wortliste/', ['2.json']);
  fsMock.__setFile('file:///doc/wortliste/2.json', 1_080_000);
});

describe('Speicher-Bildschirm: weitere Daten', () => {
  it('weist die Koran-Wortdaten mit Groesse aus und loescht sie nach Bestaetigung', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const view = await render(
      <SettingsProvider>
        <QueryClientProvider client={queryClient}>
          <StorageScreen />
        </QueryClientProvider>
      </SettingsProvider>,
    );

    // 1. Der Bestand steht mit Beschriftung und Groesse in der Uebersicht.
    await waitFor(() => expect(view.getByText(de.settings.storage.otherData.quranWords)).toBeTruthy());
    // Zweimal: in der Gesamtsumme oben UND in der Zeile. Vorher stand die
    // Wortliste an beiden Stellen nicht - die Gesamtsumme zeigte 0 KB.
    expect(view.getAllByText('1.0 MB')).toHaveLength(2);

    // 2. Der Loesch-Knopf fragt zuerst nach — und loescht noch nichts.
    fireEvent.press(view.getByRole('button', { name: de.settings.storage.otherData.delete }));
    expect(alert).toHaveBeenCalled();
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();

    // 3. Erst die Bestaetigung raeumt die drei Verzeichnisse ab.
    const knoepfe = alert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
    const bestaetigen = knoepfe.find((b) => b.text === de.settings.storage.otherData.delete);
    await bestaetigen?.onPress?.();

    const geloescht = (FileSystem.deleteAsync as jest.Mock).mock.calls.map((c) => c[0] as string).sort();
    expect(geloescht).toEqual([
      'file:///doc/morphologie/',
      'file:///doc/wbw/',
      'file:///doc/wortliste/',
    ]);
    alert.mockRestore();
  });
});
