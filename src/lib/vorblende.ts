/**
 * Freigabe der Web-Vorblende (`data-vorblende` in `src/app/+html.tsx`).
 *
 * Der statische Web-Export rendert die Seite ohne Fenster und ohne
 * gespeicherte Einstellungen vor. Zwei Dinge ändern sich deshalb erst nach der
 * Hydration, jeweils auf einen Schlag:
 *
 *  • die SPRACHE — vorgerendert wird Deutsch/LTR; nur `de`/`en` sind gebündelt,
 *    alles andere kommt nachgeladen (src/lib/translate.ts);
 *  • das LAYOUT — `useLayout()` kennt die Fensterbreite erst auf dem Client,
 *    ein Tablet-Fenster springt also von der schmalen auf die breite Fassung
 *    (src/hooks/use-layout.ts).
 *
 * Gemessen am 30.07.2026: ohne Gegenmaßnahme CLS 0,30 bei gespeichertem
 * Arabisch in einem 1026 px breiten Fenster. Das Inline-Skript blendet den
 * Inhalt deshalb aus, solange einer dieser Sprünge noch aussteht — aber nur
 * dann. Ein deutschsprachiger Besuch auf einem schmalen Fenster wird nicht
 * angefasst und behält seinen LCP.
 *
 * Hier steht die Gegenseite: die Freigabe. Sie darf NICHT beim ersten Render
 * erfolgen. Der hat noch die Standardsprache, weil die Einstellungen
 * asynchron aus dem Speicher kommen — eine Freigabe an dieser Stelle zeigt
 * genau den deutschen Zwischenstand, den die Vorblende verhindern soll (so
 * gemessen: CLS blieb bei 0,30).
 */
import { useEffect } from 'react';

import { useSettings } from '@/features/settings/store';

import { isLocaleLoaded } from './translate';

type Grund = 'layout' | 'sprache';
type Fenster = { __salatiVorblendeFrei?: (grund?: Grund) => void };

/**
 * Gibt einen Grund frei (ohne Angabe: alle). Die Seite wird sichtbar, sobald
 * kein Grund mehr offen ist. Ohne Wirkung auf nativ und beim Server-Durchlauf.
 */
export function vorblendeFreigeben(grund?: Grund): void {
  if (typeof document === 'undefined') return;
  const w = globalThis as unknown as Fenster;
  if (typeof w.__salatiVorblendeFrei === 'function') w.__salatiVorblendeFrei(grund);
  else document.documentElement.removeAttribute('data-vorblende');
}

/**
 * Gibt die beiden Gründe getrennt frei, jeden so früh wie möglich.
 *
 * Getrennt, weil sie unterschiedlich lange brauchen: das Layout steht mit dem
 * ersten Client-Render (dieser Effekt), die Sprache erst mit der nachgeladenen
 * Datei. Beide zusammen freizugeben hieße, dass ein deutschsprachiger Besuch
 * auf etwas wartet, das ihn nichts angeht — im Livetest hing der LCP dadurch
 * bei 1,5 s, also am Sicherheitsnetz.
 *
 * Gehört in eine Komponente innerhalb des SettingsProvider und wird genau
 * einmal gebraucht (mehrfach schadet nicht, die Freigabe ist idempotent).
 */
export function useVorblendeFreigabe(): void {
  const { settings, loaded } = useSettings();
  const sprache = settings.language;
  const spracheDa = isLocaleLoaded(sprache);

  // Läuft nach dem ersten Commit — ab hier hat useLayout die echte
  // Fensterbreite geliefert und das Layout springt nicht mehr.
  useEffect(() => {
    vorblendeFreigeben('layout');
  }, []);

  useEffect(() => {
    if (!loaded || !spracheDa) return;
    vorblendeFreigeben('sprache');
  }, [loaded, spracheDa, sprache]);
}
