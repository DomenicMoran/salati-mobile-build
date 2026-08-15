'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { heightBucket, widthScale, type WidgetSize } from './widgetLayout';
import { cardGradient, hairline, tint, WIDGET_THEMES, type WidgetTheme } from './widgetTheme';

// "use no memo" oben: react-native-android-widget ruft Widget-Komponenten
// als rohe Funktion auf (jsxTree.type(props), kein echter React-Render) -
// der React-19-Compiler (app.config.ts reactCompiler:true) transformiert
// PascalCase-Funktionen sonst auf useMemoCache-Hooks, was hier mit
// "Invalid Hook Call" crasht (live im Emulator reproduziert, Widget blieb
// leer). Betrifft auch StreakWidget.tsx/WisdomWidget.tsx.
//
// Homescreen-Widget "Gebetszeiten": nächstes Gebet groß + alle fünf Zeiten
// des Tages. Farbe/Deckkraft/Schriftgröße/Ecken/Inhalt sind PER-WIDGET über
// die Konfigurations-Activity einstellbar (WidgetConfig) — Palette/Begründung
// s. widgetTheme.ts.
//
// GRÖSSEN-ADAPTIV (size-Prop, DP aus WidgetInfo, s. widgetLayout.ts): das
// Widget rendert je nach verfügbarer Höhe eine andere Dichtestufe, damit ein
// flaches Widget (z. B. 4×1) die wichtigste Info kompakt hineinquetscht statt
// unten abzuschneiden.
//  - 'tall'    (>= 175dp): Standort/Hijri + großes nächstes Gebet + Trennlinie
//                          + alle 5 Zeiten + Fortschrittsleiste + Countdown-Pille
//                          (volles Layout, alle Inhalts-Toggles greifen).
//  - 'medium'  (100–175dp): großes nächstes Gebet + kompakte 5-Zeiten-Reihe.
//  - 'compact' (< 100dp):  nächstes Gebet + Restzeit prominent in EINER Zeile.
// Die vom Nutzer gewählten Inhalts-Toggles wirken als OBERGRENZE (aus = nie
// zeigen); die Größe bestimmt, wie viel von den erlaubten Inhalten Platz findet.
// Fehlt size (0/undefined, z. B. direkt nach dem Platzieren, bevor der Launcher
// gemessen hat) → 'tall' = bisheriges Voll-Layout, nichts regressiert.

export type { WidgetTheme };

export interface PrayerWidgetProps {
  title: string;
  nextName: string;
  nextTime: string;
  rows: { name: string; time: string; active: boolean; passed?: boolean }[];
  theme?: WidgetTheme;
  /** Hintergrund-Deckkraft in Prozent (0..100). Default 100 = voll deckend. */
  opacity?: number;
  /** Eckenradius der Karte in px. Default 20. */
  radius?: number;
  /** Multiplikator auf die Basis-Schriftgrößen (1 = unverändert). */
  fontScale?: number;
  /** Standort-Zeile oben zeigen (default true). */
  showCoords?: boolean;
  /** Große "nächstes Gebet"-Zeile (Name + Uhrzeit) zeigen (default true). */
  showNextTime?: boolean;
  /** Nächstes Gebet in der Zeiten-Zeile farblich hervorheben (default true). */
  highlightNext?: boolean;
  /** Countdown-Zeile ("in Xh Ym") unter den Zeiten zeigen (default false). */
  showCountdown?: boolean;
  /** Bereits formatierte Restzeit für die Countdown-Zeile (z. B. "in 2h 15m"). */
  remaining?: string;
  /**
   * Fortschritt vom vorigen zum nächsten Gebet (0..1) für die dünne
   * Fortschrittsleiste. undefined = keine Leiste (z. B. wenn kein sinnvoller
   * Bezugspunkt existiert). Reiner Anzeigewert vom letzten Widget-Update.
   */
  progress?: number;
  /** Bereits formatiertes Hijri-Datum; gesetzt = Hijri-Zeile zeigen. */
  hijri?: string;
  /** Textfarben-Override (Hex) für den Haupttext; undefined = Theme-Textfarbe. */
  textColor?: `#${string}`;
  /** Akzentfarben-Override (Hex); undefined = Theme-Akzentfarbe. */
  accentColor?: `#${string}`;
  /** Aktuelle Widget-Größe in DP (aus WidgetInfo) für das adaptive Layout. */
  size?: WidgetSize;
}

