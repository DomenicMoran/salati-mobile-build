import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import type { WidgetRepresentation, WidgetTaskHandlerProps } from 'react-native-android-widget';

import duasData from '@/features/duas/data/duas.json';
import { parseLearnProgress, LEARN_PROGRESS_STORAGE_KEY } from '@/features/learn/progress';
import { fetchTimingsWithRetry, type HijriDate, type Timings } from '@/features/prayer-times/api';
import { calcOptionsFromSettings } from '@/features/prayer-times/calc';
import { countdownUnits, formatHHMM, nextPrayer, parseTimeOn, PRAYERS } from '@/features/prayer-times/next-prayer';
import { qiblaBearing, distanceToMeccaKm } from '@/features/qibla/bearing';
import { cardinalKey } from '@/features/qibla/cardinal';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, type AppSettings } from '@/features/settings/types';
import { COURSE_META } from '@/features/study/courses';
import { computeLearningStreak } from '@/features/study/streak';
import { ensureLocale, translate } from '@/lib/translate';
import { CountdownWidget } from './CountdownWidget';
import type { WidgetSize } from './widgetLayout';
import { PrayerWidget } from './PrayerWidget';
import { QiblaWidget } from './QiblaWidget';
import { StreakWidget } from './StreakWidget';
// Stellt den Alarm auf den nächsten Gebetszeit-Wechsel. Er sorgt dafür, dass
// dieser Handler zur richtigen Sekunde erneut läuft, statt frühestens beim
// nächsten 30-Minuten-Tick des Systems (s. updateAlarm.android.ts). Die Kette
// hält sich damit selbst am Leben: Alarm → Widget-Update → neuer Alarm.
import { scheduleWidgetUpdateAlarms } from './updateAlarm';
import {
  baseWidgetName,
  getWidgetConfig,
  resolveTimeFormat,
  resolveWidgetConfig,
  type ResolvedWidgetConfig,
} from './widgetConfig';
import {
  WIDGET_CORNER_RADII,
  WIDGET_FONT_SCALES,
  widgetTextColorHex,
} from './widgetTheme';
import { WisdomWidget } from './WisdomWidget';

// Gemeinsame Darstellungs-Props (Theme/Deckkraft/Ecken/Schriftgröße/Farben)
// aus der aufgelösten Konfiguration — für alle Widget-Typen identisch, daher
// einmal zentral gemappt und in jedes Widget gespreadet.
function styleProps(cfg: ResolvedWidgetConfig) {
  return {
    theme: cfg.theme,
    opacity: cfg.backgroundOpacity,
    radius: WIDGET_CORNER_RADII[cfg.cornerStyle],
    fontScale: WIDGET_FONT_SCALES[cfg.fontScale],
    textColor: widgetTextColorHex(cfg.textColor),
    accentColor: widgetTextColorHex(cfg.accentColor),
  };
}

/** Hijri-Datum knapp formatieren, z. B. "12 Rajab 1447". */
function formatHijri(hijri: HijriDate): string {
  return `${hijri.day} ${hijri.month.en} ${hijri.year}`;
}

// Headless-Handler: läuft OHNE UI-Kontext (kein SettingsProvider, kein
// React-Query) — alle Daten kommen direkt aus AsyncStorage bzw. der
// Aladhan-API, mit Offline-Fallback auf die zuletzt gecachten Zeiten.

const WIDGET_TIMINGS_CACHE_KEY = 'salatibox:widget-timings';

