// Sprungziele der Handy-Fernbedienung für Salati TV (Audit 2026-07-28, T14).
//
// Befund: die Fernbedienung kannte sechs Ziele, die TV-App elf Bildschirme —
// `reels`, `quran`, `settings`, `pairing` und der Home-Hub waren vom Handy aus
// überhaupt nicht erreichbar. Ursache war nicht ein vergessener Eintrag,
// sondern dass beide Listen unabhängig voneinander gepflegt wurden.
//
// Gegenmaßnahme auf zwei Ebenen:
//  1) Zur Laufzeit meldet der Fernseher seine Bildschirme im Handshake
//     (`{ t:'welcome', screens }`, siehe apps/tv/src/lib/pairing.ts). Der
//     Katalog hier liefert nur noch Beschriftung und Symbol dazu. Ein neuerer
//     Fernseher an einem älteren Handy bleibt damit vollständig bedienbar.
//  2) Zur Bauzeit prüft `screens.test.ts` diesen Katalog gegen
//     `apps/tv/src/lib/nav.ts` — ein neuer TV-Bildschirm ohne Eintrag hier
//     macht den Test rot, statt still unerreichbar zu bleiben.
import type { IconName } from '@/components/ui/icon-symbol';

export interface TvShortcut {
  /** Screen-Name aus `apps/tv/src/lib/nav.ts`. */
  screen: string;
  /** Locale-Schlüssel; `null` für einen Bildschirm, den dieses Handy nicht kennt. */
  labelKey: string | null;
  icon: IconName;
}

/** Symbol für einen vom Fernseher gemeldeten, hier unbekannten Bildschirm. */
const UNKNOWN_ICON: IconName = 'ellipsis-horizontal-circle-outline';

/**
 * Reihenfolge wie in `apps/tv/src/lib/nav.ts` — die Kacheln stehen dann in
 * derselben Ordnung wie am Fernseher.
 */
export const TV_SHORTCUTS: TvShortcut[] = [
  { screen: 'clock', labelKey: 'tvRemote.clock', icon: 'time-outline' },
  { screen: 'home', labelKey: 'tvRemote.home', icon: 'home-outline' },
  { screen: 'videos', labelKey: 'tvRemote.videos', icon: 'film-outline' },
  { screen: 'reels', labelKey: 'tvRemote.reels', icon: 'play-circle-outline' },
  { screen: 'radio', labelKey: 'tvRemote.radio', icon: 'radio-outline' },
  { screen: 'reciters', labelKey: 'tvRemote.reciters', icon: 'book-outline' },
  { screen: 'quran', labelKey: 'tvRemote.quran', icon: 'reader-outline' },
  { screen: 'podcasts', labelKey: 'tvRemote.podcasts', icon: 'headset-outline' },
  { screen: 'quiz', labelKey: 'tvRemote.quiz', icon: 'help-circle-outline' },
  { screen: 'pairing', labelKey: 'tvRemote.pairing', icon: 'qr-code-outline' },
  { screen: 'settings', labelKey: 'tvRemote.settings', icon: 'settings-outline' },
];

const BY_SCREEN = new Map(TV_SHORTCUTS.map((s) => [s.screen, s]));

/**
 * Die anzuzeigenden Sprungziele.
 *
 * `reported` ist die Liste aus dem Handshake. Ohne sie (älterer Fernseher oder
 * noch nicht verbunden) gilt der volle Katalog. Ein gemeldeter Bildschirm ohne
 * Katalog-Eintrag wird trotzdem angeboten — unbeschriftet erreichbar ist besser
 * als gar nicht erreichbar, und genau dieser Fall war der Befund.
 */
export function tvShortcutsFor(reported?: readonly string[] | null): TvShortcut[] {
  if (!reported || reported.length === 0) return TV_SHORTCUTS;
  return reported.map(
    (screen) => BY_SCREEN.get(screen) ?? { screen, labelKey: null, icon: UNKNOWN_ICON },
  );
}
