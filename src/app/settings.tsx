import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Children, createContext, Fragment, isValidElement, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SwitchRow } from '@/components/settings/switch-row';
import { SettingsSearchBar } from '@/components/settings/search-bar';
import { azanSource } from '@/features/prayer-times/azan';
import { markBatteryHintShown, wasBatteryHintShown } from '@/features/prayer-times/battery-hint';
import { checkExactAlarmPermission, openExactAlarmSettings } from '@/features/prayer-times/exact-alarm';
import { formatErrorReport, getErrorLog } from '@/lib/errorLog';
import { useSsrSafeAudioPlayer } from '@/lib/ssrSafeAudio';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import {
  ActionRow,
  InputRow,
  ListGroupHeading,
  ListNote,
  ListSection,
  NavRow,
  SelectRow,
  ValueRow,
} from '@/components/ui/list';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { RECITATION_MODELS } from '@/features/hifz/whisperModel';
import { useDeviceLocation } from '@/features/location/useDeviceLocation';
import { nominatimResultToLocation, searchCity, type NominatimResult } from '@/features/location/nominatim';
import {
  addSavedLocation,
  isActiveSavedLocation,
  removeSavedLocation,
} from '@/features/settings/savedLocations';
import { EditionPicker, editionDisplayName } from '@/features/quran/EditionPicker';
import {
  ARABIC_FONT_FEATURES,
  QURAN_FONTS,
  adaptQuranText,
  arabicMetrics,
  quranFontDef,
  type QuranFontDef,
} from '@/features/quran/fonts';
import { useQuranFontFamily } from '@/features/quran/useQuranFont';
import { useQueryClient } from '@tanstack/react-query';

import { BEST_TAFSIRS, BEST_TRANSLATIONS, RECOMMENDED_RECITERS, RECOMMENDED_TRANSLATIONS, fetchSurahReading } from '@/features/quran/api';
import { rescheduleAdhkarReminders } from '@/features/duas/adhkarNotifications';
import { rescheduleVerseOfDayReminder } from '@/features/verseOfDay/notifications';
import { rescheduleWeeklySummary } from '@/features/weeklySummary/notifications';
import { rescheduleUdhiyahReminder } from '@/features/udhiyah/notifications';
import { useAudioEditions, useTranslationEditions } from '@/features/quran/hooks';
import {
  countDownloadedSurahs,
  deleteFullMushafAudio,
  listDownloadedReciters,
  QURAN_SURAH_COUNT,
  useFullMushafDownload,
  type DownloadedReciterPack,
} from '@/features/quran/offline-audio';
import {
  APP_ICON_VARIANTS,
  appIconNameSwitchSupported,
  appIconSupported,
  getCurrentAppIcon,
  setAppIcon,
  type AppIconVariant,
} from '@/features/settings/app-icon';
import {
  applyBackupData,
  collectBackupData,
  parseBackupFile,
  readBackupFile,
  writeBackupFile,
  type BackupData,
} from '@/features/settings/backup';
import { MethodPicker, useMethodLabels } from '@/features/settings/MethodPicker';
import { SCHOOLS, methodById, methodName, methodParamsLabel } from '@/features/settings/methods';
import { recommendMethod } from '@/features/prayer-times/method-country';
import {
  checkForOtaUpdate,
  otaSupported,
  restartWithUpdate,
  type OtaCheckResult,
} from '@/features/updates/otaUpdate';
import { useSettings } from '@/features/settings/store';
import {
  ADHKAR_EVENING_HOURS,
  ADHKAR_MORNING_HOURS,
  AZAN_CHOICES,
  DAILY_MINUTES_OPTIONS,
  HIGH_LATITUDE_OPTIONS,
  IFTAR_REMINDER_LEAD_MINUTES,
  IQAMA_OFFSET_OPTIONS,
  NO_PRAYER_TIME_OFFSETS,
  PRAYER_TIME_OFFSET_MAX,
  PRAYER_TIME_OFFSET_MIN,
  PRE_ADHAN_OFFSET_OPTIONS,
  REVIEW_REMINDER_HOUR_OPTIONS,
  SUHOOR_LEAD_OPTIONS,
  VERSE_OF_DAY_HOUR_OPTIONS,
  azanNumber,
  type AzanChoice,
  type AzanPerPrayer,
  type IqamaOffsets,
  type LocationSetting,
  type NotificationToggles,
  type PrayerTimeOffsets,
} from '@/features/settings/types';
import { splitSequential, useLayout } from '@/hooks/use-layout';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';
import type { Locale } from '@/lib/locale-detect';
import { refreshAllWidgets } from '@/widgets/refresh';
import { WIDGET_THEME_KEYS } from '@/widgets/widgetTheme';

// Sprach-Labels bewusst in der jeweiligen Sprache (Endonym), nicht übersetzt.
const LANGUAGES: { id: Locale; label: string }[] = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'English' },
  { id: 'tr', label: 'Türkçe' },
  { id: 'ar', label: 'العربية' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'id', label: 'Bahasa Indonesia' },
  { id: 'bn', label: 'বাংলা' },
  { id: 'fa', label: 'فارسی' },
  { id: 'ms', label: 'Bahasa Melayu' },
  { id: 'ur', label: 'اردو' },
  { id: 'ru', label: 'Русский' },
  { id: 'sw', label: 'Kiswahili' },
  { id: 'ps', label: 'پښتو' },
];

const PRAYER_TOGGLE_LABELS: { id: keyof NotificationToggles; label: string }[] = [
  { id: 'fajr', label: 'Fajr' },
  { id: 'dhuhr', label: 'Dhuhr' },
  { id: 'asr', label: 'Asr' },
  { id: 'maghrib', label: 'Maghrib' },
  { id: 'isha', label: 'Isha' },
];

// Minuten-Korrektur: dieselben fünf Gebete wie oben, plus Sonnenaufgang
// (Ende der Fajr-Zeit — für Moscheen/Nutzer, die sich danach richten, ebenso
// relevant). Die Gebetsnamen bleiben wie überall in der App transliteriert und
// damit unübersetzt; `label: null` = Sonnenaufgang, wird übersetzt gerendert.
const PRAYER_OFFSET_ROWS: { id: keyof PrayerTimeOffsets; label: string | null }[] = [
  { id: 'fajr', label: 'Fajr' },
  { id: 'sunrise', label: null },
  { id: 'dhuhr', label: 'Dhuhr' },
  { id: 'asr', label: 'Asr' },
  { id: 'maghrib', label: 'Maghrib' },
  { id: 'isha', label: 'Isha' },
];

// Schrittweiten der Minuten-Korrektur: ±1 für die Feinjustierung, ±5 damit man
// die ±60-Spanne nicht in Einer-Schritten durchtippen muss.
const OFFSET_STEPS = [-5, -1, 1, 5] as const;

/** "+5" / "0" / "-5" — das Vorzeichen macht die Richtung der Korrektur eindeutig. */
function formatOffset(minutes: number): string {
  return minutes > 0 ? `+${minutes}` : String(minutes);
}

// Alle 14 App-Sprachen wählbar — und seit dem Lizenz-Audit vom 30.07.2026
// liegt der gesamte Hadith-Bestand in jeder davon vor: An-Nawawi 40 aus den
// Repo-Kursdaten und die HadeethEnc-Enzyklopädie, die redaktionell in alle 14
// Sprachen übersetzt ist. Der frühere Hinweis, dass für die meisten Sprachen
// auf Englisch zurückgefallen wird, gilt nicht mehr.
const HADITH_LANGUAGES: { id: Locale; label: string }[] = LANGUAGES;

const TIME_FORMATS: { id: '24h' | '12h'; labelKey: string }[] = [
  { id: '24h', labelKey: 'settings.format24' },
  { id: '12h', labelKey: 'settings.format12' },
];

const FONT_SIZES: { id: 'small' | 'medium' | 'large' | 'xlarge'; labelKey: string }[] = [
  { id: 'small', labelKey: 'settings.fontSmall' },
  { id: 'medium', labelKey: 'settings.fontMedium' },
  { id: 'large', labelKey: 'settings.fontLarge' },
  { id: 'xlarge', labelKey: 'settings.fontXLarge' },
];

// Vorschau der Schriftauswahl: „Bismillāh …" — der Satz, den jeder Nutzer
// kennt, und er enthält alle kritischen Zeichen (Alif waṣla, Shadda, Alif
// khanjariyya), an denen sich die Schriften unterscheiden.
const FONT_PREVIEW_TEXT = 'بِسْمِ ٱللَّهِ';
// Dasselbe Wort in beiden Sukūn-Schreibweisen: "عَلَيْهِمْ" — einmal mit U+06E1
// (Haken, Madina-Druck), einmal mit U+0652 (Kreis). Sie zeigen also genau den
// Unterschied, um den es in der Einstellung geht.
const SUKUN_VORSCHAU_MADINA = 'عَلَيۡهِمۡ';
const SUKUN_VORSCHAU_KREIS = 'عَلَيْهِمْ';
const FONT_PREVIEW_SIZE = 17;
const FONT_PREVIEW_LINE_HEIGHT = 30;

const THEME_OPTIONS: { id: 'auto' | 'light' | 'dark'; labelKey: string }[] = [
  { id: 'auto', labelKey: 'settings.themeAuto' },
  { id: 'light', labelKey: 'settings.themeLight' },
  { id: 'dark', labelKey: 'settings.themeDark' },
];

