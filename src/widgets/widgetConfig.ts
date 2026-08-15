// PER-WIDGET-INSTANZ-Konfiguration für die Homescreen-Widgets.
//
// react-native-android-widget 0.21 unterstützt eine RN-Konfigurations-Activity
// (registerWidgetConfigurationScreen, siehe index.android.js +
// WidgetConfigScreen.tsx). Beim langen Drücken → "Konfigurieren" öffnet Android
// diese Activity und übergibt die konkrete widgetId. Die dort gewählten
// Einstellungen (Theme/Transparenz/Inhalts-Toggles) werden PRO widgetId hier in
// AsyncStorage abgelegt und vom Headless-Handler (widget-task-handler.tsx) beim
// Rendern angewendet.
//
// Auflösungsreihenfolge (resolveWidgetConfig): Instanz-Wert > globaler Default
// (AppSettings.widgetTheme bzw. sinnvolle Anzeige-Defaults). Ein Widget OHNE
// eigene Konfiguration verhält sich damit exakt wie bisher (globales Theme,
// alle Inhalte sichtbar) — 100 % abwärtskompatibel zu bereits platzierten
// Widgets.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppSettings } from '@/features/settings/types';
import type {
  WidgetCornerStyle,
  WidgetFontScale,
  WidgetOpacity,
  WidgetTextColor,
  WidgetTheme,
} from './widgetTheme';

/** Prayer/Countdown: Zeitformat-Override ('auto' = globale App-Einstellung). */
export type WidgetTimeFormat = 'auto' | '24h' | '12h';
/** Wisdom/Dua: tägliche (fest rotierend) vs. zufällige Auswahl bei jedem Update. */
export type WidgetDuaSelection = 'daily' | 'random';

/** Pro widgetId gespeicherte Overrides. Alle Felder optional → Fallback global. */
export interface WidgetInstanceConfig {
  /** Farbthema (7 Themen inkl. transparent). Fällt auf globales Theme zurück. */
  theme?: WidgetTheme;
  /** Halbtransparenter Kartenhintergrund über dem gewählten Theme (Alt-Feld,
   *  bleibt für bereits platzierte Widgets wirksam; neue Auswahl nutzt
   *  backgroundOpacity). */
  transparent?: boolean;
  /** Hintergrund-Deckkraft in Stufen (0/25/50/75/100 %). Überschreibt transparent. */
  backgroundOpacity?: WidgetOpacity;
  /** Textfarben-Override für den Haupttext ('default' = Theme-Textfarbe). */
  textColor?: WidgetTextColor;
  /** Akzentfarbe für nächstes Gebet / aktive Zeile / Streak-Zahl ('default' = Theme-Akzent). */
  accentColor?: WidgetTextColor;
  /** Schriftgröße des Haupttexts (klein/mittel/groß). */
  fontScale?: WidgetFontScale;
  /** Eckenradius/Rundung der Widget-Karte. */
  cornerStyle?: WidgetCornerStyle;
  /** Prayer/Countdown: Ort/Standort-Zeile zeigen. */
  showCoords?: boolean;
  /** Prayer/Countdown: "nächste Gebetszeit" zeigen. */
  showNextTime?: boolean;
  /** Prayer/Countdown: Zeitformat-Override (12h/24h) statt globaler Einstellung. */
  timeFormat?: WidgetTimeFormat;
  /** Prayer: Hijri-Datum (islamischer Kalender) einblenden. */
  showHijri?: boolean;
  /** Prayer: Sonnenaufgang zusätzlich zu den 5 Pflichtgebeten anzeigen. */
  showSunrise?: boolean;
  /** Prayer: nächstes Gebet in der Zeiten-Zeile farblich hervorheben. */
  highlightNext?: boolean;
  /** Prayer: Countdown-Zeile ("in Xh Ym") unter den Zeiten zeigen. */
  showCountdown?: boolean;
  /** Wisdom: arabischen Text zeigen. */
  showArabic?: boolean;
  /** Wisdom: Übersetzung unter dem arabischen Text zeigen. */
  showTranslation?: boolean;
  /** Wisdom: Quelle (Überlieferung/Sure) zeigen. */
  showSource?: boolean;
  /** Wisdom: tägliche vs. zufällige Auswahl. */
  duaSelection?: WidgetDuaSelection;
  /** Qibla: Entfernung zur Kaaba zeigen. */
  showDistance?: boolean;
  /** Qibla: Gradzahl (Bearing) zeigen. */
  showBearing?: boolean;
  /** Qibla: Himmelsrichtung als Wort zeigen. */
  showDirection?: boolean;
  /** Streak: Serien-Zahl besonders groß darstellen. */
  streakLarge?: boolean;
  /** Streak: Label unter der Zahl zeigen. */
  showStreakLabel?: boolean;
}

/** Vollständig aufgelöste Konfiguration (keine optionalen Felder mehr). */
export interface ResolvedWidgetConfig {
  theme: WidgetTheme;
  transparent: boolean;
  backgroundOpacity: number;
  textColor: WidgetTextColor;
  accentColor: WidgetTextColor;
  fontScale: WidgetFontScale;
  cornerStyle: WidgetCornerStyle;
  showCoords: boolean;
  showNextTime: boolean;
  timeFormat: WidgetTimeFormat;
  showHijri: boolean;
  showSunrise: boolean;
  highlightNext: boolean;
  showCountdown: boolean;
  showArabic: boolean;
  showTranslation: boolean;
  showSource: boolean;
  duaSelection: WidgetDuaSelection;
  showDistance: boolean;
  showBearing: boolean;
  showDirection: boolean;
  streakLarge: boolean;
  showStreakLabel: boolean;
}

