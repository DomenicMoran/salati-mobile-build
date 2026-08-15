/**
 * Berechtigungs-Vorabdialoge — Apple-Ablehnung der Version 1.33.0
 * (Guideline 5.1.1(iv), Legal - Privacy - Data Collection and Storage).
 *
 * Apple beanstandete zwei Dinge an den eigenen Erklärungen, die VOR einer
 * Systemabfrage stehen:
 *   1. Der Knopf hieß „Kamerazugriff erlauben" — er darf den Wortlaut des
 *      Systemdialogs nicht vorwegnehmen („Continue"/„Next" verlangt Apple).
 *   2. Der Knopf im Standort-Schritt des Onboardings führte am Systemdialog
 *      vorbei zum nächsten Schritt — nach der eigenen Erklärung MUSS die
 *      Systemabfrage folgen.
 *
 * Dieser Test hält beides fest:
 *   (a) Kein Knopf, der vor einer Systemabfrage steht, trägt in einer der 14
 *       Sprachen eine „erlauben"/„aktivieren"-Formulierung.
 *   (b) Genau dieser Knopf löst die Systemabfrage aus — in allen vier Screens
 *       mit eigener Erklärung (Halal-Scanner, TV-Verbindung, Qibla-AR,
 *       Onboarding: Standort UND Benachrichtigungen).
 *
 * Ausdrücklich NICHT betroffen: der Fall `canAskAgain === false`. Dort zeigt
 * das System keinen Dialog mehr, dort ist „Systemeinstellungen öffnen" die
 * einzig richtige Beschriftung — auch das wird hier geprüft, damit die Fixes
 * aus Audit 2026-07-27 (N9/U5) nicht wieder verloren gehen.
 *
 * Der Test liegt unter src/__tests__ und NICHT neben den Screens: expo-router
 * zieht jede Datei unter src/app per require.context als Route ins Bundle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import HalalScannerScreen from '@/app/halal-scanner';
import OnboardingScreen from '@/app/onboarding';
import TvConnectScreen from '@/app/tv-connect';
import QiblaArView from '@/components/qibla-ar-view';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { SUPPORTED_LOCALES } from '@/lib/locale-detect';
import { translate } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// `mock`-Präfix ist Pflicht: nur so dürfen die jest.mock-Fabriken darauf
// zugreifen (Hoisting).
const mockRequestCameraPermission = jest.fn().mockResolvedValue({ granted: true });
let mockCameraPermission: { granted: boolean; canAskAgain: boolean } | null = {
  granted: false,
  canAskAgain: true,
};

jest.mock('expo-camera', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    CameraView: View,
    useCameraPermissions: () => [mockCameraPermission, mockRequestCameraPermission],
  };
});

const mockRequestForegroundPermissions = jest
  .fn()
  .mockResolvedValue({ status: 'denied', canAskAgain: true });

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissions(...args),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
  Accuracy: { Balanced: 3 },
}));

const mockRequestNotificationPermission = jest.fn().mockResolvedValue(false);

jest.mock('@/features/prayer-times/notifications', () => ({
  requestNotificationPermission: (...args: unknown[]) => mockRequestNotificationPermission(...args),
}));

// Ohne Dateisystem: der Offline-Schritt des Onboardings fragt beim Mounten den
// Modellstatus ab. Nur die dateisystemnahen Funktionen ersetzen — der
// Einstellungs-Store nutzt aus demselben Modul `setRecitationModel`.
jest.mock('@/features/hifz/whisperModel', () => ({
  ...(jest.requireActual('@/features/hifz/whisperModel') as object),
  istWhisperModellHeruntergeladen: jest.fn().mockResolvedValue(false),
  whisperModellHerunterladen: jest.fn().mockResolvedValue(undefined),
}));

// Kein Netz im Test: die Stadtsuche des Standort-Schritts.
jest.mock('@/features/location/nominatim', () => ({
  searchCity: jest.fn().mockResolvedValue([]),
  nominatimResultToLocation: jest.fn().mockReturnValue(null),
}));

jest.mock('@/features/onboarding/flag', () => ({
  markOnboardingDone: jest.fn().mockResolvedValue(undefined),
}));

// Die LAN-Kopplung des TV-Screens hängt an react-native-tcp-socket — für die
// Berechtigungs-Ansicht irrelevant.
jest.mock('@/features/tv/pairing-client', () => ({
  parsePairPayload: jest.fn().mockReturnValue(null),
  useTvConnection: () => ({
    status: 'idle',
    tvName: null,
    quiz: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    nav: jest.fn(),
    key: jest.fn(),
    answerQuiz: jest.fn(),
  }),
}));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react') as typeof import('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

const t = (key: string) => translate('de', key);

function Wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockCameraPermission = { granted: false, canAskAgain: true };
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }),
  );
});

// ---------------------------------------------------------------------------
// (a) Wortlaut in allen 14 Sprachen
// ---------------------------------------------------------------------------

/**
 * Wörter, die den Systemdialog vorwegnehmen („erlauben", „aktivieren",
 * „Zugriff gewähren") — je Sprache, kleingeschrieben verglichen. Genau diese
 * Formulierungen hat Apple beanstandet.
 */
