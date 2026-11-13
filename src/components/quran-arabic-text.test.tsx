import { render } from '@testing-library/react-native';

import { QuranArabicText } from '@/components/quran-arabic-text';
import { SettingsProvider } from '@/features/settings/store';

const SURAH_WITH_06E1 = 'سُورَةُ آلِ عِمۡرَانَ';

describe('QuranArabicText', () => {
  it('renders U+06E1 surah titles without throwing', () => {
    expect(() =>
      render(
        <SettingsProvider>
          <QuranArabicText>{SURAH_WITH_06E1}</QuranArabicText>
        </SettingsProvider>,
      ),
    ).not.toThrow();
  });
});