const CONFIG_KEY_PREFIX = 'salati.widget.config.';

/** AsyncStorage-Key für eine konkrete widgetId. */
export function widgetConfigKey(widgetId: number): string {
  return `${CONFIG_KEY_PREFIX}${widgetId}`;
}

/**
 * "Light"-Suffix der Kompatibilitäts-Provider abstreifen, sodass der Basis-
 * Widgettyp übrig bleibt (SalatiPrayer, SalatiCountdown, …). Wird sowohl vom
 * Handler als auch vom Config-Screen genutzt, damit beide identisch mappen.
 */
export function baseWidgetName(name: string): string {
  return name.endsWith('Light') ? name.slice(0, -'Light'.length) : name;
}

/** Inhalts-Toggle-Schlüssel je Widgettyp (steuert die Boolean-Schalter im Config-Screen). */
export type WidgetContentToggle =
  | 'showCoords'
  | 'showNextTime'
  | 'showHijri'
  | 'showSunrise'
  | 'highlightNext'
  | 'showCountdown'
  | 'showArabic'
  | 'showTranslation'
  | 'showSource'
  | 'showDistance'
  | 'showBearing'
  | 'showDirection'
  | 'streakLarge'
  | 'showStreakLabel';

const CONTENT_TOGGLES: Record<string, WidgetContentToggle[]> = {
  SalatiPrayer: ['showCoords', 'showNextTime', 'highlightNext', 'showCountdown', 'showHijri', 'showSunrise'],
  SalatiCountdown: ['showCoords', 'showNextTime'],
  SalatiWisdom: ['showArabic', 'showTranslation', 'showSource'],
  SalatiQibla: ['showBearing', 'showDirection', 'showDistance'],
  SalatiStreak: ['streakLarge', 'showStreakLabel'],
};

/** Welche Inhalts-Toggles gelten für diesen Widget-Namen (Light-Suffix egal)? */
export function widgetContentToggles(widgetName: string): WidgetContentToggle[] {
  return CONTENT_TOGGLES[baseWidgetName(widgetName)] ?? [];
}

/** Gespeicherte Instanz-Konfiguration lesen (leeres Objekt, wenn keine da). */
export async function getWidgetConfig(widgetId: number): Promise<WidgetInstanceConfig> {
  try {
    const raw = await AsyncStorage.getItem(widgetConfigKey(widgetId));
    if (!raw) return {};
    return JSON.parse(raw) as WidgetInstanceConfig;
  } catch {
    return {};
  }
}

/** Instanz-Konfiguration mergen + persistieren (partielles Update). */
export async function setWidgetConfig(
  widgetId: number,
  patch: Partial<WidgetInstanceConfig>,
): Promise<WidgetInstanceConfig> {
  const current = await getWidgetConfig(widgetId);
  const next = { ...current, ...patch };
  try {
    await AsyncStorage.setItem(widgetConfigKey(widgetId), JSON.stringify(next));
  } catch {
    // Persistenz-Fehler schluckt der Storage still — Widget bleibt nutzbar.
  }
  return next;
}

/**
 * Effektive Konfiguration aus Instanz-Override + globalen Einstellungen.
 * Theme: Instanz-Theme, sonst globales AppSettings.widgetTheme.
 * Anzeige-Toggles: default true (alle Inhalte sichtbar wie bisher).
 */
export function resolveWidgetConfig(
  config: WidgetInstanceConfig,
  _widgetName: string,
  settings: AppSettings,
): ResolvedWidgetConfig {
  const theme = config.theme ?? settings.widgetTheme;
  // Deckkraft: explizite Stufe gewinnt; sonst leiten wir sie abwärtskompatibel
  // aus dem Alt-Toggle bzw. dem inhärent halbtransparenten "transparent"-Theme
  // ab (beide ~75 %), damit bereits platzierte Widgets gleich aussehen.
  const backgroundOpacity =
    config.backgroundOpacity ?? (config.transparent || theme === 'transparent' ? 75 : 100);
  return {
    theme,
    transparent: config.transparent ?? false,
    backgroundOpacity,
    textColor: config.textColor ?? 'default',
    accentColor: config.accentColor ?? 'default',
    fontScale: config.fontScale ?? 'medium',
    cornerStyle: config.cornerStyle ?? 'rounded',
    showCoords: config.showCoords ?? true,
    showNextTime: config.showNextTime ?? true,
    timeFormat: config.timeFormat ?? 'auto',
    showHijri: config.showHijri ?? false,
    showSunrise: config.showSunrise ?? false,
    highlightNext: config.highlightNext ?? true,
    showCountdown: config.showCountdown ?? false,
    showArabic: config.showArabic ?? true,
    showTranslation: config.showTranslation ?? true,
    showSource: config.showSource ?? false,
    duaSelection: config.duaSelection ?? 'daily',
    showDistance: config.showDistance ?? true,
    showBearing: config.showBearing ?? true,
    showDirection: config.showDirection ?? true,
    streakLarge: config.streakLarge ?? false,
    showStreakLabel: config.showStreakLabel ?? true,
  };
}

/** Effektives Zeitformat: Instanz-Override ('auto' = globale App-Einstellung). */
export function resolveTimeFormat(
  cfg: ResolvedWidgetConfig,
  settings: AppSettings,
): '24h' | '12h' {
  return cfg.timeFormat === 'auto' ? settings.timeFormat : cfg.timeFormat;
}
