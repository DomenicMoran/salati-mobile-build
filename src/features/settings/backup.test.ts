import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { HIFZ_STORAGE_KEY } from '@/features/hifz/progress';
import { LEARN_PROGRESS_STORAGE_KEY } from '@/features/learn/progress';
import { OFFLINE_AUDIO_INDEX_KEY } from '@/features/quran/offline-audio';
import { QURAN_PROGRESS_STORAGE_KEY } from '@/features/quran/progress';
import { COURSE_META } from '@/features/study/courses';

import {
  applyBackupData,
  BACKUP_FORMAT_VERSION,
  MIN_SUPPORTED_BACKUP_VERSION,
  collectBackupData,
  parseBackupFile,
  readBackupFile,
  serializeBackup,
  writeBackupFile,
  type BackupData,
} from './backup';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
}));

const EMPTY_QURAN_PROGRESS = { bookmarks: [], lastRead: null, notes: [], history: [] };

describe('collectBackupData', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('liefert leere Defaults, wenn noch nirgendwo Fortschritt existiert', async () => {
    const data = await collectBackupData(1000);
    expect(data.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(data.exportedAt).toBe(1000);
    expect(data.storage).toEqual({});
    expect(data.downloadedReciters).toEqual([]);
  });

  it('sammelt echten Fortschritt aus allen betroffenen Keys', async () => {
    const tajwidKey = COURSE_META.find((c) => c.id === 'tajwid')!.storageKey;
    await AsyncStorage.multiSet([
      [LEARN_PROGRESS_STORAGE_KEY, JSON.stringify({ l1: { score: 8, total: 10, completedAt: 1 } })],
      [tajwidKey, JSON.stringify({ tj1: { score: 5, total: 5, completedAt: 2 } })],
      [HIFZ_STORAGE_KEY, JSON.stringify({ 1: { 1: 'known' } })],
      [
        QURAN_PROGRESS_STORAGE_KEY,
        JSON.stringify({ bookmarks: [{ surah: 2, ayah: 255, createdAt: 5 }], lastRead: null, notes: [], history: [] }),
      ],
      [OFFLINE_AUDIO_INDEX_KEY, JSON.stringify({ 'ar.alafasy|1': 7 })],
    ]);

    const data = await collectBackupData(2000);
    expect(JSON.parse(data.storage[LEARN_PROGRESS_STORAGE_KEY])).toEqual({
      l1: { score: 8, total: 10, completedAt: 1 },
    });
    expect(JSON.parse(data.storage[tajwidKey])).toEqual({ tj1: { score: 5, total: 5, completedAt: 2 } });
    expect(JSON.parse(data.storage[HIFZ_STORAGE_KEY])).toEqual({ 1: { 1: 'known' } });
    expect(JSON.parse(data.storage[QURAN_PROGRESS_STORAGE_KEY]).bookmarks).toEqual([
      { surah: 2, ayah: 255, createdAt: 5 },
    ]);
    // Der Download-Index selbst gehoert NICHT in die Sicherung, nur die Namen.
    expect(data.storage[OFFLINE_AUDIO_INDEX_KEY]).toBeUndefined();
    expect(data.downloadedReciters).toEqual(['ar.alafasy']);
  });

  // Das war der Kern des Befunds: die Datei sicherte NUR Lern-/Hifz-/Koran-
  // Fortschritt, der Sync-Code eine andere Auswahl. Jetzt derselbe Umfang.
  it('sichert dieselben Domaenen wie der Sync-Code — inkl. der frueher verlorenen', async () => {
    await AsyncStorage.multiSet([
      ['salatibox:prayer-qada-owed', '{"fajr":3,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}'],
      ['salatibox:qada-owed', '4'],
      ['salatibox:taraweeh', '{"2026-03-02":20}'],
      ['salatibox:journey:sabr', '{"journeyId":"sabr","startDay":"2026-01-01","completed":{}}'],
      ['salatibox:tasbih-history', '[{"day":"2026-01-01","count":100}]'],
      ['salatibox:achievements-seen', '["erste-sure"]'],
      ['salatibox:mushaf-page', '340'],
    ]);
    const { storage } = await collectBackupData(1);
    expect(Object.keys(storage).sort()).toEqual([
      'salatibox:achievements-seen',
      'salatibox:journey:sabr',
      'salatibox:mushaf-page',
      'salatibox:prayer-qada-owed',
      'salatibox:qada-owed',
      'salatibox:taraweeh',
      'salatibox:tasbih-history',
    ]);
  });
});

