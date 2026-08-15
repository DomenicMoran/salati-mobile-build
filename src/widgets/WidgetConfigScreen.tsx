// PER-WIDGET Konfigurations-Screen.
//
// Wird über registerWidgetConfigurationScreen (index.android.js) unter dem
// AppRegistry-Key 'RNWidgetConfigurationScreen' registriert. Android startet
// die native WidgetConfigurationActivity (AndroidManifest + android:configure
// in den 5 widgetprovider_*.xml), wenn ein Widget platziert oder über langes
// Drücken → "Konfigurieren" bearbeitet wird, und übergibt die konkrete
// widgetId.
//
// WICHTIG: Dieser Screen rendert STANDALONE — ohne expo-router, ohne
// SettingsProvider, ohne Theme-Context. Deshalb: eigenes SafeArea-Padding,
// eigenes (dunkles) Theming und Sprache/Defaults direkt aus AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import type { WidgetConfigurationScreenProps, WidgetRepresentation } from 'react-native-android-widget';

import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, type AppSettings } from '@/features/settings/types';
import { PRAYERS } from '@/features/prayer-times/next-prayer';
import { ErrorBoundary } from '@/components/error-boundary';
import { ensureLocale, translate } from '@/lib/translate';
import { CountdownWidget } from './CountdownWidget';
import { PrayerWidget } from './PrayerWidget';
import { QiblaWidget } from './QiblaWidget';
import { StreakWidget } from './StreakWidget';
import { WisdomWidget } from './WisdomWidget';
import {
  baseWidgetName,
  getWidgetConfig,
  resolveWidgetConfig,
  setWidgetConfig,
  widgetContentToggles,
  type ResolvedWidgetConfig,
  type WidgetContentToggle,
  type WidgetDuaSelection,
  type WidgetInstanceConfig,
  type WidgetTimeFormat,
} from './widgetConfig';
import { renderWidgetForInfo } from './widget-task-handler';
import {
  WIDGET_CORNER_RADII,
  WIDGET_CORNER_STYLE_KEYS,
  WIDGET_FONT_SCALE_KEYS,
  WIDGET_FONT_SCALES,
  WIDGET_OPACITY_STEPS,
  WIDGET_TEXT_COLOR_KEYS,
  WIDGET_TEXT_COLORS,
  WIDGET_THEME_KEYS,
  WIDGET_THEMES,
  widgetTextColorHex,
  type WidgetCornerStyle,
  type WidgetFontScale,
  type WidgetOpacity,
  type WidgetTextColor,
  type WidgetTheme,
} from './widgetTheme';

async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Beschriftung eines Widget-Typs für den Kopfbereich.
function widgetTypeLabel(base: string, t: (k: string) => string): string {
  switch (base) {
    case 'SalatiPrayer':
      return t('widgets.nextPrayer');
    case 'SalatiCountdown':
      return t('widgetConfig.typeCountdown');
    case 'SalatiWisdom':
      return t('widgets.duaOfDay');
    case 'SalatiQibla':
      return t('widgets.qibla');
    case 'SalatiStreak':
      return t('widgetConfig.typeStreak');
    default:
      return base;
  }
}

const TOGGLE_LABEL_KEY: Record<WidgetContentToggle, string> = {
  showCoords: 'widgetConfig.showCoords',
  showNextTime: 'widgetConfig.showNextTime',
  showHijri: 'widgetConfig.showHijri',
  showSunrise: 'widgetConfig.showSunrise',
  highlightNext: 'widgetConfig.highlightNext',
  showCountdown: 'widgetConfig.showCountdown',
  showArabic: 'widgetConfig.showArabic',
  showTranslation: 'widgetConfig.showTranslation',
  showSource: 'widgetConfig.showSource',
  showDistance: 'widgetConfig.showDistance',
  showBearing: 'widgetConfig.showBearing',
  showDirection: 'widgetConfig.showDirection',
  streakLarge: 'widgetConfig.streakLarge',
  showStreakLabel: 'widgetConfig.showStreakLabel',
};

