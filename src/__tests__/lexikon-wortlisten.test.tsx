/**
 * Reiter "Grammatik & Sarf" — Unterreiter "Wortlisten" (WortlistenKatalogView,
 * siehe features/lexikon/wortlistenLoader.ts/wortlistenTypes.ts): Vokabel-/
 * Partikellisten, eine Beispielsatzliste und zwei Flussdiagramme aus
 * data/wortlisten.json, die keine Flexionsparadigmen sind (siehe
 * data/LUECKEN.md) und deshalb außerhalb von ParadigmKatalogView geführt
 * werden. Bewusst UNGEMOCKT (echte data/wortlisten.json), damit der Test
 * denselben Bestand prüft, der auch in der App ausgeliefert wird.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import LexikonScreen from '@/app/lexikon/index';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useLocalSearchParams: () => ({}),
    Link: ({ children, ...rest }: { children?: ReactNode }) =>
      (jest.requireActual('react') as typeof import('react')).createElement(Text, rest, children),
  };
});

const t = (key: string) => translate('de', key);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SettingsProvider>
  );
}

afterEach(() => {
  queryClient.clear();
});

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }));
});

async function openWortlistenKatalog() {
  await render(<LexikonScreen />, { wrapper: Wrapper });
  fireEvent.press(screen.getByText(t('lexikon.tabs.grammar')));
  fireEvent.press(await screen.findByText(t('lexikon.grammar.wortlisten.toggleWortlisten')));
}

describe('Reiter "Grammatik & Sarf" — Unterreiter "Wortlisten"', () => {
  it('zeigt den Hinweis auf die vorerst nur deutschen Bedeutungen und die Gesamtzahl', async () => {
    await openWortlistenKatalog();
    expect(await screen.findByText(t('lexikon.grammar.wortlisten.germanOnlyMeaningNote'))).toBeTruthy();
    expect(await screen.findByText(/^\d+ /)).toBeTruthy();
  });

  it('gliedert nach Handout-Kapitel und zeigt beim Aufklappen eine Vokabelliste mit arabischem Wort und deutscher Bedeutung', async () => {
    await openWortlistenKatalog();
    const kapitel1 = await screen.findByText('Kapitel 1 · Ism');
    fireEvent.press(kapitel1);
    expect(await screen.findByText('Vokabelliste: Ism (Grundvokabular)')).toBeTruthy();
    expect(screen.getAllByText('Allah').length).toBeGreaterThan(0);
  });

  it('zeigt die Beispielsatzliste der Verbindungsbuchstaben mit Qur\'an-Beispiel und Übersetzung', async () => {
    await openWortlistenKatalog();
    const kapitel6 = await screen.findByText('Kapitel 6 · Verschiedene Ausdrücke im Qur\'an');
    fireEvent.press(kapitel6);
    expect(await screen.findByText('Liste der Verbindungsbuchstaben (Harf al-\'Atf)')).toBeTruthy();
    expect(screen.getByText(/Segnungen auf den Propheten/)).toBeTruthy();
  });

  it('zeigt das Ablaufschema Mubtada -> Chabar als Kästchenfolge statt als Tabelle', async () => {
    await openWortlistenKatalog();
    const kapitel4 = await screen.findByText('Kapitel 4 · Sätze');
    fireEvent.press(kapitel4);
    expect(await screen.findByText('Vom Mubtada zum Chabar (Nominalsatz)')).toBeTruthy();
    expect(screen.getAllByText(/Was ist mit dem Mubtada/).length).toBeGreaterThan(0);
  });

  it('Suche findet eine Wortliste über einen enthaltenen arabischen Begriff', async () => {
    await openWortlistenKatalog();
    const search = await screen.findByPlaceholderText(t('lexikon.grammar.tables.searchPlaceholder'));
    fireEvent.changeText(search, 'جَنَّةٌ');
    expect(await screen.findByText('Vokabelliste: Ism (Grundvokabular)')).toBeTruthy();
  });

  it('Suche ohne Treffer zeigt den ehrlichen Leerzustand', async () => {
    await openWortlistenKatalog();
    const search = await screen.findByPlaceholderText(t('lexikon.grammar.tables.searchPlaceholder'));
    fireEvent.changeText(search, 'xyzxyz-kein-treffer');
    expect(await screen.findByText(t('lexikon.grammar.tables.noResults'))).toBeTruthy();
  });
});

/**
 * Sprache Englisch: data/wortlisten-i18n/en.json (siehe wortlistenI18nLoader.ts)
 * ist ein vollstaendiges Uebersetzungsbuendel (siehe
 * data/wortlisten-i18n/wortlisten-sprachparitaet.test.ts) — der "nur auf
 * Deutsch"-Hinweis darf hier deshalb NICHT mehr erscheinen, und Kapitel-/
 * Listentitel sowie Bedeutungen muessen aus dem Uebersetzungsbuendel kommen
 * statt aus den deutschen Feldern in wortlisten.json.
 */
describe('Reiter "Grammatik & Sarf" — Unterreiter "Wortlisten" (Sprache Englisch)', () => {
  const tEn = (key: string) => translate('en', key);

  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, language: 'en' }));
  });

  async function openWortlistenKatalogEn() {
    await render(<LexikonScreen />, { wrapper: Wrapper });
    fireEvent.press(screen.getByText(tEn('lexikon.tabs.grammar')));
    fireEvent.press(await screen.findByText(tEn('lexikon.grammar.wortlisten.toggleWortlisten')));
  }

  it('zeigt keinen "nur auf Deutsch"-Hinweis mehr und rendert Kapitel-/Listentitel sowie Bedeutungen auf Englisch', async () => {
    await openWortlistenKatalogEn();

    // Hinweis ist weg, weil fuer "en" ein vollstaendiges Uebersetzungsbuendel existiert.
    expect(screen.queryByText(tEn('lexikon.grammar.wortlisten.germanOnlyMeaningNote'))).toBeNull();
    expect(screen.queryByText('Die deutschen Bedeutungen dieser Wortlisten liegen aktuell nur auf Deutsch vor.')).toBeNull();

    const kapitel1 = await screen.findByText('Chapter 1 · Ism');
    fireEvent.press(kapitel1);
    expect(await screen.findByText('Vocabulary list: Ism (basic vocabulary)')).toBeTruthy();
    // Arabisch/Umschrift bleiben unveraendert, nur die Bedeutung ist jetzt Englisch statt "Eimer".
    expect(screen.getAllByText('bucket').length).toBeGreaterThan(0);
    expect(screen.queryByText('Eimer')).toBeNull();
  });

  it('zeigt Beispielsatzliste und Ablaufschema mit englischer Uebersetzung statt der deutschen Felder', async () => {
    await openWortlistenKatalogEn();

    const kapitel6 = await screen.findByText("Chapter 6 · Various Expressions in the Qur'an");
    fireEvent.press(kapitel6);
    expect(await screen.findByText("List of Connecting Letters (Harf al-'Atf)")).toBeTruthy();
    expect(screen.getByText(/blessings upon the Prophet/)).toBeTruthy();

    const kapitel4 = await screen.findByText('Chapter 4 · Sentences');
    fireEvent.press(kapitel4);
    expect(await screen.findByText('From Mubtada to Chabar (Nominal Sentence)')).toBeTruthy();
    expect(screen.getAllByText(/What about the Mubtada/).length).toBeGreaterThan(0);
  });
});
