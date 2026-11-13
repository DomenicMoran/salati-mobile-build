const mockPlatform = { OS: 'ios' as 'ios' | 'android' | 'web' };

jest.mock('react-native', () => ({
  Platform: mockPlatform,
}));

jest.mock('react-native/Libraries/Core/InitializeCore', () => ({}));

jest.mock('./ensureAbortSignalGlobals', () => ({}));

jest.mock('expo/src/winter/FormData', () => ({
  installFormDataPatch: jest.fn(),
}));

jest.mock('expo/src/winter/installGlobal', () => ({
  installGlobal: jest.fn(() => jest.fn()),
}));

jest.mock('./expoWinterAbortSignal', () => ({
  installAbortSignalPatch: jest.fn((x: unknown) => x),
}));

describe('expoWinterRuntime.native.shim', () => {
  const originalHeaders = globalThis.Headers;
  const originalEnv = process.env.EXPO_PUBLIC_USE_RN_FETCH;

  beforeEach(() => {
    jest.resetModules();
    mockPlatform.OS = 'ios';
    process.env.EXPO_PUBLIC_USE_RN_FETCH = '';
    // @ts-expect-error test: fehlende WinterCG-Polyfills
    delete globalThis.Headers;
    // @ts-expect-error Hermes-Cold-Start
    delete globalThis.AbortSignal;
  });

  afterEach(() => {
    if (originalHeaders) {
      globalThis.Headers = originalHeaders;
    } else {
      // @ts-expect-error restore
      delete globalThis.Headers;
    }
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_USE_RN_FETCH;
    } else {
      process.env.EXPO_PUBLIC_USE_RN_FETCH = originalEnv;
    }
  });

  it('wirft auf iOS nicht, wenn Headers und AbortSignal fehlen', () => {
    expect(() => {
      jest.isolateModules(() => {
        require('./expoWinterRuntime.native.shim');
      });
    }).not.toThrow();
  });

  it('wirft auf web ohne Headers nicht, wenn EXPO_PUBLIC_USE_RN_FETCH gesetzt ist', () => {
    mockPlatform.OS = 'web';
    process.env.EXPO_PUBLIC_USE_RN_FETCH = '1';
    expect(() => {
      jest.isolateModules(() => {
        require('./expoWinterRuntime.native.shim');
      });
    }).not.toThrow();
  });
});
