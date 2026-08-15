import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

import { checkForOtaUpdate, isDueForCheck, OTA_LAST_CHECK_KEY } from './otaUpdate';

// expo-updates ist ein natives Modul — in Jest gibt es keine Implementierung.
// isEnabled ist per Default true, damit die Tagesgrenze überhaupt geprüft wird;
// einzelne Tests überschreiben es.
jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

const mockUpdates = Updates as jest.Mocked<typeof Updates>;

const TAG = 24 * 60 * 60 * 1000;
const JETZT = 1_800_000_000_000;

describe('isDueForCheck', () => {
  it('prüft beim allerersten Start', () => {
    expect(isDueForCheck(null, JETZT)).toBe(true);
  });

  it('prüft nicht erneut innerhalb von 24 Stunden', () => {
    expect(isDueForCheck(JETZT - TAG + 1, JETZT)).toBe(false);
  });

  it('prüft nach 24 Stunden wieder', () => {
    expect(isDueForCheck(JETZT - TAG, JETZT)).toBe(true);
  });

  it('prüft bei zurückgestellter Geräteuhr statt bis zu einem Tag zu blockieren', () => {
    expect(isDueForCheck(JETZT + TAG, JETZT)).toBe(true);
  });

  it('prüft bei kaputtem gespeichertem Wert', () => {
    expect(isDueForCheck(Number.NaN, JETZT)).toBe(true);
  });
});

describe('checkForOtaUpdate', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Date, 'now').mockReturnValue(JETZT);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lädt ein verfügbares Update und meldet es als startbereit', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true, isRollBackToEmbedded: false } as never);
    mockUpdates.fetchUpdateAsync.mockResolvedValue({ isNew: true, isRollBackToEmbedded: false } as never);

    await expect(checkForOtaUpdate()).resolves.toBe('ready');
    expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('lädt nichts, wenn kein Update vorliegt', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: false } as never);

    await expect(checkForOtaUpdate()).resolves.toBe('up-to-date');
    expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('prüft am selben Tag kein zweites Mal', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: false } as never);

    await checkForOtaUpdate();
    await expect(checkForOtaUpdate()).resolves.toBe('skipped');
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('ignoriert die Tagesgrenze bei einem manuellen Aufruf (force)', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: false } as never);

    await checkForOtaUpdate();
    await expect(checkForOtaUpdate({ force: true })).resolves.toBe('up-to-date');
    expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(2);
  });

  it('merkt sich einen fehlgeschlagenen Versuch NICHT (ohne Netz gleich neu prüfen dürfen)', async () => {
    mockUpdates.checkForUpdateAsync.mockRejectedValue(new Error('offline'));

    await expect(checkForOtaUpdate()).resolves.toBe('failed');
    await expect(AsyncStorage.getItem(OTA_LAST_CHECK_KEY)).resolves.toBeNull();
  });

  it('tut nichts, wenn expo-updates im Build nicht aktiv ist', async () => {
    // @ts-expect-error -- readonly Konstante, im Mock bewusst überschrieben
    mockUpdates.isEnabled = false;
    try {
      await expect(checkForOtaUpdate({ force: true })).resolves.toBe('skipped');
      expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
    } finally {
      // @ts-expect-error -- s. o.
      mockUpdates.isEnabled = true;
    }
  });
});
