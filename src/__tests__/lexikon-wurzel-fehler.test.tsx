/**
 * Wurzel-Detailansicht: Fehler-/Fortschrittszustand des Wortformen-Ladens
 * (useRootWordforms, siehe features/lexikon/hooks.ts).
 *
 * Befund vor diesem Test: `useRootWordforms().isError` wurde in der
 * Detailansicht nicht ausgewertet — ein fehlgeschlagener Suren-Abruf blieb
 * unsichtbar (weder Fehlermeldung noch "Erneut versuchen"). Dieser Test
 * deckt sowohl den Fehlerfall als auch die Fortschrittsanzeige ab, die den
 * bisher rein statischen Ladetext ersetzt (siehe FORTSETZEN-Notiz im Auftrag:
 * "Nutzer muss sehen, dass etwas passiert").
 *
 * Eigene, in sich geschlossene Fixtures (zwei Lemmata je Wurzel, zwei
 * verschiedene Suren) statt der Fixture aus lexikon-wurzel.test.tsx, damit
 * die beiden Suren-Abrufe unabhängig voneinander steuerbar sind (kontrollierte
 * Promises statt echtem Netz/Datei-Cache).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import WurzelDetailScreen from '@/app/lexikon/wurzel/[wurzel]';
import { ladeMorphologie } from '@/features/quran/morphologie';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';
import type { LemmataDatei, MorphologieDatei, WurzelnDatei } from '@/features/quran/morphologieTypen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({ wurzel: 'دعو' }),
}));

// Erfundene, aber strukturell echte Wurzel mit zwei Lemmata in zwei
// verschiedenen Suren, damit distinctSurahs.length === 2 (Fortschritt "1 von 2").
const WURZELN: WurzelnDatei = {
  دعو: { count: 2, lemmas: ['دَعْوَة', 'دَاعٍ'], occurrences: [[1, 1, 1], [2, 1, 1]] },
};
const LEMMATA: LemmataDatei = {
  'دَعْوَة': { count: 1, occurrences: [[1, 1, 1]] },
  'دَاعٍ': { count: 1, occurrences: [[2, 1, 1]] },
};

// Minimale, aber schema-valide Morphologie-Datei — der Mock ersetzt
// ladeMorphologie komplett, die Feld-Validierung von morphologie.ts greift
// hier nicht; das `surah`-Feld wird vom Hook ohnehin nicht ausgewertet
// (siehe hooks.ts: `bySurah` schlüsselt über den Suren-Index, nicht `data.surah`).
function baueSure(): MorphologieDatei {
  return {
    schema: 2,
    surah: 1,
    verses: {
      '1': [
        {
          position: 1,
          text: 'دَعْوَة',
          segments: [
            {
              text: 'دَعْوَة',
              kind: 'stem',
              pos: 'N',
              features: {
                person: null,
                gender: null,
                number: null,
                case: null,
                state: null,
                mood: null,
                tense: null,
                voice: null,
                verbForm: null,
                derivation: null,
              },
              derived: [],
              raw: 'N',
            },
          ],
          syntax: [],
        },
      ],
    },
  } as unknown as MorphologieDatei;
}

jest.mock('@/features/quran/morphologie', () => ({
  ladeWurzeln: jest.fn(async () => WURZELN),
  ladeLemmata: jest.fn(async () => LEMMATA),
  ladeMorphologie: jest.fn(),
}));

const ladeMorphologieMock = ladeMorphologie as jest.MockedFunction<typeof ladeMorphologie>;

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
  ladeMorphologieMock.mockReset();
});

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }));
});

/** Kontrollierbares Promise, um den "lädt gerade"-Zustand gezielt zu beobachten. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Wurzel-Detailansicht: Wortformen-Fehler und -Fortschritt', () => {
  it('zeigt die Fortschrittszahl, solange noch nicht alle Suren geladen sind', async () => {
    const d1 = deferred<MorphologieDatei>();
    const d2 = deferred<MorphologieDatei>();
    ladeMorphologieMock.mockImplementation((surah: number) => (surah === 1 ? d1.promise : d2.promise));

    await render(<WurzelDetailScreen />, { wrapper: Wrapper });

    // "0 von 2" — noch keine der beiden Suren ist fertig.
    await screen.findByText(
      t('lexikon.wurzel.formsLoadingProgress').replace('{loaded}', '0').replace('{total}', '2'),
    );

    d1.resolve(baueSure());

    // "1 von 2" — eine Sure fertig, die andere noch offen.
    await screen.findByText(
      t('lexikon.wurzel.formsLoadingProgress').replace('{loaded}', '1').replace('{total}', '2'),
    );

    d2.resolve(baueSure());

    // Danach verschwindet der Ladehinweis, die Wortform erscheint.
    await screen.findByText('دَعْوَة');
    expect(screen.queryByText(t('lexikon.wurzel.formsLoadingProgress').replace('{loaded}', '1').replace('{total}', '2'))).toBeNull();
  });

  it('zeigt einen Fehlerhinweis mit Wiederholen-Option, wenn eine Sure nicht geladen werden konnte, ohne die bereits geladenen Formen zu verstecken', async () => {
    ladeMorphologieMock.mockImplementation((surah: number) =>
      surah === 1 ? Promise.resolve(baueSure()) : Promise.reject(new Error('morphologie_2_http_500')),
    );

    await render(<WurzelDetailScreen />, { wrapper: Wrapper });

    expect(await screen.findByText(t('lexikon.wurzel.formsLoadError'))).toBeTruthy();
    expect(screen.getByText(t('common.retry'))).toBeTruthy();
    // Die erfolgreich geladene Form bleibt trotz des Fehlers der anderen Sure sichtbar.
    expect(screen.getByText('دَعْوَة')).toBeTruthy();
  });

  it('stößt beim Antippen von "Erneut versuchen" den fehlgeschlagenen Abruf erneut an', async () => {
    let zweiterAufrufVersuch = 0;
    ladeMorphologieMock.mockImplementation((surah: number) => {
      if (surah === 1) return Promise.resolve(baueSure());
      zweiterAufrufVersuch += 1;
      return zweiterAufrufVersuch === 1
        ? Promise.reject(new Error('morphologie_2_http_500'))
        : Promise.resolve(baueSure());
    });

    await render(<WurzelDetailScreen />, { wrapper: Wrapper });

    const retryButton = await screen.findByText(t('common.retry'));
    fireEvent.press(retryButton);

    await waitFor(() => expect(screen.queryByText(t('lexikon.wurzel.formsLoadError'))).toBeNull());
    expect(zweiterAufrufVersuch).toBe(2);
  });
});
