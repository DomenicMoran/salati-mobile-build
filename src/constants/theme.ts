/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Salatibox-Markenpalette (identisch zu apps/device/src/app/globals.css)
export const Brand = {
  gold: '#d4af37',
  goldSoft: '#c9a96e',
  ink: '#0b0b0d',
  paper: '#f7f3ea',
} as const;

export const Colors = {
  light: {
    text: Brand.ink,
    background: Brand.paper,
    backgroundElement: '#F0EAD9',
    backgroundSelected: '#E8DFC7',
    // iOS-„systemGroupedBackground": ruhiger, dunklerer Grund, VOR dem die
    // abgerundeten Inset-Karten (groupedCard) deutlich heller stehen — die
    // Ebenen-Staffelung der iOS-Einstellungen (Seite dunkler, Karte heller).
    // Audit 2026-07-29: der frühere Grund #E4DCC7 stand nur 1.13:1 vor der
    // Karte #F0EAD9, die Kartenkanten verschwanden dadurch praktisch. Jetzt
    // 1.33:1 (Apple selbst liegt bei 1.17:1, hat aber eine rein achromatische
    // weiße Karte — auf warmem Papierton braucht es etwas mehr Abstand).
    groupedBackground: '#E2D9C2',
    // iOS-„secondarySystemGroupedBackground": die Zeilenfläche der
    // Inset-Gruppen. Bewusst NICHT backgroundElement — das bleibt die Farbe
    // der Chips/Eingabefelder, die INNERHALB dieser Karten sichtbar bleiben
    // müssen. Kontrast: textSecondary 6.25:1, accent 6.07:1, text 18.6:1.
    groupedCard: '#FCF9F2',
    // Hairline-Trenner zwischen Zeilen + Rahmen. Aus textSecondary abgeleitet,
    // damit Trenner und Sekundärtext derselben Tonfamilie angehören.
    separator: 'rgba(99,92,77,0.22)',
    // Audit 2026-07-27 (P2): #6B6455 verfehlte AA auf den dunkleren Flächen
    // (4.42:1 auf backgroundSelected, 4.29:1 auf groupedBackground, 4.32:1 auf
    // dem Sepia-Kartengrund #e9dcbf). #635C4D erreicht auf ALLEN Light-Flächen
    // ≥4.5:1 — berechnet: background 5.98:1, backgroundElement 5.52:1,
    // backgroundSelected 4.99:1, groupedBackground 4.85:1, Sepia-Karte 4.88:1.
    textSecondary: '#635C4D',
    // Dunkleres Gold für Text/Icons im Light Mode: Brand.gold (#d4af37) hat
    // auf Paper nur 1.9:1 Kontrast (WCAG-Fail). Der bisherige Wert #846200 war
    // auf Paper zwar gut (5.09:1), fiel aber auf backgroundSelected auf 4.24:1
    // durch (Audit 2026-07-27, N12) — betroffen war u. a. der generische
    // EmptyState-CTA. #785A00 erreicht auf ALLEN Light-Flächen ≥4.5:1 —
    // berechnet: background 5.81:1, backgroundElement 5.36:1,
    // backgroundSelected 4.85:1, groupedBackground 4.71:1, Sepia-Karte 4.74:1.
    // Dekorative Flächen (Progress-Fill, Nadel, Rahmen) nutzen weiter
    // Brand.gold direkt.
    accent: '#785A00',
  },
  dark: {
    text: Brand.paper,
    background: Brand.ink,
    backgroundElement: '#1A1A1D',
    backgroundSelected: '#242427',
    // Im Dark Mode ist die Seite (ink, fast schwarz) dunkler als die Karten
    // — wieder die iOS-Staffelung, nur invertiert (iOS: #000 vs. #1C1C1E).
    groupedBackground: Brand.ink,
    groupedCard: '#1C1C1F',
    separator: 'rgba(247,243,234,0.16)',
    textSecondary: 'rgba(247,243,234,0.65)',
    accent: Brand.gold,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

// Die arabische Schrift steht NICHT mehr hier: sie ist seit der Schriftauswahl
// einstellbar (KFGQPC HAFS Uthmanic, Amiri Quran, Scheherazade New, Noto Naskh
// Arabic). Registry + Metriken: features/quran/fonts.ts, Laden und fertiger
// Text-Style: features/quran/useQuranFont.ts, Herkunft/Lizenzen:
// assets/fonts/CREDITS.md.

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Web-only: Platz für den schwebenden Zurück-Chip auf Stack-Routen —
 * ohne diesen Versatz überlappt der Chip die Seitentitel (36px Chip
 * + 16px Abstand; nativ gibt es den Chip nicht). */
export const BackChipInset = Platform.OS === 'web' ? 44 : 0;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Einheitliche Icon-Badge-Größenskala (Audit 2026-07-22: vorher 32↔44 wild
 * gemischt). `section` = winziges Präfix-Badge einer Gruppen-Überschrift
 * (Einstellungen, Speicher, Benachrichtigungs-Übersicht — dekorativ, KEIN
 * Tap-Ziel, daher unter 44pt zulässig), `row` = kompakte Listen-Zeile (Mehr,
 * Moscheen, Studium-Hub, Erste-Schritte), `card` = große Feature-/Raster-Karte
 * (Lernen). Bewusst kompakt (Apple-Maß): lieber ruhig-dicht als aufgeblasen.
 */
export const IconBadge = {
  section: 20,
  row: 40,
  card: 44,
} as const;

/** Eckenradien der IconBadge-Stufen (gleiche Rundungs-Anmutung je Größe). */
export const IconBadgeRadius = {
  section: 6,
  row: 12,
  card: 12,
} as const;
