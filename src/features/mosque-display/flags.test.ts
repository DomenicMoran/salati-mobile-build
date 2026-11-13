import { DEFAULT_MOSQUE_FLAGS } from './flags';

describe('mosque feature flags defaults', () => {
  it('are off by default', () => {
    expect(DEFAULT_MOSQUE_FLAGS).toEqual({ mosqueDisplayEnabled: false, khutbaLiveEnabled: false });
  });
});
