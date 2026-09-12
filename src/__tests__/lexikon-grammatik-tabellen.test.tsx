/**
 * Reiter "Grammatik & Sarf" — Unterreiter "Formentabellen" (ParadigmKatalogView,
 * siehe features/lexikon/paradigmenLoader.ts/paradigmenKategorien.ts): der
 * gemeinsame, nach Kategorien gegliederte Katalog ALLER Paradigmen-/Bab-
 * Tabellen aus den vier data/paradigmen*.json-Dateien, plus die Verbtyp-
 * Route (app/lexikon/verbtyp/[typ].tsx) für die künftige Reader-Verlinkung.
 *
 * Bewusst UNGEMOCKT (echte JSON-Dateien, siehe lexikon-grammatik.test.tsx) —
 * insbesondere die Regression, dass die Vorlagen-Unstimmigkeit bei
 * bab-tafaul6-naqis-talaqa (Abbildung 92, siehe deren `notes`) tatsächlich
 * sichtbar wird und nicht in einer auf notes[0] abgeschnittenen Anzeige
 * verschwindet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import LexikonScreen from '@/app/lexikon/index';
import VerbtypScreen from '@/app/lexikon/verbtyp/[typ]';
import { PARADIGM_KATEGORIE_ORDER } from '@/features/lexikon/paradigmenKategorien';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';

const mockPush = jest.fn();
let mockVerbtypParams: { typ: string } = { typ: 'ajwaf' };

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useLocalSearchParams: () => mockVerbtypParams,
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
  mockPush.mockClear();
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }));
});

async function openTabellenKatalog() {
  await render(<LexikonScreen />, { wrapper: Wrapper });
  fireEvent.press(screen.getByText(t('lexikon.tabs.grammar')));
  fireEvent.press(await screen.findByText(t('lexikon.grammar.tables.toggleTabellen')));
}

describe('Reiter "Grammatik & Sarf" — Unterreiter "Formentabellen"', () => {
  it('zeigt standardmäßig weiter "Begriffe" (bestehender Pfad bleibt Vorbelegung)', async () => {
    await render(<LexikonScreen />, { wrapper: Wrapper });
    fireEvent.press(screen.getByText(t('lexikon.tabs.grammar')));
    expect(await screen.findByText('Ism')).toBeTruthy();
  });

  it('zeigt die Gesamtzahl vollständig gegliedert über alle Kategorien (keine bleibt leer/unsichtbar) und die Kategorie "Verbstamm-Familien (Bab)"', async () => {
    await openTabellenKatalog();

    // Bewusst OHNE hartcodierte Gesamtzahl: Stand 2026-09-05 waren es 129,
    // seit dem Anschluss der letzten Tabellendatei sind es 146 — eine feste
    // Zahl hier bricht bei jeder künftigen Tabellendatei erneut, ohne dass an
    // der Kategorisierung selbst etwas falsch wäre (genau der Fehler, der zu
    // dieser Korrektur führte). paradigmenKategorien.test.ts sichert den
    // GENAUEN Bestand je Kategorie bereits hart gegen die echten
    // Datendateien ab — das ist die richtige Stelle für eine feste Zahl. Hier,
    // auf UI-Ebene, zählt nur die Eigenschaft, auf die es ankommt: die
    // angezeigte Gesamtzahl ist tatsächlich die Summe der angezeigten
    // Kategorien (jede Tabelle in genau einer Kategorie, keine doppelt/fehlt)
    // und jede der Katalog-Kategorien ist sichtbar (keine bleibt leer).
    const gesamtzahlKnoten = await screen.findByText(/^\d+ Tabellen$/);
    const gesamtzahl = Number(String(gesamtzahlKnoten.props.children).match(/\d+/)?.[0]);
    expect(gesamtzahl).toBeGreaterThan(0);

    const kategorieKnoepfe = screen.getAllByRole('button').filter((btn) => /\(\d+\)$/.test(String(btn.props.accessibilityLabel)));
    expect(kategorieKnoepfe.length).toBe(PARADIGM_KATEGORIE_ORDER.length);
    const summe = kategorieKnoepfe.reduce((acc, btn) => acc + Number(String(btn.props.accessibilityLabel).match(/\((\d+)\)$/)?.[1] ?? 0), 0);
    expect(summe).toBe(gesamtzahl);

    expect(await screen.findByText(/Verbstamm-Familien \(Bab\).*\(107\)/)).toBeTruthy();

    // Verbstamm-Familien aufklappen -> die kombinierte Familie
    // (paradigmen-bab-murakkab.json, während dieser Umsetzung parallel
    // eingetroffen) erscheint mit ihren 21 Tabellen, ohne dass der Katalog
    // dafür angepasst werden musste (siehe PARADIGM_SOURCES in
    // paradigmenLoader.ts — eine Zeile genügte).
    fireEvent.press(screen.getByText(/Verbstamm-Familien \(Bab\)/));
    expect(await screen.findByText(/Murakkab \(kombiniert\).*\(21\)/)).toBeTruthy();
  });

  it('Suche findet eine Bab-Tabelle über ihren Titel und zeigt ALLE ihre Anmerkungen — inklusive der ACHTUNG-Notiz zu Abbildung 92', async () => {
    await openTabellenKatalog();

    const search = await screen.findByPlaceholderText(t('lexikon.grammar.tables.searchPlaceholder'));
    fireEvent.changeText(search, "Tafa'ul VI (Naqis)");

    // Die Tabelle selbst (termAr تَلَقَى, auch als Zellenwert vorhanden) und
    // eine harmlose Notiz sind sichtbar …
    expect((await screen.findAllByText('تَلَقَى')).length).toBeGreaterThan(0);
    expect(screen.getByText(/Gleiche Tabellenstruktur wie die Mahmooz-Bab-Tabellen/)).toBeTruthy();
    // … UND die als drittes Element stehende ACHTUNG-Notiz — vor der
    // Notes-Anzeige-Korrektur wäre nur notes[0] gerendert worden.
    expect(screen.getByText(/^ACHTUNG — dokumentierte Unstimmigkeit im Original \(Abbildung 92/)).toBeTruthy();
  });

  it('Suche ohne Treffer zeigt den ehrlichen Leerzustand', async () => {
    await openTabellenKatalog();
    const search = await screen.findByPlaceholderText(t('lexikon.grammar.tables.searchPlaceholder'));
    fireEvent.changeText(search, 'xyzxyz-kein-treffer');
    expect(await screen.findByText(t('lexikon.grammar.tables.noResults'))).toBeTruthy();
  });
});

describe('Verbtyp-Route (app/lexikon/verbtyp/[typ]) — Anbindung an wurzelTyp()', () => {
  it('typ=ajwaf zeigt die Aǧwaf-Bab-Tabellen (z. B. قَالَ, Bab Nasara)', async () => {
    mockVerbtypParams = { typ: 'ajwaf' };
    await render(<VerbtypScreen />, { wrapper: Wrapper });
    // قَالَ steht sowohl als termAr-Überschrift als auch als Zellenwert (3. Pers.
    // mask. Singular Madhi) — deshalb findAllByText statt eines Eindeutigkeits-
    // Treffers.
    expect((await screen.findAllByText('قَالَ')).length).toBeGreaterThan(0);
  });

  it('typ=sahih zeigt sowohl die Kurztabellen als auch die vollständigen Personenmatrizen von نَصَرَ', async () => {
    mockVerbtypParams = { typ: 'sahih' };
    await render(<VerbtypScreen />, { wrapper: Wrapper });
    // Kurztabelle (paradigmen.json) UND vollständige Matrix (paradigmen-verben.json)
    // tragen beide denselben termAr نَصَرَ — mindestens eine Instanz muss erscheinen.
    expect((await screen.findAllByText('نَصَرَ')).length).toBeGreaterThan(0);
  });

  it('typ=rubai (keine Bab-Familie in den Tabellen) zeigt den ehrlichen Leerzustand', async () => {
    mockVerbtypParams = { typ: 'rubai' };
    await render(<VerbtypScreen />, { wrapper: Wrapper });
    expect(await screen.findByText(t('lexikon.verbtyp.notFound'))).toBeTruthy();
  });

  it('ein ungültiger Verbtyp-Parameter zeigt ebenfalls den Leerzustand statt abzustürzen', async () => {
    mockVerbtypParams = { typ: 'gibt-es-nicht' };
    await render(<VerbtypScreen />, { wrapper: Wrapper });
    expect(await screen.findByText(t('lexikon.verbtyp.notFound'))).toBeTruthy();
  });
});
