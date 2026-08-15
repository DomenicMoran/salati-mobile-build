import { Platform } from 'react-native';

import {
  buildIftarReminderContent,
  buildSuhoorAlarmContent,
  computeSuhoorAlarmTime,
  hijriCalibrationShift,
  isRamadanDay,
  localDayKey,
  rescheduleRamadanReminders,
} from './suhoorAlarm';
import { SUPPORTED_LOCALES } from '@/lib/locale-detect';

const mockSchedule = jest.fn().mockResolvedValue('id');
const mockGetAllScheduled = jest.fn().mockResolvedValue([]);
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockSetChannel = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  getAllScheduledNotificationsAsync: (...args: unknown[]) => mockGetAllScheduled(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...args),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { MAX: 5, DEFAULT: 3 },
  AndroidAudioUsage: { ALARM: 4 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  AndroidNotificationPriority: { MAX: 5, LOW: 2 },
}));

// Der tabellarische Offline-Kalender (features/calendar/offline.ts) legt
// Ramadan 1448 auf den 09.02.2027 – 08.03.2027; 08.02.2027 ist dort noch
// Schaʿbān 29. Diese Daten sind die Grundlage aller Fälle unten.
const RAMADAN_DAY = new Date(2027, 1, 10); // 10.02.2027 = 9/2
const BEFORE_RAMADAN = new Date(2027, 1, 8); // 08.02.2027 = 8/29
const TIMINGS = {
  Fajr: '05:20',
  Sunrise: '07:10',
  Dhuhr: '12:30',
  Asr: '15:10',
  Maghrib: '17:45',
  Isha: '19:15',
};

const ALL_ON = { suhoorEnabled: true, suhoorLead: 45 as const, iftarEnabled: true };

function suhoorCalls() {
  return mockSchedule.mock.calls.filter((c) => (c[0].identifier as string).startsWith('suhoor-'));
}
function iftarCalls() {
  return mockSchedule.mock.calls.filter((c) => (c[0].identifier as string).startsWith('iftar-'));
}

beforeEach(() => {
  mockSchedule.mockClear();
  mockCancel.mockClear();
  mockSetChannel.mockClear();
  mockGetAllScheduled.mockResolvedValue([]);
});

describe('Weckzeit-Berechnung', () => {
  test('liegt exakt den gewählten Vorlauf vor Fadschr', () => {
    const fajr = new Date(2027, 1, 10, 5, 20);
    expect(computeSuhoorAlarmTime(fajr, 45).getHours()).toBe(4);
    expect(computeSuhoorAlarmTime(fajr, 45).getMinutes()).toBe(35);
    expect(computeSuhoorAlarmTime(fajr, 90).getHours()).toBe(3);
    expect(computeSuhoorAlarmTime(fajr, 90).getMinutes()).toBe(50);
  });

  test('auch in den Nächten der Zeitumstellung bleibt der Abstand echte Minuten', () => {
    // Zeitzonen-unabhängig formuliert: der Abstand ist eine Eigenschaft der
    // Zeitachse, nicht der Wanduhr — genau darum rechnet die Funktion in
    // Millisekunden statt in lokalen Stunden-/Minuten-Feldern. Die Daten sind
    // Umstellungstage in Europa (29.03./25.10.) bzw. den USA (08.03./01.11.).
    for (const day of [
      new Date(2026, 2, 29),
      new Date(2026, 9, 25),
      new Date(2026, 2, 8),
      new Date(2026, 10, 1),
    ]) {
      for (const lead of [30, 45, 60, 90] as const) {
        const fajr = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 5, 20);
        expect(fajr.getTime() - computeSuhoorAlarmTime(fajr, lead).getTime()).toBe(lead * 60_000);
      }
    }
  });

  test('sehr frühes Fadschr schiebt den Wecker auf den Vortag', () => {
    const fajr = new Date(2027, 1, 10, 0, 20);
    const alarm = computeSuhoorAlarmTime(fajr, 60);
    expect(alarm.getDate()).toBe(9);
    expect(alarm.getHours()).toBe(23);
    expect(alarm.getMinutes()).toBe(20);
  });
});

