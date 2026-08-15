/**
 * Der Import auf dem Sync-Bildschirm ERSETZT den lokalen Fortschritt.
 *
 * Bis 2026-07-28 geschah das ohne jede Rueckfrage: wer einen Code vom aelteren
 * Geraet einfuegte, verlor seinen neueren Stand kommentarlos — kein Dialog,
 * kein Hinweis, kein Weg zurueck (der Code enthaelt den alten Stand, der neue
 * war ueberschrieben). Dieser Test haelt beide Haelften fest:
 *
 *   1. Antippen von „Uebernehmen" schreibt NOCH NICHTS, sondern fragt nach —
 *      und nennt dabei das Exportdatum, denn nur daran ist erkennbar, ob der
 *      Code der juengere ist.
 *   2. Erst die Bestaetigung schreibt.
 *
 * Bewusst gegen den echten Bildschirm getestet, nicht gegen eine Hilfsfunktion:
 * der Fehler lag nicht in der Sync-Logik, sondern darin, dass die Oberflaeche
 * sie ohne Zwischenschritt aufrief.
 *
 * Geknoepft wird ueber `getByRole('button', …)`, nicht ueber `getByLabelText`:
 * letzteres liefert die Host-View des Pressable, und `fireEvent.press` findet
 * darauf kein `onPress` — der Test waere stumm gruen geblieben bzw. haette wie
 * hier faelschlich Rot gemeldet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import de from '@/locales/de.json';
import SyncScreen from '@/app/sync';
import { SettingsProvider } from '@/features/settings/store';
import { exportProgressCode } from '@/features/sync/codeSync';
import { preloadLocale } from '@/lib/translate';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'de' }],
}));

// Echter Sicherungs-Schluessel aus features/sync/backupKeys.ts — ein frei
// erfundener Name waere gar nicht Teil des Codes und der Test damit wertlos.
const SCHLUESSEL = 'salatibox:khatmah';

async function codeMitStand(wert: string): Promise<string> {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(SCHLUESSEL, wert);
  return exportProgressCode();
}

beforeEach(async () => {
  await preloadLocale('de');
});

describe('Sync-Bildschirm: Rueckfrage vor dem Ueberschreiben', () => {
  it('fragt nach und laesst den lokalen Stand bis zur Bestaetigung unangetastet', async () => {
    const code = await codeMitStand('stand-vom-alten-geraet');

    // Zielgeraet: hat einen NEUEREN Stand als der Code.
    await AsyncStorage.clear();
    await AsyncStorage.setItem(SCHLUESSEL, 'neuerer-stand');

    const view = await render(
      <SettingsProvider>
        <SyncScreen />
      </SettingsProvider>,
    );

    fireEvent.changeText(view.getByPlaceholderText(de.sync.importPlaceholder), code);
    // Abwarten, bis die Eingabe im Zustand steht: der Knopf ist bei leerem Feld
    // `disabled`, ein zu frueher Druck verpufft wirkungslos.
    await waitFor(() => expect(view.getByDisplayValue(code)).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: de.sync.importButton }));

    // Rueckfrage steht — und der lokale Stand ist noch der eigene.
    await waitFor(() => expect(view.getByText(de.sync.confirmTitle)).toBeTruthy());
    expect(await AsyncStorage.getItem(SCHLUESSEL)).toBe('neuerer-stand');

    // Abbrechen laesst ihn ebenfalls stehen.
    fireEvent.press(view.getByRole('button', { name: de.common.cancel }));
    await waitFor(() => expect(view.queryByText(de.sync.confirmTitle)).toBeNull());
    expect(await AsyncStorage.getItem(SCHLUESSEL)).toBe('neuerer-stand');
  });

  it('uebernimmt den Code erst nach der Bestaetigung', async () => {
    const code = await codeMitStand('stand-vom-alten-geraet');
    await AsyncStorage.clear();
    await AsyncStorage.setItem(SCHLUESSEL, 'neuerer-stand');

    const view = await render(
      <SettingsProvider>
        <SyncScreen />
      </SettingsProvider>,
    );

    fireEvent.changeText(view.getByPlaceholderText(de.sync.importPlaceholder), code);
    // Abwarten, bis die Eingabe im Zustand steht: der Knopf ist bei leerem Feld
    // `disabled`, ein zu frueher Druck verpufft wirkungslos.
    await waitFor(() => expect(view.getByDisplayValue(code)).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: de.sync.importButton }));
    await waitFor(() => expect(view.getByText(de.sync.confirmTitle)).toBeTruthy());

    fireEvent.press(view.getByRole('button', { name: de.sync.confirmAction }));

    await waitFor(async () =>
      expect(await AsyncStorage.getItem(SCHLUESSEL)).toBe('stand-vom-alten-geraet'),
    );
    expect(view.getByText(de.sync.importSuccess)).toBeTruthy();
  });

  it('weist einen unbrauchbaren Code ab, ohne etwas zu schreiben', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(SCHLUESSEL, 'neuerer-stand');

    const view = await render(
      <SettingsProvider>
        <SyncScreen />
      </SettingsProvider>,
    );

    // Haeufigster echter Fehlerfall: beim Kopieren abgeschnitten.
    fireEvent.changeText(view.getByPlaceholderText(de.sync.importPlaceholder), 'SALATI-kaputt');
    await waitFor(() => expect(view.getByDisplayValue('SALATI-kaputt')).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: de.sync.importButton }));

    await waitFor(() => expect(view.getByText(de.sync.importError)).toBeTruthy());
    expect(view.queryByText(de.sync.confirmTitle)).toBeNull();
    expect(await AsyncStorage.getItem(SCHLUESSEL)).toBe('neuerer-stand');
  });
});
