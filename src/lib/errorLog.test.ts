import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearErrorLog, formatErrorReport, getErrorLog, logError } from './errorLog';

describe('errorLog', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearErrorLog();
  });

  it('starts empty', async () => {
    expect(await getErrorLog()).toEqual([]);
  });

  it('records a logged error with message and stack', async () => {
    await logError(new Error('boom'), 'render');
    const log = await getErrorLog();
    expect(log).toHaveLength(1);
    expect(log[0].message).toBe('boom');
    expect(log[0].context).toBe('render');
    expect(log[0].stack).toBeDefined();
  });

  it('handles non-Error values without a stack', async () => {
    await logError('plain string failure');
    const log = await getErrorLog();
    expect(log[0].message).toBe('plain string failure');
    expect(log[0].stack).toBeUndefined();
  });

  it('caps the ring buffer at 20 entries, keeping the most recent', async () => {
    for (let i = 0; i < 25; i++) {
      await logError(new Error(`err-${i}`));
    }
    const log = await getErrorLog();
    expect(log).toHaveLength(20);
    expect(log[0].message).toBe('err-5');
    expect(log[19].message).toBe('err-24');
  });

  it('persists across a fresh read from storage', async () => {
    await logError(new Error('persisted'));
    const raw = await AsyncStorage.getItem('salatibox:error-log');
    expect(raw).toContain('persisted');
  });

  it('clearErrorLog empties the buffer and storage', async () => {
    await logError(new Error('to-clear'));
    await clearErrorLog();
    expect(await getErrorLog()).toEqual([]);
    const raw = await AsyncStorage.getItem('salatibox:error-log');
    expect(JSON.parse(raw ?? '[]')).toEqual([]);
  });

  it('formatErrorReport reports an empty log honestly', () => {
    expect(formatErrorReport([])).toContain('keine Fehler');
  });

  it('formatErrorReport includes timestamp, context and message', () => {
    const report = formatErrorReport([{ message: 'oops', context: 'render', timestamp: 0 }]);
    expect(report).toContain('oops');
    expect(report).toContain('render');
    expect(report).toContain('1 Eintraege');
  });
});