describe('Tagesschlüssel', () => {
  test('folgt dem LOKALEN Kalendertag, nicht UTC', () => {
    // Ein UTC-Schlüssel (toISOString) kippt östlich/westlich von Greenwich um
    // einen Tag — zwei Ramadan-Nächte teilten sich dann einen Identifier und
    // die zweite Planung überschriebe die erste.
    expect(localDayKey(new Date(2027, 1, 9, 23, 20))).toBe('2027-02-09');
    expect(localDayKey(new Date(2027, 1, 10, 0, 20))).toBe('2027-02-10');
    expect(localDayKey(new Date(2027, 0, 1, 0, 5))).toBe('2027-01-01');
    expect(localDayKey(new Date(2027, 11, 31, 23, 55))).toBe('2027-12-31');
  });
});

describe('Ramadan-Erkennung folgt dem Kalender der App', () => {
  test('ohne API-Datum kein Versatz', () => {
    expect(hijriCalibrationShift(new Date(2027, 1, 10), undefined)).toBe(0);
    expect(isRamadanDay(RAMADAN_DAY, 0)).toBe(true);
    expect(isRamadanDay(BEFORE_RAMADAN, 0)).toBe(false);
  });

  test('zeigt die App Ramadan einen Tag früher, wandert die Erkennung mit', () => {
    // API/App: 08.02.2027 ist bereits 1 Ramadan.
    const hijri = { day: '1', month: { number: '9', en: 'Ramadan' }, year: '1448' };
    const shift = hijriCalibrationShift(new Date(2027, 1, 8), hijri);
    expect(shift).toBe(1);
    expect(isRamadanDay(BEFORE_RAMADAN, shift)).toBe(true);
    // ... und der Monat endet dann auch einen Tag früher.
    expect(isRamadanDay(new Date(2027, 2, 8), shift)).toBe(false);
    expect(isRamadanDay(new Date(2027, 2, 7), shift)).toBe(true);
  });

  test('unplausibles API-Datum wird ignoriert statt blind verschoben', () => {
    const hijri = { day: '17', month: { number: '3', en: 'Rabi al-Awwal' }, year: '1448' };
    expect(hijriCalibrationShift(new Date(2027, 1, 8), hijri)).toBe(0);
  });
});

