/**
 * WortFokusKarte — Übungsschritt-Karte der Analyse-Übung: vor dem Aufdecken
 * darf nichts verraten werden, danach muss der Abgleich richtig/falsch klar
 * über TEXT (nicht nur Farbe) erkennbar sein, samt Begründung UND — bei
 * hergeleiteten Zusatzmerkmalen — sichtbarer Herkunfts-Kennzeichnung.
 *
 * Getestet gegen einen echten Ausschnitt der Morphologie-Pipeline
 * (__fixtures__/morphologie-1.json, wie in wort-analyse-sheet.test.tsx).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import sure1Fixture from '@/features/quran/__fixtures__/morphologie-1.json';
import type { MorphologieDatei } from '@/features/quran/morphologieTypen';
import type { QuranFontResult } from '@/features/quran/useQuranFont';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  aktiveDimensionen,
  baueSchritte,
  baueUebungsWort,
  satzrolleOptionen,
  type Antwort,
  type UebungsSchritt,
} from '@/features/quran/uebung/modell';
import { WortFokusKarte } from '@/features/quran/uebung/WortFokusKarte';

const sure1 = sure1Fixture as unknown as MorphologieDatei;
const ayah1 = sure1.verses['1'];
const t = (key: string) => translate('de', key);

const FAKE_QURAN_FONT = {
  style: {},
  text: (arabic: string) => arabic,
} as unknown as QuranFontResult;

function Wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }));
});

// بِسْمِ (1:1:1): Ism, Kasus Genitiv (beleg), Bestimmtheit HERGELEITET
// (derived: ['number', 'state'] in der Fixture), Satzrolle "gen".
const wort = baueUebungsWort(ayah1[0]);
const schritt: UebungsSchritt = { wort, dimensionen: aktiveDimensionen(wort, 3) };
const satzrolleOptionenListe = satzrolleOptionen(baueSchritte(ayah1, 3));

function renderKarte(overrides: Partial<Parameters<typeof WortFokusKarte>[0]> = {}) {
  const props = {
    schritt,
    index: 1,
    gesamt: 1,
    verseWords: ayah1,
    satzrolleOptionenListe,
    antwort: {} as Antwort,
    onAntwortChange: jest.fn(),
    aufgedeckt: false,
    onAufdecken: jest.fn(),
    onWeiter: jest.fn(),
    istLetzter: true,
    quranFont: FAKE_QURAN_FONT,
    ...overrides,
  };
  return render(<WortFokusKarte {...props} />, { wrapper: Wrapper });
}

describe('WortFokusKarte — vor dem Aufdecken', () => {
  it('zeigt weder richtig/falsch noch Begründung, bevor "Aufdecken" gedrückt wurde', async () => {
    await renderKarte();
    expect(screen.queryByText(t('analyseUebung.exercise.richtig'))).toBeNull();
    expect(screen.queryByText(t('analyseUebung.exercise.falsch'))).toBeNull();
    expect(screen.queryByText(t('analyseUebung.exercise.deineAntwort'), { exact: false })).toBeNull();
  });

  it('der "Aufdecken"-Knopf löst nichts aus, solange nicht alle drei Dimensionen beantwortet sind', async () => {
    const onAufdecken = jest.fn();
    await renderKarte({ antwort: { wortart: 'ism' }, onAufdecken });
    fireEvent.press(screen.getByText(t('analyseUebung.exercise.aufdecken')));
    expect(onAufdecken).not.toHaveBeenCalled();
  });

  it('der "Aufdecken"-Knopf funktioniert, sobald alle Dimensionen beantwortet sind', async () => {
    const onAufdecken = jest.fn();
    await renderKarte({ antwort: { wortart: 'ism', kasusTempus: 'gen', satzrolle: 'gen' }, onAufdecken });
    fireEvent.press(screen.getByText(t('analyseUebung.exercise.aufdecken')));
    expect(onAufdecken).toHaveBeenCalledTimes(1);
  });
});

describe('WortFokusKarte — nach dem Aufdecken', () => {
  it('markiert eine falsche Wortart-Antwort per Text (nicht nur Farbe) und nennt die richtige Antwort', async () => {
    await renderKarte({
      antwort: { wortart: 'fiil', kasusTempus: 'gen', satzrolle: 'gen' },
      aufgedeckt: true,
    });
    // "✗ Falsch" NUR für die Wortart (Nutzer wählte fiil, richtig ist ism) — Kasus/Satzrolle sind hier korrekt.
    expect(screen.getByText(`✗ ${t('analyseUebung.exercise.falsch')}`)).toBeTruthy();
    expect(
      screen.getByText(`${t('grammatik.wortarten.ism.name')} — ${t('grammatik.wortarten.ism.ar')}`, { exact: false }),
    ).toBeTruthy();
  });

  it('markiert eine korrekte Kasus-Antwort per Text (nicht nur Farbe)', async () => {
    await renderKarte({
      antwort: { wortart: 'ism', kasusTempus: 'gen', satzrolle: 'Poss' },
      aufgedeckt: true,
    });
    expect(screen.getAllByText(`✓ ${t('analyseUebung.exercise.richtig')}`).length).toBeGreaterThan(0);
  });

  it('zeigt bei der Satzrolle die ausführliche Begründung mit dem echten Bezugswort, nicht nur den generischen Optionsnamen', async () => {
    await renderKarte({
      antwort: { wortart: 'ism', kasusTempus: 'gen', satzrolle: 'Poss' }, // Poss ist falsch, richtig ist "gen"
      aufgedeckt: true,
    });
    expect(screen.getByText(t('grammatik.relationen.gen.info'))).toBeTruthy();
  });

  it('zeigt bei einem hergeleiteten Zusatzmerkmal (Bestimmtheit) sichtbar die Herkunfts-Kennzeichnung', async () => {
    await renderKarte({
      antwort: { wortart: 'ism', kasusTempus: 'gen', satzrolle: 'gen' },
      aufgedeckt: true,
    });
    fireEvent.press(screen.getByLabelText(t('analyseUebung.exercise.weitereMerkmale')));
    // Sowohl Numerus als auch Bestimmtheit sind für dieses Wort hergeleitet
    // (Fixture: derived: ['number', 'state']) — daher mindestens EINE Zeile,
    // nicht zwangsläufig genau eine.
    expect((await screen.findAllByText(t('grammatik.herkunft.hergeleitet.label'))).length).toBeGreaterThan(0);
  });
});
