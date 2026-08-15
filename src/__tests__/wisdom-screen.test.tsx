/**
 * Weisheiten-Screen — Audit 2026-07-27, Bildschirm-Bericht M24.
 *
 * Die ganze Karte war ein `PressableCard` (Text teilen) MIT einem zweiten
 * `Pressable` darin (Als Bild teilen). Screenreader melden dann „Taste in
 * Taste"; im Web-Export entstanden zwei verschachtelte `<button>` — ungueltiges
 * HTML, das beim Parsen umgebaut wird und danach einen Hydration-Fehler
 * (React #418) ausloest. Genau diese Fehlerklasse wurde zuvor schon auf
 * /settings (Adhan-Auswahl) behoben.
 *
 * Der Test rastert den gerenderten Baum ab und verlangt, dass KEIN
 * fokussierbares/tappbares Element ein anderes enthaelt. Gegen den Stand vor
 * dem Fix ist er rot (2 Verschachtelungen: Karte des Tages + jede Listenkarte).
 *
 * Der Test liegt unter src/__tests__ und nicht neben dem Screen: expo-router
 * zieht jede Datei unter src/app per require.context als Route ins Bundle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import WisdomScreen from '@/app/wisdom';
import { SettingsProvider } from '@/features/settings/store';
import { translate } from '@/lib/i18n';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/types';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react') as typeof import('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

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

/** Knoten des gerenderten Baums — RNTL gibt `ReactTestInstance` zurueck; der
 *  Typ kommt aus react-test-renderer, das hier nicht als eigenes Paket
 *  installiert ist, deshalb nur die genutzte Teilform. */
interface TreeNode {
  type: unknown;
  props: Record<string, unknown>;
  children: (TreeNode | string)[];
}

/** Ein Knopf im Sinne der Plattform: RN setzt daraus nativ ein
 *  Accessibility-Element und im Web ein `<button>`. */
function isButton(node: TreeNode): boolean {
  const role = node.props.accessibilityRole ?? node.props.role;
  return role === 'button';
}

function collectNestedButtons(root: TreeNode): string[] {
  const problems: string[] = [];
  function walk(node: TreeNode, insideButton: string | null) {
    const button = isButton(node);
    const label = String(node.props.accessibilityLabel ?? node.props.testID ?? node.type);
    if (button && insideButton) problems.push(`${label} in ${insideButton}`);
    for (const child of node.children) {
      if (typeof child === 'string') continue;
      walk(child, button ? label : insideButton);
    }
  }
  walk(root, null);
  return problems;
}

describe('Weisheiten-Screen', () => {
  it('hat keinen Knopf in einem Knopf', async () => {
    const view = await render(<WisdomScreen />, { wrapper: Wrapper });
    expect(collectNestedButtons(view.root as unknown as TreeNode)).toEqual([]);
  });

  it('bietet weiterhin beide Aktionen an — Text teilen UND als Bild teilen', async () => {
    const view = await render(<WisdomScreen />, { wrapper: Wrapper });
    // Beide Aktionen existieren mehrfach (Karte des Tages + Liste); wichtig
    // ist, dass keine von beiden der Entschachtelung zum Opfer fiel.
    expect(view.getAllByLabelText(translate('de', 'wisdom.share')).length).toBeGreaterThan(0);
    expect(view.getAllByLabelText(translate('de', 'wisdom.shareImage')).length).toBeGreaterThan(0);
  });
});