// Gemeinsame Darstellungs-Props für die Vorschau — spiegelt styleProps() im
// Task-Handler, sodass die Vorschau exakt wie das echte Widget aussieht.
function previewCommon(cfg: ResolvedWidgetConfig) {
  return {
    theme: cfg.theme,
    opacity: cfg.backgroundOpacity,
    radius: WIDGET_CORNER_RADII[cfg.cornerStyle],
    fontScale: WIDGET_FONT_SCALES[cfg.fontScale],
    textColor: widgetTextColorHex(cfg.textColor),
    accentColor: widgetTextColorHex(cfg.accentColor),
  };
}

// Repräsentativer Vorschau-Render mit Beispieldaten (keine Netz-/Storage-Last
// in der Config-Activity). Nach setResult('ok') rendert der Task-Handler das
// Widget mit echten Daten + gespeicherter Konfiguration neu.
function buildPreview(
  base: string,
  cfg: ResolvedWidgetConfig,
  settings: AppSettings,
): WidgetRepresentation | null {
  const t = (key: string) => translate(settings.language, key);
  const common = previewCommon(cfg);
  const timeFormat = cfg.timeFormat === 'auto' ? settings.timeFormat : cfg.timeFormat;
  const sample12 = timeFormat === '12h';
  switch (base) {
    case 'SalatiPrayer': {
      const times = sample12
        ? ['5:12 AM', '1:05 PM', '3:42 PM', '6:20 PM', '8:01 PM']
        : ['05:12', '13:05', '15:42', '18:20', '20:01'];
      const rows: { name: string; time: string; active: boolean; passed: boolean }[] = [];
      PRAYERS.forEach((p, i) => {
        rows.push({ name: t(`prayers.${p.toLowerCase()}`), time: times[i], active: i === 2, passed: i < 2 });
        if (cfg.showSunrise && p === 'Fajr') {
          rows.push({ name: t('prayer.sunrise'), time: sample12 ? '6:48 AM' : '06:48', active: false, passed: true });
        }
      });
      return (
        <PrayerWidget
          title={`${t('widgets.nextPrayer')} · ${settings.location.label}`}
          nextName={t('prayers.asr')}
          nextTime={sample12 ? '3:42 PM' : '15:42'}
          rows={rows}
          showCoords={cfg.showCoords}
          showNextTime={cfg.showNextTime}
          highlightNext={cfg.highlightNext}
          showCountdown={cfg.showCountdown}
          remaining={t('widgets.remaining').replace('{t}', '2h 15m')}
          progress={0.62}
          hijri={cfg.showHijri ? '12 Rajab 1447' : undefined}
          {...common}
        />
      );
    }
    case 'SalatiCountdown':
      return (
        <CountdownWidget
          title={`${t('widgets.nextPrayer')} · ${settings.location.label}`}
          nextName={t('prayers.asr')}
          nextTime={sample12 ? '3:42 PM' : '15:42'}
          remaining={t('widgets.remaining').replace('{t}', '2h 15m')}
          showCoords={cfg.showCoords}
          showNextTime={cfg.showNextTime}
          {...common}
        />
      );
    case 'SalatiWisdom':
      return (
        <WisdomWidget
          title={t('widgets.duaOfDay')}
          arabic="رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً"
          translation="Unser Herr, gib uns im Diesseits Gutes."
          source="Al-Baqara 2:201"
          showArabic={cfg.showArabic}
          showTranslation={cfg.showTranslation}
          showSource={cfg.showSource}
          {...common}
        />
      );
    case 'SalatiQibla':
      return (
        <QiblaWidget
          title={t('widgets.qibla')}
          bearing="137°"
          direction={t('qibla.dir.so')}
          distance="4312 km"
          showBearing={cfg.showBearing}
          showDirection={cfg.showDirection}
          showDistance={cfg.showDistance}
          {...common}
        />
      );
    case 'SalatiStreak':
      return (
        <StreakWidget
          streak={7}
          streakLabel={t('widgets.streakLabel')}
          todayLine={t('widgets.todayLessons').replace('{n}', '2')}
          streakLarge={cfg.streakLarge}
          showStreakLabel={cfg.showStreakLabel}
          {...common}
        />
      );
    default:
      return null;
  }
}