async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface CachedTimings {
  dateKey: string;
  today: Timings;
  tomorrow: Timings;
  hijri?: HijriDate;
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function loadTimings(settings: AppSettings): Promise<CachedTimings | null> {
  const now = new Date();
  const dateKey = localDateKey(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const { lat, lon } = settings.location;
  // Hochbreiten-Regel + Minuten-Korrektur des Nutzers gelten auch im Widget —
  // sonst zeigte der Homescreen andere Zeiten als die App.
  const opts = calcOptionsFromSettings(settings);
  const [today, tomorrow] = await Promise.all([
    fetchTimingsWithRetry(lat, lon, now, opts),
    fetchTimingsWithRetry(lat, lon, tomorrowDate, opts),
  ]);
  if (today && tomorrow) {
    const fresh: CachedTimings = {
      dateKey,
      today: today.timings,
      tomorrow: tomorrow.timings,
      hijri: today.hijri,
    };
    await AsyncStorage.setItem(WIDGET_TIMINGS_CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
    await scheduleWidgetUpdateAlarms(fresh.today, fresh.tomorrow);
    return fresh;
  }
  // Offline: letzten Stand nur verwenden, wenn er vom heutigen Tag ist —
  // gestrige Zeiten wären still falsch.
  try {
    const raw = await AsyncStorage.getItem(WIDGET_TIMINGS_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedTimings;
    if (cached.dateKey !== dateKey) return null;
    await scheduleWidgetUpdateAlarms(cached.today, cached.tomorrow);
    return cached;
  } catch {
    return null;
  }
}

// Baut die Zeiten-Zeilen (5 Pflichtgebete; optional Sonnenaufgang nach Fajr).
// `active` markiert das nächste Gebet für die farbliche Hervorhebung — der
// Sonnenaufgang ist kein Gebet und daher nie aktiv. `passed` markiert bereits
// vergangene Gebete, damit sie im Widget dezent abgetönt werden (rein optisch).
// nextIdx === -1 bedeutet: alle heutigen Gebete sind vorbei (nächstes ist Fajr
// morgen) → alle heutigen Zeilen gelten als vergangen.
function prayerRows(
  data: CachedTimings,
  nextIdx: number,
  timeFormat: '24h' | '12h',
  showSunrise: boolean,
  t: (key: string) => string,
): { name: string; time: string; active: boolean; passed: boolean }[] {
  const rows: { name: string; time: string; active: boolean; passed: boolean }[] = [];
  const allPassed = nextIdx < 0;
  PRAYERS.forEach((p, i) => {
    rows.push({
      name: t(`prayers.${p.toLowerCase()}`),
      time: formatHHMM(data.today[p], timeFormat),
      active: i === nextIdx,
      passed: allPassed || i < nextIdx,
    });
    if (showSunrise && p === 'Fajr') {
      // Sonnenaufgang liegt zwischen Fajr und Dhuhr → vergangen, sobald Fajr
      // vorbei ist (nächstes Gebet ist Dhuhr o. später bzw. schon morgen).
      rows.push({
        name: t('prayer.sunrise'),
        time: formatHHMM(data.today.Sunrise, timeFormat),
        active: false,
        passed: allPassed || nextIdx > 0,
      });
    }
  });
  return rows;
}

// Fortschritt vom vorigen zum nächsten Gebet (0..1) für die dünne Leiste im
// PrayerWidget. Ohne sinnvollen Bezugspunkt (ganz früh morgens vor Fajr, wenn
// das vorige Gebet Isha von GESTERN wäre — hier nicht vorhanden) → undefined.
// Reiner Anzeigewert vom Zeitpunkt des Widget-Updates.
function prayerProgress(data: CachedTimings, next: { nextIdx: number; nextTs: Date }, now: Date): number | undefined {
  let prevTs: Date;
  if (next.nextIdx > 0) {
    prevTs = parseTimeOn(data.today[PRAYERS[next.nextIdx - 1] as (typeof PRAYERS)[number]], now);
  } else if (next.nextIdx < 0) {
    prevTs = parseTimeOn(data.today.Isha, now);
  } else {
    return undefined; // vor Fajr: kein heutiger Vorgänger
  }
  const span = next.nextTs.getTime() - prevTs.getTime();
  if (span <= 0) return undefined;
  return Math.max(0, Math.min(1, (now.getTime() - prevTs.getTime()) / span));
}

async function renderPrayerWidget(settings: AppSettings, cfg: ResolvedWidgetConfig, size?: WidgetSize) {
  const t = (key: string) => translate(settings.language, key);
  const timeFormat = resolveTimeFormat(cfg, settings);
  const data = await loadTimings(settings);
  if (!data) {
    return (
      <PrayerWidget
        title={settings.location.label}
        nextName={t('widgets.offline')}
        nextTime=""
        rows={PRAYERS.map((p) => ({ name: t(`prayers.${p.toLowerCase()}`), time: '--:--', active: false }))}
        showCoords={cfg.showCoords}
        showNextTime={cfg.showNextTime}
        highlightNext={cfg.highlightNext}
        size={size}
        {...styleProps(cfg)}
      />
    );
  }
  const now = new Date();
  const next = nextPrayer(data.today, data.tomorrow, now);
  const totalMin = Math.floor(next.diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  // Einheiten aus der App-Sprache (Audit 2026-07-28, T17) — vorher stand
  // auch im arabischen Widget „1h 55m“.
  const u = countdownUnits(t);
  const compact = h > 0 ? `${h}${u.hours} ${m}${u.minutes}` : `${m}${u.minutes}`;
  return (
    <PrayerWidget
      title={`${t('widgets.nextPrayer')} · ${settings.location.label}`}
      nextName={t(`prayers.${next.nextPrayer.toLowerCase()}`)}
      nextTime={formatHHMM(next.nextIdx >= 0 ? data.today[next.nextPrayer] : data.tomorrow.Fajr, timeFormat)}
      rows={prayerRows(data, next.nextIdx, timeFormat, cfg.showSunrise, t)}
      showCoords={cfg.showCoords}
      showNextTime={cfg.showNextTime}
      highlightNext={cfg.highlightNext}
      showCountdown={cfg.showCountdown}
      remaining={t('widgets.remaining').replace('{t}', compact)}
      progress={prayerProgress(data, next, now)}
      hijri={cfg.showHijri && data.hijri ? formatHijri(data.hijri) : undefined}
      size={size}
      {...styleProps(cfg)}
    />
  );
}

async function renderCountdownWidget(settings: AppSettings, cfg: ResolvedWidgetConfig, size?: WidgetSize) {
  const t = (key: string) => translate(settings.language, key);
  const timeFormat = resolveTimeFormat(cfg, settings);
  const data = await loadTimings(settings);
  if (!data) {
    return (
      <CountdownWidget
        title={t('widgets.nextPrayer')}
        nextName={t('widgets.offline')}
        nextTime="--:--"
        remaining=""
        showCoords={cfg.showCoords}
        showNextTime={cfg.showNextTime}
        size={size}
        {...styleProps(cfg)}
      />
    );
  }
  const now = new Date();
  const next = nextPrayer(data.today, data.tomorrow, now);
  const totalMin = Math.floor(next.diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  // Einheiten aus der App-Sprache (Audit 2026-07-28, T17) — vorher stand
  // auch im arabischen Widget „1h 55m“.
  const u = countdownUnits(t);
  const compact = h > 0 ? `${h}${u.hours} ${m}${u.minutes}` : `${m}${u.minutes}`;
  return (
    <CountdownWidget
      title={`${t('widgets.nextPrayer')} · ${settings.location.label}`}
      nextName={t(`prayers.${next.nextPrayer.toLowerCase()}`)}
      nextTime={formatHHMM(next.nextIdx >= 0 ? data.today[next.nextPrayer] : data.tomorrow.Fajr, timeFormat)}
      remaining={t('widgets.remaining').replace('{t}', compact)}
      rows={prayerRows(data, next.nextIdx, timeFormat, false, t)}
      highlightNext={cfg.highlightNext}
      showCoords={cfg.showCoords}
      showNextTime={cfg.showNextTime}
      size={size}
      {...styleProps(cfg)}
    />
  );
}

function renderQiblaWidget(settings: AppSettings, cfg: ResolvedWidgetConfig, size?: WidgetSize) {
  const t = (key: string) => translate(settings.language, key);
  const { lat, lon } = settings.location;
  const bearing = qiblaBearing(lat, lon);
  const km = Math.round(distanceToMeccaKm(lat, lon));
  return (
    <QiblaWidget
      title={t('widgets.qibla')}
      bearing={`${Math.round(bearing)}°`}
      direction={t(`qibla.dir.${cardinalKey(bearing)}`)}
      distance={`${km} km`}
      showBearing={cfg.showBearing}
      showDirection={cfg.showDirection}
      showDistance={cfg.showDistance}
      size={size}
      {...styleProps(cfg)}
    />
  );
}

interface DuaEntry {
  arabic: string;
  translations: Record<string, string>;
  source?: string;
}

function renderWisdomWidget(settings: AppSettings, cfg: ResolvedWidgetConfig, size?: WidgetSize) {
  const t = (key: string) => translate(settings.language, key);
  const duas = (duasData as { duas: DuaEntry[] }).duas;
  // 'daily' = feste, über den Tag stabile Rotation (Tag-des-Jahres); 'random' =
  // bei jedem Widget-Update eine andere Dua.
  const startOfYear = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - startOfYear.getTime()) / 86400000);
  const idx = cfg.duaSelection === 'random' ? Math.floor(Math.random() * duas.length) : dayOfYear % duas.length;
  const dua = duas[idx];
  return (
    <WisdomWidget
      title={t('widgets.duaOfDay')}
      arabic={dua.arabic}
      translation={dua.translations[settings.language] ?? dua.translations.en ?? ''}
      source={dua.source}
      showArabic={cfg.showArabic}
      showTranslation={cfg.showTranslation}
      showSource={cfg.showSource}
      size={size}
      {...styleProps(cfg)}
    />
  );
}

async function renderStreakWidget(settings: AppSettings, cfg: ResolvedWidgetConfig, size?: WidgetSize) {
  const t = (key: string) => translate(settings.language, key);
  const [learnRaw, ...courseRaws] = await Promise.all([
    AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY),
    ...COURSE_META.map((c) => AsyncStorage.getItem(c.storageKey)),
  ]);
  const allProgress = [parseLearnProgress(learnRaw), ...courseRaws.map(parseLearnProgress)];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const passedTimestamps: number[] = [];
  let today = 0;
  for (const progress of allProgress) {
    for (const r of Object.values(progress)) {
      if (r.total > 0 && r.score / r.total >= 0.7) {
        passedTimestamps.push(r.completedAt);
        if (r.completedAt >= startOfDay.getTime()) today++;
      }
    }
  }
  return (
    <StreakWidget
      streak={computeLearningStreak(passedTimestamps)}
      streakLabel={t('widgets.streakLabel')}
      todayLine={t('widgets.todayLessons').replace('{n}', String(today))}
      streakLarge={cfg.streakLarge}
      showStreakLabel={cfg.showStreakLabel}
      size={size}
      {...styleProps(cfg)}
    />
  );
}

// Konfiguration wird PRO widgetId aufgelöst (widgetConfig.ts): der Nutzer setzt
// Theme/Transparenz/Inhalts-Toggles je platziertem Widget über die
// Konfigurations-Activity (langes Drücken → Konfigurieren). Fehlt für eine
// widgetId ein Override, greift der globale Default (AppSettings.widgetTheme,
// alle Inhalte sichtbar) — bestehende Widgets verhalten sich unverändert.
// Die "Light"-Provider im Picker (Namenssuffix "Light") leiten weiterhin
// denselben Widget-TYP ab wie ihr Basisname (baseWidgetName in widgetConfig.ts).

/**
 * Rendert das zu (widgetName, widgetId) passende Widget mit ECHTEN Daten +
 * der pro-Instanz aufgelösten Konfiguration (Theme/Transparenz/Textfarbe/
 * Inhalts-Toggles). Gemeinsame Render-Logik für a) den Headless-Task-Handler
 * (WIDGET_UPDATE) und b) das sofortige Neu-Rendern nach einer Änderung
 * (Config-Screen "Fertig" bzw. Theme-Wechsel in den Einstellungen →
 * requestWidgetUpdate, s. refresh.android.ts).
 */
export async function renderWidgetForInfo(
  widgetName: string,
  widgetId: number,
  size?: WidgetSize,
): Promise<WidgetRepresentation> {
  const settings = await loadSettings();
  // Headless-Task ohne React-Kontext: die Sprachdatei muss hier explizit
  // geladen werden (nur de/en sind statisch gebündelt, s. lib/translate.ts),
  // sonst rendert das Widget in der Fallback-Sprache.
  await ensureLocale(settings.language);
  const instance = await getWidgetConfig(widgetId);
  const cfg = resolveWidgetConfig(instance, widgetName, settings);
  switch (baseWidgetName(widgetName)) {
    case 'SalatiWisdom':
      return renderWisdomWidget(settings, cfg, size);
    case 'SalatiStreak':
      return renderStreakWidget(settings, cfg, size);
    case 'SalatiCountdown':
      return renderCountdownWidget(settings, cfg, size);
    case 'SalatiQibla':
      return renderQiblaWidget(settings, cfg, size);
    case 'SalatiPrayer':
    default:
      return renderPrayerWidget(settings, cfg, size);
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(
        await renderWidgetForInfo(props.widgetInfo.widgetName, props.widgetInfo.widgetId, {
          width: props.widgetInfo.width,
          height: props.widgetInfo.height,
        }),
      );
      break;
    default:
      // WIDGET_DELETED/WIDGET_CLICK: Klick öffnet die App bereits über
      // clickAction="OPEN_APP" am Widget-Root — nichts zu tun.
      break;
  }
}