const VERBOTEN: Record<string, string[]> = {
  de: ['erlaub', 'zulass', 'gewähr', 'aktivier', 'freigab'],
  en: ['allow', 'grant', 'enable', 'permit'],
  fr: ['autoris', 'activer', 'permettre'],
  es: ['permit', 'activar'],
  tr: ['izin', 'etkinleştir'],
  ar: ['السماح', 'اسمح', 'تفعيل', 'إذن'],
  fa: ['اجازه', 'فعال'],
  ur: ['اجازت', 'فعال'],
  ps: ['اجازه', 'فعال'],
  bn: ['অনুমতি', 'চালু'],
  id: ['izinkan', 'aktifkan'],
  ms: ['benarkan', 'izinkan', 'aktifkan'],
  ru: ['разреш', 'включ'],
  sw: ['ruhusu', 'washa'],
};

/**
 * Die Beschriftungen, die vor einer Systemabfrage stehen können.
 * `common.openSettings` fehlt hier bewusst: dieser Knopf steht NUR, wenn keine
 * Systemabfrage mehr kommt (canAskAgain === false).
 */
const VORAB_KNOPF_KEYS = ['common.continue', 'onboarding.next', 'common.useLocation'];

/** Schlüssel, die mit der Apple-Ablehnung entfallen sind. */
const ENTFERNTE_KEYS = [
  'scanner.grantPermission',
  'tvRemote.allowCamera',
  'qibla.ar.grantCamera',
  'onboarding.notifEnable',
  'onboarding.continue',
  'onboarding.later',
];

