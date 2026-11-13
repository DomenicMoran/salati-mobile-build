import { installAbortSignalPatch } from './expoWinterAbortSignal';

describe('installAbortSignalPatch', () => {
  it('toleriert fehlendes AbortSignal (Hermes pre-winter)', () => {
    expect(installAbortSignalPatch(undefined)).toBeUndefined();
  });

  it('ergänzt timeout und any am Konstruktor', () => {
  class Signal {}
    const patched = installAbortSignalPatch(Signal as unknown as typeof AbortSignal);
    expect(patched).toBe(Signal);
    expect(typeof (Signal as unknown as { timeout?: unknown }).timeout).toBe('function');
    expect(typeof (Signal as unknown as { any?: unknown }).any).toBe('function');
  });
});
