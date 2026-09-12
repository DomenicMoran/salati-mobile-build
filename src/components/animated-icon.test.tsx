/**
 * Abnahme 1.54.0: der Startbildschirm erschien bei persischer Einstellung
 * fuer rund eine halbe Sekunde auf Deutsch und in links-nach-rechts-
 * Leserichtung.
 *
 * Ursache war ein Rennen: das Splash-Overlay blendete sich nach seinem eigenen
 * Zeitplan aus (onLayout -> hideAsync -> 600-ms-Animation), voellig unabhaengig
 * davon, ob die gespeicherten Einstellungen schon gelesen waren. Gewann das
 * Overlay, sah der Nutzer Frames mit `DEFAULT_SETTINGS.language` (Deutsch).
 *
 * Beobachtet wird `SplashScreen.hideAsync()`: das ist der Moment, ab dem
 * ueberhaupt etwas anderes als der Splash sichtbar werden kann.
 *
 * Der erste Fall MUSS gegen den Stand vor der Behebung rot sein (dort lief
 * hideAsync direkt im onLayout, ohne jede Ruecksicht auf den Speicher). Der
 * zweite Fall darf das NICHT sein — er sichert die Gegenrichtung ab: haengt
 * der Speicher, muss der Splash trotzdem weichen, sonst haetten wir statt der
 * falschen Sprache einen Dauer-Splash.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay, SPLASH_WARTET_HOECHSTENS_MS } from './animated-icon';
import { SettingsProvider } from '@/features/settings/store';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

// react-native-worklets braucht eine JSI-Runtime und wirft sonst schon beim
// Import ("loadUnpackersWithCode"); der globale Reanimated-Mock (jest.setup.js)
// deckt nur reanimated selbst ab. `scheduleOnRN` schiebt einen Aufruf vom
// Worklet- auf den JS-Thread — im Test genuegt der direkte Aufruf.
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => fn(...args),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// Default false (wie ohne "Bewegung reduzieren"-Einstellung) — ein Test unten
// stellt gezielt auf true, um den Notausgang-Zweig `animate && reducedMotion`
// abzudecken.
jest.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: jest.fn(() => false),
}));

const hideAsync = SplashScreen.hideAsync as jest.Mock;
const reducedMotionMock = useReducedMotion as jest.Mock;

// Die Original-Funktion des offiziellen AsyncStorage-Mocks. NICHT ueber
// jest.spyOn(...).mockRestore() zuruecksetzen: der Mock ist selbst ein
// jest.fn, und mockRestore macht daraus einen leeren Mock, der `undefined`
// statt eines Promise liefert — die folgenden Tests rendern dann gar nichts.
const echterGetItem = AsyncStorage.getItem;

/**
 * `render()` liefert in dieser Fassung von @testing-library/react-native ein
 * Promise (React 19) — ohne await sind die Abfragen noch nicht bereit.
 */
async function zeigeSplash() {
  await render(
    <SettingsProvider>
      <AnimatedSplashOverlay />
    </SettingsProvider>,
  );
  // Ohne Layout-Ereignis passiert nichts — genau hier rief der alte Stand
  // sofort hideAsync() auf.
  fireEvent(screen.getByTestId('splash-overlay'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 1080, height: 2400 } },
  });
}

/**
 * Laesst offene Promise-Ketten durchlaufen. BEWUSST ohne `act()`: das
 * asynchrone `render()` dieser Fassung von @testing-library/react-native
 * benutzt intern selbst act, und ein zweites, verschachteltes act zerlegt den
 * act-Stapel von React ("overlapping act() calls") — danach committet kein
 * `render()` im selben Test-Lauf mehr etwas.
 */
async function kurzWarten(ms = 50) {
  await new Promise((fertig) => setTimeout(fertig, ms));
}

function speicherAntwortetNie() {
  AsyncStorage.getItem = (() => new Promise<string | null>(() => {})) as typeof AsyncStorage.getItem;
}

beforeEach(() => {
  hideAsync.mockClear();
  reducedMotionMock.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  AsyncStorage.getItem = echterGetItem;
});

it('haelt den Splash, solange die gespeicherten Einstellungen nicht gelesen sind', async () => {
  speicherAntwortetNie();

  await zeigeSplash();
  await kurzWarten();

  expect(hideAsync).not.toHaveBeenCalled();
});

