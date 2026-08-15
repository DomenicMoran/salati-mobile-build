import AsyncStorage from '@react-native-async-storage/async-storage';

import { encodeBase64 } from './base64';
import {
  InvalidSyncCodeError,
  MIN_SUPPORTED_SYNC_VERSION,
  SYNC_FORMAT_VERSION,
  buildSyncPayload,
  decodeSyncPayload,
  encodeSyncPayload,
  exportProgressCode,
  importProgressCode,
} from './codeSync';

describe('buildSyncPayload', () => {
  it('includes only known sync keys with a non-null value', () => {
    const payload = buildSyncPayload({
      'salatibox:quran-progress': '{"bookmarks":[]}',
      'salatibox:hifz-progress': null,
    });
    expect(payload.v).toBe(SYNC_FORMAT_VERSION);
    expect(payload.data).toEqual({ 'salatibox:quran-progress': '{"bookmarks":[]}' });
    expect(payload.exportedAt).toEqual(expect.any(String));
  });

  it('produces an empty data object when nothing is stored yet', () => {
    expect(buildSyncPayload({}).data).toEqual({});
  });

  it('drops keys that are deliberately excluded from the backup', () => {
    const payload = buildSyncPayload({
      'salatibox:error-log': '[]',
      'salatibox:query-cache': '{}',
      'salatibox:taraweeh': '{"2026-03-02":20}',
    });
    expect(payload.data).toEqual({ 'salatibox:taraweeh': '{"2026-03-02":20}' });
  });

  it('carries dynamic course and journey keys', () => {
    const payload = buildSyncPayload({
      'salatibox:study-tajwid': '{"t1":{"score":5,"total":5,"completedAt":1}}',
      'salatibox:journey:sabr': '{"journeyId":"sabr"}',
    });
    expect(Object.keys(payload.data).sort()).toEqual(['salatibox:journey:sabr', 'salatibox:study-tajwid']);
  });
});

describe('encodeSyncPayload / decodeSyncPayload', () => {
  it('round-trips a payload with multiple domains', () => {
    const payload = buildSyncPayload({
      'salatibox:quran-progress': '{"bookmarks":[{"surah":2,"ayah":255}]}',
      'salatibox:tasbih': '{"count":33}',
    });
    const code = encodeSyncPayload(payload);
    const decoded = decodeSyncPayload(code);
    expect(decoded).toEqual(payload);
  });

  it('throws InvalidSyncCodeError for garbage input', () => {
    expect(() => decodeSyncPayload('not a real code!!')).toThrow(InvalidSyncCodeError);
  });

  it('throws InvalidSyncCodeError for valid base64 that is not a sync payload', () => {
    const unrelatedCode = encodeSyncPayload({ v: SYNC_FORMAT_VERSION, exportedAt: '', data: {} });
    const tampered = unrelatedCode.slice(0, -4); // truncate to corrupt the JSON
    expect(() => decodeSyncPayload(tampered)).toThrow(InvalidSyncCodeError);
  });

  it('throws InvalidSyncCodeError when the version field is missing or newer than this app', () => {
    expect(() => decodeSyncPayload(encodeBase64(JSON.stringify({ exportedAt: '', data: {} })))).toThrow(
      InvalidSyncCodeError,
    );
    expect(() =>
      decodeSyncPayload(encodeBase64(JSON.stringify({ v: SYNC_FORMAT_VERSION + 1, exportedAt: '', data: {} }))),
    ).toThrow(InvalidSyncCodeError);
    expect(() =>
      decodeSyncPayload(encodeBase64(JSON.stringify({ v: MIN_SUPPORTED_SYNC_VERSION - 1, exportedAt: '', data: {} }))),
    ).toThrow(InvalidSyncCodeError);
  });

  it('throws InvalidSyncCodeError when data is null', () => {
    const code = encodeBase64(JSON.stringify({ v: SYNC_FORMAT_VERSION, exportedAt: '', data: null }));
    expect(() => decodeSyncPayload(code)).toThrow(InvalidSyncCodeError);
  });

  it('throws InvalidSyncCodeError when data is an array instead of an object', () => {
    const code = encodeBase64(JSON.stringify({ v: SYNC_FORMAT_VERSION, exportedAt: '', data: [] }));
    expect(() => decodeSyncPayload(code)).toThrow(InvalidSyncCodeError);
  });

  it('trims surrounding whitespace from a pasted code', () => {
    const payload = buildSyncPayload({ 'salatibox:fasting': '{"2026-03-01":true}' });
    const code = `  ${encodeSyncPayload(payload)}\n`;
    expect(decodeSyncPayload(code)).toEqual(payload);
  });
});

