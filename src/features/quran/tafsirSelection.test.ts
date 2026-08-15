import { TAFSIR_MAX_SIMULTANEOUS, toggleTafsirSelection } from './tafsirSelection';

describe('toggleTafsirSelection', () => {
  it('adds a new edition when below the limit', () => {
    expect(toggleTafsirSelection(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes an already-selected edition', () => {
    expect(toggleTafsirSelection(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('refuses to remove the last remaining edition', () => {
    expect(toggleTafsirSelection(['a'], 'a')).toEqual(['a']);
  });

  it('rotates out the oldest selection once the limit is reached', () => {
    expect(toggleTafsirSelection(['a', 'b', 'c'], 'd')).toEqual(['b', 'c', 'd']);
  });

  it('exposes the limit as a constant matching the rotation behavior', () => {
    expect(TAFSIR_MAX_SIMULTANEOUS).toBe(3);
  });
});
