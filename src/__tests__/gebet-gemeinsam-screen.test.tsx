/**
 * "Gemeinsam beten" (Dschamāʿa) — Datenmodell- und Render-Test.
 *
 * Der wichtigste Test hier ist "jede Regel hat Quelle und Sicherheitsgrad":
 * er verhindert, dass eine künftige Änderung eine religiöse Rechtsaussage
 * ohne Beleg (Quran/Hadith-Angabe) oder ohne sichtbaren Sicherheitsgrad
 * (anerkannt/strittig/empfehlung) in die App bringt — genau die Sorgfaltspflicht
 * aus dem Kopfkommentar von features/gebet-gemeinsam/daten.ts.
 *
 * Der Test liegt unter src/__tests__ und NICHT neben dem Screen: expo-router
 * zieht jede Datei unter src/app per require.context als Route ins Bundle
 * (gleiches Muster wie khatmah-screen.test.tsx/wisdom-screen.test.tsx).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import GebetGemeinsamScreen from '@/app/gebet-gemeinsam/index';
import {
  ALL_GEBET_GEMEINSAM_REGELN,
  AUFSTELLUNGEN,
  type Sicherheitsgrad,
} from '@/features/gebet-gemeinsam/daten';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react') as typeof import('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

const t = (key: string) => translate('de', key);

function Wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  // Feste Sprache — sonst entscheidet die Geraete-Erkennung des Testlaeufers.
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }),
  );
});

const VALID_GRADE: Sicherheitsgrad[] = ['anerkannt', 'strittig', 'empfehlung'];

describe('Datenmodell: jede Regel hat Quelle und Sicherheitsgrad', () => {
  it('deckt alle drei Abschnitte ab und enthaelt mindestens eine Regel je Grad', () => {
    expect(ALL_GEBET_GEMEINSAM_REGELN.length).toBeGreaterThanOrEqual(10);
    const grades = new Set(ALL_GEBET_GEMEINSAM_REGELN.map((r) => r.grad));
    // Alle drei Sicherheitsgrade muessen tatsaechlich vorkommen — sonst waere
    // die optische Trennung im Screen ungetestet.
    expect(grades).toEqual(new Set(VALID_GRADE));
  });

  it.each(ALL_GEBET_GEMEINSAM_REGELN.map((r) => [r.id, r] as const))(
    'Regel "%s" hat einen gueltigen Sicherheitsgrad, eine Rechtsschul-Angabe und (ausser bei Empfehlungen) eine Quelle',
    (_id, regel) => {
      expect(VALID_GRADE).toContain(regel.grad);
      expect(['alle', 'hanafi', 'verschieden']).toContain(regel.madhhab);
      expect(regel.titelKey.length).toBeGreaterThan(0);
      expect(regel.textKey.length).toBeGreaterThan(0);
      if (regel.grad === 'empfehlung') {
        // Ein reiner Praxistipp darf KEINE Rechtsnorm vortaeuschen — daher
        // ausdruecklich ohne Quran-/Hadith-Quelle.
        expect(regel.source).toBeNull();
      } else {
        expect(regel.source).toEqual(expect.any(String));
        expect((regel.source ?? '').length).toBeGreaterThan(0);
      }
      // Jeder Titel/Text muss in der deutschen Locale tatsaechlich aufgeloest
      // sein (kein liegen gebliebener Schluessel ohne Uebersetzung).
      expect(t(regel.titelKey)).not.toBe(regel.titelKey);
      expect(t(regel.textKey)).not.toBe(regel.textKey);
    },
  );
});

describe('Datenmodell: alle Konstellationen', () => {
  it('enthaelt alle 5 im Auftrag genannten Aufstellungen', () => {
    expect(AUFSTELLUNGEN.map((k) => k.id).sort()).toEqual(
      ['dreiPersonen', 'familienrunde', 'groessereGruppe', 'imamEhefrau', 'zweiPersonen'].sort(),
    );
  });

  it('jede Konstellation hat genau einen Imam und mindestens eine Reihe', () => {
    for (const k of AUFSTELLUNGEN) {
      expect(k.reihen.length).toBeGreaterThan(0);
      const imamCount = k.reihen.flat().filter((rolle) => rolle === 'imam').length;
      expect(imamCount).toBe(1);
      expect(t(k.titelKey)).not.toBe(k.titelKey);
      expect(t(k.beschreibungKey)).not.toBe(k.beschreibungKey);
    }
  });

  it('die Zwei-Personen-Konstellation stellt den Mitbeter in dieselbe Reihe wie den Imam (rechts daneben)', () => {
    const zwei = AUFSTELLUNGEN.find((k) => k.id === 'zweiPersonen');
    expect(zwei?.reihen).toEqual([['imam', 'mann']]);
  });
});

describe('Gemeinsam-beten-Screen', () => {
  it('rendert Titel, alle Konstellations-Titel und alle Regel-Titel', async () => {
    await render(<GebetGemeinsamScreen />, { wrapper: Wrapper });

    expect(await screen.findByText(t('gebetGemeinsam.title'))).toBeTruthy();

    for (const k of AUFSTELLUNGEN) {
      // getAllByText statt getByText: die Familienrunden-Konstellation und
      // die gleichnamige Regel teilen bewusst denselben Titeltext.
      expect(screen.getAllByText(t(k.titelKey)).length).toBeGreaterThan(0);
    }
    for (const regel of ALL_GEBET_GEMEINSAM_REGELN) {
      expect(screen.getAllByText(t(regel.titelKey)).length).toBeGreaterThan(0);
    }
  });

  it('zeigt fuer jede Regel den Sicherheitsgrad-Text sichtbar an', async () => {
    await render(<GebetGemeinsamScreen />, { wrapper: Wrapper });
    // Mindestens einmal jeder der drei Grad-Beschriftungen, da mehrere Regeln
    // denselben Grad teilen koennen (getAllByText statt getByText).
    for (const grad of VALID_GRADE) {
      expect(screen.getAllByText(t(`gebetGemeinsam.grad.${grad}`)).length).toBeGreaterThan(0);
    }
  });

  it('zeigt die Quelle jeder nicht-empfehlenden Regel im Text an', async () => {
    await render(<GebetGemeinsamScreen />, { wrapper: Wrapper });
    for (const regel of ALL_GEBET_GEMEINSAM_REGELN) {
      if (regel.source) {
        // Manche Quellen (z. B. Sahih al-Bukhari 727) belegen bewusst zwei
        // verschiedene Regeln zugleich — getAllByText statt getByText.
        const pattern = new RegExp(regel.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        expect(screen.getAllByText(pattern).length).toBeGreaterThan(0);
      }
    }
  });
});
