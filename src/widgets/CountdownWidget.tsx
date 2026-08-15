'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { heightBucket, widthScale, type WidgetSize } from './widgetLayout';
import { cardGradient, hairline, tint, WIDGET_THEMES, type WidgetTheme } from './widgetTheme';

// "use no memo" oben: siehe Kommentar in PrayerWidget.tsx (React-Compiler
// bricht sonst mit "Invalid Hook Call", da react-native-android-widget die
// Komponente als rohe Funktion aufruft statt sie echt zu rendern).
//
// Homescreen-Widget "Countdown": kompaktes Einzel-Widget, das nur das nächste
// Gebet groß zeigt — Name, Uhrzeit und die verbleibende Zeit als Text
// (z. B. "in 2h 15m"). Das Widget tickt NICHT sekündlich (Android aktualisiert
// Widgets höchstens alle 30 Min, updatePeriodMillis); die Restzeit ist der
// Stand des letzten Updates — deshalb bewusst "in Xh Ym", kein Live-Timer.
//
// GRÖSSEN-ADAPTIV (size-Prop, s. widgetLayout.ts): bei flacher Höhe (~1 Zelle)
// wird alles in EINE Zeile gelegt (Name + Uhrzeit links, Restzeit-Pille rechts);
// sonst das zentrierte Standard-Layout. Die Breite skaliert die Schrift
// proportional herunter, damit nichts überläuft.
export type { WidgetTheme };

export interface CountdownWidgetProps {
  title: string;
  nextName: string;
  nextTime: string;
  /** Verbleibende Zeit, bereits übersetzt formatiert (z. B. "in 2h 15m"). */
  remaining: string;
  /** Alle fünf Tageszeiten für die Zeiten-Reihe (medium/tall). Der Nutzer soll
   *  auch beim Countdown-Widget die fünf Gebete sehen, sobald etwas Höhe da ist. */
  rows?: { name: string; time: string; active: boolean; passed?: boolean }[];
  /** Nächstes Gebet in der Zeiten-Reihe farblich hervorheben (default true). */
  highlightNext?: boolean;
  theme?: WidgetTheme;
  /** Hintergrund-Deckkraft in Prozent (0..100). Default 100 = voll deckend. */
  opacity?: number;
  /** Eckenradius der Karte in px. Default 20. */
  radius?: number;
  /** Multiplikator auf die Basis-Schriftgrößen (1 = unverändert). */
  fontScale?: number;
  /** Ort/Titel-Zeile oben zeigen (default true). */
  showCoords?: boolean;
  /** Absolute Uhrzeit des nächsten Gebets zeigen (default true). */
  showNextTime?: boolean;
  /** Textfarben-Override (Hex) für den Haupttext; undefined = Theme-Textfarbe. */
  textColor?: `#${string}`;
  /** Akzentfarben-Override (Hex); undefined = Theme-Akzentfarbe. */
  accentColor?: `#${string}`;
  /** Aktuelle Widget-Größe in DP (aus WidgetInfo) für das adaptive Layout. */
  size?: WidgetSize;
}

export function CountdownWidget({
  title,
  nextName,
  nextTime,
  remaining,
  rows,
  highlightNext = true,
  theme = 'dark',
  opacity = 100,
  radius = 20,
  fontScale = 1,
  showCoords = true,
  showNextTime = true,
  textColor,
  accentColor,
  size,
}: CountdownWidgetProps) {
  const c = WIDGET_THEMES[theme];
  const text = textColor ?? c.text;
  const accent = accentColor ?? c.accent;
  const auto = widthScale(size?.width);
  const fs = (n: number) => Math.round(n * fontScale * auto);
  const dim = tint(text, 0.4);

  // Kompakte 5-Spalten-Zeiten-Reihe (nächstes Gebet hervorgehoben), identisch
  // zur Darstellung im Gebetszeiten-Widget — nur eingeblendet, wenn Zeiten
  // übergeben wurden und genug Höhe da ist.
  const timesRow = (data: NonNullable<CountdownWidgetProps['rows']>) =>
    data.map((r, i) => {
      const on = r.active && highlightNext;
      const nameColor = on ? accent : r.passed ? dim : c.muted;
      const timeColor = on ? accent : r.passed ? dim : text;
      return (
        <FlexWidget
          key={`${r.name}-${i}`}
          style={{
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 12,
            paddingHorizontal: 4,
            paddingVertical: 3,
            backgroundColor: on ? tint(accent, 0.16) : '#00000000',
          }}>
          <TextWidget text={r.name} truncate="END" maxLines={1} style={{ fontSize: fs(10), color: nameColor, letterSpacing: 0.2 }} />
          <TextWidget text={r.time} style={{ fontSize: fs(12), color: timeColor, fontWeight: on ? '700' : '500', marginTop: 2 }} />
        </FlexWidget>
      );
    });

  // compact (~1 Zelle hoch): alles in eine Zeile — Name + Uhrzeit links,
  // Restzeit-Pille rechts. Titel entfällt, um Höhe zu sparen.
  if (heightBucket(size?.height) === 'compact') {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          flex: 1,
          width: 'match_parent',
          height: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundGradient: cardGradient(theme, opacity),
          borderRadius: radius,
          borderWidth: 1,
          borderColor: hairline(theme),
          paddingHorizontal: 14,
          paddingVertical: 8,
        }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <TextWidget
            text={nextName}
            truncate="END"
            maxLines={1}
            style={{ fontSize: fs(18), color: accent, fontWeight: '700', letterSpacing: 0.2 }}
          />
          {showNextTime && nextTime ? (
            <TextWidget text={`  ${nextTime}`} style={{ fontSize: fs(18), color: text, fontWeight: '700' }} />
          ) : null}
        </FlexWidget>
        {remaining && (!size || size.width >= 150) ? (
          <FlexWidget
            style={{ backgroundColor: tint(accent, 0.16), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
            <TextWidget
              text={remaining}
              truncate="END"
              maxLines={1}
              style={{ fontSize: fs(12), color: accent, fontWeight: '600', letterSpacing: 0.2 }}
            />
          </FlexWidget>
        ) : null}
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        flex: 1,
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundGradient: cardGradient(theme, opacity),
        borderRadius: radius,
        borderWidth: 1,
        borderColor: hairline(theme),
        padding: 12,
      }}>
      {showCoords ? (
        <TextWidget
          text={title}
          truncate="END"
          maxLines={1}
          style={{ fontSize: 11, color: c.muted, letterSpacing: 0.3, marginBottom: 2 }}
        />
      ) : null}
      <TextWidget text={nextName} style={{ fontSize: fs(24), color: accent, fontWeight: '700', letterSpacing: 0.2 }} />
      {showNextTime ? (
        <TextWidget text={nextTime} style={{ fontSize: fs(20), color: text, fontWeight: '700', marginTop: 2 }} />
      ) : null}
      {remaining ? (
        <FlexWidget
          style={{
            backgroundColor: tint(accent, 0.16),
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 4,
            marginTop: 10,
          }}>
          <TextWidget text={remaining} style={{ fontSize: fs(12), color: accent, fontWeight: '600', letterSpacing: 0.2 }} />
        </FlexWidget>
      ) : null}
      {rows && rows.length > 0 ? (
        <FlexWidget
          style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', marginTop: 12 }}>
          {timesRow(rows)}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