// Such-Index für die Live-Filterung: bildet die gerenderte Reihenfolge der
// Gruppen und Sektionen 1:1 ab. `id` ist der i18n-Schlüssel des Sektions-Titels
// (identisch zum an <Section label=…> übergebenen Titel) und dient zugleich als
// durchsuchbarer Begriff. `keys` sind i18n-Schlüssel (bzw. reine Literale wie
// Gebetsnamen) — sie werden zur Laufzeit via t() in die AKTUELLE Sprache
// übersetzt und dann gegen die Suchanfrage geprüft, damit die Suche in jeder
// Sprache die tatsächlich angezeigten Labels trifft. Trifft eine Sektion, legt
// der Provider ihren übersetzten Titel (t(id)) + den Gruppentitel ins Sichtbar-
// Set; Section/GroupHeader lesen das per Context und rendern sich sonst zu null.
type SearchGroup = { group: string; sections: { id: string; keys: string[] }[] };
const SETTINGS_SEARCH_INDEX: SearchGroup[] = [
  {
    group: 'settings.groups.prayer',
    sections: [
      { id: 'settings.location', keys: ['settings.location', 'settings.current', 'settings.useMyLocation', 'settings.searchCity'] },
      { id: 'settings.savedLocations.title', keys: ['settings.savedLocations.title', 'settings.savedLocations.saveCurrent', 'settings.savedLocations.namePlaceholder'] },
      { id: 'settings.travel.title', keys: ['settings.travel.title', 'settings.travel.enable', 'settings.travel.setHome'] },
      { id: 'settings.method', keys: ['settings.method', 'settings.methodHint', 'settings.methodCountryHint'] },
      {
        id: 'prayerSource.title',
        keys: ['prayerSource.title', 'prayerSource.subtitle', 'mosqueMatch.title', 'mosqueMatch.subtitle'],
      },
      { id: 'settings.asrSchool', keys: ['settings.asrSchool', 'settings.asrEarlier', 'settings.asrEarlierDesc', 'settings.asrLater', 'settings.asrLaterDesc'] },
      { id: 'settings.highLatitude.title', keys: ['settings.highLatitude.title', 'settings.highLatitude.auto', 'settings.highLatitude.autoDesc', 'settings.highLatitude.middleOfNight', 'settings.highLatitude.middleOfNightDesc', 'settings.highLatitude.seventhOfNight', 'settings.highLatitude.seventhOfNightDesc', 'settings.highLatitude.twilightAngle', 'settings.highLatitude.twilightAngleDesc'] },
      { id: 'settings.timeAdjust.title', keys: ['settings.timeAdjust.title', 'settings.timeAdjust.sunrise', 'settings.timeAdjust.reset', 'Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] },
      { id: 'settings.iqama.title', keys: ['settings.iqama.title', 'settings.iqama.enable'] },
      { id: 'settings.timeFormat', keys: ['settings.timeFormat', 'settings.format24', 'settings.format12'] },
    ],
  },
  {
    group: 'settings.groups.notifications',
    sections: [
      { id: 'settings.notificationsOverview.navLabel', keys: ['settings.notificationsOverview.navLabel', 'settings.notificationsOverview.navHint'] },
      { id: 'settings.notifications', keys: ['settings.notifications', 'Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'settings.notifPrefs.sound', 'settings.notifPrefs.vibrate', 'settings.notifPrefs.headsUp'] },
      { id: 'settings.lateNotif.title', keys: ['settings.lateNotif.title', 'settings.lateNotif.exactAlarm', 'settings.lateNotif.battery'] },
      {
        id: 'settings.azan.title',
        keys: [
          'settings.azan.title', 'settings.azan.option', 'settings.azan.systemDefault',
          'settings.azan.notification', 'settings.azan.notificationHint', 'settings.azan.credit',
        ],
      },
      {
        id: 'settings.ramadan.title',
        keys: [
          'settings.ramadan.title', 'settings.ramadan.hint',
          'settings.ramadan.suhoor', 'settings.ramadan.suhoorHint', 'settings.ramadan.leadHint',
          'settings.ramadan.iftar', 'settings.ramadan.iftarHint',
        ],
      },
      { id: 'settings.preAdhan.title', keys: ['settings.preAdhan.title', 'settings.preAdhan.enable', 'settings.preAdhan.hint'] },
    ],
  },
  {
    group: 'settings.groups.reminders',
    sections: [
      { id: 'settings.adhkar.title', keys: ['settings.adhkar.title', 'settings.adhkar.morning', 'settings.adhkar.evening'] },
      { id: 'settings.reviewReminder.title', keys: ['settings.reviewReminder.title', 'settings.reviewReminder.enable'] },
      { id: 'settings.verseOfDay.title', keys: ['settings.verseOfDay.title', 'settings.verseOfDay.enable'] },
      // Zusammengefasste Karte "Weitere Erinnerungen": bündelt die vier bisher
      // einzelnen Ein-Schalter-Sektionen (Jumu'ah/Sunnah/Wochenrückblick/Udhiyah).
      // Deren frühere Titel bleiben als Such-Begriffe erhalten, damit die Live-
      // Suche nach z. B. "Jumu'ah" weiterhin diese (jetzt gemeinsame) Karte trifft.
      {
        id: 'settings.moreReminders.title',
        keys: [
          'settings.moreReminders.title',
          'settings.jumuah.title', 'settings.jumuah.enable',
          'settings.sunnah.title', 'settings.sunnah.duha', 'settings.sunnah.tahajjud', 'settings.sunnah.witr',
          'settings.weeklySummary.title', 'settings.weeklySummary.enable',
          'settings.udhiyah.title', 'settings.udhiyah.enable',
        ],
      },
    ],
  },
  {
    group: 'settings.groups.quran',
    sections: [
      { id: 'nav.quran', keys: ['nav.quran', 'quran.chooseReciter', 'quran.chooseTranslation'] },
      { id: 'settings.fontSize', keys: ['settings.fontSize', 'settings.fontSmall', 'settings.fontMedium', 'settings.fontLarge', 'settings.fontXLarge'] },
      // Schriftnamen sind Eigennamen und stehen nicht in den Locale-Dateien —
      // sie kommen als Literale in den Index, damit die Suche nach "Amiri"
      // oder "Scheherazade" die Sektion findet.
      {
        id: 'settings.quranFont.title',
        keys: ['settings.quranFont.title', ...QURAN_FONTS.map((f) => f.name), ...QURAN_FONTS.map((f) => f.hintKey)],
      },
      { id: 'settings.offlinePack.title', keys: ['settings.offlinePack.title', 'settings.offlinePack.download'] },
      { id: 'settings.reciterAudioPack.title', keys: ['settings.reciterAudioPack.title', 'settings.reciterAudioPack.chooseReciter'] },
      { id: 'settings.storage.title', keys: ['settings.storage.title'] },
    ],
  },
  {
    group: 'settings.groups.language',
    sections: [
      { id: 'settings.language', keys: ['settings.language'] },
      { id: 'settings.hadithLanguage', keys: ['settings.hadithLanguage'] },
      { id: 'settings.appearance', keys: ['settings.appearance', 'settings.themeAuto', 'settings.themeLight', 'settings.themeDark'] },
      { id: 'settings.display.title', keys: ['settings.display.title', 'settings.display.transliteration', 'settings.display.isolatedLetters'] },
      { id: 'settings.appIcon.title', keys: ['settings.appIcon.title'] },
      { id: 'settings.dashboard.navLabel', keys: ['settings.dashboard.navLabel', 'settings.dashboard.navHint'] },
      { id: 'settings.widgets.title', keys: ['settings.widgets.title', 'widgets.themeTitle'] },
    ],
  },
  {
    group: 'settings.groups.learning',
    sections: [
      { id: 'settings.pace.title', keys: ['settings.pace.title', 'settings.pace.freeUnlock'] },
      { id: 'settings.exercise.title', keys: ['settings.exercise.title', 'settings.exercise.mixed', 'settings.exercise.mixedDesc', 'settings.exercise.audio', 'settings.exercise.audioDesc', 'settings.exercise.reading', 'settings.exercise.readingDesc', 'settings.exercise.speech', 'settings.recitationModel.title'] },
    ],
  },
  {
    group: 'settings.groups.data',
    sections: [
      { id: 'settings.backup.title', keys: ['settings.backup.title', 'settings.backup.exportButton', 'settings.backup.importButton', 'sync.title'] },
      { id: 'settings.support.title', keys: ['settings.support.title', 'settings.support.copyReport', 'settings.support.replayOnboarding'] },
    ],
  },
  {
    group: 'settings.groups.about',
    sections: [
      { id: 'settings.legal', keys: ['settings.legal', 'nav.impressum', 'nav.datenschutz', 'nav.agb', 'nav.lizenzen', 'settings.legalFeedback', 'settings.legalVersion'] },
    ],
  },
];

// Sichtbarkeits-Context der Live-Suche: `null` = keine Suche aktiv (alles
// sichtbar), sonst ein Set der übersetzten Titel, die zur aktuellen Anfrage
// passen. Section/GroupHeader lesen das und rendern sich zu `null`, wenn ihr
// Titel nicht enthalten ist — so bleibt die JSX-Struktur unverändert.
const SettingsFilterContext = createContext<Set<string> | null>(null);
function useSectionVisible(title: string): boolean {
  const visible = useContext(SettingsFilterContext);
  return visible === null || visible.has(title);
}

export default function SettingsScreen() {
  const { settings, update, reset } = useSettings();
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  // Vorschau der beiden Sukūn-Schreibweisen in der aktiven Koran-Schrift.
  const sukunVorschauFamilie = useQuranFontFamily(settings.quranFont);
  const { requestLocation, loading: locLoading } = useDeviceLocation();
  const { data: audioEditions } = useAudioEditions();
  const { data: translationEditions } = useTranslationEditions();

  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [pickerOpen, setPickerOpen] = useState<'reciter' | 'translation' | 'method' | 'downloadReciter' | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const cityRequestId = useRef(0);
  const cityDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const queryClient = useQueryClient();
  // null = noch nie gestartet; 0-113 = laeuft; 114 = fertig
  const [offlineProgress, setOfflineProgress] = useState<number | null>(null);

  // Exact-Alarm-Berechtigungsstatus (nur Android, siehe exact-alarm.ts) -
  // null = unbekannt (iOS/Web oder natives Modul nicht gebaut/registriert,
  // dann bleibt nur der generische Hinweistext unten sichtbar). Wird beim
  // Betreten des Screens einmal geprüft, nicht laufend gepollt - der Nutzer
  // kommt ohnehin über einen der beiden Buttons hierher zurück, wenn er die
  // Einstellung ändert.
  const [exactAlarmGranted, setExactAlarmGranted] = useState<boolean | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    const pruefen = () => {
      checkExactAlarmPermission().then((status) => {
        if (!cancelled) setExactAlarmGranted(status);
      });
    };
    pruefen();
    // Nach dem Erteilen kommt der Nutzer aus den Systemeinstellungen zurueck -
    // ohne diese Pruefung stuende der Hinweis "Aktuell nicht erlaubt" dann bis
    // zum naechsten App-Start weiter da.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') pruefen();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  /**
   * Wrapper um das Umschalten der 5 Gebets-Toggles: identisch zum direkten
   * update()-Aufruf, zeigt aber beim ERSTEN Einschalten (irgendeines Gebets,
   * irgendwann) zusätzlich einmalig den Akku-Optimierungs-Hinweis (Teil 2
   * der Exact-Alarm/Doze-Recherche) - danach nie wieder, siehe battery-hint.ts.
   */
  async function togglePrayerNotification(id: keyof NotificationToggles, value: boolean) {
    update({ notificationsEnabled: { ...settings.notificationsEnabled, [id]: value } });
    if (Platform.OS !== 'android' || !value) return;
    // Zuerst die Berechtigung fuer exakte Alarme: ohne sie schiebt Android die
    // Benachrichtigung im Stromsparmodus auf - das ist die haeufigste Ursache
    // verspaeteter Gebetszeiten und wiegt schwerer als die Akku-Optimierung.
    // Seit Android 13 wird sie bei Neuinstallationen nicht mehr automatisch
    // erteilt (s. features/prayer-times/exact-alarm.ts). Nur EIN Dialog auf
    // einmal, damit sich nicht zwei Systemdialoge stapeln.
    const exaktErlaubt = await checkExactAlarmPermission();
    setExactAlarmGranted(exaktErlaubt);
    if (exaktErlaubt === false) {
      Alert.alert(t('prayer.lateWarning.title'), t('prayer.lateWarning.body'), [
        { text: t('settings.lateNotif.batteryPromptLater'), style: 'cancel' },
        { text: t('prayer.lateWarning.action'), onPress: () => void openExactAlarmSettings() },
      ]);
      return;
    }
    if (await wasBatteryHintShown()) return;
    await markBatteryHintShown();
    Alert.alert(t('settings.lateNotif.batteryPromptTitle'), t('settings.lateNotif.batteryPromptBody'), [
      { text: t('settings.lateNotif.batteryPromptLater'), style: 'cancel' },
      {
        text: t('settings.lateNotif.batteryPromptOpen'),
        onPress: () => Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => {}),
      },
    ]);
  }

  async function downloadOfflinePack() {
    setOfflineProgress(0);
    const staleTime = 7 * 24 * 60 * 60 * 1000;
    for (let n = 1; n <= 114; n++) {
      try {
        await queryClient.prefetchQuery({
          queryKey: ['quran', 'surah', n, settings.quranTranslation, settings.quranReciter],
          queryFn: () => fetchSurahReading(n, settings.quranTranslation, settings.quranReciter),
          staleTime,
        });
      } catch {
        // einzelne Fehlschlaege ueberspringen (naechster Lauf holt sie nach)
      }
      setOfflineProgress(n);
      // API-freundlich drosseln
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  // Kompletter Rezitator-Audio-Download (114 Suren, sequentiell) - Hook aus
  // offline-audio.ts, hier nur UI (Bestätigungs-Dialog + Fortschritt + Anzahl
  // bereits vorhandener Suren fürs "fortsetzen"-Label). Bewusst NICHT an
  // settings.quranReciter (den Wiedergabe-Rezitator) gekoppelt: der Download
  // soll unabhängig davon wählbar sein, wer gerade abgespielt wird - Start-
  // wert ist der aktuelle Wiedergabe-Rezitator als sinnvoller Default, ändert
  // sich danach aber nicht mehr mit, wenn der Nutzer diesen umstellt.
  const [downloadReciter, setDownloadReciter] = useState(settings.quranReciter);
  const reciterDownload = useFullMushafDownload(downloadReciter);
  const [reciterDownloadedCount, setReciterDownloadedCount] = useState<number | null>(null);
  useEffect(() => {
    if (!reciterDownload.supported) return;
    let cancelled = false;
    countDownloadedSurahs(downloadReciter).then((n) => {
      if (!cancelled) setReciterDownloadedCount(n);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadReciter, reciterDownload.downloading]);

  // Übersicht aller bereits (teilweise) offline gespeicherten Rezitatoren -
  // mehrere Pakete können gleichzeitig vorliegen, da Pfad+Index pro Rezitator
  // getrennt sind (siehe offline-audio.ts). Refresh bei Download-Ende/-Start
  // und nach jedem Löschen.
  const [downloadedReciters, setDownloadedReciters] = useState<DownloadedReciterPack[]>([]);
  useEffect(() => {
    if (!reciterDownload.supported) return;
    let cancelled = false;
    listDownloadedReciters().then((list) => {
      if (!cancelled) setDownloadedReciters(list);
    });
    return () => {
      cancelled = true;
    };
  }, [reciterDownload.supported, reciterDownload.downloading]);

  const downloadReciterEdition = audioEditions?.find((e) => e.identifier === downloadReciter);
  const downloadReciterName = downloadReciterEdition ? editionDisplayName(downloadReciterEdition) : downloadReciter;

  function confirmReciterDownload() {
    Alert.alert(t('settings.reciterAudioPack.confirmTitle'), t('settings.reciterAudioPack.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.reciterAudioPack.startAction'), onPress: () => void reciterDownload.download() },
    ]);
  }

  function confirmDeleteReciterPack(reciter: string, name: string) {
    Alert.alert(
      t('settings.reciterAudioPack.deleteConfirmTitle'),
      t('settings.reciterAudioPack.deleteConfirmBody').replace('{reciter}', name),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.reciterAudioPack.deleteAction'),
          style: 'destructive',
          onPress: () => {
            void deleteFullMushafAudio(reciter).then(async () => {
              setDownloadedReciters(await listDownloadedReciters());
              if (reciter === downloadReciter) setReciterDownloadedCount(0);
            });
          },
        },
      ],
    );
  }

  // App-Icon/Name-Auswahl (nur Android, siehe features/settings/app-icon.ts).
  const [appIconChoice, setAppIconChoice] = useState<AppIconVariant>('Default');
  useEffect(() => {
    if (!appIconSupported()) return;
    getCurrentAppIcon().then(setAppIconChoice);
  }, []);
  async function pickAppIcon(variant: AppIconVariant) {
    setAppIconChoice(variant);
    await setAppIcon(variant);
  }

  const [cityResults, setCityResults] = useState<NominatimResult[]>([]);
  // Name-Eingabe für "aktuellen Ort speichern" (s. features/settings/savedLocations.ts).
  const [savedLocationName, setSavedLocationName] = useState('');
  // Vorschau-Player für die Adhan-Auswahl (kein bestimmter Track vorgewählt,
  // wird pro Tipp neu gesetzt).
  const [previewChoice, setPreviewChoice] = useState<AzanChoice | null>(null);
  const previewPlayer = useSsrSafeAudioPlayer(previewChoice ? azanSource(previewChoice) : undefined);
  function previewAzan(choice: AzanChoice) {
    if (choice === 'default') return;
    setPreviewChoice(choice);
  }
  /**
   * Beschriftung einer Adhan-Auswahl: schlicht „Adhan 1/2/3" nach der
   * Reihenfolge in AZAN_CHOICES (azanNumber). Die Liste ist bei JEDEM Gebet
   * dieselbe, deshalb bezeichnet die Nummer ueberall dieselbe Aufnahme.
   * Welche Aufnahme woher stammt, steht in der Lizenz-Nennung darunter
   * (settings.azan.credit) und ausfuehrlich unter „Quellen & Lizenzen".
   */
  const azanLabel = (choice: AzanChoice, kurz = false) =>
    choice === 'default'
      ? t(kurz ? 'settings.azan.standardShort' : 'settings.azan.systemDefault')
      : t('settings.azan.option').replace('{n}', String(azanNumber(choice)));
  useEffect(() => {
    if (previewChoice) {
      previewPlayer.seekTo(0);
      previewPlayer.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewChoice]);

  const [citySearching, setCitySearching] = useState(false);
  // Treffer mit unbrauchbaren Koordinaten (s. pickCity) — sichtbar melden
  // statt still nichts zu tun.
  const [cityError, setCityError] = useState(false);

  const [reportCopied, setReportCopied] = useState(false);
  async function copyErrorReport() {
    const entries = await getErrorLog();
    await Clipboard.setStringAsync(formatErrorReport(entries));
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 1800);
  }

  // Kontakt-Adresse identisch zum Impressum (src/app/impressum.tsx) - kein
  // eigenes Backend, öffnet nur den Standard-Mail-Client des Geräts.
  function openFeedbackMail() {
    const subject = encodeURIComponent(t('settings.legalFeedbackSubject'));
    Linking.openURL(`mailto:salati@domenicmoran.de?subject=${subject}`).catch(() => {});
  }

  // App-Version für Support-Anfragen: JS-Konfigversion (app.config.ts) plus
  // die tatsächliche native Build-Nummer des installierten Binaries (bleibt
  // auch nach einem OTA-Update auf den ursprünglichen Build fixiert, siehe
  // expo-constants-Doku zu Constants.platform.*). `platform`-Feld ist zwar
  // als deprecated markiert (expo-application wird empfohlen), liefert aber
  // ohne zusätzliche native Dependency/Rebuild bereits den echten Wert.
  const nativeBuildNumber =
    Platform.OS === 'android'
      ? Constants.platform?.android?.versionCode
      : Platform.OS === 'ios'
        ? Constants.platform?.ios?.buildNumber
        : undefined;
  const appVersionLabel = nativeBuildNumber != null
    ? `${Constants.expoConfig?.version ?? '?'} (${nativeBuildNumber})`
    : Constants.expoConfig?.version ?? '?';

  // Manueller OTA-Update-Check (features/updates/otaUpdate.ts). Sichtbar nur in
  // Builds, in denen expo-updates wirklich arbeitet - auf Web und im
  // Entwicklungs-Client bleibt die Zeile eine reine Versionsanzeige.
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | OtaCheckResult>('idle');
  const updateHint =
    updateState === 'checking'
      ? t('settings.updates.checking')
      : updateState === 'ready'
        ? t('settings.updates.restart')
        : updateState === 'up-to-date'
          ? t('settings.updates.upToDate')
          : updateState === 'failed'
            ? t('settings.updates.failed')
            : t('settings.updates.check');

  async function onUpdateRowPress() {
    if (updateState === 'ready') {
      // Fehler schlucken: greift das Neuladen nicht, ist das Update spätestens
      // beim nächsten regulären App-Start aktiv.
      restartWithUpdate().catch(() => {});
      return;
    }
    if (updateState === 'checking') return;
    setUpdateState('checking');
    setUpdateState(await checkForOtaUpdate({ force: true }));
  }

  // Fortschritt exportieren/importieren (siehe features/settings/backup.ts für
  // die recherchierten AsyncStorage-Keys + Formatversion). scrollRef +
  // reciterSectionY erlauben den "Zu den Rezitator-Downloads"-Link nach einem
  // Import direkt zur bestehenden Rezitator-Sektion weiter unten zu scrollen,
  // statt eine zweite Kopie der Sektion aufzubauen.
  const scrollRef = useRef<ScrollView>(null);
  // Auf Tablets darf die Seite breiter werden als die 800-dp-Telefonspalte —
  // sie traegt dort zwei Sektionsspalten (SettingsColumns).
  const { contentWidth } = useLayout();
  const reciterSectionY = useRef(0);
  const [backupBusy, setBackupBusy] = useState<'export' | 'import' | null>(null);
  const [importedReciters, setImportedReciters] = useState<string[] | null>(null);

  async function exportProgress() {
    if (backupBusy) return;
    setBackupBusy('export');
    try {
      const data = await collectBackupData();
      const uri = await writeBackupFile(data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          dialogTitle: t('settings.backup.exportButton'),
        });
      } else {
        Alert.alert(t('settings.backup.title'), t('settings.backup.exportError'));
      }
    } catch {
      Alert.alert(t('settings.backup.title'), t('settings.backup.exportError'));
    } finally {
      setBackupBusy(null);
    }
  }

  async function finishImport(data: BackupData) {
    try {
      await applyBackupData(data);
      setImportedReciters(data.downloadedReciters);
      Alert.alert(t('settings.backup.title'), t('settings.backup.importSuccess'));
    } catch {
      Alert.alert(t('settings.backup.title'), t('settings.backup.importError'));
    }
  }

  async function importProgress() {
    if (backupBusy) return;
    setBackupBusy('import');
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset) return;

      const raw = await readBackupFile(asset.uri);
      const result = parseBackupFile(raw);
      if (!result.ok) {
        Alert.alert(
          t('settings.backup.title'),
          result.reason === 'unsupported_version'
            ? t('settings.backup.importUnsupportedVersion')
            : t('settings.backup.importInvalidFile'),
        );
        return;
      }

      // Import überschreibt lokalen Fortschritt vollständig - erst nach
      // expliziter Bestätigung anwenden (Aufgabenstellung Punkt 2).
      Alert.alert(t('settings.backup.importConfirmTitle'), t('settings.backup.importConfirmBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.backup.importConfirmAction'),
          style: 'destructive',
          onPress: () => void finishImport(result.data),
        },
      ]);
    } catch {
      Alert.alert(t('settings.backup.title'), t('settings.backup.importError'));
    } finally {
      setBackupBusy(null);
    }
  }

  function goToReciterDownloads() {
    scrollRef.current?.scrollTo({ y: Math.max(reciterSectionY.current - Spacing.three, 0), animated: true });
  }

  function onCityQueryChange(q: string) {
    setCityQuery(q);
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    if (q.trim().length < 3) {
      setCityResults([]);
      setCitySearching(false);
      return;
    }
    // 400ms Debounce: ohne Bremse feuert jeder Tastendruck sofort einen
    // eigenen Nominatim-Request ab, was gegen deren 1req/s-Nutzungsrichtlinie
    // verstößt und dort zu Rate-Limit-Antworten (kein valides JSON) führt.
    // requestId verwirft veraltete Antworten, falls der Nutzer weitertippt.
    setCitySearching(true);
    const requestId = ++cityRequestId.current;
    cityDebounce.current = setTimeout(async () => {
      try {
        const results = await searchCity(q);
        if (requestId === cityRequestId.current) setCityResults(results);
      } catch {
        if (requestId === cityRequestId.current) setCityResults([]);
      } finally {
        if (requestId === cityRequestId.current) setCitySearching(false);
      }
    }, 400);
  }

  function pickCity(r: NominatimResult) {
    // Audit 2026-07-27 (O4): unbrauchbare Koordinaten (NaN/außerhalb des
    // Wertebereichs) NICHT speichern — sonst rechnen ab hier alle Gebetszeiten
    // still falsch. Statt dessen sichtbar melden und die Auswahl offen lassen.
    const loc = nominatimResultToLocation(r);
    if (!loc) {
      setCityError(true);
      return;
    }
    setCityError(false);
    update({ location: loc });
    setCityQuery('');
    setCityResults([]);
  }

  async function useMyLocation() {
    const pos = await requestLocation();
    if (pos) {
      update({
        location: {
          ...pos,
          label: `${pos.lat.toFixed(3)}, ${pos.lon.toFixed(3)}`,
          city: settings.location.city,
          country: settings.location.country,
        },
      });
    }
  }

  // Gespeicherte Orte ("Zuhause"/"Arbeit"/…) — schnelles Wechseln ohne
  // erneute Stadtsuche, s. features/settings/savedLocations.ts. Der aktive
  // Ort (settings.location) bleibt davon unberührt, bis der Nutzer explizit
  // einen gespeicherten Ort antippt.
  function saveCurrentLocation() {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = addSavedLocation(settings.savedLocations, id, savedLocationName, settings.location);
    if (next !== settings.savedLocations) {
      update({ savedLocations: next });
      setSavedLocationName('');
    }
  }

  function switchToSavedLocation(loc: LocationSetting) {
    update({ location: { lat: loc.lat, lon: loc.lon, label: loc.label, city: loc.city, country: loc.country } });
  }

  function deleteSavedLocation(id: string) {
    update({ savedLocations: removeSavedLocation(settings.savedLocations, id) });
  }

  const currentMethodName = methodName(settings.method);
  const aktuelleMethode = methodById(settings.method);
  const methodLabels = useMethodLabels();
  // Welche Behörde ist im Land des eingestellten Ortes die übliche? Nur ein
  // Vorschlag — umgestellt wird ausschließlich per Tipp auf die Aktionszeile.
  const landesEmpfehlung = recommendMethod(settings.location.country);
  const empfohleneMethode = methodById(landesEmpfehlung.methodId);
  const landesAbweichung =
    landesEmpfehlung.basis === 'country' && landesEmpfehlung.methodId !== settings.method;
  const currentReciterEdition = audioEditions?.find((e) => e.identifier === settings.quranReciter);
  const currentReciterName = currentReciterEdition
    ? editionDisplayName(currentReciterEdition)
    : settings.quranReciter;
  const currentTranslationEdition = translationEditions?.find(
    (e) => e.identifier === settings.quranTranslation,
  );
  const currentTranslationName = currentTranslationEdition
    ? editionDisplayName(currentTranslationEdition)
    : settings.quranTranslation;

  // Live-Suche über alle Einstellungen (iOS-artig): filtert Sektionen und
  // Gruppen-Überschriften anhand ihrer in die aktuelle Sprache übersetzten
  // Titel + Unter-Labels (SETTINGS_SEARCH_INDEX). Statt jede der ~35 Sektionen
  // im JSX einzeln mit einem Gate zu umschließen, stellen wir das Ergebnis als
  // Set der SICHTBAREN übersetzten Titel per Context bereit: Section/GroupHeader
  // rendern sich selbst zu `null`, wenn ihr Titel nicht im Set ist. Leeres Feld
  // => `null` = alles sichtbar. Auswertung pro Render günstig, kein useMemo.
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  let visibleTitles: Set<string> | null = null;
  if (query) {
    visibleTitles = new Set<string>();
    for (const g of SETTINGS_SEARCH_INDEX) {
      const groupMatches = t(g.group).toLowerCase().includes(query);
      const matchedSections = g.sections.filter(
        (s) => groupMatches || s.keys.some((k) => t(k).toLowerCase().includes(query)),
      );
      if (matchedSections.length > 0) {
        visibleTitles.add(t(g.group));
        for (const s of matchedSections) visibleTitles.add(t(s.id));
      }
    }
  }
  const filterVisible = visibleTitles;
  const noResults = filterVisible !== null && filterVisible.size === 0;

  return (
    <SettingsFilterContext.Provider value={filterVisible}>
    <ThemedView type="groupedBackground" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('nav.settings')} variant="modal" align="left" />
        <ScrollView ref={scrollRef} contentContainerStyle={[styles.scroll, { maxWidth: contentWidth }]}>
          <SettingsSearchBar value={search} onChangeText={setSearch} />

          {noResults && (
            <EmptyState
              icon="search-outline"
              title={t('settings.searchNoResults')}
            />
          )}

          <SettingsColumns>
          <GroupHeader label={t('settings.groups.prayer')} />

          <AnimatedListItem index={0}>
          <Section label={t('settings.location')}>
            {/* Wertzeile statt der früheren grauen Info-Zeile „Current: …":
                Label links, Wert rechts — dieselbe Grammatik wie überall. */}
            <ValueRow label={t('settings.current')} value={settings.location.label} />
            {/* Aktionszeile OHNE Chevron: die Ortung passiert in der Zeile,
                sie öffnet keinen Bildschirm (Audit 2026-07-29, Punkt 4). */}
            <ActionRow
              onPress={useMyLocation}
              label={t('settings.useMyLocation')}
              busy={locLoading}
              hint={locLoading ? t('settings.locating') : undefined}
            />
            <InputRow
              icon="search-outline"
              value={cityQuery}
              onChangeText={onCityQueryChange}
              placeholder={t('settings.searchCity')}
              autoCorrect={false}
              returnKeyType="search"
            />
            {citySearching && <ListNote text={t('common.loading')} />}
            {cityError && <ListNote text={t('settings.cityInvalid')} />}
            {cityResults.map((r) => (
              <SelectRow key={r.place_id} onPress={() => pickCity(r)} label={r.display_name} />
            ))}
          </Section>
          </AnimatedListItem>

          {/* Gespeicherte Orte als EIGENE Sektion: schnelles Wechseln
              (z. B. "Zuhause"/"Arbeit") ohne die Stadtsuche erneut zu
              bemühen — der aktive Ort bleibt weiterhin settings.location. */}
          <AnimatedListItem index={1}>
          <Section label={t('settings.savedLocations.title')}>
            {settings.savedLocations.map((loc) => {
              const active = isActiveSavedLocation(loc, settings.location);
              return (
                <View key={loc.id} style={[styles.savedLocationRow, rtl && styles.savedLocationRowRtl]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${loc.name}, ${loc.label}`}
                    onPress={() => switchToSavedLocation(loc)}
                    style={({ pressed }) => [
                      styles.savedLocationMain,
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.rowPressed,
                    ]}>
                    <ThemedText type="default" style={rtl && styles.rtlText}>
                      {loc.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                      {loc.label}
                    </ThemedText>
                  </Pressable>
                  {active && <IconSymbol name="checkmark" size={18} color={colors.accent} />}
                  <Pressable
                    onPress={() => deleteSavedLocation(loc.id)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('settings.savedLocations.delete')}: ${loc.name}`}
                    style={({ pressed }) => [
                      styles.savedLocationDelete,
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <IconSymbol name="trash-outline" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
              );
            })}
            <InputRow
              icon="create-outline"
              value={savedLocationName}
              onChangeText={setSavedLocationName}
              placeholder={t('settings.savedLocations.namePlaceholder')}
            />
            <ActionRow onPress={saveCurrentLocation} label={t('settings.savedLocations.saveCurrent')} />
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={2}>
          <Section
            label={t('settings.travel.title')}
            footer={t('settings.travel.home').replace(
              '{location}',
              settings.homeLocation?.label ?? settings.location.label,
            )}>
            <SwitchRow
              label={t('settings.travel.enable')}
              hint={t('settings.travel.enableHint')}
              value={settings.travelModeEnabled}
              onValueChange={(v) => update({ travelModeEnabled: v })}
            />
            <ActionRow
              onPress={() => update({ homeLocation: settings.location })}
              label={t('settings.travel.setHome')}
            />
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={3}>
          <Section
            label={t('settings.method')}
            hideTitle
            footer={
              // Der Hinweis erscheint NUR, wenn die eingestellte Methode nicht
              // die des aktuellen Landes ist — und er stellt nichts um: wer
              // bewusst der Methode seiner Heimat oder seiner Moschee folgt,
              // darf sie nicht durch einen Ortswechsel verlieren.
              landesAbweichung && empfohleneMethode
                ? t('settings.methodCountryHint')
                    .replace('{country}', settings.location.label)
                    .replace('{method}', empfohleneMethode.name)
                : t('settings.methodParamsFooter').replace(
                    '{params}',
                    aktuelleMethode ? methodParamsLabel(aktuelleMethode, methodLabels) : '',
                  )
            }>
            {/* Navigationszeile: öffnet den Auswahl-Bildschirm — Wert rechts,
                Chevron dahinter (iOS-Muster „Label · Wert · ›"). */}
            <NavRow
              onPress={() => setPickerOpen('method')}
              label={t('settings.method')}
              value={currentMethodName}
              hint={t('settings.methodHint')}
            />
            {landesAbweichung && empfohleneMethode ? (
              <ActionRow
                onPress={() => update({ method: empfohleneMethode.id })}
                label={t('settings.methodCountryApply').replace('{method}', empfohleneMethode.shortName)}
              />
            ) : null}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={3.5}>
          <Section label={t('prayerSource.title')} hideTitle footer={t('settings.prayerHelpFooter')}>
            {/* Die zwei Wege aus „meine Zeiten stimmen nicht" heraus — bewusst
                DIREKT unter der Methodenwahl, denn dort entsteht die Frage. */}
            <NavRow
              onPress={() => router.push('/prayer-times-mosque')}
              label={t('mosqueMatch.title')}
              hint={t('mosqueMatch.subtitle')}
            />
            <NavRow
              onPress={() => router.push('/prayer-times-source')}
              label={t('prayerSource.title')}
              hint={t('prayerSource.subtitle')}
            />
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={4}>
          <Section label={t('settings.asrSchool')}>
            {SCHOOLS.map((s) => (
              <SelectRow
                key={s.id}
                onPress={() => update({ school: s.id })}
                label={t(s.id === 0 ? 'settings.asrEarlier' : 'settings.asrLater')}
                description={t(s.id === 0 ? 'settings.asrEarlierDesc' : 'settings.asrLaterDesc')}
                selected={settings.school === s.id}
              />
            ))}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={5}>
          <Section label={t('settings.highLatitude.title')} footer={t('settings.highLatitude.hint')}>
            {HIGH_LATITUDE_OPTIONS.map((id) => (
              <SelectRow
                key={id}
                onPress={() => update({ highLatitudeRule: id })}
                label={t(`settings.highLatitude.${id}`)}
                // Ohne Kurzbeschreibung stünden hier vier Fachbegriffe, von
                // denen "Automatisch" und "Winkelbasiert" in Deutschland sogar
                // dasselbe Ergebnis liefern. Die Beschreibung sagt, was die
                // Wahl konkret an Fadschr/Ischa verschiebt.
                description={t(`settings.highLatitude.${id}Desc`)}
                selected={settings.highLatitudeRule === id}
              />
            ))}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={6}>
          <Section label={t('settings.timeAdjust.title')} footer={t('settings.timeAdjust.hint')}>
            {PRAYER_OFFSET_ROWS.map((p) => {
              const value = settings.prayerTimeOffsets[p.id];
              return (
                <View key={p.id}>
                  <View style={[styles.switchRow, rtl && styles.switchRowRtl]}>
                    <ThemedText type="default" style={rtl && styles.rtlText}>
                      {p.label ?? t('settings.timeAdjust.sunrise')}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      themeColor={value === 0 ? 'textSecondary' : 'accent'}
                      style={rtl && styles.rtlText}>
                      {formatOffset(value)} {t('settings.timeAdjust.minutesShort')}
                    </ThemedText>
                  </View>
                  <View style={[styles.hourRow, rtl && styles.hourRowRtl]}>
                    {OFFSET_STEPS.map((step) => {
                      const next = value + step;
                      const disabled = next < PRAYER_TIME_OFFSET_MIN || next > PRAYER_TIME_OFFSET_MAX;
                      return (
                        <Pressable
                          key={step}
                          disabled={disabled}
                          onPress={() =>
                            update({
                              prayerTimeOffsets: {
                                ...settings.prayerTimeOffsets,
                                [p.id]: next,
                              } as PrayerTimeOffsets,
                            })
                          }
                          style={({ pressed }) => [
                            Platform.OS === 'web' ? styles.pressableWeb : undefined,
                            (pressed || disabled) && styles.pressed,
                          ]}>
                          <ThemedView type="backgroundElement" style={styles.hourChip}>
                            <ThemedText type="small">{formatOffset(step)}</ThemedText>
                          </ThemedView>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
            <ActionRow
              onPress={() => update({ prayerTimeOffsets: NO_PRAYER_TIME_OFFSETS })}
              label={t('settings.timeAdjust.reset')}
            />
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={7}>
          <Section
            label={t('settings.iqama.title')}
            footer={settings.iqamaEnabled ? t('settings.iqama.offsetHint') : undefined}>
            <SwitchRow
              label={t('settings.iqama.enable')}
              hint={t('settings.iqama.enableHint')}
              value={settings.iqamaEnabled}
              onValueChange={(v) => update({ iqamaEnabled: v })}
            />
            {settings.iqamaEnabled && (
              <>
                {PRAYER_TOGGLE_LABELS.map((p) => (
                  <View key={p.id}>
                    <View style={[styles.switchRow, rtl && styles.switchRowRtl]}>
                      <ThemedText type="default" style={rtl && styles.rtlText}>{p.label}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                        +{settings.iqamaOffsets[p.id]} {t('settings.iqama.minutesShort')}
                      </ThemedText>
                    </View>
                    <View style={[styles.hourRow, rtl && styles.hourRowRtl]}>
                      {IQAMA_OFFSET_OPTIONS.map((minutes) => (
                        <Pressable
                          key={minutes}
                          onPress={() =>
                            update({
                              iqamaOffsets: { ...settings.iqamaOffsets, [p.id]: minutes } as IqamaOffsets,
                            })
                          }
                          style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                          <ThemedView
                            type={settings.iqamaOffsets[p.id] === minutes ? 'backgroundSelected' : 'backgroundElement'}
                            style={styles.hourChip}>
                            <ThemedText
                              type="small"
                              themeColor={settings.iqamaOffsets[p.id] === minutes ? 'accent' : 'text'}>
                              {minutes}
                            </ThemedText>
                          </ThemedView>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </>
            )}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={8}>
          <Section label={t('settings.timeFormat')}>
            {TIME_FORMATS.map((f) => (
              <SelectRow
                key={f.id}
                onPress={() => update({ timeFormat: f.id })}
                label={t(f.labelKey)}
                selected={settings.timeFormat === f.id}
              />
            ))}
          </Section>
          </AnimatedListItem>

          <GroupHeader label={t('settings.groups.notifications')} />

          {/* Prominenter Einstieg in die Benachrichtigungs-Gruppe: zentrale
              Übersicht ALLER Notification-Toggles der App (notifications-
              overview.tsx) - die einzelnen Toggles unten in ihren jeweiligen
              Sections bleiben zusätzlich bestehen, siehe Datei-Kommentar dort. */}
          <AnimatedListItem index={9}>
          <Section label={t('settings.notificationsOverview.navLabel')} hideTitle>
            <NavRow
              onPress={() => router.push('/notifications-overview')}
              label={t('settings.notificationsOverview.navHint')}
            />
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={10}>
          <Section label={t('settings.notifications')}>
            {PRAYER_TOGGLE_LABELS.map((p) => (
              <SwitchRow
                key={p.id}
                label={p.label}
                value={settings.notificationsEnabled[p.id]}
                onValueChange={(v) => togglePrayerNotification(p.id, v)}
              />
            ))}
            {(
              [
                { key: 'sound', label: t('settings.notifPrefs.sound'), hint: t('settings.notifPrefs.soundHint') },
                { key: 'vibrate', label: t('settings.notifPrefs.vibrate'), hint: t('settings.notifPrefs.vibrateHint') },
                { key: 'headsUp', label: t('settings.notifPrefs.headsUp'), hint: t('settings.notifPrefs.headsUpHint') },
                ...(Platform.OS === 'android'
                  ? ([
                      {
                        key: 'ongoingCountdown',
                        label: t('settings.notifPrefs.ongoingCountdown'),
                        hint: t('settings.notifPrefs.ongoingCountdownHint'),
                      },
                    ] as const)
                  : []),
                ...(Platform.OS === 'ios'
                  ? ([
                      {
                        key: 'liveActivity',
                        label: t('settings.notifPrefs.liveActivity'),
                        hint: t('settings.notifPrefs.liveActivityHint'),
                      },
                    ] as const)
                  : []),
              ] as const
            ).map((row) => (
              <SwitchRow
                key={row.key}
                label={row.label}
                hint={row.hint}
                value={settings.notificationPrefs[row.key]}
                onValueChange={(v) =>
                  update({ notificationPrefs: { ...settings.notificationPrefs, [row.key]: v } })
                }
              />
            ))}
          </Section>
          </AnimatedListItem>

          {/* Direkt nach den Gebets-Toggles statt hinter dem Adhan-Klang
              (Nutzerfund: 3 Benachrichtigungen kamen gebuendelt/verspaetet
              an — Ursache meist eine fehlende Exact-Alarm-Berechtigung;
              der Hinweis dazu war vorher zu weit von den Toggles entfernt,
              um beim Einrichten aufzufallen). */}
          {Platform.OS === 'android' && (
            <AnimatedListItem index={11}>
            <Section label={t('settings.lateNotif.title')} footer={t('settings.lateNotif.hint')}>
              {/* Laufzeit-Prüfung via ExactAlarmModule.kt (exact-alarm.ts) -
                  nur sichtbar, wenn der Status tatsächlich bekannt UND
                  explizit nicht erteilt ist. `null` (iOS/Web/Modul nicht
                  gebaut) und `true` zeigen bewusst NICHTS Zusätzliches, damit
                  kein falscher Alarm entsteht. */}
              {exactAlarmGranted === false && (
                <ValueRow label={t('settings.lateNotif.title')} value={t('settings.lateNotif.notGranted')} />
              )}
              <ActionRow
                onPress={() => Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM').catch(() => {})}
                label={t('settings.lateNotif.exactAlarm')}
              />
              <ActionRow
                onPress={() => Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => {})}
                label={t('settings.lateNotif.battery')}
              />
            </Section>
            </AnimatedListItem>
          )}

          <AnimatedListItem index={12}>
          <Section label={t('settings.azan.title')} footer={t('settings.azan.hint')}>
            <View style={[styles.azanRow, rtl && styles.azanRowRtl]}>
              {AZAN_CHOICES.map((choice) => (
                // Zwei GESCHWISTER-Pressables statt verschachtelt (Auswahl +
                // Vorschau-Icon): ein <button> im anderen ist ungültiges HTML
                // und löste im Web-Export einen reproduzierbaren Hydration-
                // Fehler aus (Browser korrigiert das verschachtelte <button>
                // beim Parsen selbst weg, React erwartet danach eine andere
                // DOM-Struktur als tatsächlich vorhanden — minified React
                // error #418, per Playwright-Konsole auf /settings bestätigt).
                <ThemedView
                  key={choice}
                  type={settings.azanChoice === choice ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.azanChip}>
                  <Pressable
                    onPress={() => update({ azanChoice: choice })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: settings.azanChoice === choice }}
                    style={({ pressed }) => [
                      styles.azanChipLabel,
                      choice === 'default' && styles.azanChipLabelSolo,
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="small" themeColor={settings.azanChoice === choice ? 'accent' : 'text'}>
                      {azanLabel(choice)}
                    </ThemedText>
                  </Pressable>
                  {choice !== 'default' && (
                    <Pressable
                      onPress={() => previewAzan(choice)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.azan.preview')}
                      style={({ pressed }) => [
                        styles.azanChipPreview,
                        Platform.OS === 'web' ? styles.pressableWeb : undefined,
                        pressed && styles.pressed,
                      ]}>
                      <IconSymbol name="play-circle-outline" size={16} color={colors.accent} />
                    </Pressable>
                  )}
                </ThemedView>
              ))}
            </View>
            {/* Namensnennung ist bei CC BY / CC BY-SA Pflicht und gehoert dorthin,
                wo die Aufnahme laeuft — nicht nur auf die Lizenzseite. Namen und
                Lizenzkuerzel sind Eigennamen und in jeder Sprache gleich. */}
            <ListNote text={t('settings.azan.credit')} />
            <SwitchRow
              label={t('settings.azan.notification')}
              hint={t('settings.azan.notificationHint')}
              value={settings.azanNotificationEnabled}
              onValueChange={(v) => update({ azanNotificationEnabled: v })}
            />
            {settings.azanNotificationEnabled && (
              <>
                {/* Plattform-Unterschied gehoert an die Stelle, an der er
                    auffaellt: auf dem iPhone laeuft in der Benachrichtigung
                    der 30-s-Schnitt, der volle Ruf danach in der App. */}
                <ListNote
                  text={Platform.OS === 'ios' ? t('settings.azan.iosLimit') : t('settings.azan.perPrayerHint')}
                />
                {PRAYER_TOGGLE_LABELS.map((p) => (
                  <View key={p.id}>
                    <View style={[styles.switchRow, rtl && styles.switchRowRtl]}>
                      <ThemedText type="default" style={rtl && styles.rtlText}>{p.label}</ThemedText>
                    </View>
                    {/* Der Hinweis steht UNTER dem Gebetsnamen, nicht daneben:
                        neben der einzeiligen Ueberschrift quetschte der
                        mehrzeilige Satz das Wort „Fadschr" zusammen. */}
                    {p.id === 'fajr' && <ListNote text={t('settings.azan.fajrNote')} />}
                    <View style={[styles.azanRow, rtl && styles.azanRowRtl]}>
                      {/* Bei JEDEM Gebet dieselbe Liste — „Adhan 3" (der Ruf mit
                          Tathwib) ist fuer Fadschr voreingestellt, aber kein
                          Sonderfall neben der Liste (s. AzanPerPrayer). */}
                      {AZAN_CHOICES.map((choice) => {
                        const selected = settings.azanNotificationChoices[p.id] === choice;
                        return (
                          // Wieder zwei GESCHWISTER-Pressables statt geschachtelt,
                          // s. Begruendung an der Auswahl darueber (Web-Hydration).
                          <ThemedView
                            key={choice}
                            type={selected ? 'backgroundSelected' : 'backgroundElement'}
                            style={styles.azanChip}>
                            <Pressable
                              onPress={() =>
                                update({
                                  azanNotificationChoices: {
                                    ...settings.azanNotificationChoices,
                                    [p.id]: choice,
                                  } as AzanPerPrayer,
                                })
                              }
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              accessibilityLabel={`${p.label}: ${azanLabel(choice, true)}`}
                              style={({ pressed }) => [
                                styles.azanChipLabel,
                                choice === 'default' && styles.azanChipLabelSolo,
                                Platform.OS === 'web' ? styles.pressableWeb : undefined,
                                pressed && styles.pressed,
                              ]}>
                              <ThemedText type="small" themeColor={selected ? 'accent' : 'text'}>
                                {azanLabel(choice, true)}
                              </ThemedText>
                            </Pressable>
                            {choice !== 'default' && (
                              <Pressable
                                onPress={() => previewAzan(choice)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={t('settings.azan.preview')}
                                style={({ pressed }) => [
                                  styles.azanChipPreview,
                                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                                  pressed && styles.pressed,
                                ]}>
                                <IconSymbol name="play-circle-outline" size={16} color={colors.accent} />
                              </Pressable>
                            )}
                          </ThemedView>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </>
            )}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={13}>
          <Section label={t('settings.ramadan.title')} footer={t('settings.ramadan.hint')}>
            <SwitchRow
              label={t('settings.ramadan.suhoor')}
              hint={t('settings.ramadan.suhoorHint')}
              value={settings.suhoorAlarmEnabled}
              onValueChange={(v) => update({ suhoorAlarmEnabled: v })}
            />
            {settings.suhoorAlarmEnabled && (
              <>
              {/* Ohne diesen Satz ist die Chip-Reihe eine nackte Zahlenreihe —
                  sie sagt nicht, worauf sich die Minuten beziehen. */}
              <ListNote text={t('settings.ramadan.leadHint')} />
              <View style={[styles.hourRow, rtl && styles.hourRowRtl]}>
                {SUHOOR_LEAD_OPTIONS.map((min) => (
                  <Pressable
                    key={min}
                    onPress={() => update({ suhoorAlarmLead: min })}
                    style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                    <ThemedView
                      type={settings.suhoorAlarmLead === min ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.hourChip}>
                      <ThemedText type="small" themeColor={settings.suhoorAlarmLead === min ? 'accent' : 'text'}>
                        {t('settings.ramadan.lead').replace('{n}', String(min))}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </View>
              </>
            )}
            <SwitchRow
              label={t('settings.ramadan.iftar')}
              hint={t('settings.ramadan.iftarHint').replace('{n}', String(IFTAR_REMINDER_LEAD_MINUTES))}
              value={settings.iftarReminderEnabled}
              onValueChange={(v) => update({ iftarReminderEnabled: v })}
            />
            {/* Ein Wecker, der zu spaet kommt, ist wertlos: derselbe
                Laufzeit-Status wie im Abschnitt "verspaetete
                Benachrichtigungen" (ExactAlarmModule.kt), aber hier gezeigt,
                wo er ueber Erfolg oder Misserfolg entscheidet. */}
            {settings.suhoorAlarmEnabled && Platform.OS === 'android' && exactAlarmGranted === false && (
              <ActionRow
                onPress={() => Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM').catch(() => {})}
                label={t('settings.lateNotif.exactAlarm')}
              />
            )}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={14}>
          <Section label={t('settings.preAdhan.title')}>
            <SwitchRow
              label={t('settings.preAdhan.enable')}
              hint={t('settings.preAdhan.hint')}
              value={settings.preAdhanReminderEnabled}
              onValueChange={(v) => update({ preAdhanReminderEnabled: v })}
            />
            {settings.preAdhanReminderEnabled && (
              <View style={[styles.hourRow, rtl && styles.hourRowRtl]}>
                {PRE_ADHAN_OFFSET_OPTIONS.map((min) => (
                  <Pressable
                    key={min}
                    onPress={() => update({ preAdhanReminderOffset: min })}
                    style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                    <ThemedView
                      type={settings.preAdhanReminderOffset === min ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.hourChip}>
                      <ThemedText type="small" themeColor={settings.preAdhanReminderOffset === min ? 'accent' : 'text'}>
                        {t('settings.preAdhan.minutes').replace('{n}', String(min))}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </View>
            )}
          </Section>
          </AnimatedListItem>

          <GroupHeader label={t('settings.groups.reminders')} />

          <AnimatedListItem index={15}>
          <Section label={t('settings.adhkar.title')}>
            {(
              [
                { key: 'morning', enabledKey: 'adhkarMorningEnabled', hourKey: 'adhkarMorningHour', hours: ADHKAR_MORNING_HOURS },
                { key: 'evening', enabledKey: 'adhkarEveningEnabled', hourKey: 'adhkarEveningHour', hours: ADHKAR_EVENING_HOURS },
              ] as const
            ).map((row) => (
              <View key={row.key}>
                <SwitchRow
                  label={t(`settings.adhkar.${row.key}`)}
                  hint={t(`settings.adhkar.${row.key}Hint`)}
                  value={settings[row.enabledKey]}
                  onValueChange={(v) => {
                    update({ [row.enabledKey]: v });
                    rescheduleAdhkarReminders({
                      morningEnabled: row.key === 'morning' ? v : settings.adhkarMorningEnabled,
                      morningHour: settings.adhkarMorningHour,
                      eveningEnabled: row.key === 'evening' ? v : settings.adhkarEveningEnabled,
                      eveningHour: settings.adhkarEveningHour,
                      locale: settings.language,
                    }).catch(() => {});
                  }}
                />
                {settings[row.enabledKey] && (
                  <View style={[styles.hourRow, rtl && styles.hourRowRtl]}>
                    {row.hours.map((h) => (
                      <Pressable
                        key={h}
                        onPress={() => {
                          update({ [row.hourKey]: h });
                          rescheduleAdhkarReminders({
                            morningEnabled: settings.adhkarMorningEnabled,
                            morningHour: row.key === 'morning' ? h : settings.adhkarMorningHour,
                            eveningEnabled: settings.adhkarEveningEnabled,
                            eveningHour: row.key === 'evening' ? h : settings.adhkarEveningHour,
                            locale: settings.language,
                          }).catch(() => {});
                        }}
                        style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                        <ThemedView
                          type={settings[row.hourKey] === h ? 'backgroundSelected' : 'backgroundElement'}
                          style={styles.hourChip}>
                          <ThemedText type="small" themeColor={settings[row.hourKey] === h ? 'accent' : 'text'}>
                            {h}:00
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={16}>
          <Section label={t('settings.reviewReminder.title')}>
            <SwitchRow
              label={t('settings.reviewReminder.enable')}
              hint={t('settings.reviewReminder.hint')}
              value={settings.reviewReminderEnabled}
              onValueChange={(v) => update({ reviewReminderEnabled: v })}
            />
            {settings.reviewReminderEnabled &&
              REVIEW_REMINDER_HOUR_OPTIONS.map((hour) => (
                <SelectRow
                  key={hour}
                  onPress={() => update({ reviewReminderHour: hour })}
                  label={t(`settings.reviewReminder.hour${hour}`)}
                  selected={settings.reviewReminderHour === hour}
                />
              ))}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={17}>
          <Section label={t('settings.verseOfDay.title')}>
            <SwitchRow
              label={t('settings.verseOfDay.enable')}
              hint={t('settings.verseOfDay.hint')}
              value={settings.verseOfDayReminderEnabled}
              onValueChange={(v) => {
                update({ verseOfDayReminderEnabled: v });
                rescheduleVerseOfDayReminder(
                  v,
                  settings.verseOfDayReminderHour,
                  settings.language,
                  settings.hadithLanguage,
                ).catch(() => {});
              }}
            />
            {settings.verseOfDayReminderEnabled && (
              <View style={[styles.hourRow, rtl && styles.hourRowRtl]}>
                {VERSE_OF_DAY_HOUR_OPTIONS.map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => {
                      update({ verseOfDayReminderHour: h });
                      rescheduleVerseOfDayReminder(true, h, settings.language, settings.hadithLanguage).catch(
                        () => {},
                      );
                    }}
                    style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                    <ThemedView
                      type={settings.verseOfDayReminderHour === h ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.hourChip}>
                      <ThemedText type="small" themeColor={settings.verseOfDayReminderHour === h ? 'accent' : 'text'}>
                        {h}:00
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </View>
            )}
          </Section>
          </AnimatedListItem>

          {/* Zusammengefasste Karte: die vier bisher einzelnen Ein-Schalter-
              Sektionen (Freitags-, Sunnah-, Wochenrückblick-, Udhiyah-Erinnerung)
              sind hier zu EINER scanbaren Liste gebündelt — die einzelnen
              Toggle-Labels bleiben selbsterklärend, jede onValueChange-Logik
              (inkl. Reschedule) unverändert. Weniger fast-leere Karten. */}
          <AnimatedListItem index={18}>
          <Section label={t('settings.moreReminders.title')}>
            <SwitchRow
              label={t('settings.jumuah.enable')}
              hint={t('settings.jumuah.hint')}
              value={settings.jumuahReminderEnabled}
              onValueChange={(v) => update({ jumuahReminderEnabled: v })}
            />
            {(
              [
                { key: 'duha', enabledKey: 'sunnahDuhaEnabled' },
                { key: 'tahajjud', enabledKey: 'sunnahTahajjudEnabled' },
                { key: 'witr', enabledKey: 'sunnahWitrEnabled' },
              ] as const
            ).map((row) => (
              <SwitchRow
                key={row.key}
                label={t(`settings.sunnah.${row.key}`)}
                hint={t(`settings.sunnah.${row.key}Hint`)}
                value={settings[row.enabledKey]}
                onValueChange={(v) => update({ [row.enabledKey]: v })}
              />
            ))}
            <SwitchRow
              label={t('settings.weeklySummary.enable')}
              hint={t('settings.weeklySummary.hint')}
              value={settings.weeklySummaryReminderEnabled}
              onValueChange={(v) => {
                update({ weeklySummaryReminderEnabled: v });
                rescheduleWeeklySummary(v, settings.language).catch(() => {});
              }}
            />
            <SwitchRow
              label={t('settings.udhiyah.enable')}
              hint={t('settings.udhiyah.hint')}
              value={settings.udhiyahReminderEnabled}
              onValueChange={(v) => {
                update({ udhiyahReminderEnabled: v });
                rescheduleUdhiyahReminder(v, settings.language).catch(() => {});
              }}
            />
          </Section>
          </AnimatedListItem>

          <GroupHeader label={t('settings.groups.quran')} />

          <AnimatedListItem index={19}>
          <Section label={t('nav.quran')}>
            <NavRow
              onPress={() => setPickerOpen('reciter')}
              label={t('quran.chooseReciter')}
              value={currentReciterName}
            />
            <NavRow
              onPress={() => setPickerOpen('translation')}
              label={t('quran.chooseTranslation')}
              value={currentTranslationName}
            />
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={20}>
          <Section label={t('settings.fontSize')}>
            {FONT_SIZES.map((f) => (
              <SelectRow
                key={f.id}
                onPress={() => update({ quranFontSize: f.id })}
                label={t(f.labelKey)}
                selected={settings.quranFontSize === f.id}
              />
            ))}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={20}>
          <Section label={t('settings.quranFont.title')}>
            {QURAN_FONTS.map((f) => (
              <QuranFontRow
                key={f.id}
                font={f}
                selected={settings.quranFont === f.id}
                onPress={() => update({ quranFont: f.id })}
                hint={t(f.hintKey)}
              />
            ))}
          </Section>
          </AnimatedListItem>

          {/* Sukūn-Zeichen: nur sichtbar, wenn eine Schrift mit KFGQPC-Kodierung
              aktiv ist — bei allen anderen zeichnet die Schrift ihr eigenes
              Sukūn und die Auswahl haette keine Wirkung. */}
          {quranFontDef(settings.quranFont).textEncoding === 'kfgqpc' && (
            <AnimatedListItem index={21}>
            <Section label={t('settings.quranSukun.title')}>
              {(['madina', 'kreis'] as const).map((stil) => (
                <SelectRow
                  key={stil}
                  label={t(`settings.quranSukun.${stil}`)}
                  selected={settings.quranSukun === stil}
                  onPress={() => update({ quranSukun: stil })}
                  leading={
                    <ThemedText
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      numberOfLines={1}
                      style={[styles.fontPreview, ARABIC_FONT_FEATURES, { fontFamily: sukunVorschauFamilie }]}>
                      {stil === 'madina' ? SUKUN_VORSCHAU_MADINA : SUKUN_VORSCHAU_KREIS}
                    </ThemedText>
                  }
                />
              ))}
              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                {t('settings.quranSukun.hint')}
              </ThemedText>
            </Section>
            </AnimatedListItem>
          )}

          <AnimatedListItem index={22}>
          <Section label={t('settings.offlinePack.title')}>
            <View style={[styles.switchRow, rtl && styles.switchRowRtl]}>
              <View style={[styles.switchLabel, rtl && styles.switchLabelRtl]}>
                <ThemedText type="default" style={rtl && styles.rtlText}>{t('settings.offlinePack.download')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                  {offlineProgress === null
                    ? t('settings.offlinePack.hint')
                    : offlineProgress >= 114
                      ? t('settings.offlinePack.done')
                      : `${offlineProgress} / 114`}
                </ThemedText>
              </View>
              <Pressable
                onPress={downloadOfflinePack}
                disabled={offlineProgress !== null && offlineProgress < 114}
                accessibilityRole="button"
                accessibilityLabel={t('settings.offlinePack.download')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <ThemedView type="backgroundSelected" style={styles.hourChip}>
                  <IconSymbol
                    name={offlineProgress !== null && offlineProgress >= 114 ? 'checkmark' : 'cloud-download-outline'}
                    size={16}
                    color={colors.accent}
                  />
                </ThemedView>
              </Pressable>
            </View>
          </Section>
          </AnimatedListItem>

          {reciterDownload.supported && (
          <View onLayout={(e) => { reciterSectionY.current = e.nativeEvent.layout.y; }}>
          <AnimatedListItem index={22}>
          <Section
            label={t('settings.reciterAudioPack.title')}
            footer={t('settings.reciterAudioPack.hint').replace('{reciter}', downloadReciterName)}>
            <NavRow
              onPress={() => setPickerOpen('downloadReciter')}
              label={t('settings.reciterAudioPack.chooseReciter')}
              value={downloadReciterName}
            />
            <View style={[styles.switchRow, rtl && styles.switchRowRtl]}>
              <View style={[styles.switchLabel, rtl && styles.switchLabelRtl]}>
                <ThemedText type="default" style={rtl && styles.rtlText}>
                  {reciterDownload.downloading
                    ? t('settings.reciterAudioPack.progress')
                        .replace('{n}', String(Math.round(reciterDownload.progress * QURAN_SURAH_COUNT)))
                        .replace('{total}', String(QURAN_SURAH_COUNT))
                    : reciterDownloadedCount !== null && reciterDownloadedCount >= QURAN_SURAH_COUNT
                      ? t('settings.reciterAudioPack.done')
                      : reciterDownloadedCount
                        ? t('settings.reciterAudioPack.resume').replace('{n}', String(reciterDownloadedCount))
                        : t('settings.reciterAudioPack.download')}
                </ThemedText>
              </View>
              <Pressable
                onPress={reciterDownload.downloading ? reciterDownload.cancel : confirmReciterDownload}
                disabled={!reciterDownload.downloading && reciterDownloadedCount !== null && reciterDownloadedCount >= QURAN_SURAH_COUNT}
                accessibilityRole="button"
                accessibilityLabel={reciterDownload.downloading ? t('common.cancel') : t('settings.reciterAudioPack.download')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <ThemedView type="backgroundSelected" style={styles.hourChip}>
                  <IconSymbol
                    name={
                      reciterDownload.downloading
                        ? 'close'
                        : reciterDownloadedCount !== null && reciterDownloadedCount >= QURAN_SURAH_COUNT
                          ? 'checkmark'
                          : 'cloud-download-outline'
                    }
                    size={16}
                    color={colors.accent}
                  />
                </ThemedView>
              </Pressable>
            </View>
            {downloadedReciters.length > 0 ? (
              <>
                <ListNote text={t('settings.reciterAudioPack.downloadedTitle')} />
                {downloadedReciters.map((pack) => {
                  const edition = audioEditions?.find((e) => e.identifier === pack.reciter);
                  const name = edition ? editionDisplayName(edition) : pack.reciter;
                  return (
                    <View key={pack.reciter} style={[styles.switchRow, rtl && styles.switchRowRtl]}>
                      <View style={[styles.switchLabel, rtl && styles.switchLabelRtl]}>
                        <ThemedText type="default" style={rtl && styles.rtlText}>
                          {name}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                          {pack.surahCount >= QURAN_SURAH_COUNT
                            ? t('settings.reciterAudioPack.packComplete')
                            : t('settings.reciterAudioPack.packStatus').replace('{n}', String(pack.surahCount))}
                        </ThemedText>
                      </View>
                      <Pressable
                        onPress={() => confirmDeleteReciterPack(pack.reciter, name)}
                        accessibilityRole="button"
                        accessibilityLabel={t('settings.reciterAudioPack.deleteAction')}
                        style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                        <ThemedView type="backgroundSelected" style={styles.hourChip}>
                          <IconSymbol name="trash-outline" size={16} color={colors.accent} />
                        </ThemedView>
                      </Pressable>
                    </View>
                  );
                })}
              </>
            ) : (
              <EmptyState
                compact
                icon="cloud-download-outline"
                title={t('settings.reciterAudioPack.noDownloads')}
              />
            )}
          </Section>
          </AnimatedListItem>
          </View>
          )}

          {/* Speicherverwaltung direkt neben den Offline-/Rezitator-Downloads:
              der Nutzer, der hier Suren/Rezitatoren offline verfügbar macht,
              erreicht die zugehörige Größen-/Lösch-Übersicht ohne bis zur
              "Daten"-Gruppe weiterscrollen zu müssen (Nutzerfund: "Speicher
              verwalten" lag zu weit von "offline verfügbar machen" entfernt). */}
          {Platform.OS !== 'web' && (
          <AnimatedListItem index={23}>
          <Section label={t('settings.storage.title')} hideTitle footer={t('settings.storage.openHint')}>
            <NavRow onPress={() => router.push('/storage')} label={t('settings.storage.title')} />
          </Section>
          </AnimatedListItem>
          )}

          {/* Salati KI auch aus den Einstellungen erreichbar (Nutzerwunsch —
              vorher nur über Mehr → Salati AI). Seit dem Zitat-Modus gibt es
              hier nichts mehr zu verwalten: kein Modell, kein Download. */}
          {Platform.OS !== 'web' && (
          <AnimatedListItem index={24}>
          <Section label={t('ki.title')} hideTitle footer={t('ki.subtitle')}>
            <NavRow onPress={() => router.push('/ki-native')} label={t('ki.title')} />
          </Section>
          </AnimatedListItem>
          )}

          <GroupHeader label={t('settings.groups.language')} />

          <AnimatedListItem index={25}>
          <Section label={t('settings.language')}>
            {LANGUAGES.map((l) => (
              <SelectRow
                key={l.id}
                onPress={() =>
                  update({
                    language: l.id,
                    quranTranslation: BEST_TRANSLATIONS[l.id] ?? settings.quranTranslation,
                    quranTafsirs: [BEST_TAFSIRS[l.id] ?? settings.quranTafsirs[0]],
                    // Hadith-Sprache mitziehen — bisher blieb sie auf Englisch
                    // stehen, auch wenn die Sammlung in der App-Sprache vorliegt.
                    hadithLanguage: l.id,
                  })
                }
                label={l.label}
                selected={settings.language === l.id}
              />
            ))}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={26}>
          <Section label={t('settings.hadithLanguage')}>
            {HADITH_LANGUAGES.map((l) => (
              <SelectRow
                key={l.id}
                onPress={() => update({ hadithLanguage: l.id })}
                label={l.label}
                selected={settings.hadithLanguage === l.id}
              />
            ))}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={27}>
          <Section label={t('settings.appearance')}>
            {THEME_OPTIONS.map((themeOption) => (
              <SelectRow
                key={themeOption.id}
                onPress={() => update({ themeOverride: themeOption.id })}
                label={t(themeOption.labelKey)}
                selected={settings.themeOverride === themeOption.id}
              />
            ))}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={28}>
          <Section label={t('settings.display.title')}>
            <SwitchRow
              label={t('settings.display.transliteration')}
              hint={t('settings.display.transliterationHint')}
              value={settings.showTransliteration}
              onValueChange={(v) => update({ showTransliteration: v })}
            />
            <SwitchRow
              label={t('settings.display.isolatedLetters')}
              hint={t('settings.display.isolatedLettersHint')}
              value={settings.showIsolatedLetters}
              onValueChange={(v) => update({ showIsolatedLetters: v })}
            />
          </Section>
          </AnimatedListItem>

          {appIconSupported() && (
          <AnimatedListItem index={29}>
          <Section
            label={t('settings.appIcon.title')}
            footer={appIconNameSwitchSupported() ? t('settings.appIcon.hint') : t('settings.appIcon.iosHint')}>
            {APP_ICON_VARIANTS.map((variant) => (
              <SelectRow
                key={variant.id}
                onPress={() => pickAppIcon(variant.id)}
                label={t(`settings.appIcon.variant${variant.id}`)}
                selected={appIconChoice === variant.id}
                leading={<View style={[styles.iconSwatch, { backgroundColor: variant.swatch }]} />}
              />
            ))}
          </Section>
          </AnimatedListItem>
          )}

          <AnimatedListItem index={30}>
          <Section label={t('settings.dashboard.navLabel')}>
            <NavRow
              onPress={() => router.push('/dashboard-reorder')}
              label={t('settings.dashboard.navHint')}
            />
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={31}>
          <Section label={t('settings.widgets.title')} footer={t('settings.widgets.perWidgetHint')}>
            <ListNote text={t('settings.widgets.hint')} />
            <View style={styles.modelPicker}>
              <ListNote text={t('widgets.themeTitle')} />
              {WIDGET_THEME_KEYS.map((k) => (
                <SelectRow
                  key={k}
                  onPress={() => {
                    // Erst persistieren, DANN die platzierten Widgets neu
                    // zeichnen — sonst läse der Widget-Renderer noch das alte
                    // Theme aus AsyncStorage. Auf Web/iOS ist refreshAllWidgets
                    // ein No-Op (s. widgets/refresh.ts).
                    void update({ widgetTheme: k }).then(() => refreshAllWidgets());
                  }}
                  label={t(`widgets.theme_${k}`)}
                  selected={settings.widgetTheme === k}
                />
              ))}
              <ListNote text={t('widgets.themeHint')} />
            </View>
          </Section>
          </AnimatedListItem>

          <GroupHeader label={t('settings.groups.learning')} />

          <AnimatedListItem index={32}>
          <Section label={t('settings.pace.title')}>
            {DAILY_MINUTES_OPTIONS.map((minutes) => (
              <SelectRow
                key={minutes}
                onPress={() => update({ dailyMinutes: minutes })}
                label={t(`settings.pace.min${minutes}`)}
                selected={settings.dailyMinutes === minutes}
              />
            ))}
            <SwitchRow
              label={t('settings.pace.freeUnlock')}
              hint={t('settings.pace.freeUnlockHint')}
              value={settings.freeUnlock}
              onValueChange={(v) => update({ freeUnlock: v })}
            />
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={33}>
          <Section label={t('settings.exercise.title')}>
            {(['mixed', 'audio', 'reading'] as const).map((s) => (
              <SelectRow
                key={s}
                onPress={() => update({ exerciseStyle: s })}
                label={t(`settings.exercise.${s}`)}
                description={t(`settings.exercise.${s}Desc`)}
                selected={settings.exerciseStyle === s}
              />
            ))}
            <SwitchRow
              label={t('settings.exercise.speech')}
              hint={t('settings.exercise.speechHint')}
              value={settings.speechExercisesEnabled}
              onValueChange={(v) => update({ speechExercisesEnabled: v })}
            />
            {settings.speechExercisesEnabled && (
              <View style={styles.modelPicker}>
                <ListNote text={t('settings.recitationModel.title')} />
                {(['base', 'turbo'] as const).map((m) => (
                  <SelectRow
                    key={m}
                    onPress={() => update({ recitationModel: m })}
                    label={t(`settings.recitationModel.${m}`)}
                    description={`${Math.round(RECITATION_MODELS[m].groesse / 1_000_000)} MB`}
                    selected={settings.recitationModel === m}
                  />
                ))}
                <ListNote text={t('settings.recitationModel.hint')} />
              </View>
            )}
          </Section>
          </AnimatedListItem>

          <GroupHeader label={t('settings.groups.data')} />

          <AnimatedListItem index={34}>
          <Section
            label={t('settings.backup.title')}
            /* Der Datei-Export nutzt Geraete-Dateisystem + nativen Teilen-Dialog
               (expo-file-system/expo-sharing) - auf Web nicht verfuegbar
               (Sharing.isAvailableAsync()===false). Dort statt der nicht
               funktionierenden Datei-Buttons der Hinweis auf die
               Code-Uebertragung (Sync), die im Browser funktioniert. */
            footer={Platform.OS === 'web' ? t('sync.intro') : t('settings.backup.hint')}>
            {Platform.OS !== 'web' && (
              <>
                <ActionRow
                  onPress={exportProgress}
                  label={t('settings.backup.exportButton')}
                  busy={backupBusy === 'export'}
                  disabled={backupBusy !== null}
                />
                <ActionRow
                  onPress={importProgress}
                  label={t('settings.backup.importButton')}
                  busy={backupBusy === 'import'}
                  disabled={backupBusy !== null}
                />
              </>
            )}
            {/* Code-basierte Uebertragung (funktioniert auch im Browser) - bisher
                nur im "Mehr"-Tab verlinkt, hier fuer bessere Auffindbarkeit
                direkt in der Sichern-Sektion. */}
            <NavRow onPress={() => router.push('/sync')} label={t('sync.title')} />

            {importedReciters !== null && importedReciters.length > 0 && (
              <>
                <ListNote
                  text={t('settings.backup.downloadedRecitersNote').replace('{list}', importedReciters.join(', '))}
                />
                {reciterDownload.supported && (
                  <ActionRow onPress={goToReciterDownloads} label={t('settings.backup.goToDownloads')} />
                )}
              </>
            )}
          </Section>
          </AnimatedListItem>

          <AnimatedListItem index={35}>
          <Section label={t('settings.support.title')}>
            <ActionRow
              onPress={copyErrorReport}
              label={reportCopied ? t('settings.support.copied') : t('settings.support.copyReport')}
              hint={t('settings.support.copyReportHint')}
              trailingIcon={reportCopied ? 'checkmark' : undefined}
            />
            {Platform.OS !== 'web' && (
              <NavRow
                onPress={() => router.push('/onboarding')}
                label={t('settings.support.replayOnboarding')}
              />
            )}
          </Section>
          </AnimatedListItem>

          <GroupHeader label={t('settings.groups.about')} />

          <AnimatedListItem index={36}>
          <Section label={t('settings.legal')}>
            <NavRow onPress={() => router.push('/impressum')} label={t('nav.impressum')} />
            <NavRow onPress={() => router.push('/datenschutz')} label={t('nav.datenschutz')} />
            <NavRow onPress={() => router.push('/agb')} label={t('nav.agb')} />
            <NavRow onPress={() => router.push('/lizenzen')} label={t('nav.lizenzen')} />
            <ActionRow onPress={openFeedbackMail} label={t('settings.legalFeedback')} />
            {/* Version + Update-Check in EINER Zeile ("1.31.0 (51) · Nach Updates
                suchen"). Antippen prüft beim EAS-Update-Endpunkt; liegt ein
                Update bereit, startet derselbe Tipp die App neu. Ohne aktive
                expo-updates-Konfiguration (Web/Dev-Client) bleibt es die
                bisherige, nicht antippbare Versionsanzeige. */}
            {otaSupported() ? (
              <ActionRow
                onPress={onUpdateRowPress}
                label={t('settings.legalVersion')}
                hint={`${appVersionLabel} · ${updateHint}`}
                busy={updateState === 'checking'}
              />
            ) : (
              <ValueRow label={t('settings.legalVersion')} value={appVersionLabel} />
            )}
          </Section>
          </AnimatedListItem>

          {!query && (
            <ListSection>
              <ActionRow onPress={reset} label={t('settings.resetDefaults')} />
            </ListSection>
          )}
          </SettingsColumns>
        </ScrollView>

        <EditionPicker
          visible={pickerOpen === 'reciter'}
          title={t('quran.chooseReciter')}
          editions={audioEditions ?? []}
          recommended={RECOMMENDED_RECITERS}
          selected={settings.quranReciter}
          onSelect={(id) => {
            update({ quranReciter: id });
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />
        <EditionPicker
          visible={pickerOpen === 'downloadReciter'}
          title={t('settings.reciterAudioPack.chooseReciter')}
          editions={audioEditions ?? []}
          recommended={RECOMMENDED_RECITERS}
          selected={downloadReciter}
          onSelect={(id) => {
            setDownloadReciter(id);
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />
        <EditionPicker
          visible={pickerOpen === 'translation'}
          title={t('quran.chooseTranslation')}
          editions={translationEditions ?? []}
          recommended={RECOMMENDED_TRANSLATIONS}
          selected={settings.quranTranslation}
          onSelect={(id) => {
            update({ quranTranslation: id });
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />
        <MethodPicker
          visible={pickerOpen === 'method'}
          selected={settings.method}
          recommended={landesEmpfehlung.basis === 'country' ? landesEmpfehlung.methodId : undefined}
          countryLabel={settings.location.label}
          onSelect={(id) => {
            update({ method: id });
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />
      </SafeAreaView>
    </ThemedView>
    </SettingsFilterContext.Provider>
  );
}

/**
 * Breitbild-Umbruch der Einstellungen (Tablet ab 720 dp).
 *
 * Die Einstellungen sind eine einzige, sehr lange Spalte. Auf 800 dp Breite
 * stand jede Zeile über die volle Fensterbreite („Aktuell" links, „Berlin,
 * Deutschland" 700 dp weiter rechts) und die Seite war entsprechend lang.
 * Hier werden die Kinder an ihren `GroupHeader`n in Gruppen zerlegt und
 * reihenfolgetreu auf zwei Spalten verteilt — eine Gruppe wird nie zerrissen.
 *
 * Auf Telefonen (`sectionColumns === 1`) gibt die Komponente ihre Kinder
 * unverändert zurück: kein zusätzlicher View, kein Layout-Unterschied.
 */
function SettingsColumns({ children }: { children: React.ReactNode }) {
  const { sectionColumns } = useLayout();
  // In rechtslaeufiger Schrift beginnt die erste Spalte rechts.
  const rtl = useRtl();
  const items = Children.toArray(children);
  if (sectionColumns <= 1) return <>{children}</>;

  const gruppen: React.ReactNode[][] = [];
  for (const child of items) {
    const isHeader = isValidElement(child) && child.type === GroupHeader;
    if (isHeader || gruppen.length === 0) gruppen.push([]);
    gruppen[gruppen.length - 1].push(child);
  }
  const spalten = splitSequential(gruppen, sectionColumns, (g) => g.length);

  return (
    <View style={[styles.columnsRow, rtl && styles.columnsRowRtl]}>
      {spalten.map((spalte, i) => (
        <View key={i} style={styles.column}>
          {spalte.map((gruppe, j) => (
            <Fragment key={j}>{gruppe}</Fragment>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Gruppen-Überschrift — die EINE gemischtschriftliche Hierarchie-Ebene über
 * den grauen Sektions-Labels. Vorher war sie versal und gesperrt wie die
 * Sektions-Labels darunter, wodurch die Unterordnung nicht erkennbar war
 * (Audit 2026-07-29, Punkt 1); jetzt trägt sie ThemedText type="heading".
 */
function GroupHeader({ label }: { label: string }) {
  // Bei aktiver Suche nur einblenden, wenn mindestens eine Sektion der Gruppe
  // trifft (der Provider nimmt den Gruppen-Titel dann in das Sichtbar-Set auf).
  const visible = useSectionVisible(label);
  if (!visible) return null;
  return <ListGroupHeading title={label} />;
}

/**
 * Sektion der Einstellungen = ListSection + Sichtbarkeits-Gate der Live-Suche.
 * Ohne Symbol im Kopf (iOS setzt Symbole in Zeilen, nie in Gruppentitel) und
 * ohne Versalien — Aussehen und Trenner kommen zentral aus components/ui/list.
 */
function Section({
  label,
  footer,
  hideTitle,
  children,
}: {
  label: string;
  /** Erklärtext UNTER der Karte (iOS-Sektionsfußnote) statt als graue
   * Pseudo-Zeile in der Karte. */
  footer?: string;
  /** Kopf nicht anzeigen, wenn die einzige Zeile der Karte denselben Text
   * trägt (z. B. „Speicher verwalten" über „Speicher verwalten") — der Titel
   * bleibt für die Live-Suche trotzdem der Schlüssel dieser Sektion. */
  hideTitle?: boolean;
  children: React.ReactNode;
}) {
  // Live-Suche: Sektion verschwindet, wenn ihr Titel nicht ins Treffer-Set des
  // Providers fällt. Der umgebende AnimatedListItem-Wrapper bleibt dann leer
  // (0 Höhe) — deshalb trägt die Abstands-Logik `marginBottom` an der Sektion
  // selbst (in ListSection) statt am `gap` des ScrollView-Containers.
  const visible = useSectionVisible(label);
  if (!visible) return null;
  return (
    <ListSection title={hideTitle ? undefined : label} footer={footer}>
      {children}
    </ListSection>
  );
}

/**
 * Auswahlzeile einer Koran-Schrift MIT echter Vorschau: die Basmala steht in
 * genau der Schrift, um die es geht. Eine Schrift lässt sich nicht beschreiben —
 * man muss sie sehen, sonst probiert man alle vier durch.
 *
 * Die Vorschau lädt die jeweilige Schrift (rund 130–330 KB, aus dem Bundle,
 * kein Netz) — deshalb hängt das Laden an dieser Zeile und nicht am App-Start.
 * Bis sie da ist, steht die Basmala in der Systemschrift.
 */
function QuranFontRow({
  font,
  selected,
  hint,
  onPress,
}: {
  font: QuranFontDef;
  selected: boolean;
  hint: string;
  onPress: () => void;
}) {
  const family = useQuranFontFamily(font.id);
  const { fontSize, lineHeight } = arabicMetrics(font.id, FONT_PREVIEW_SIZE, FONT_PREVIEW_LINE_HEIGHT);
  return (
    <SelectRow
      label={font.name}
      description={hint}
      selected={selected}
      onPress={onPress}
      leading={
        <ThemedText
          // Für Screenreader ist die Vorschau reine Dekoration — der Name der
          // Schrift steht bereits im Label der Zeile.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          // Einzeilig: umgebrochen wäre die Vorschau kein Schriftvergleich
          // mehr, sondern nur noch ein Größenvergleich.
          numberOfLines={1}
          style={[
            styles.fontPreview,
            ARABIC_FONT_FEATURES,
            { fontFamily: family, fontSize, lineHeight },
          ]}>
          {/* In der Kodierung DIESER Schrift — sonst zeigt die Vorschau etwas
              anderes als der Reader danach (features/quran/fonts.ts). */}
          {adaptQuranText(FONT_PREVIEW_TEXT, font)}
        </ThemedText>
      }
    />
  );
}

const styles = StyleSheet.create({
  // 124 dp: der breiteste der vier Vorschau-Texte (KFGQPC bei 17 px) passt
  // einzeilig hinein — schmaler brach er um (Browser-Befund 2026-07-31).
  fontPreview: { width: 124, textAlign: 'right', writingDirection: 'rtl' },
  hourRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  hourRowRtl: { flexDirection: 'row-reverse' },
  // Groessere Tap-Ziele fuer die Auswahl-Chips (Iqama-Offsets, Pre-Adhan-
  // Minuten, Adhkar-/Vers-Stunden) und die Download-Icon-Buttons: vorher nur
  // ~28px hoch (unter der 44pt-Empfehlung), jetzt min. 40px und zentriert.
  hourChip: {
    minHeight: 40,
    minWidth: 40,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  azanRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  azanRowRtl: { flexDirection: 'row-reverse' },
  // Fadschr-Hinweis steht in derselben Zeile wie der Gebetsname und muss
  // umbrechen duerfen, ohne den Namen zu verdraengen.
  azanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: 999,
    overflow: 'hidden',
  },
  azanChipLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
  },
  azanChipLabelSolo: {
    paddingRight: Spacing.three,
  },
  azanChipPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.three,
  },
  pressed: { opacity: 0.6 },
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  // Kein `gap` mehr: bei aktiver Suche rendern gefilterte Sektionen zu `null`,
  // ihr AnimatedListItem-Wrapper bliebe aber ein Flex-Kind und `gap` würde
  // leere Lücken erzeugen. Abstände liegen daher an den Elementen selbst
  // (ListSection.marginBottom, ListGroupHeading.marginTop/Bottom).
  scroll: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.six, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  // Breitbild (ab 720 dp): zwei Sektionsspalten. `alignItems: flex-start`,
  // damit eine kurze Spalte nicht auf die Hoehe der langen gedehnt wird.
  columnsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.four },
  columnsRowRtl: { flexDirection: 'row-reverse' },
  column: { flex: 1, minWidth: 0 },
  rowPressed: { opacity: 0.5 },
  // Farbmuster der App-Icon-Auswahl — sitzt als `leading` in der SelectRow,
  // den Abstand zum Label liefert deren `gap` (kein eigener Rand mehr).
  iconSwatch: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  switchRowRtl: { flexDirection: 'row-reverse' },
  // Untergruppe innerhalb einer Karte — der Trenner davor kommt von ListCard
  // (zwischen den direkten Kindern), hier bleibt nur der Innenabstand.
  modelPicker: { paddingTop: Spacing.two },
  switchLabel: { flex: 1, gap: 2, paddingRight: Spacing.two },
  switchLabelRtl: { paddingRight: 0, paddingLeft: Spacing.two },
  rtlText: { textAlign: 'right' },
  // Gespeicherter Ort: gleiche Seiteneinzüge und Mindesthöhe wie jede andere
  // Zeile der Karte (vorher Spacing.two → fiel aus der Flucht).
  savedLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  savedLocationRowRtl: { flexDirection: 'row-reverse' },
  savedLocationMain: { flex: 1, gap: 1 },
  savedLocationDelete: { padding: Spacing.one },
  pressableWeb: { cursor: 'pointer' },
});