describe('Planung', () => {
  test('plant Suhur-Wecker und Iftar-Hinweis nur an Ramadan-Tagen', async () => {
    const days = [
      { date: BEFORE_RAMADAN, timings: TIMINGS },
      { date: new Date(2027, 1, 9), timings: TIMINGS },
      { date: RAMADAN_DAY, timings: TIMINGS },
    ];
    await rescheduleRamadanReminders(days, ALL_ON, undefined, new Date(2027, 1, 8, 0, 0), 'de', '24h');

    expect(suhoorCalls().map((c) => c[0].identifier)).toEqual(['suhoor-2027-02-09', 'suhoor-2027-02-10']);
    expect(iftarCalls().map((c) => c[0].identifier)).toEqual(['iftar-2027-02-09', 'iftar-2027-02-10']);
  });

  test('Wecker steht 45 Minuten vor Fadschr, Iftar-Hinweis 15 Minuten vor Maghrib', async () => {
    await rescheduleRamadanReminders(
      [{ date: RAMADAN_DAY, timings: TIMINGS }],
      ALL_ON,
      undefined,
      new Date(2027, 1, 9),
      'de',
      '24h',
    );
    const alarm = suhoorCalls()[0]![0].trigger.date as Date;
    expect(alarm.getHours()).toBe(4);
    expect(alarm.getMinutes()).toBe(35);
    const iftar = iftarCalls()[0]![0].trigger.date as Date;
    expect(iftar.getHours()).toBe(17);
    expect(iftar.getMinutes()).toBe(30);
  });

  test('Fadschr kurz nach Mitternacht: Identifier trägt den Tag des Weckers, nicht des Gebets', async () => {
    await rescheduleRamadanReminders(
      [{ date: RAMADAN_DAY, timings: { ...TIMINGS, Fajr: '00:20' } }],
      { ...ALL_ON, suhoorLead: 60 },
      undefined,
      new Date(2027, 1, 9, 12, 0),
      'de',
      '24h',
    );
    expect(suhoorCalls()[0]![0].identifier).toBe('suhoor-2027-02-09');
  });

  test('bereits vergangene Weckzeiten werden nicht geplant', async () => {
    await rescheduleRamadanReminders(
      [{ date: RAMADAN_DAY, timings: TIMINGS }],
      ALL_ON,
      undefined,
      new Date(2027, 1, 10, 5, 0), // schon nach 04:35, aber vor Maghrib
      'de',
      '24h',
    );
    expect(suhoorCalls()).toHaveLength(0);
    expect(iftarCalls()).toHaveLength(1);
  });

  test('ausgeschaltet: alte Planungen werden entfernt, keine neuen angelegt', async () => {
    mockGetAllScheduled.mockResolvedValue([
      { identifier: 'suhoor-2027-02-09' },
      { identifier: 'iftar-2027-02-09' },
      { identifier: 'prayer-2027-02-09-Fajr' },
    ]);
    await rescheduleRamadanReminders(
      [{ date: RAMADAN_DAY, timings: TIMINGS }],
      { suhoorEnabled: false, suhoorLead: 45, iftarEnabled: false },
      undefined,
      new Date(2027, 1, 9),
      'de',
      '24h',
    );
    expect(mockCancel.mock.calls.map((c) => c[0])).toEqual(['suhoor-2027-02-09', 'iftar-2027-02-09']);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  test('nur der Iftar-Hinweis an: kein Wecker', async () => {
    await rescheduleRamadanReminders(
      [{ date: RAMADAN_DAY, timings: TIMINGS }],
      { suhoorEnabled: false, suhoorLead: 45, iftarEnabled: true },
      undefined,
      new Date(2027, 1, 9),
      'de',
      '24h',
    );
    expect(suhoorCalls()).toHaveLength(0);
    expect(iftarCalls()).toHaveLength(1);
  });

  test('Android: Wecker läuft über einen eigenen Channel mit Alarm-Lautstärke', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    try {
      await rescheduleRamadanReminders(
        [{ date: RAMADAN_DAY, timings: TIMINGS }],
        ALL_ON,
        undefined,
        new Date(2027, 1, 9),
        'de',
        '24h',
      );
      const suhoorChannel = mockSetChannel.mock.calls.find((c) => c[0] === 'ramadan-suhoor-alarm');
      expect(suhoorChannel).toBeDefined();
      expect(suhoorChannel![1].audioAttributes.usage).toBe(4); // AndroidAudioUsage.ALARM
      expect(suhoorChannel![1].importance).toBe(5);
      // "Bitte nicht stören" wird NICHT umgangen (bräuchte eine eigene Freigabe).
      expect(suhoorChannel![1].bypassDnd).toBe(false);
      expect(suhoorCalls()[0]![0].trigger.channelId).toBe('ramadan-suhoor-alarm');
      expect(iftarCalls()[0]![0].trigger.channelId).toBe('ramadan-iftar');
    } finally {
      Object.defineProperty(Platform, 'OS', { get: () => original });
    }
  });

  test('Web: keine Planung (kein Scheduling-Support)', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => 'web' });
    try {
      await rescheduleRamadanReminders(
        [{ date: RAMADAN_DAY, timings: TIMINGS }],
        ALL_ON,
        undefined,
        new Date(2027, 1, 9),
        'de',
        '24h',
      );
      expect(mockSchedule).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { get: () => original });
    }
  });
});

describe('Texte', () => {
  test('Platzhalter werden ersetzt', () => {
    const { title, body } = buildSuhoorAlarmContent('04:15', 45, 'de');
    expect(title).not.toContain('{');
    expect(body).toContain('45');
    expect(body).toContain('04:15');
    const iftar = buildIftarReminderContent('17:45', 'de');
    expect(iftar.body).toContain('17:45');
    expect(iftar.body).toContain('15');
  });

  test('alle 14 App-Sprachen haben eigene Texte (kein stiller Deutsch-Fallback)', () => {
    const deSuhoor = buildSuhoorAlarmContent('04:15', 45, 'de');
    const deIftar = buildIftarReminderContent('17:45', 'de');
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'de') continue;
      expect(buildSuhoorAlarmContent('04:15', 45, locale).title).not.toBe(deSuhoor.title);
      expect(buildIftarReminderContent('17:45', locale).title).not.toBe(deIftar.title);
    }
  });
});