export function PrayerWidget({
  title,
  nextName,
  nextTime,
  rows,
  theme = 'dark',
  opacity = 100,
  radius = 20,
  fontScale = 1,
  showCoords = true,
  showNextTime = true,
  highlightNext = true,
  showCountdown = false,
  remaining,
  progress,
  hijri,
  textColor,
  accentColor,
  size,
}: PrayerWidgetProps) {
  const c = WIDGET_THEMES[theme];
  const text = textColor ?? c.text;
  const accent = accentColor ?? c.accent;
  // fs kombiniert die Nutzer-Schriftgröße mit dem Breiten-Autofaktor: schmale
  // Widgets skalieren proportional herunter (tabellarische Ziffern, kein
  // Überlauf der 5-Spalten-Reihe), 4-Zellen-Breite bleibt unverändert.
  const auto = widthScale(size?.width);
  const fs = (n: number) => Math.round(n * fontScale * auto);
  // Vergangene Gebete dezent abtönen, damit die Zeit-Reihe eine klare
  // Lese-Hierarchie bekommt (erledigt → gedimmt, kommend → normal, nächstes
  // → Akzent-Pille). Basis ist die Textfarbe mit reduziertem Alpha.
  const dim = tint(text, 0.4);
  const bucket = heightBucket(size?.height);
  const showProgress = typeof progress === 'number' && progress >= 0 && progress <= 1;
  const p = showProgress ? Math.max(0.001, Math.min(0.999, progress as number)) : 0;

  // Die 5-(bzw. 6-)Spalten-Zeitenreihe; dense = engere Abstände/kleinere Schrift
  // für die mittlere Dichtestufe.
  const timesRow = (dense: boolean) =>
    rows.map((r, i) => {
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
            paddingHorizontal: dense ? 4 : 6,
            paddingVertical: dense ? 3 : 5,
            backgroundColor: on ? tint(accent, 0.16) : '#00000000',
          }}>
          <TextWidget
            text={r.name}
            truncate="END"
            maxLines={1}
            style={{ fontSize: fs(dense ? 10 : 11), color: nameColor, letterSpacing: 0.2 }}
          />
          <TextWidget
            text={r.time}
            style={{ fontSize: fs(dense ? 12 : 13), color: timeColor, fontWeight: on ? '700' : '500', marginTop: 2 }}
          />
        </FlexWidget>
      );
    });

  // --- compact (~4×1): ALLE fünf Zeiten in EINER Reihe -------------------------
  // Bewusst NICHT nur das nächste Gebet: der Nutzer soll auch bei flach
  // gezogenem Widget die fünf Tageszeiten sehen. Die kompakte 5-Spalten-Reihe
  // hebt das nächste Gebet farblich hervor (ersetzt so die separate
  // "nächstes Gebet"-Zeile) und passt in eine ~1-Zellen-Höhe.
  if (bucket === 'compact') {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          flex: 1,
          width: 'match_parent',
          height: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundGradient: cardGradient(theme, opacity),
          borderRadius: radius,
          borderWidth: 1,
          borderColor: hairline(theme),
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}>
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
          {timesRow(true)}
        </FlexWidget>
      </FlexWidget>
    );
  }

  // --- medium (~4×2): großes nächstes Gebet + kompakte Zeitenreihe ------------
  if (bucket === 'medium') {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          flex: 1,
          width: 'match_parent',
          height: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundGradient: cardGradient(theme, opacity),
          borderRadius: radius,
          borderWidth: 1,
          borderColor: hairline(theme),
          padding: 12,
        }}>
        {showNextTime ? (
          <FlexWidget
            style={{ flexDirection: 'row', alignItems: 'flex-end', width: 'match_parent', marginBottom: 8 }}>
            <TextWidget
              text={nextName}
              truncate="END"
              maxLines={1}
              style={{ fontSize: fs(20), color: accent, fontWeight: '700', letterSpacing: 0.2 }}
            />
            {nextTime ? (
              <TextWidget text={`  ${nextTime}`} style={{ fontSize: fs(20), color: text, fontWeight: '700' }} />
            ) : null}
          </FlexWidget>
        ) : null}
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
          {timesRow(true)}
        </FlexWidget>
      </FlexWidget>
    );
  }

  // --- tall (>= 4×3): volles Layout mit allen Extras --------------------------
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        flex: 1,
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        backgroundGradient: cardGradient(theme, opacity),
        borderRadius: radius,
        borderWidth: 1,
        borderColor: hairline(theme),
        padding: 14,
      }}>
      {showCoords ? (
        <TextWidget
          text={title}
          truncate="END"
          maxLines={1}
          style={{ fontSize: 11, color: c.muted, letterSpacing: 0.3 }}
        />
      ) : null}
      {hijri ? (
        <TextWidget text={hijri} truncate="END" maxLines={1} style={{ fontSize: 11, color: c.muted, letterSpacing: 0.3 }} />
      ) : null}
      {showNextTime ? (
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            width: 'match_parent',
            marginTop: 6,
            marginBottom: 10,
          }}>
          <TextWidget text={nextName} style={{ fontSize: fs(24), color: accent, fontWeight: '700', letterSpacing: 0.2 }} />
          <TextWidget text={`  ${nextTime}`} style={{ fontSize: fs(24), color: text, fontWeight: '700' }} />
        </FlexWidget>
      ) : null}
      {showNextTime ? (
        <FlexWidget
          style={{ width: 'match_parent', height: 1, backgroundColor: hairline(theme, 0.16), marginBottom: 10 }}
        />
      ) : null}
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
        {timesRow(false)}
      </FlexWidget>
      {showProgress ? (
        <FlexWidget
          style={{
            flexDirection: 'row',
            width: 'match_parent',
            height: 4,
            borderRadius: 999,
            backgroundColor: tint(text, 0.12),
            marginTop: 12,
            overflow: 'hidden',
          }}>
          <FlexWidget style={{ height: 4, flex: p, borderRadius: 999, backgroundColor: accent }} />
          <FlexWidget style={{ height: 4, flex: 1 - p }} />
        </FlexWidget>
      ) : null}
      {showCountdown && remaining ? (
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginTop: showProgress ? 8 : 10 }}>
          <FlexWidget
            style={{
              backgroundColor: tint(accent, 0.16),
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}>
            <TextWidget text={remaining} style={{ fontSize: fs(11), color: accent, fontWeight: '600', letterSpacing: 0.2 }} />
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
