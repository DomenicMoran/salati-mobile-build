jest.mock('@react-native-ml-kit/translate-text', () => ({
  __esModule: true,
  default: {
    translate: jest.fn(async ({ text }: { text: string }) => `tr:${text}`),
  },
  TranslateLanguage: { ARABIC: 1, GERMAN: 2, ENGLISH: 3, TURKISH: 4 },
}));

import { translateKhutbaLine } from './khutbaTranslate';

describe('khutbaTranslate', () => {
  it('returns trimmed passthrough when source equals target', async () => {
    await expect(translateKhutbaLine('  hi  ', 'de', 'de')).resolves.toBe('hi');
  });
});