describe('serializeBackup / parseBackupFile roundtrip', () => {
  const sample: BackupData = {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: 12345,
    storage: {
      'salatibox:learn-progress': '{"l1":{"score":9,"total":10,"completedAt":1}}',
      'salatibox:study-tajwid': '{"tj1":{"score":5,"total":5,"completedAt":2}}',
      'salatibox:prayer-qada-owed': '{"fajr":3,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}',
    },
    downloadedReciters: ['ar.alafasy', 'ar.husary'],
  };

  it('parst ein zuvor serialisiertes Backup identisch zurück', () => {
    expect(parseBackupFile(serializeBackup(sample))).toEqual({ ok: true, data: sample });
  });
});

describe('parseBackupFile: Fehlerfälle', () => {
  it('kaputtes JSON -> invalid_json', () => {
    expect(parseBackupFile('{nope')).toEqual({ ok: false, reason: 'invalid_json' });
  });

  it('gültiges JSON, aber kein Objekt -> invalid_shape', () => {
    expect(parseBackupFile('[]')).toEqual({ ok: false, reason: 'invalid_shape' });
    expect(parseBackupFile('42')).toEqual({ ok: false, reason: 'invalid_shape' });
    expect(parseBackupFile('null')).toEqual({ ok: false, reason: 'invalid_shape' });
  });

  it('fehlendes/zu altes formatVersion-Feld -> unsupported_version', () => {
    expect(parseBackupFile(JSON.stringify({ hifzProgress: {} }))).toEqual({
      ok: false,
      reason: 'unsupported_version',
    });
    expect(parseBackupFile(JSON.stringify({ formatVersion: MIN_SUPPORTED_BACKUP_VERSION - 1 }))).toEqual({
      ok: false,
      reason: 'unsupported_version',
    });
  });

  it('zu neue Formatversion wird abgelehnt statt still falsch importiert', () => {
    expect(parseBackupFile(JSON.stringify({ formatVersion: BACKUP_FORMAT_VERSION + 1 }))).toEqual({
      ok: false,
      reason: 'unsupported_version',
    });
  });

  it('kaputte/fremde storage-Eintraege werden verworfen statt den Import abzulehnen', () => {
    const result = parseBackupFile(
      JSON.stringify({
        formatVersion: BACKUP_FORMAT_VERSION,
        storage: {
          'salatibox:qada-owed': '3',
          'salatibox:error-log': '[]', // bewusst ausgeschlossen
          'salatibox:etwas-fremdes': 'x', // unbekannt
          'salatibox:taraweeh': { kein: 'string' }, // falscher Typ
        },
        downloadedReciters: ['a', 1, null, 'b'],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data.storage).toEqual({ 'salatibox:qada-owed': '3' });
    expect(result.data.downloadedReciters).toEqual(['a', 'b']);
  });

  it('kaputtes storage-Feld faellt auf leer zurueck', () => {
    const result = parseBackupFile(JSON.stringify({ formatVersion: BACKUP_FORMAT_VERSION, storage: 'kaputt' }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data.storage).toEqual({});
  });

  it('fehlendes exportedAt bekommt einen Now-Fallback statt NaN', () => {
    const result = parseBackupFile(JSON.stringify({ formatVersion: BACKUP_FORMAT_VERSION }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(typeof result.data.exportedAt).toBe('number');
    expect(Number.isNaN(result.data.exportedAt)).toBe(false);
  });
});

// Beide Richtungen der Formatversion: eine v1-Datei (getippte Einzelfelder)
// bleibt lesbar, eine v2-Datei wird von dieser App normal gelesen.
describe('Formatversion 1 bleibt einlesbar', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  const tajwidKey = COURSE_META.find((c) => c.id === 'tajwid')!.storageKey;
  const v1File = JSON.stringify({
    formatVersion: 1,
    exportedAt: 111,
    learnProgress: { l1: { score: 8, total: 10, completedAt: 1 } },
    courseProgress: { [tajwidKey]: { tj1: { score: 5, total: 5, completedAt: 2 } } },
    hifzProgress: { 1: { 1: 'known' } },
    quranProgress: { bookmarks: [{ surah: 2, ayah: 255, createdAt: 5 }], lastRead: null, notes: [], history: [] },
    downloadedReciters: ['ar.alafasy'],
  });

  it('hebt die vier getippten v1-Felder in das storage-Format', () => {
    const result = parseBackupFile(v1File);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.data.exportedAt).toBe(111);
    expect(Object.keys(result.data.storage).sort()).toEqual(
      [LEARN_PROGRESS_STORAGE_KEY, HIFZ_STORAGE_KEY, QURAN_PROGRESS_STORAGE_KEY, tajwidKey].sort(),
    );
    expect(JSON.parse(result.data.storage[tajwidKey])).toEqual({ tj1: { score: 5, total: 5, completedAt: 2 } });
    expect(result.data.downloadedReciters).toEqual(['ar.alafasy']);
  });

  it('schreibt eine v1-Datei vollstaendig in den Speicher zurueck', async () => {
    const result = parseBackupFile(v1File);
    if (!result.ok) throw new Error('unreachable');
    await applyBackupData(result.data);

    expect(JSON.parse((await AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY))!)).toEqual({
      l1: { score: 8, total: 10, completedAt: 1 },
    });
    expect(JSON.parse((await AsyncStorage.getItem(HIFZ_STORAGE_KEY))!)).toEqual({ 1: { 1: 'known' } });
    expect(JSON.parse((await AsyncStorage.getItem(tajwidKey))!)).toEqual({
      tj1: { score: 5, total: 5, completedAt: 2 },
    });
  });

  it('ignoriert fremde courseProgress-Schluessel einer editierten v1-Datei', () => {
    const result = parseBackupFile(
      JSON.stringify({ formatVersion: 1, courseProgress: { 'salatibox:error-log': {}, boeses: {} } }),
    );
    if (!result.ok) throw new Error('unreachable');
    expect(result.data.storage['salatibox:error-log']).toBeUndefined();
    expect(result.data.storage.boeses).toBeUndefined();
  });
});

describe('applyBackupData', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('schreibt alle Felder zurück in ihre jeweiligen AsyncStorage-Keys', async () => {
    const tajwidKey = COURSE_META.find((c) => c.id === 'tajwid')!.storageKey;
    const data: BackupData = {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: 1,
      storage: {
        [LEARN_PROGRESS_STORAGE_KEY]: '{"l1":{"score":1,"total":1,"completedAt":1}}',
        [tajwidKey]: '{"tj1":{"score":1,"total":1,"completedAt":1}}',
        [HIFZ_STORAGE_KEY]: '{"2":{"5":"known"}}',
        [QURAN_PROGRESS_STORAGE_KEY]: JSON.stringify({ ...EMPTY_QURAN_PROGRESS, bookmarks: [{ surah: 1, ayah: 1 }] }),
        'salatibox:prayer-qada-owed': '{"fajr":3,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}',
      },
      downloadedReciters: ['ar.alafasy'],
    };

    const restored = await applyBackupData(data);
    expect(restored.sort()).toEqual(Object.keys(data.storage).sort());

    for (const [key, value] of Object.entries(data.storage)) {
      expect([key, await AsyncStorage.getItem(key)]).toEqual([key, value]);
    }
  });

  it('überschreibt vorhandenen Fortschritt vollständig (kein Merge innerhalb eines Keys)', async () => {
    await AsyncStorage.setItem(HIFZ_STORAGE_KEY, JSON.stringify({ 9: { 9: 'known' } }));
    await applyBackupData({
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: 1,
      storage: { [HIFZ_STORAGE_KEY]: '{"1":{"1":"known"}}' },
      downloadedReciters: [],
    });
    expect(JSON.parse((await AsyncStorage.getItem(HIFZ_STORAGE_KEY))!)).toEqual({ 1: { 1: 'known' } });
  });
});

describe('writeBackupFile / readBackupFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('schreibt die serialisierte Backup-Datei ins Cache-Verzeichnis und liest sie wieder', async () => {
    const data: BackupData = {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: 1,
      storage: {},
      downloadedReciters: [],
    };
    const uri = await writeBackupFile(data);
    expect(uri).toBe('file:///cache/salati-fortschritt.json');
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(uri, serializeBackup(data));

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce(serializeBackup(data));
    const raw = await readBackupFile(uri);
    expect(parseBackupFile(raw)).toEqual({ ok: true, data });
  });
});