describe('(a) Beschriftung der Vorab-Knöpfe', () => {
  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale}: kein Vorab-Knopf sagt „erlauben"/„aktivieren"`, () => {
      const verboten = VERBOTEN[locale];
      // Fehlt die Sprache in der Liste, prüft der Test nichts — das wäre still
      // grün und damit wertlos.
      expect(verboten).toBeDefined();
      const treffer = VORAB_KNOPF_KEYS.flatMap((key) => {
        const wert = translate(locale, key).toLowerCase();
        return verboten!.filter((wort) => wert.includes(wort)).map((wort) => `${key}: ${wort}`);
      });
      expect(treffer).toEqual([]);
    });

    it(`${locale}: die beanstandeten Schlüssel existieren nicht mehr`, () => {
      for (const key of ENTFERNTE_KEYS) {
        // translate() gibt bei fehlendem Schlüssel den Schlüssel selbst zurück.
        expect(translate(locale, key)).toBe(key);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// (b) Der Vorab-Knopf löst die Systemabfrage aus
// ---------------------------------------------------------------------------

describe('(b) Kamera-Screens: Knopf führt zur Systemabfrage', () => {
  it('Halal-Scanner fragt die Kamera-Berechtigung an', async () => {
    await render(<HalalScannerScreen />, { wrapper: Wrapper });
    const knopf = await screen.findByText(t('common.continue'));
    fireEvent.press(knopf);
    expect(mockRequestCameraPermission).toHaveBeenCalled();
  });

  it('Halal-Scanner führt bei dauerhaft verweigerter Kamera in die Systemeinstellungen', async () => {
    mockCameraPermission = { granted: false, canAskAgain: false };
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await render(<HalalScannerScreen />, { wrapper: Wrapper });
    expect(screen.queryByText(t('common.continue'))).toBeNull();
    fireEvent.press(await screen.findByText(t('common.openSettings')));
    expect(openSettings).toHaveBeenCalled();
    expect(mockRequestCameraPermission).not.toHaveBeenCalled();
    openSettings.mockRestore();
  });

  it('TV-Verbindung fragt die Kamera-Berechtigung an', async () => {
    await render(<TvConnectScreen />, { wrapper: Wrapper });
    // Der Erklärtext steht weiterhin vor der Abfrage — nur der Knopf ist neutral.
    expect(screen.getByText(t('tvRemote.permissionBody'))).toBeTruthy();
    fireEvent.press(await screen.findByText(t('common.continue')));
    expect(mockRequestCameraPermission).toHaveBeenCalled();
  });

  it('Qibla-AR fragt die Kamera-Berechtigung an', async () => {
    await render(
      <QiblaArView heading={0} bearing={0} available needsCalibration={false} onClose={jest.fn()} />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText(t('qibla.ar.permissionBody'))).toBeTruthy();
    fireEvent.press(await screen.findByText(t('common.continue')));
    expect(mockRequestCameraPermission).toHaveBeenCalled();
  });
});

describe('(b) Onboarding: „Weiter" überspringt keine Systemabfrage', () => {
  /** Rendert das Onboarding und geht vom Willkommens- zum Standort-Schritt. */
  async function bisStandortSchritt() {
    await render(<OnboardingScreen />, { wrapper: Wrapper });
    fireEvent.press(await screen.findByText(t('onboarding.next')));
    await waitFor(() => expect(screen.getByText(t('onboarding.locationTitle'))).toBeTruthy());
  }

  it('löst im Standort-Schritt die Standort-Abfrage aus, bevor es weitergeht', async () => {
    await bisStandortSchritt();
    expect(mockRequestForegroundPermissions).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText(t('onboarding.next')));
    await waitFor(() => expect(mockRequestForegroundPermissions).toHaveBeenCalled());
    // Und danach geht es weiter — auch bei Ablehnung (Schritt 3: Methode).
    await waitFor(() => expect(screen.getByText(t('onboarding.methodTitle'))).toBeTruthy());
  });

  it('bietet im Standort-Schritt keinen Knopf, der die Abfrage wegdrückt', async () => {
    await bisStandortSchritt();
    // Der frühere „Später"-Ausweg ist entfernt (der Schlüssel existiert nicht
    // mehr, s. oben) — als getrennter Weg bleiben die Stadtsuche auf demselben
    // Schritt und „Überspringen" in der Kopfzeile.
    expect(screen.queryByText('Später')).toBeNull();
    expect(screen.getByPlaceholderText(t('settings.searchCity'))).toBeTruthy();
    expect(screen.getByText(t('onboarding.skip'))).toBeTruthy();
  });

  it('löst im Benachrichtigungs-Schritt die Benachrichtigungs-Abfrage aus', async () => {
    await bisStandortSchritt();
    // Standort-Schritt → Methode → Benachrichtigungen.
    fireEvent.press(screen.getByText(t('onboarding.next')));
    await waitFor(() => expect(screen.getByText(t('onboarding.methodTitle'))).toBeTruthy());
    fireEvent.press(screen.getByText(t('onboarding.next')));
    await waitFor(() => expect(screen.getByText(t('onboarding.notifTitle'))).toBeTruthy());

    expect(mockRequestNotificationPermission).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(t('onboarding.next')));
    await waitFor(() => expect(mockRequestNotificationPermission).toHaveBeenCalled());
  });
});
