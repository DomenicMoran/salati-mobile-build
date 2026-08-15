/**
 * Audit 2026-07-27, Befund O6.
 *
 * Beim allerersten Start leitet der Store Sprache, Koran-Uebersetzung, Tafsir
 * und Hadith-Sprache aus der Geraetesprache ab — schrieb das Ergebnis aber
 * NICHT nach AsyncStorage. Der `!raw`-Zweig lief damit bei jedem Start erneut.
 * Er ist nur solange harmlos, wie `detectDeviceLocale()` dasselbe liefert:
 * stellt der Nutzer die Systemsprache um, bevor er in der App etwas aendert,
 * kippen alle vier Werte still mit.
 *
 * Gegen den Stand vor dem Fix sind „schreibt den abgeleiteten Erststart-Stand"
 * (nichts unter dem Schluessel) und „bleibt beim zweiten Start stabil"
 * (liefert dann `fr|fr|…`) rot.
 *
 * Hinweis zur Testfuehrung: die Abfragen laufen bewusst ueber das Ergebnis von
 * `render()` und nicht ueber das globale `screen` — im dritten Fall stehen
 * zwei Provider gleichzeitig, und nur die gebundenen Abfragen treffen den
 * jeweils gemeinten Baum.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { SettingsProvider, useSettings } from './store';
import { SETTINGS_STORAGE_KEY, type AppSettings } from './types';

const mockLocales = jest.fn(() => [{ languageCode: 'tr' }]);
jest.mock('expo-localization', () => ({
  getLocales: () => mockLocales(),
}));

function Probe() {
  const { settings, loaded } = useSettings();
  if (!loaded) return null;
  return (
    <Text testID="probe">
      {`${settings.language}|${settings.hadithLanguage}|${settings.quranTranslation}`}
    </Text>
  );
}

/** Zeigt die Adhan-Auswahl statt der Sprachwerte (Migrationstests unten). */
function AzanProbe() {
  const { settings, loaded } = useSettings();
  if (!loaded) return null;
  const n = settings.azanNotificationChoices;
  return (
    <Text testID="azan">
      {`${settings.azanChoice}|${n.fajr}|${n.dhuhr}|${n.asr}|${n.maghrib}|${n.isha}`}
    </Text>
  );
}

function renderStore(probe: ReactElement = <Probe />) {
  return render(<SettingsProvider>{probe}</SettingsProvider>);
}

async function stored(): Promise<Partial<AppSettings> | null> {
  const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Partial<AppSettings>) : null;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockLocales.mockReturnValue([{ languageCode: 'tr' }]);
});

describe('Erststart (kein gespeicherter Stand)', () => {
  it('uebernimmt die Geraetesprache in Oberflaeche, Hadith und Koran-Uebersetzung', async () => {
    const view = await renderStore();
    const el = await view.findByTestId('probe');
    expect(String(el.props.children)).toBe('tr|tr|tr.diyanet');
  });

  it('schreibt den abgeleiteten Erststart-Stand nach AsyncStorage', async () => {
    const view = await renderStore();
    await view.findByTestId('probe');
    await waitFor(async () => {
      const s = await stored();
      expect(s).not.toBeNull();
      expect(s?.language).toBe('tr');
      expect(s?.hadithLanguage).toBe('tr');
      expect(s?.quranTranslation).toBe('tr.diyanet');
    });
  });

  it('bleibt beim zweiten Start stabil, auch wenn die Systemsprache inzwischen wechselt', async () => {
    const first = await renderStore();
    await first.findByTestId('probe');
    await waitFor(async () => expect(await stored()).not.toBeNull());

    // Nutzer stellt das Geraet auf Franzoesisch — die beim Erststart
    // uebernommene App-Sprache darf davon nicht mehr ueberschrieben werden.
    mockLocales.mockReturnValue([{ languageCode: 'fr' }]);
    const second = await renderStore();
    const el = await second.findByTestId('probe');
    expect(String(el.props.children)).toBe('tr|tr|tr.diyanet');
  });
});

describe('Folgestart (gespeicherter Stand)', () => {
  it('laesst einen vorhandenen Stand unangetastet', async () => {
    await AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ language: 'es', hadithLanguage: 'es', quranTranslation: 'es.cortes' }),
    );
    const view = await renderStore();
    // Grosszuegiger Timeout: die Sprachdatei wird per import() nachgeladen
    // (preloadLocale wartet bis zu 1,5 s).
    const el = await view.findByTestId('probe', {}, { timeout: 5000 });
    expect(String(el.props.children)).toBe('es|es|es.cortes');
  });
});

/**
 * Die fuenf bis 2026-07-28 mitgelieferten Adhan-Aufnahmen (azan8/9/12/14/20)
 * sind entfallen, weil sich fuer sie keine Freigabe belegen liess
 * (docs/audit-2026-07-27/ADHAN-LIZENZEN.md). Eine gespeicherte Auswahl zeigt
 * danach auf ein Asset, das es nicht mehr gibt: der Adhan-Knopf im
 * Gebetszeiten-Screen bliebe stumm, und der Notification-Channel fiele
 * wortlos auf den System-Standardton zurueck.
 */
describe('Migration der entfallenen Adhan-Aufnahmen', () => {
  it('zieht alte Auswahlen auf vorhandene Aufnahmen und Fadschr auf den Fadschr-Ruf', async () => {
    await AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        language: 'de',
        azanChoice: 'azan14',
        azanNotificationChoices: {
          fajr: 'azan8',
          dhuhr: 'azan9',
          asr: 'azan12',
          maghrib: 'default',
          isha: 'azan20',
        },
      }),
    );
    const view = await renderStore(<AzanProbe />);
    const el = await view.findByTestId('azan', {}, { timeout: 5000 });
    // "default" (bewusst kein Adhan) bleibt erhalten, alles andere wird gezogen.
    expect(String(el.props.children)).toBe('adhan1|fajr|adhan1|adhan1|default|adhan1');
  });

  it('persistiert die Migration, damit sie nicht bei jedem Start neu laeuft', async () => {
    await AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ language: 'de', azanChoice: 'azan9' }),
    );
    const view = await renderStore(<AzanProbe />);
    await view.findByTestId('azan', {}, { timeout: 5000 });
    await waitFor(async () => {
      const s = await stored();
      expect(s?.azanChoice).toBe('adhan1');
    });
  });

  it('laesst eine aktuelle Auswahl unangetastet', async () => {
    await AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        language: 'de',
        azanChoice: 'adhan2',
        azanNotificationChoices: {
          fajr: 'default',
          dhuhr: 'adhan2',
          asr: 'adhan2',
          maghrib: 'adhan2',
          isha: 'adhan2',
        },
      }),
    );
    const view = await renderStore(<AzanProbe />);
    const el = await view.findByTestId('azan', {}, { timeout: 5000 });
    expect(String(el.props.children)).toBe('adhan2|default|adhan2|adhan2|adhan2|adhan2');
  });
});