// Format-Version: eine ältere Sicherung muss weiterhin einlesbar sein, eine
// neuere darf NICHT halb importiert werden. Beide Richtungen sind hier geprüft.
describe('Formatversion: Abwärtskompatibilität', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('liest einen v1-Code (die alten 10 Schlüssel) vollständig ein', async () => {
    const legacyCode = encodeBase64(
      JSON.stringify({
        v: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        data: {
          'salatibox:quran-progress': '{"bookmarks":[{"surah":2,"ayah":255}]}',
          'salatibox:learn-progress': '{"l1":{"score":8,"total":10,"completedAt":1}}',
          'salatibox:hifz-progress': '{"1":{"1":"known"}}',
          'salatibox:khatmah': '{"startDay":"2026-01-01"}',
          'salatibox:prayer-tracker': '{"2026-01-01":{"fajr":true}}',
          'salatibox:tasbih': '{"count":33}',
          'salatibox:fasting': '{"2026-03-01":true}',
          'salatibox:practice-stats': '{"plays":5}',
          'salatibox:review': '{"queue":[]}',
          'salatibox:mistakes': '[]',
        },
      }),
    );

    const decoded = decodeSyncPayload(legacyCode);
    expect(decoded.v).toBe(1);

    const { restoredKeys } = await importProgressCode(legacyCode);
    expect(restoredKeys).toHaveLength(10);
    expect(await AsyncStorage.getItem('salatibox:tasbih')).toBe('{"count":33}');
    expect(await AsyncStorage.getItem('salatibox:mistakes')).toBe('[]');
  });

  it('exportiert v2 und liest es wieder ein (Hin- und Rückweg)', async () => {
    await AsyncStorage.multiSet([
      ['salatibox:prayer-qada-owed', '{"fajr":3,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}'],
      ['salatibox:study-tajwid', '{"t1":{"score":5,"total":5,"completedAt":1}}'],
      ['salatibox:journey:sabr', '{"journeyId":"sabr","startDay":"2026-01-01","completed":{}}'],
      ['salatibox:error-log', '["darf-nicht-mit"]'],
    ]);

    const code = await exportProgressCode();
    expect(decodeSyncPayload(code).v).toBe(SYNC_FORMAT_VERSION);

    await AsyncStorage.clear();
    const { restoredKeys } = await importProgressCode(code);

    expect(restoredKeys.sort()).toEqual([
      'salatibox:journey:sabr',
      'salatibox:prayer-qada-owed',
      'salatibox:study-tajwid',
    ]);
    expect(await AsyncStorage.getItem('salatibox:prayer-qada-owed')).toBe(
      '{"fajr":3,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}',
    );
    expect(await AsyncStorage.getItem('salatibox:error-log')).toBeNull();
  });

  it('lehnt einen Code aus einer NEUEREN App-Version ab statt ihn halb zu importieren', async () => {
    const futureCode = encodeBase64(
      JSON.stringify({
        v: SYNC_FORMAT_VERSION + 1,
        exportedAt: '',
        data: { 'salatibox:tasbih': '{"count":1}' },
      }),
    );
    await expect(importProgressCode(futureCode)).rejects.toThrow(InvalidSyncCodeError);
    expect(await AsyncStorage.getItem('salatibox:tasbih')).toBeNull();
  });
});
