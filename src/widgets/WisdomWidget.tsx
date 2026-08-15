'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { heightBucket, widthScale, type WidgetSize } from './widgetLayout';
import { cardGradient, hairline, WIDGET_THEMES, type WidgetTheme } from './widgetTheme';

// "use no memo" oben: siehe Kommentar in PrayerWidget.tsx (React-Compiler
// bricht sonst mit "Invalid Hook Call", da react-native-android-widget die
// Komponente als rohe Funktion aufruft statt sie echt zu rendern).
//
// Homescreen-Widget "Dua des Tages": rotiert täglich (oder zufällig) durch die
// geprüften Duas der App (Hisnul-Muslim-Kern-Set) — komplett offline, keine
// API nötig. Farbe/Deckkraft/Schriftgröße/Ecken/Inhalt sind PER-WIDGET über
// die Konfigurations-Activity einstellbar (WidgetConfig).
//
// GRÖSSEN-ADAPTIV (size-Prop, s. widgetLayout.ts): die Zeilenanzahl (maxLines)
// von arabischem Text/Übersetzung schrumpft mit der Höhe, statt den Text unten
// abzuschneiden — 'tall' zeigt alles (inkl. Quelle), 'compact' nur EINE
// Kern-Zeile (arabischer Text, sonst Übersetzung). Breite skaliert die Schrift.
export type { WidgetTheme };

export interface WisdomWidgetProps {
  title: string;
  arabic: string;
  translation: string;
  /** Quelle (Überlieferung/Sure); gesetzt + showSource = Quellen-Zeile zeigen. */
  source?: string;
  theme?: WidgetTheme;
  /** Hintergrund-Deckkraft in Prozent (0..100). Default 100 = voll deckend. */
  opacity?: number;
  /** Eckenradius der Karte in px. Default 20. */
  radius?: number;
  /** Multiplikator auf die Basis-Schriftgrößen (1 = unverändert). */
  fontScale?: number;
  /** Arabischen Text zeigen (default true). */
  showArabic?: boolean;
  /** Übersetzungs-Zeile unter dem arabischen Text zeigen (default true). */
  showTranslation?: boolean;
  /** Quellen-Zeile zeigen (default false). */
  showSource?: boolean;
  /** Textfarben-Override (Hex) für den Haupttext; undefined = Theme-Textfarbe. */
  textColor?: `#${string}`;
  /** Akzentfarben-Override (Hex) für den Titel; undefined = Theme-Akzentfarbe. */
  accentColor?: `#${string}`;
  /** Aktuelle Widget-Größe in DP (aus WidgetInfo) für das adaptive Layout. */
  size?: WidgetSize;
}

export function WisdomWidget({
  title,
  arabic,
  translation,
  source,
  theme = 'dark',
  opacity = 100,
  radius = 20,
  fontScale = 1,
  showArabic = true,
  showTranslation = true,
  showSource = false,
  textColor,
  accentColor,
  size,
}: WisdomWidgetProps) {
  const c = WIDGET_THEMES[theme];
  const text = textColor ?? c.text;
  const accent = accentColor ?? c.accent;
  const auto = widthScale(size?.width);
  const fs = (n: number) => Math.round(n * fontScale * auto);
  const bucket = heightBucket(size?.height);
  // Zeilen-Budget je Höhe: 'tall' voll, 'medium' knapper, 'compact' nur eine
  // Kern-Zeile. Bei 'compact' zeigen wir NUR den arabischen Text (bzw. die
  // Übersetzung, wenn Arabisch aus ist), damit nichts unten abschneidet.
  const arabicLines = bucket === 'tall' ? 2 : 1;
  const translationLines = bucket === 'tall' ? 3 : bucket === 'medium' ? 2 : 1;
  const showArabicLine = showArabic;
  // In compact nur eine Zeile: Übersetzung nur, wenn Arabisch nicht gezeigt wird.
  const showTranslationLine = showTranslation && (bucket !== 'compact' || !showArabicLine);
  const showSourceLine = showSource && bucket === 'tall';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        flex: 1,
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        justifyContent: bucket === 'compact' ? 'center' : 'flex-start',
        backgroundGradient: cardGradient(theme, opacity),
        borderRadius: radius,
        borderWidth: 1,
        borderColor: hairline(theme),
        padding: bucket === 'compact' ? 12 : 14,
      }}>
      {bucket !== 'compact' ? (
        <TextWidget text={title} truncate="END" maxLines={1} style={{ fontSize: 11, color: accent, fontWeight: '600', letterSpacing: 0.3 }} />
      ) : null}
      {showArabicLine ? (
        <TextWidget
          text={arabic}
          truncate="END"
          maxLines={arabicLines}
          style={{ fontSize: fs(17), color: text, marginTop: bucket === 'compact' ? 0 : 6, marginBottom: bucket === 'compact' ? 0 : 6 }}
        />
      ) : null}
      {showTranslationLine ? (
        <TextWidget text={translation} truncate="END" maxLines={translationLines} style={{ fontSize: fs(12), color: c.muted }} />
      ) : null}
      {showSourceLine && source ? (
        <TextWidget text={source} truncate="END" maxLines={1} style={{ fontSize: 10, color: c.muted, marginTop: 6 }} />
      ) : null}
    </FlexWidget>
  );
}
