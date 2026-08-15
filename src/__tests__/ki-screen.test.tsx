/**
 * Salati-KI-Screen — Render- und Antwort-Test des ZITAT-MODUS.
 *
 * Anlass: Mit dem Zitat-Modus (docs/audit-2026-07-27/KI-ZITATMODUS.md) ist aus
 * dem Screen der komplette Modell-Lebenszyklus verschwunden — Download,
 * Fortschritt, Ladefehler, Abbrechen-Knopf, Beta-Sprachschalter. Übrig bleibt
 * ein Pfad: Frage → Retrieval → wörtliche Zitate mit Quellenangabe. Genau den
 * prüft dieser Test, und zwar am echten, gebündelten Korpus (7.144 Dokumente).
 *
 * Der Test liegt unter src/__tests__ und NICHT neben dem Screen: expo-router
 * zieht jede Datei unter src/app per require.context als Route ins Bundle.
 *
 * Beschriftungen kommen aus `translate()` statt als feste deutsche Zeichenkette
 * — ein Test, der nur auf Deutsch grün ist, prüft die Sprache statt den Screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import KiNativeScreen from '@/app/ki-native';
import { normalisiereZitat } from '@/features/ki/zitat';
import { SettingsProvider } from '@/features/settings/store';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';
import { translate } from '@/lib/i18n';
import korpus from '../../public/rag/korpus-de.json';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react') as typeof import('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

// Der Screen zieht beim Öffnen den übersetzten Korpus von R2 nach. Ohne
// Dateisystem bleibt es beim gebündelten deutschen Stand — genau der Zustand,
// den jede Nutzerin mit deutscher Oberfläche sieht, und er braucht kein Netz.
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: null }));

const t = (key: string) => translate('de', key);

// Abgefragt wird über das Accessibility-Label des Eingabefelds — eine
// Platzhalter-Abfrage gibt es in dieser Version von
// @testing-library/react-native nicht.
//
// Der Screen ist erst benutzbar, wenn der BM25-Index über die 7.144
// gebündelten Dokumente steht. Auf dem Gerät sind das ~150 ms, unter Jest mit
// Babel-Instrumentierung mehr — die Standard-Wartezeit von 1 s trägt das nicht.
const WARTE = { timeout: 20_000 };
jest.setTimeout(60_000);

function Wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

/** Das Eingabefeld, immer frisch aus dem Baum. */
const feld = () => screen.getByLabelText(t('ki.inputPlaceholder'));

/** Rendert und wartet, bis der Chat steht. Gibt das Eingabefeld zurück. */
async function screenOeffnen() {
  await render(<KiNativeScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByText(t('ki.welcome'))).toBeTruthy(), WARTE);
  return feld();
}

async function frageStellen(text: string) {
  const eingabe = await screenOeffnen();
  fireEvent.changeText(eingabe, text);
  // Erst abschicken, wenn der Eingabetext auch wirklich im Zustand steht:
  // `senden()` liest ihn aus der Closure des aktuellen Renderings. Wird zu
  // früh abgeschickt, ist er dort noch leer und der Versuch verpufft
  // stillschweigend — der Test wäre grün, ohne etwas zu prüfen.
  await waitFor(() => expect(feld().props.value).toBe(text), WARTE);
  fireEvent(feld(), 'submitEditing');
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, language: 'de' }));
});

describe('KI-Screen im Zitat-Modus', () => {
  it('ist sofort benutzbar — ohne Download, ohne Ladezustand', async () => {
    const eingabe = await screenOeffnen();
    // Eingabefeld da = der Screen ist bereit. Früher stand hier zuerst die
    // Download-Karte für ein 1,1-GB-Modell.
    expect(eingabe).toBeTruthy();
    expect(screen.getByLabelText(t('a11y.back'))).toBeTruthy();
  });

  it('zeigt den KI-Kennzeichnungshinweis (EU AI Act Art. 50)', async () => {
    await screenOeffnen();
    expect(screen.getByText(t('ki.aiDisclosure'))).toBeTruthy();
  });

  it('bietet weder Beta-Sprachschalter noch Modell-Bedienelemente an', async () => {
    await screenOeffnen();
    // Die Schlüssel sind entfernt; translate() gibt dann den Schlüssel zurück.
    for (const weg of ['ki.answerInMyLanguage', 'ki.answerInMyLanguageWarning', 'ki.downloadButton', 'ki.stop', 'ki.loadingModel']) {
      expect(screen.queryByText(weg)).toBeNull();
      expect(screen.queryByText(translate('de', weg))).toBeNull();
    }
  });

  it('beantwortet eine Frage mit wörtlichen Zitaten und nennt die Quelle', async () => {
    await frageStellen('Ist Alkohol im Islam erlaubt?');
    // Die Quellenzeile erscheint nur an einer Antwort mit Quellen.
    await waitFor(() => expect(screen.getByText(t('ki.sourcesLabel'))).toBeTruthy(), WARTE);
    // Die Quellenangabe des erwarteten Eintrags ist antippbar sichtbar.
    expect(screen.getByText('Salati-Wissen: Alkohol im Islam')).toBeTruthy();
    // Und die Antwort sagt, was die Quelle sagt — nicht das Gegenteil.
    expect(screen.getByText(/Berauschende Getränke sind im Islam verboten/)).toBeTruthy();
  });

  it('zeigt nichts an, was nicht wörtlich in einer Quelle steht', async () => {
    await frageStellen('Wie viele Rakat hat das Mittagsgebet Dhuhr?');
    await waitFor(() => expect(screen.getByText(t('ki.sourcesLabel'))).toBeTruthy(), WARTE);
    const knoten = screen.getByText(/Dhuhr hat vier Rakat/);
    const angezeigt = String(knoten.props.children ?? '');
    // Gegenprobe am ANGEZEIGTEN Text: jeder Zitatblock muss wörtlich im
    // gebündelten Korpus stehen. Das ist die Zusage, auf der der Wegfall des
    // Beta-Hinweises beruht — hier an der Oberfläche geprüft, nicht in der Logik.
    const bloecke = angezeigt.split('\n\n');
    expect(bloecke.length).toBeGreaterThan(0);
    for (const block of bloecke) {
      const zitat = block.split('\n—')[0]!.replace(/^„/, '').replace(/“$/, '');
      const belegt = (korpus as { docs: { t: string }[] }).docs.some((d) =>
        normalisiereZitat(d.t).includes(normalisiereZitat(zitat)),
      );
      expect(belegt).toBe(true);
    }
  });

  it('sagt ehrlich Bescheid, wenn der Korpus nichts hergibt', async () => {
    await frageStellen('zzzqqqxyz');
    await waitFor(() => expect(screen.getByText(t('ki.noAnswer'))).toBeTruthy(), WARTE);
  });
});
