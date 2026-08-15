/**
 * Render-Nachweis fuer das Abzeichen „Inhalt auf Deutsch".
 *
 * Der Fall, um den es geht (MEDIEN-LUECKEN.md §5): tuerkische Oberflaeche,
 * deutsche Folge. Bisher stand nirgends ein Hinweis — der Nutzer merkte es
 * erst nach dem Antippen, schlimmstenfalls erst nach dem Offline-Download.
 * Gegengeprueft wird, dass fuer deutsche Oberflaeche GAR NICHTS gerendert wird
 * (kein zusaetzliches Abzeichen in einer Liste mit 68 Zeilen).
 */
// `render()` ist in RNTL 14 asynchron — ohne `await` liefert es ein Promise
// ohne Abfragen ("getByText is not a function").
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, waitFor } from '@testing-library/react-native';

import tr from '@/locales/tr.json';
import { SettingsProvider } from '@/features/settings/store';
import { preloadLocale } from '@/lib/translate';
import { ContentLanguageBadge } from './content-language-badge';

const mockLocales = jest.fn(() => [{ languageCode: 'tr' }]);
jest.mock('expo-localization', () => ({
  getLocales: () => mockLocales(),
}));

const ERWARTET = tr.media.contentLanguage.replace('{lang}', tr.media.languages.de);

// Der Settings-Store schreibt den beim Erststart abgeleiteten Sprachstand nach
// AsyncStorage — ohne Leeren zoege der zweite Fall die Sprache des ersten mit.
beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('ContentLanguageBadge', () => {
  it('nennt bei tuerkischer Oberflaeche die deutsche Inhaltssprache', async () => {
    mockLocales.mockReturnValue([{ languageCode: 'tr' }]);
    await preloadLocale('tr');
    const view = await render(
      <SettingsProvider>
        <ContentLanguageBadge lang="de" />
      </SettingsProvider>,
    );
    await waitFor(() => expect(view.getByText(ERWARTET)).toBeTruthy());
  });

  it('rendert bei deutscher Oberflaeche nichts', async () => {
    mockLocales.mockReturnValue([{ languageCode: 'de' }]);
    const view = await render(
      <SettingsProvider>
        <ContentLanguageBadge lang="de" />
      </SettingsProvider>,
    );
    await waitFor(() => expect(view.queryByText(ERWARTET)).toBeNull());
    expect(view.toJSON()).toBeNull();
  });
});