const FONT_SCALE_LABEL_KEY: Record<WidgetFontScale, string> = {
  small: 'widgetConfig.fontSmall',
  medium: 'widgetConfig.fontMedium',
  large: 'widgetConfig.fontLarge',
};

const CORNER_LABEL_KEY: Record<WidgetCornerStyle, string> = {
  sharp: 'widgetConfig.cornerSharp',
  rounded: 'widgetConfig.cornerRounded',
  round: 'widgetConfig.cornerRound',
};

const TIME_FORMAT_LABEL_KEY: Record<WidgetTimeFormat, string> = {
  auto: 'widgetConfig.timeAuto',
  '24h': 'widgetConfig.time24h',
  '12h': 'widgetConfig.time12h',
};

const DUA_SELECTION_LABEL_KEY: Record<WidgetDuaSelection, string> = {
  daily: 'widgetConfig.duaDaily',
  random: 'widgetConfig.duaRandom',
};

// Segmentierte Auswahl (Pillen-Reihe) für Optionen mit festen Stufen —
// Schriftgröße, Ecken, Deckkraft, Zeitformat, Dua-Auswahl.
function Segmented<V extends string | number>({
  options,
  selected,
  onSelect,
}: {
  options: { value: V; label: string }[];
  selected: V;
  onSelect: (v: V) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((o) => {
        const on = o.value === selected;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onSelect(o.value)}
            style={[styles.segment, on && styles.segmentOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}>
            <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WidgetConfigScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  // ROBUSTHEIT: Android liefert die widgetInfo (widgetId/widgetName) als
  // Initial-Props der nativen Config-Activity. Fehlen sie (z. B. wenn die
  // Initial-Props im New-Architecture-/bridgeless-Pfad nicht ankommen), darf der
  // Screen NICHT abstürzen — bisher las er widgetInfo.widgetId direkt und crashte
  // damit die ganze App. Statt dessen zeigen wir eine sichtbare Meldung.
  const hasWidget =
    !!widgetInfo &&
    typeof widgetInfo.widgetId === 'number' &&
    typeof widgetInfo.widgetName === 'string';
  const widgetId = hasWidget ? widgetInfo.widgetId : -1;
  const widgetName = hasWidget ? widgetInfo.widgetName : '';
  const base = baseWidgetName(widgetName);
  const toggles = widgetContentToggles(widgetName);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [config, setConfig] = useState<WidgetInstanceConfig>({});

  useEffect(() => {
    if (!hasWidget) return;
    let alive = true;
    void (async () => {
      try {
        const [s, c] = await Promise.all([loadSettings(), getWidgetConfig(widgetId)]);
        // Eigene Activity ohne SettingsProvider: Sprachdatei explizit laden
        // (nur de/en sind statisch gebündelt, s. lib/translate.ts).
        await ensureLocale(s.language);
        if (!alive) return;
        setSettings(s);
        setConfig(c);
        // Erste Vorschau sofort rendern, damit das Widget nicht leer wirkt.
        const preview = buildPreview(base, resolveWidgetConfig(c, widgetName, s), s);
        if (preview) renderWidget(preview);
      } catch {
        // Settings/Vorschau optional — der Screen bleibt bedienbar, statt zu crashen.
        if (alive) setSettings(DEFAULT_SETTINGS);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mount laden
  }, []);

  const t = (key: string) => translate(settings?.language ?? 'en', key);

  async function apply(patch: Partial<WidgetInstanceConfig>) {
    if (!settings) return;
    try {
      const next = await setWidgetConfig(widgetId, patch);
      setConfig(next);
      const preview = buildPreview(base, resolveWidgetConfig(next, widgetName, settings), settings);
      if (preview) renderWidget(preview);
    } catch {
      // Persistenz-/Render-Fehler nicht eskalieren — Screen bleibt nutzbar.
    }
  }

  // "Fertig": vor dem Abschließen das Widget einmal mit ECHTEN Daten (statt der
  // Beispiel-Vorschau) und der frisch gespeicherten Konfiguration zeichnen, damit
  // es sofort korrekt aussieht — sonst bliebe bis zum nächsten Update-Tick die
  // Vorschau mit Beispielzeiten stehen. Fehler (z. B. offline) werden bewusst
  // geschluckt: der Task-Handler rendert beim nächsten Tick ohnehin neu.
  async function commit() {
    try {
      // Echte Widget-Größe (DP) mitgeben, damit die "Fertig"-Zeichnung dieselbe
      // Dichtestufe (compact/medium/tall) trifft wie das platzierte Widget.
      const size =
        hasWidget && typeof widgetInfo.width === 'number' && typeof widgetInfo.height === 'number'
          ? { width: widgetInfo.width, height: widgetInfo.height }
          : undefined;
      renderWidget(await renderWidgetForInfo(widgetName, widgetId, size));
    } catch {
      // Vorschau bleibt bestehen — kein harter Fehler.
    }
    try {
      setResult('ok');
    } catch {
      // finishWidgetConfiguration ist ein nativer Aufruf — sollte er werfen,
      // darf das die App nicht beenden.
    }
  }

  function cancel() {
    try {
      setResult('cancel');
    } catch {
      // s. commit(): nativer Aufruf defensiv umschlossen.
    }
  }

  // widgetInfo fehlt/ungültig: sichtbare Meldung statt Absturz. Kein setResult,
  // da dessen widgetId ebenfalls fehlt — der Nutzer entfernt das Widget und legt
  // es neu an.
  if (!hasWidget) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.title}>Widget</Text>
        <Text style={styles.fallbackBody}>
          Diese Konfiguration konnte nicht geladen werden. Bitte entferne das Widget vom Startbildschirm
          und füge es erneut hinzu.{'\n\n'}
          This configuration could not be loaded. Please remove the widget from the home screen and add it
          again.
        </Text>
      </View>
    );
  }

  if (!settings) {
    return <View style={styles.screen} />;
  }

  const resolved = resolveWidgetConfig(config, widgetName, settings);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('widgetConfig.title')}</Text>
        <Text style={styles.subtitle}>{widgetTypeLabel(base, t)}</Text>

        {/* Farbe / Theme */}
        <Text style={styles.sectionLabel}>{t('widgetConfig.color')}</Text>
        <View style={styles.swatchRow}>
          {WIDGET_THEME_KEYS.map((k: WidgetTheme) => {
            const c = WIDGET_THEMES[k];
            const selected = resolved.theme === k;
            return (
              <Pressable
                key={k}
                onPress={() => apply({ theme: k })}
                style={[styles.swatch, { backgroundColor: c.bg }, selected && styles.swatchSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}>
                <Text style={[styles.swatchDot, { color: c.accent }]}>●</Text>
                <Text style={[styles.swatchLabel, { color: c.text }]} numberOfLines={1}>
                  {t(`widgets.theme_${k}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Hintergrund-Deckkraft in Stufen (ersetzt den alten An/Aus-Schalter) */}
        <Text style={styles.sectionLabel}>{t('widgetConfig.opacity')}</Text>
        <Segmented<WidgetOpacity>
          options={WIDGET_OPACITY_STEPS.map((v) => ({ value: v, label: `${v}%` }))}
          selected={resolved.backgroundOpacity as WidgetOpacity}
          onSelect={(v) => apply({ backgroundOpacity: v })}
        />

        {/* Textfarbe: 'default' zeigt die Textfarbe des gewählten Themes, alle
            anderen überschreiben den Haupttext (z. B. rot). */}
        <Text style={styles.sectionLabel}>{t('widgetConfig.textColor')}</Text>
        <View style={styles.colorRow}>
          {WIDGET_TEXT_COLOR_KEYS.map((k: WidgetTextColor) => {
            const dot = WIDGET_TEXT_COLORS[k] ?? WIDGET_THEMES[resolved.theme].text;
            const selected = resolved.textColor === k;
            return (
              <Pressable
                key={k}
                onPress={() => apply({ textColor: k })}
                style={[styles.colorSwatch, selected && styles.colorSwatchSelected]}
                accessibilityRole="button"
                accessibilityLabel={k}
                accessibilityState={{ selected }}>
                <View style={[styles.colorDot, { backgroundColor: dot }]}>
                  {k === 'default' ? (
                    <Text style={[styles.colorDefaultGlyph, { color: WIDGET_THEMES[resolved.theme].bg }]}>A</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Akzentfarbe: nächstes Gebet / aktive Zeile / Streak-Zahl / Titel.
            'default' = Theme-Akzentfarbe (Punkt zeigt die aktuelle Akzentfarbe). */}
        <Text style={styles.sectionLabel}>{t('widgetConfig.accentColor')}</Text>
        <View style={styles.colorRow}>
          {WIDGET_TEXT_COLOR_KEYS.map((k: WidgetTextColor) => {
            const dot = WIDGET_TEXT_COLORS[k] ?? WIDGET_THEMES[resolved.theme].accent;
            const selected = resolved.accentColor === k;
            return (
              <Pressable
                key={k}
                onPress={() => apply({ accentColor: k })}
                style={[styles.colorSwatch, selected && styles.colorSwatchSelected]}
                accessibilityRole="button"
                accessibilityLabel={k}
                accessibilityState={{ selected }}>
                <View style={[styles.colorDot, { backgroundColor: dot }]}>
                  {k === 'default' ? (
                    <Text style={[styles.colorDefaultGlyph, { color: WIDGET_THEMES[resolved.theme].bg }]}>A</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Schriftgröße des Haupttexts */}
        <Text style={styles.sectionLabel}>{t('widgetConfig.fontSize')}</Text>
        <Segmented<WidgetFontScale>
          options={WIDGET_FONT_SCALE_KEYS.map((k) => ({ value: k, label: t(FONT_SCALE_LABEL_KEY[k]) }))}
          selected={resolved.fontScale}
          onSelect={(v) => apply({ fontScale: v })}
        />

        {/* Ecken / Rundung der Karte */}
        <Text style={styles.sectionLabel}>{t('widgetConfig.corners')}</Text>
        <Segmented<WidgetCornerStyle>
          options={WIDGET_CORNER_STYLE_KEYS.map((k) => ({ value: k, label: t(CORNER_LABEL_KEY[k]) }))}
          selected={resolved.cornerStyle}
          onSelect={(v) => apply({ cornerStyle: v })}
        />

        {/* Zeitformat-Override (nur Widgets mit Uhrzeiten) */}
        {base === 'SalatiPrayer' || base === 'SalatiCountdown' ? (
          <>
            <Text style={styles.sectionLabel}>{t('widgetConfig.timeFormat')}</Text>
            <Segmented<WidgetTimeFormat>
              options={(['auto', '24h', '12h'] as WidgetTimeFormat[]).map((k) => ({
                value: k,
                label: t(TIME_FORMAT_LABEL_KEY[k]),
              }))}
              selected={resolved.timeFormat}
              onSelect={(v) => apply({ timeFormat: v })}
            />
          </>
        ) : null}

        {/* Inhalts-Toggles je Widgettyp */}
        {toggles.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t('widgetConfig.content')}</Text>
            {toggles.map((key) => (
              <View key={key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t(TOGGLE_LABEL_KEY[key])}</Text>
                <Switch
                  value={resolved[key]}
                  onValueChange={(v) => apply({ [key]: v } as Partial<WidgetInstanceConfig>)}
                  trackColor={{ true: '#d4af37', false: '#3a3a3f' }}
                  thumbColor="#f7f3ea"
                />
              </View>
            ))}
          </>
        ) : null}

        {/* Dua-Auswahl (nur Wisdom): täglich fest vs. bei jedem Update zufällig */}
        {base === 'SalatiWisdom' ? (
          <>
            <Text style={styles.sectionLabel}>{t('widgetConfig.duaSelection')}</Text>
            <Segmented<WidgetDuaSelection>
              options={(['daily', 'random'] as WidgetDuaSelection[]).map((k) => ({
                value: k,
                label: t(DUA_SELECTION_LABEL_KEY[k]),
              }))}
              selected={resolved.duaSelection}
              onSelect={(v) => apply({ duaSelection: v })}
            />
          </>
        ) : null}

        <Text style={styles.hint}>{t('widgetConfig.previewHint')}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={cancel}
          style={[styles.button, styles.buttonGhost]}
          accessibilityRole="button">
          <Text style={styles.buttonGhostText}>{t('widgetConfig.cancel')}</Text>
        </Pressable>
        <Pressable
          onPress={() => void commit()}
          style={[styles.button, styles.buttonPrimary]}
          accessibilityRole="button">
          <Text style={styles.buttonPrimaryText}>{t('widgetConfig.done')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Registrierter Root der nativen Config-Activity (index.android.js). Hüllt den
// Screen in die ErrorBoundary: ein Render-Fehler IRGENDWO im Config-Screen
// (fehlende Initial-Props, defekte Settings, Widget-Vorschau-Fehler …) zeigt
// dann den Wiederherstellungs-Screen statt die GESAMTE App zu beenden — genau
// das Verhalten, das der vc27-Delegate-Fix allein nicht abgedeckt hat. Die
// ErrorBoundary ist bewusst standalone lauffähig (nur RN-Primitive + Colors +
// systemweites useColorScheme, kein App-Context), siehe error-boundary.tsx.
export function WidgetConfigScreenRoot(props: WidgetConfigurationScreenProps) {
  return (
    <ErrorBoundary>
      <WidgetConfigScreen {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b0b0d',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44,
  },
  content: { padding: 20, paddingBottom: 24 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  fallbackBody: { color: '#f7f3eacc', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  title: { color: '#f7f3ea', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#d4af37', fontSize: 14, fontWeight: '600', marginTop: 2, marginBottom: 18 },
  sectionLabel: {
    color: '#f7f3eaa6',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    minWidth: 92,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: '#d4af37' },
  swatchDot: { fontSize: 14 },
  swatchLabel: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: { borderColor: '#d4af37' },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDefaultGlyph: { fontSize: 15, fontWeight: '800' },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    flexGrow: 1,
    minWidth: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1c1c20',
    alignItems: 'center',
  },
  segmentOn: { borderColor: '#d4af37', backgroundColor: '#2a2410' },
  segmentText: { color: '#f7f3eacc', fontSize: 13, fontWeight: '600' },
  segmentTextOn: { color: '#f7f3ea' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff1a',
  },
  toggleLabel: { color: '#f7f3ea', fontSize: 15, flexShrink: 1, paddingRight: 12 },
  hint: { color: '#f7f3ea80', fontSize: 12, marginTop: 20, lineHeight: 17 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ffffff1a',
  },
  button: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  buttonGhost: { backgroundColor: '#1c1c20' },
  buttonGhostText: { color: '#f7f3ea', fontSize: 15, fontWeight: '600' },
  buttonPrimary: { backgroundColor: '#d4af37' },
  buttonPrimaryText: { color: '#0b0b0d', fontSize: 15, fontWeight: '700' },
});
