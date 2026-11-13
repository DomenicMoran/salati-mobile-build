import { searchSessions, sessionExportText, type KhutbaSession } from './khutbaSession';

describe('khutbaSession helpers', () => {
  const sample: KhutbaSession = {
    id: '1',
    startedAt: 0,
    endedAt: null,
    lines: [{ ts: 1, text: 'As-Salamu alaikum' }],
  };

  it('searches lines', () => {
    expect(searchSessions([sample], 'salam')).toHaveLength(1);
    expect(searchSessions([sample], 'xyz')).toHaveLength(0);
  });

  it('exports plain text', () => {
    expect(sessionExportText(sample)).toContain('As-Salamu');
  });
});
