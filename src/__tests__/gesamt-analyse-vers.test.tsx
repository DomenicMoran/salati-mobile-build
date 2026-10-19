import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import type { ReactNode } from 'react';

import sure1Fixture from '@/features/quran/__fixtures__/morphologie-1.json';
import sure2Fixture from '@/features/quran/__fixtures__/morphologie-2-verse-1-5.json';
import { GesamtAnalyseVers } from '@/features/quran/analyse/GesamtAnalyseVers';
import type { MorphWord, MorphologieDatei } from '@/features/quran/morphologieTypen';
import type { QuranFontResult } from '@/features/quran/useQuranFont';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

const verse = (sure1Fixture as unknown as MorphologieDatei).verses['1'];
const sure2 = sure2Fixture as unknown as MorphologieDatei;
const t = (key: string) => translate('de', key);
const fakeFont = { style: {}, text: (value: string) => value } as unknown as QuranFontResult;

function Wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }));
});

function renderAnalysis(words: MorphWord[], verseWords: MorphWord[] = verse) {
  return render(
    <GesamtAnalyseVers words={words} verseWords={verseWords} displayWords={words.map((word) => word.text)} quranFont={fakeFont} />,
    { wrapper: Wrapper },
  );
}

describe('GesamtAnalyseVers', () => {
  it('zeigt Fragmente, Wortart, Bestimmtheit, Negation und Satzrolle gleichzeitig; nur Begründung bleibt optional', async () => {
    await renderAnalysis([verse[0]]);
    expect(screen.getAllByText(/Vorsilbe/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wortstamm/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ism \(Nomen\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bestimmtheit/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/keine/).length).toBeGreaterThan(0);
    const rationaleButton = screen.getAllByRole('button', { name: new RegExp(t('quran.wortAnalyse.rationaleLabel')) })[0];
    expect(rationaleButton.props.accessibilityState.expanded).toBe(false);
    fireEvent.press(rationaleButton);
    await waitFor(() => expect(screen.getByText(t('quran.wortAnalyse.rationaleHide'))).toBeTruthy());
  });

  it('kennzeichnet fehlende Ism-Merkmale explizit als nicht in Daten angegeben, statt als nicht zutreffend', async () => {
    const noun = verse[0];
    const missingState: MorphWord = {
      ...noun,
      segments: noun.segments.map((segment) =>
        segment.kind === 'stem'
          ? { ...segment, features: { ...segment.features, state: null }, derived: segment.derived.filter((key) => key !== 'state') }
          : segment,
      ),
    };
    await renderAnalysis([missingState]);
    expect(screen.getAllByText(/Bestimmtheit: unbekannt/).length).toBeGreaterThan(0);
  });

  it('unterscheidet eine Negationspartikel im selben Wort von einem Korpusbezug, der das Verb verneint', async () => {
    const particle = sure2.verses['2'].find((word) => word.segments.some((segment) => segment.pos === 'NEG'))!;
    const verb = sure2.verses['3'].find((word) => word.segments.some((segment) => segment.pos === 'V'))!;
    const lam = {
      ...particle,
      position: 1,
      text: 'لَمْ',
      segments: particle.segments.map((segment) => segment.pos === 'NEG' ? { ...segment, text: 'لَمْ' } : segment),
    };
    const yelid = {
      ...verb,
      position: 2,
      text: 'يَلِدْ',
      syntax: { relation: 'neg', relationAr: 'نفي', head: 1 },
    };

    await renderAnalysis([lam, yelid], [lam, yelid]);

    expect(screen.getByText(/Negationspartikel im Wort: keine/)).toBeTruthy();
    expect(screen.getByText(t('quran.wortAnalyse.negatedByLabel').replace('{wort}', 'لَمْ'))).toBeTruthy();
  });

  it('stapelt Negation und Satzrolle bei schmaler Breite bzw. großer Schrift', async () => {
    const dimensionsSpy = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 343,
      height: 2000,
      scale: 2.625,
      fontScale: 2,
    });
    try {
      await renderAnalysis([verse[0]]);
      const status = screen.getByText(/Negationspartikel im Wort: keine/);
      expect(ReactNative.StyleSheet.flatten(status.props.style)).toMatchObject({ width: '100%', flexBasis: 'auto' });
    } finally {
      dimensionsSpy.mockRestore();
    }
  });
});

