import { Platform } from 'react-native';

import { effectiveAzan, prayerChannelId, rescheduleNotifications } from './notifications';
import type { NotificationPrefs, NotificationToggles } from '@/features/settings/types';

// jest hoisted: jest.mock() laeuft vor allen Imports oben, unabhaengig von
// der Quelltext-Reihenfolge (babel-plugin-jest-hoist) - Deklaration hier
// unten haelt import/first zufrieden, ohne die Hoisting-Semantik zu aendern.
const mockSchedule = jest.fn().mockResolvedValue('id');
const mockGetAllScheduled = jest.fn().mockResolvedValue([]);
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockSetChannel = jest.fn().mockResolvedValue(undefined);
const mockGetChannels = jest.fn().mockResolvedValue([]);
const mockDeleteChannel = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  getAllScheduledNotificationsAsync: (...args: unknown[]) => mockGetAllScheduled(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...args),
  getNotificationChannelsAsync: (...args: unknown[]) => mockGetChannels(...args),
  deleteNotificationChannelAsync: (...args: unknown[]) => mockDeleteChannel(...args),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { MAX: 5, DEFAULT: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  AndroidNotificationPriority: { LOW: 2 },
}));

const ENABLED: NotificationToggles = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
const PREFS: NotificationPrefs = {
  sound: true,
  vibrate: true,
  headsUp: false,
  ongoingCountdown: false,
  liveActivity: false,
};

describe('rescheduleNotifications — Uhrzeit in Titel/Body (Nutzerfund)', () => {
  beforeEach(() => {
    mockSchedule.mockClear();
  });

  test('Titel und Body enthalten die formatierte Gebetszeit (24h)', async () => {
    const day = { date: new Date('2026-07-18T00:00:00'), timings: { Fajr: '04:15', Sunrise: '05:50', Dhuhr: '13:05', Asr: '16:40', Maghrib: '20:10', Isha: '21:45' } };
    await rescheduleNotifications([day], ENABLED, PREFS, new Date('2026-07-17T00:00:00'), 'de', '24h');

    const fajrCall = mockSchedule.mock.calls.find((c) => (c[0].identifier as string).endsWith('-Fajr'));
    expect(fajrCall).toBeDefined();
    expect(fajrCall![0].content.title).toContain('04:15');
    expect(fajrCall![0].content.body).toContain('04:15');
  });

  test('Titel und Body enthalten die formatierte Gebetszeit (12h)', async () => {
    const day = { date: new Date('2026-07-18T00:00:00'), timings: { Fajr: '04:15', Sunrise: '05:50', Dhuhr: '13:05', Asr: '16:40', Maghrib: '20:10', Isha: '21:45' } };
    await rescheduleNotifications([day], ENABLED, PREFS, new Date('2026-07-17T00:00:00'), 'de', '12h');

    const dhuhrCall = mockSchedule.mock.calls.find((c) => (c[0].identifier as string).endsWith('-Dhuhr'));
    expect(dhuhrCall).toBeDefined();
    expect(dhuhrCall![0].content.title).toContain('1:05');
    expect(dhuhrCall![0].content.body).toContain('1:05');
  });

  test('kein {time}-Platzhalter bleibt uneingesetzt stehen', async () => {
    const day = { date: new Date('2026-07-18T00:00:00'), timings: { Fajr: '04:15', Sunrise: '05:50', Dhuhr: '13:05', Asr: '16:40', Maghrib: '20:10', Isha: '21:45' } };
    await rescheduleNotifications([day], ENABLED, PREFS, new Date('2026-07-17T00:00:00'), 'de', '24h');

    for (const call of mockSchedule.mock.calls) {
      expect(call[0].content.title).not.toContain('{time}');
      expect(call[0].content.body).not.toContain('{time}');
      expect(call[0].content.title).not.toContain('{p}');
      expect(call[0].content.body).not.toContain('{p}');
    }
  });

  test('Web: kein Scheduling-Aufruf (kein Support, s. Kommentar in notifications.ts)', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => 'web' });
    const day = { date: new Date('2026-07-18T00:00:00'), timings: { Fajr: '04:15', Sunrise: '05:50', Dhuhr: '13:05', Asr: '16:40', Maghrib: '20:10', Isha: '21:45' } };
    await rescheduleNotifications([day], ENABLED, PREFS, new Date('2026-07-17T00:00:00'), 'de', '24h');
    expect(mockSchedule).not.toHaveBeenCalled();
    Object.defineProperty(Platform, 'OS', { get: () => original });
  });
});

