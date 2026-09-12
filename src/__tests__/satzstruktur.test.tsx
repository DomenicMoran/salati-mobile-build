/**
 * Satzstruktur-Ansicht (Satzebene der Wortanalyse, features/quran/analyse/
 * Satzstruktur.tsx): stellt für einen ganzen Vers dar, welches Wort an
 * welchem hängt und mit welcher Rolle — Ergänzung zur bereits fertigen
 * Wort-Ebene (WortAnalyseSheet).
 *
 * useVerseMorphologie wird gemockt (wie in wort-analyse-sheet.test.tsx):
 * dieser Test prüft die Baum-/Anzeige-Logik, nicht Netzwerk-/Cache-Verhalten.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import sure1Fixture from '@/features/quran/__fixtures__/morphologie-1.json';
import sure2Fixture from '@/features/quran/__fixtures__/morphologie-2-verse-1-5.json';
import { Satzstruktur } from '@/features/quran/analyse/Satzstruktur';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';
import type { MorphologieDatei, MorphWord } from '@/features/quran/morphologieTypen';

const sure1 = sure1Fixture as unknown as MorphologieDatei;
const sure2 = sure2Fixture as unknown as MorphologieDatei;

const t = (key: string) => translate('de', key);

let mockVerse: MorphWord[] | undefined;
let mockMorphState: { isLoading: boolean; isError: boolean } = { isLoading: false, isError: false };

jest.mock('@/features/quran/morphologieHooks', () => ({
  useVerseMorphologie: jest.fn(() => ({ verse: mockVerse, ...mockMorphState })),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SettingsProvider>
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }),
  );
  mockVerse = undefined;
  mockMorphState = { isLoading: false, isError: false };
});

afterEach(() => {
  queryClient.clear();
});

function fachbegriff(name: string, ar: string) {
  return `${name} — ${ar}`;
}

describe('Satzstruktur', () => {
  it('zeigt das Kind eingerückt unter seinem Elternwort samt Bezug (echte Fixture, Sure 1 Vers 2)', async () => {
    mockVerse = sure1.verses['2']; // ٱلْحَمْدُ · لِلَّهِ(→sich) · رَبِّ(App→2) · ٱلْعَٰلَمِينَ(Poss→3)
    const wortDrei = sure1.verses['2'].find((w) => w.position === 3)!;
    const wortZwei = sure1.verses['2'].find((w) => w.position === 2)!;

    await render(
      <Satzstruktur surah={1} ayah={2} enabled onWortAuswahl={jest.fn()} />,
      { wrapper: Wrapper },
    );

    // Aufklappbar startet zugeklappt — erst öffnen.
    fireEvent.press(screen.getByLabelText(t('quran.satzstruktur.title')));

    // Rolle mit Fachbegriff UND arabischem Terminus (Badal-Relation von Wort 3).
    expect(await screen.findByText(fachbegriff(t('grammatik.relationen.App.name'), t('grammatik.relationen.App.ar')))).toBeTruthy();
    // Bezugswort von Wort 3 wird benannt (Wort 2, لِلَّهِ).
    expect(
      screen.getByText(t('quran.wortAnalyse.satzrolleHeadLabel').replace('{wort}', wortZwei.text)),
    ).toBeTruthy();
    // Wort 4 hängt wiederum an Wort 3.
    expect(
      screen.getByText(t('quran.wortAnalyse.satzrolleHeadLabel').replace('{wort}', wortDrei.text)),
    ).toBeTruthy();
  });

  it('sagt bei head:null ehrlich, dass kein Bezugswort bekannt ist, statt eines zu erfinden', async () => {
    mockVerse = sure2.verses['2']; // فِيهِ (Position 5) hat relation "link", head: null
    await render(<Satzstruktur surah={2} ayah={2} enabled onWortAuswahl={jest.fn()} />, { wrapper: Wrapper });
    fireEvent.press(screen.getByLabelText(t('quran.satzstruktur.title')));

    expect(await screen.findByText(fachbegriff(t('grammatik.relationen.link.name'), t('grammatik.relationen.link.ar')))).toBeTruthy();
    expect(screen.getByText(t('quran.wortAnalyse.satzrolleHeadNone'))).toBeTruthy();
  });

  it('zeigt bei einem Selbstbezug (head === eigene Position) KEIN "Bezogen auf sich selbst" und keinen Elidiert-Hinweis', async () => {
    mockVerse = sure2.verses['2'];
    const wortSieben = sure2.verses['2'].find((w) => w.position === 7)!; // لِّلْمُتَّقِينَ, gen, head:7
    expect(wortSieben.syntax?.head).toBe(7);

    await render(<Satzstruktur surah={2} ayah={2} enabled onWortAuswahl={jest.fn()} />, { wrapper: Wrapper });
    fireEvent.press(screen.getByLabelText(t('quran.satzstruktur.title')));

    // Die Rolle selbst (Genitiv) erscheint ganz normal …
    await screen.findByText(fachbegriff(t('grammatik.relationen.gen.name'), t('grammatik.relationen.gen.ar')));
    // … aber NICHT als "Bezogen auf: لِّلْمُتَّقِينَ" (Selbstbezug wäre irreführend).
    expect(
      screen.queryByText(t('quran.wortAnalyse.satzrolleHeadLabel').replace('{wort}', wortSieben.text)),
    ).toBeNull();
  });

  it('setzt bei der kaana-/inna-Familie (pred/subj) das regierende Wort in den Platzhalter ein', async () => {
    mockVerse = sure2.verses['2']; // رَيْبَ (Position 4): relation "subj <<la>>", head:3 (لَا)
    const wortLa = sure2.verses['2'].find((w) => w.position === 3)!;

    await render(<Satzstruktur surah={2} ayah={2} enabled onWortAuswahl={jest.fn()} />, { wrapper: Wrapper });
    fireEvent.press(screen.getByLabelText(t('quran.satzstruktur.title')));

    const erwarteterName = t('grammatik.relationen.muster.subjOf.name').replace('{wort}', wortLa.text);
    const erwarteterAr = t('grammatik.relationen.muster.subjOf.ar');
    expect(await screen.findByText(fachbegriff(erwarteterName, erwarteterAr))).toBeTruthy();
  });

  it('meldet ein Wort ohne Syntaxdaten ehrlich statt es zu verschweigen', async () => {
    mockVerse = [
      { position: 1, text: 'كلمة', root: null, lemma: 'كلمة', segments: [], syntax: undefined },
    ];
    await render(<Satzstruktur surah={9} ayah={1} enabled onWortAuswahl={jest.fn()} />, { wrapper: Wrapper });
    fireEvent.press(screen.getByLabelText(t('quran.satzstruktur.title')));
    expect(await screen.findByText(t('quran.wortAnalyse.satzrolleNoData'))).toBeTruthy();
  });

  it('meldet Tippen auf ein Wort mit dessen 1-basierter Position nach oben', async () => {
    mockVerse = sure1.verses['2'];
    const onWortAuswahl = jest.fn();
    await render(<Satzstruktur surah={1} ayah={2} enabled onWortAuswahl={onWortAuswahl} />, { wrapper: Wrapper });
    fireEvent.press(screen.getByLabelText(t('quran.satzstruktur.title')));

    const wortZwei = sure1.verses['2'].find((w) => w.position === 2)!;
    fireEvent.press(await screen.findByLabelText(new RegExp(`^${wortZwei.text}`)));
    expect(onWortAuswahl).toHaveBeenCalledWith(2);
  });

  it('rendert nichts, solange die Ansicht weder aktiv ist noch je geladen wurde', async () => {
    mockVerse = undefined;
    const { toJSON } = await render(
      <Satzstruktur surah={1} ayah={2} enabled={false} onWortAuswahl={jest.fn()} />,
      { wrapper: Wrapper },
    );
    expect(toJSON()).toBeNull();
  });
});