it('gibt den Splash trotzdem frei, wenn der Speicher nicht antwortet', async () => {
  speicherAntwortetNie();

  await zeigeSplash();
  await kurzWarten();
  expect(hideAsync).not.toHaveBeenCalled();

  // Echte Zeit statt jest.useFakeTimers(): das asynchrone `render()` dieser
  // Fassung von @testing-library/react-native kommt unter Schein-Zeitgebern
  // nicht zum Abschluss, der Baum bliebe leer.
  // Lieber der Vorgabestand als ein haengender Startbildschirm.
  await waitFor(() => expect(hideAsync).toHaveBeenCalled(), {
    timeout: SPLASH_WARTET_HOECHSTENS_MS + 2000,
    interval: 100,
  });
});

it('wartet nicht laenger als noetig: gelesene Einstellungen geben sofort frei', async () => {
  AsyncStorage.getItem = (() =>
    Promise.resolve(JSON.stringify({ language: 'de' }))) as typeof AsyncStorage.getItem;

  await zeigeSplash();

  // Ohne Zeitreise und lange vor dem Notausgang oben.
  await waitFor(() => expect(hideAsync).toHaveBeenCalled(), { timeout: 1000 });
});

/**
 * Review-Fund: der Zweig `if (animate && reducedMotion) return null;` war
 * ungetestet — weder der "normale" Weg (Einstellungen da) noch der
 * Notausgang-Weg (Speicher antwortet nicht) prüften "Bewegung reduzieren".
 */
it('zeigt bei "Bewegung reduzieren" keine Ausblende-Animation mehr, sobald der Splash freigegeben wird', async () => {
  reducedMotionMock.mockReturnValue(true);
  AsyncStorage.getItem = (() =>
    Promise.resolve(JSON.stringify({ language: 'de' }))) as typeof AsyncStorage.getItem;

  await zeigeSplash();
  await waitFor(() => expect(hideAsync).toHaveBeenCalled(), { timeout: 1000 });

  // `animate` wird erst NACH hideAsync() gesetzt (s. animated-icon.tsx) — bis
  // dahin abwarten, statt direkt nach hideAsync auf das Verschwinden zu
  // pruefen (sonst raeumt der Test zu frueh gegen einen Zwischenzustand).
  await waitFor(() => expect(screen.queryByTestId('splash-overlay')).toBeNull());
});

/**
 * Review-Fund: kein Test deckte ab, dass der Abbau der Komponente VOR dem
 * Eintreffen der Einstellungen keinen weiteren Zustand mehr setzt ("Can't
 * perform a React state update on an unmounted component"). Der riskante
 * Moment ist der Notausgang-Pfad: `hideAsync()` bereits angestossen, aber
 * noch nicht aufgeloest, wenn der Screen verschwindet.
 */
it('setzt nach dem Abbau keinen Zustand mehr, waehrend hideAsync() noch offen ist', async () => {
  // Objekt statt einfachem `let`: eine Zuweisung innerhalb der verschachtelten
  // Promise-Callback-Funktion narrowt eine lokale `let`-Variable in TS auf
  // ihren Ausgangswert (null) zurueck — ueber eine Objekteigenschaft nicht.
  const halter: { fertig: (() => void) | null } = { fertig: null };
  hideAsync.mockImplementation(
    () =>
      new Promise<void>((fertig) => {
        halter.fertig = fertig;
      }),
  );
  AsyncStorage.getItem = (() =>
    Promise.resolve(JSON.stringify({ language: 'de' }))) as typeof AsyncStorage.getItem;
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  try {
    const view = await render(
      <SettingsProvider>
        <AnimatedSplashOverlay />
      </SettingsProvider>,
    );
    fireEvent(view.getByTestId('splash-overlay'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 1080, height: 2400 } },
    });
    await waitFor(() => expect(hideAsync).toHaveBeenCalled());

    view.unmount();
    halter.fertig?.();
    await kurzWarten();

    // Keinerlei console.error danach — insbesondere keine React-Warnung ueber
    // ein Zustands-Update ausserhalb von act() (das Signal fuer "State-Update
    // auf einer abgebauten Komponente" in dieser React-Fassung).
    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    consoleError.mockRestore();
  }
});