describe('Adhan als Benachrichtigungston', () => {
  const DAY = {
    date: new Date('2026-07-18T00:00:00'),
    timings: { Fajr: '04:15', Sunrise: '05:50', Dhuhr: '13:05', Asr: '16:40', Maghrib: '20:10', Isha: '21:45' },
  };
  const NOW = new Date('2026-07-17T00:00:00');

  function withPlatform(os: string, run: () => Promise<void>): Promise<void> {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => os });
    return run().finally(() => Object.defineProperty(Platform, 'OS', { get: () => original }));
  }

  beforeEach(() => {
    mockSchedule.mockClear();
    mockSetChannel.mockClear();
    mockDeleteChannel.mockClear();
    mockGetChannels.mockResolvedValue([]);
  });

  test('Ton-Wahl steckt in der Channel-ID — ein bestehender Channel wird nie umkonfiguriert', () => {
    expect(prayerChannelId(PREFS)).toBe('prayer-s1v1h0');
    // Ohne Adhan exakt die ALTE ID: bestehende Nutzer behalten ihren Channel.
    expect(prayerChannelId(PREFS, 'default')).toBe('prayer-s1v1h0');
    expect(prayerChannelId(PREFS, 'fajr')).toBe('prayer-s1v1h0-fajr');
  });

  test('Ton-Schalter aus ⇒ kein Adhan, egal was gewählt ist', () => {
    expect(effectiveAzan({ ...PREFS, sound: false }, true, 'fajr')).toBe('default');
    expect(effectiveAzan(PREFS, false, 'fajr')).toBe('default');
    expect(effectiveAzan(PREFS, true, 'fajr')).toBe('fajr');
  });

  test('Android: je Gebet eigener Channel mit der vollen MP3 als Raw-Resource', async () => {
    await withPlatform('android', async () => {
      await rescheduleNotifications([DAY], ENABLED, PREFS, NOW, 'de', '24h', {
        enabled: true,
        choices: { fajr: 'fajr', dhuhr: 'adhan1', asr: 'adhan1', maghrib: 'adhan1', isha: 'default' },
      });

      const channelSounds = Object.fromEntries(
        mockSetChannel.mock.calls.map((c) => [c[0] as string, (c[1] as { sound?: unknown }).sound]),
      );
      // Basis-Channel (Standardton) + je gewähltem Adhan genau einer.
      expect(channelSounds['prayer-s1v1h0']).toBeUndefined();
      expect(channelSounds['prayer-s1v1h0-fajr']).toBe('assets_audio_azan_fajr.mp3');
      expect(channelSounds['prayer-s1v1h0-adhan1']).toBe('assets_audio_azan_adhan1.mp3');
      expect(Object.keys(channelSounds).sort()).toEqual([
        'prayer-s1v1h0',
        'prayer-s1v1h0-adhan1',
        'prayer-s1v1h0-fajr',
      ]);

      const fajr = mockSchedule.mock.calls.find((c) => (c[0].identifier as string).endsWith('-Fajr'));
      expect(fajr![0].trigger.channelId).toBe('prayer-s1v1h0-fajr');
      const isha = mockSchedule.mock.calls.find((c) => (c[0].identifier as string).endsWith('-Isha'));
      expect(isha![0].trigger.channelId).toBe('prayer-s1v1h0');
    });
  });

  test('Android: verwaiste Adhan-Channels werden entfernt, der Basis-Channel nie', async () => {
    mockGetChannels.mockResolvedValue([
      { id: 'prayer-s1v1h0' },
      { id: 'prayer-s1v1h0-adhan2' }, // alte Ton-Wahl
      { id: 'prayer-s1v1h0-adhan1' }, // aktuell in Benutzung
      { id: 'ramadan-suhoor-alarm' }, // fremder Channel
    ]);
    await withPlatform('android', async () => {
      await rescheduleNotifications([DAY], ENABLED, PREFS, NOW, 'de', '24h', {
        enabled: true,
        choices: { fajr: 'adhan1', dhuhr: 'adhan1', asr: 'adhan1', maghrib: 'adhan1', isha: 'adhan1' },
      });
    });
    expect(mockDeleteChannel.mock.calls.map((c) => c[0])).toEqual(['prayer-s1v1h0-adhan2']);
  });

  test('iOS: Ton kommt als < 30-s-Schnitt aus dem App-Bundle, nicht als MP3', async () => {
    await withPlatform('ios', async () => {
      await rescheduleNotifications([DAY], ENABLED, PREFS, NOW, 'de', '24h', {
        enabled: true,
        choices: { fajr: 'fajr', dhuhr: 'adhan2', asr: 'adhan2', maghrib: 'adhan2', isha: 'adhan2' },
      });
      const fajr = mockSchedule.mock.calls.find((c) => (c[0].identifier as string).endsWith('-Fajr'));
      expect(fajr![0].content.sound).toBe('adhan_fajr.caf');
      expect(mockSetChannel).not.toHaveBeenCalled();
    });
  });

  test('ohne Adhan-Auswahl bleibt alles wie vorher (Standardton, ein Channel)', async () => {
    await withPlatform('android', async () => {
      await rescheduleNotifications([DAY], ENABLED, PREFS, NOW, 'de', '24h');
      expect(mockSetChannel.mock.calls.map((c) => c[0])).toEqual(['prayer-s1v1h0']);
      for (const call of mockSchedule.mock.calls) expect(call[0].content.sound).toBe(true);
    });
  });

  test('stumm gestellt: kein Ton, auch wenn ein Adhan gewählt ist', async () => {
    await withPlatform('android', async () => {
      await rescheduleNotifications([DAY], ENABLED, { ...PREFS, sound: false }, NOW, 'de', '24h', {
        enabled: true,
        choices: { fajr: 'fajr', dhuhr: 'adhan1', asr: 'adhan1', maghrib: 'adhan1', isha: 'adhan1' },
      });
      expect(mockSetChannel.mock.calls.map((c) => c[1].sound)).toEqual([null]);
      for (const call of mockSchedule.mock.calls) expect(call[0].content.sound).toBe(false);
    });
  });
});
