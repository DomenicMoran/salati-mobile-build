import { Link, router } from 'expo-router';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AppState,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WebTopBar } from '@/components/web-top-bar';
import { useHydrated } from '@/hooks/use-hydrated';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { HIJRI_MONTHS } from '@/features/calendar/offline';
import { fastCountdown, isRamadanMonth } from '@/features/fasting/store';
import { useDeviceLocation } from '@/features/location/useDeviceLocation';
import { countdownUnits, formatClock, formatCountdown, formatHHMM, nextPrayer, PRAYERS } from '@/features/prayer-times/next-prayer';
import { formatIqama } from '@/features/prayer-times/iqama';
import type { IqamaOffsets } from '@/features/settings/types';
import {
  requestNotificationPermission,
  rescheduleNotifications,
  updateOngoingCountdown,
} from '@/features/prayer-times/notifications';
import { updatePrayerLiveActivity } from '@/features/prayer-times/live-activity';
import { fetchUpcomingTimings } from '@/features/prayer-times/api';
import { calcOptionsFromSettings } from '@/features/prayer-times/calc';
import { rescheduleJumuahReminder } from '@/features/prayer-times/jumuahReminder';
import { rescheduleSunnahReminders } from '@/features/prayer-times/sunnahReminders';
import { reschedulePreAdhanReminders } from '@/features/prayer-times/preAdhanReminder';
import { rescheduleRamadanReminders } from '@/features/fasting/suhoorAlarm';
import { rescheduleVerseOfDayReminder } from '@/features/verseOfDay/notifications';
import { rescheduleUdhiyahReminder } from '@/features/udhiyah/notifications';
import { rescheduleWeeklySummary } from '@/features/weeklySummary/notifications';
import { buildPrayerIcs } from '@/features/prayer-times/ics';
import { useTimings } from '@/features/prayer-times/hooks';
import { useTimezoneKey } from '@/features/prayer-times/useTimezoneKey';
import { checkExactAlarmPermission, openExactAlarmSettings } from '@/features/prayer-times/exact-alarm';
import { updateIosWidget } from '@/features/prayer-times/ios-widget';
import { distanceToMeccaKm, qiblaBearing } from '@/features/qibla/bearing';
import { updateWearComplication } from '@/features/prayer-times/wear-sync';
import { azanSource } from '@/features/prayer-times/azan';
import { getTravelStatus } from '@/features/prayer-times/travelMode';
import {
  DASHBOARD_LOCKED_CARDS,
  normalizeDashboardCardOrder,
  type DashboardCardId,
} from '@/features/dashboard/dashboardCards';
import { useSettings } from '@/features/settings/store';
import { useLayout } from '@/hooks/use-layout';
import { useRtl } from '@/hooks/use-rtl';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useSsrSafeAudioPlayer } from '@/lib/ssrSafeAudio';
import { useTranslation } from '@/lib/i18n';

// Gleiche Icon-Zuordnung wie die Fasten-Tracker-Karte (app/fasting.tsx), damit
// beide Karten für dieselbe Phase dasselbe Icon zeigen.
const RAMADAN_PHASE_ICON: Record<string, IconName> = {
  suhoor: 'moon',
  iftar: 'sunny',
  done: 'sparkles',
};

export default function PrayerTimesScreen() {
  const { settings, update } = useSettings();
  // Voller Adhan (User-Wunsch): spielt in der App, nicht als System-Ton
  // (Formatlimits der OS-Benachrichtigungstöne, s. AzanChoice-Kommentar).
  const azanPlayer = useSsrSafeAudioPlayer(azanSource(settings.azanChoice) ?? undefined);
  function playAzan() {
    azanPlayer.seekTo(0);
    azanPlayer.play();
  }
  const { t, locale } = useTranslation();
  // Countdown-Einheiten in der App-Sprache (Audit 2026-07-28, T17) — vorher
  // standen „h/m/s" auch in arabischer Oberflaeche.
  const countdownUnitLabels = useMemo(() => countdownUnits(t), [t]);
  const { data, isLoading, isError, refetch } = useTimings();
  const { requestLocation, loading: locLoading } = useDeviceLocation();
  const [now, setNow] = useState(() => new Date());
  // Hydration-Guard (Web/Static-Export): die Uhr ist im vorgerenderten HTML
  // auf die Build-Zeit eingebacken — bis zur Hydration neutralen Platzhalter
  // zeigen, sonst React-#418-Hydration-Mismatch auf jedem Seitenaufruf.
  const mounted = useHydrated();
  // Tablet/Desktop: Hero und Gebetszeiten stehen NEBENEINANDER und füllen die
  // Fensterhöhe. Vorher endete der Inhalt auf 1600×2560 bei rund 48 % der
  // Höhe, der Rest war leerer Grund (docs/STORE-BILDER-2026-07-29.md §7.3).
  const { tablet, contentWidth, height: fensterHoehe } = useLayout();
  const wide = tablet;
  // Obergrenze fuer die Streckung: ohne sie verteilten sich sechs Gebetszeilen
  // auf 1400 dp Hoehe (Abstaende von ~200 dp zwischen den Zeilen). 72 % der
  // Fensterhoehe, hoechstens 900 dp, fuellt die Seite und haelt die Tabelle
  // als Tabelle lesbar.
  const spaltenHoehe = Math.min(fensterHoehe * 0.72, 900);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // Geraetebefund 2026-07-29 (ar, 1600x2560): in der Gebetszeiten-Tabelle stand
  // der arabische Gebetsname links und die Uhrzeit rechts — die Zeile war als
  // einzige Zeile der App nicht gespiegelt. Ebenso liefen die beiden
  // Tablet-Spalten in Leserichtung links→rechts.
  const rtl = useRtl();

  // Reise-Modus: `homeLocation` bleibt fix, `location` ist der aktuell für
  // die Gebetszeiten-Berechnung genutzte Standort — weicht er >85 km vom
  // Heimatort ab, gilt der Nutzer als "auf Reisen" (s. features/prayer-times/travelMode.ts).
  const travelStatus = useMemo(
    () => getTravelStatus(settings.homeLocation, { lat: settings.location.lat, lon: settings.location.lon }),
    [settings.homeLocation, settings.location.lat, settings.location.lon],
  );
  const showTravelBanner = settings.travelModeEnabled && travelStatus.isTraveling;

  // Nutzer-eigene Karten-Reihenfolge/Sichtbarkeit (Einstellungen ->
  // Dashboard anpassen, siehe app/dashboard-reorder.tsx). normalize... füllt
  // fehlende Karten-IDs robust auf (App-Update mit neuer Karte, altes
  // Storage-Format), damit nie eine Karte verschwindet.
  const visibleCardIds = useMemo(
    () =>
      normalizeDashboardCardOrder(settings.dashboardCardOrder).filter(
        (id) => DASHBOARD_LOCKED_CARDS.includes(id) || !settings.dashboardHiddenCards.includes(id),
      ),
    [settings.dashboardCardOrder, settings.dashboardHiddenCards],
  );

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Wechselt beim Reisen bzw. bei der Sommerzeit-Umstellung. Steht unten in
  // den Abhängigkeiten der Neuplanung: geplante Benachrichtigungen sind
  // absolute Zeitpunkte und stünden nach einem Zonenwechsel sonst weiter auf
  // der alten Ortszeit (siehe useTimezoneKey.ts).
  const tzKey = useTimezoneKey();

  // Android: sind exakte Alarme erlaubt? `null` = keine Aussage möglich
  // (iOS/Web oder natives Modul nicht vorhanden) — dann wird nichts angezeigt.
  // Ohne diese Berechtigung schiebt Android die Alarme im Stromsparmodus auf;
  // das ist die häufigste Ursache verspäteter Gebets-Benachrichtigungen
  // (Begründung in features/prayer-times/exact-alarm.ts).
  const [exactAlarmGranted, setExactAlarmGranted] = useState<boolean | null>(null);
  // Zaehler, der sich nur beim Uebergang "verweigert -> erlaubt" erhoeht und
  // unten eine Neuplanung ausloest.
  //
  // WARUM DAS NOETIG IST — am Geraet gemessen (Android 15, dumpsys alarm):
  // ohne die Berechtigung traegt Android die Alarme mit einem
  // Ein-Stunden-Fenster ein (`window=+1h0m0s0ms`, `maxWhenElapsed` eine Stunde
  // nach `whenElapsed`) und darf sie irgendwo darin ausloesen. Erteilt der
  // Nutzer die Freigabe, aendern sich diese bereits gesetzten Eintraege NICHT
  // mehr — sie bleiben im Stundenfenster stehen, bis jemand sie neu setzt.
  // Erst nach einer Neuplanung steht dort `window=0 exactAllowReason=permission`
  // und `maxWhenElapsed == whenElapsed`, also sekundengenau. Genau diese
  // Neuplanung fehlte: die Freigabe wirkte erst nach einem App-Neustart.
  const [exactAlarmNeuplanung, setExactAlarmNeuplanung] = useState(0);
  const exactAlarmVorher = useRef<boolean | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let abgebrochen = false;
    const pruefen = () => {
      checkExactAlarmPermission().then((status) => {
        if (abgebrochen) return;
        const vorher = exactAlarmVorher.current;
        exactAlarmVorher.current = status;
        setExactAlarmGranted(status);
        if (vorher === false && status === true) setExactAlarmNeuplanung((n) => n + 1);
      });
    };
    pruefen();
    // Erneut prüfen, sobald der Nutzer aus den Systemeinstellungen zurückkommt
    // — sonst bliebe der Hinweis nach dem Erteilen bis zum Neustart stehen.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') pruefen();
    });
    return () => {
      abgebrochen = true;
      sub.remove();
    };
  }, []);

  // Rechenparameter (Methode, Madhab, Hochbreiten-Regel, Minuten-Korrektur) —
  // memoisiert an den vier Einstellungsfeldern, damit die Notification-Planung
  // unten nicht bei jeder beliebigen Einstellungsänderung neu läuft.
  const { method, school, highLatitudeRule, prayerTimeOffsets } = settings;
  const calcOptions = useMemo(
    () => calcOptionsFromSettings({ method, school, highLatitudeRule, prayerTimeOffsets }),
    [method, school, highLatitudeRule, prayerTimeOffsets],
  );

  // Notifications neu planen, sobald frische Timings da sind — für die
  // nächsten 7 Tage im Voraus (vorher nur heute: wer die App einen Tag nicht
  // öffnete, bekam gar keine Benachrichtigung mehr; User-Gerätebug 2026-07-16).
  useEffect(() => {
    if (!data?.today || Platform.OS === 'web') return;
    (async () => {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      const week = await fetchUpcomingTimings(
        settings.location.lat,
        settings.location.lon,
        calcOptions,
        7,
      );
      const days = week.length > 0 ? week : [{ date: new Date(), timings: data.today }];
      await rescheduleNotifications(
        days,
        settings.notificationsEnabled,
        settings.notificationPrefs,
        new Date(),
        locale,
        settings.timeFormat,
        { enabled: settings.azanNotificationEnabled, choices: settings.azanNotificationChoices },
      );
      // Ramadan-Erinnerungen (Suhur-Wecker/Iftar-Hinweis) hängen an denselben
      // Zeiten; `data.hijri` eicht den Kalender auf das, was die App anzeigt
      // (s. hijriCalibrationShift). Außerhalb des Ramadan löscht der Aufruf
      // nur eigene Altplanungen und kehrt zurück.
      await rescheduleRamadanReminders(
        days,
        {
          suhoorEnabled: settings.suhoorAlarmEnabled,
          suhoorLead: settings.suhoorAlarmLead,
          iftarEnabled: settings.iftarReminderEnabled,
        },
        data.hijri,
        new Date(),
        locale,
        settings.timeFormat,
      );
      // Jumu'ah-, Sunnah- und Pre-Adhan-Erinnerungen nutzen dasselbe schon
      // geladene 7-Tage-Fenster — kein zusätzlicher Netzwerk-Request nötig.
      await rescheduleJumuahReminder(days, settings.jumuahReminderEnabled, new Date(), locale, settings.timeFormat);
      await rescheduleSunnahReminders(
        days,
        {
          duha: settings.sunnahDuhaEnabled,
          tahajjud: settings.sunnahTahajjudEnabled,
          witr: settings.sunnahWitrEnabled,
        },
        new Date(),
        locale,
      );
      await reschedulePreAdhanReminders(
        days,
        settings.preAdhanReminderEnabled,
        settings.notificationsEnabled,
        settings.preAdhanReminderOffset,
        new Date(),
        locale,
        settings.timeFormat,
      );
    })();
  }, [
    data?.today,
    settings.notificationsEnabled,
    settings.timeFormat,
    settings.notificationPrefs,
    settings.location.lat,
    settings.location.lon,
    calcOptions,
    settings.jumuahReminderEnabled,
    settings.sunnahDuhaEnabled,
    settings.sunnahTahajjudEnabled,
    settings.sunnahWitrEnabled,
    settings.preAdhanReminderEnabled,
    settings.preAdhanReminderOffset,
    settings.azanNotificationEnabled,
    settings.azanNotificationChoices,
    settings.suhoorAlarmEnabled,
    settings.suhoorAlarmLead,
    settings.iftarReminderEnabled,
    data?.hijri,
    locale,
    tzKey,
    exactAlarmNeuplanung,
  ]);

  // Vers/Hadith-des-Tages-Erinnerung selbstheilend neu planen — analog zu den
  // Gebets-Notifications oben: der Start-Tab wird praktisch bei jedem
  // App-Besuch gerendert, das rollierende Mehrtage-Fenster (s. features/
  // verseOfDay/notifications.ts) bleibt dadurch auch ohne Settings-Besuch
  // gefüllt. No-op-Skip, solange die Erinnerung nicht aktiviert ist (Opt-in,
  // Default aus).
  useEffect(() => {
    if (!settings.verseOfDayReminderEnabled || Platform.OS === 'web') return;
    rescheduleVerseOfDayReminder(
      true,
      settings.verseOfDayReminderHour,
      locale,
      settings.hadithLanguage,
    ).catch(() => {});
  }, [settings.verseOfDayReminderEnabled, settings.verseOfDayReminderHour, settings.hadithLanguage, locale]);

  // Wochenzusammenfassung selbstheilend neu planen — gleiches Prinzip wie
  // oben bei Vers/Hadith: der WEEKLY-Trigger legt den Text einmal beim
  // Scheduling fest (s. features/weeklySummary/notifications.ts), ein
  // Besuch des Start-Tabs hält die eingebetteten Zahlen aktuell, ohne dass
  // der Nutzer extra die Einstellungen öffnen muss.
  useEffect(() => {
    if (!settings.weeklySummaryReminderEnabled || Platform.OS === 'web') return;
    rescheduleWeeklySummary(true, locale).catch(() => {});
  }, [settings.weeklySummaryReminderEnabled, locale]);

  // Udhiyah/Qurbani-Erinnerung selbstheilend neu planen — gleiches Prinzip
  // wie Wochenzusammenfassung oben: der Termin liegt fest (ein paar Tage vor
  // Eid al-Adha, s. features/udhiyah/eidAdha.ts), ein Besuch des Start-Tabs
  // sorgt dafür, dass nach jedem verstrichenen Eid al-Adha automatisch fürs
  // nächste Hijri-Jahr neu geplant wird, ohne dass der Nutzer die
  // Einstellungen erneut öffnen muss.
  useEffect(() => {
    if (!settings.udhiyahReminderEnabled || Platform.OS === 'web') return;
    rescheduleUdhiyahReminder(true, locale).catch(() => {});
  }, [settings.udhiyahReminderEnabled, locale]);

  const next = useMemo(() => {
    if (!data) return null;
    return nextPrayer(data.today, data.tomorrow, now);
  }, [data, now]);

  // Ramadan-Suhoor/Iftar-Karte: nur sichtbar während des Hijri-Monats Ramadan
  // (Erkennung wiederverwendet aus features/fasting/store.ts, dieselbe Stelle
  // die auch der Fasten-Tracker für seine Countdown-Karte nutzt). Läuft am
  // selben `now`-Sekundentakt mit wie der Hero-Countdown oben, kein eigenes
  // Interval nötig.
  const ramadanCountdown = useMemo(() => {
    if (!data?.today || !data.hijri || !isRamadanMonth(data.hijri.month.number)) return null;
    return fastCountdown(data.today.Fajr, data.today.Maghrib, now);
  }, [data, now]);

  // Dauerhafte "nächstes Gebet"-Notification (Opt-in, Android) — bewusst
  // NICHT an `now` gekoppelt (das würde bei jedem Sekunden-Tick neu planen).
  // Nur wenn sich das nächste Gebet selbst ändert (max. 5x/Tag), wird die
  // Notification-Anzeige aktualisiert.
  const nextPrayerTs = next?.nextTs.getTime();
  useEffect(() => {
    if (!next) return;
    updateOngoingCountdown(next, settings.notificationPrefs, locale, settings.timeFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.nextPrayer, nextPrayerTs, settings.notificationPrefs, locale, settings.timeFormat]);

  // iOS Live Activity ("nächstes Gebet") — Pendant zur obigen Android-
  // Ongoing-Notification, gleiches Prinzip (nur bei Wechsel des nächsten
  // Gebets aktualisieren, nicht sekündlich). No-op auf Android/Web, s.
  // live-activity.ts (Metro-Platform-Split, live-activity.ios.tsx hat die
  // echte Implementierung).
  useEffect(() => {
    if (!next) return;
    updatePrayerLiveActivity(next, settings.notificationPrefs, locale, settings.timeFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.nextPrayer, nextPrayerTs, settings.notificationPrefs, locale, settings.timeFormat]);

  // iOS-Homescreen-Widget (WidgetKit-Extension, targets/salati-widget/) mit
  // frischen Zeiten versorgen — no-op auf Android/Web (Guard in ios-widget.ts).
  // Android hat sein Pendant bereits über react-native-android-widget +
  // src/widgets/widget-task-handler.tsx, der eigenständig AsyncStorage liest.
  useEffect(() => {
    if (!data) return;
    updateIosWidget({
      locationLabel: settings.location.label,
      today: data.today,
      tomorrow: data.tomorrow,
      timeFormat: settings.timeFormat,
      qiblaBearing: qiblaBearing(settings.location.lat, settings.location.lon),
      qiblaDistanceKm: distanceToMeccaKm(settings.location.lat, settings.location.lon),
      widgetTheme: settings.widgetTheme,
    });
  }, [
    data,
    settings.location.label,
    settings.location.lat,
    settings.location.lon,
    settings.timeFormat,
    settings.widgetTheme,
  ]);

  // WearOS-Tile (android/wear/, siehe wear-sync.ts) mit frischen Zeiten
  // versorgen — no-op auf iOS/Web und solange das native Bridge-Modul nicht
  // gebaut ist (siehe Kommentar in wear-sync.ts).
  useEffect(() => {
    if (!data) return;
    updateWearComplication({
      locationLabel: settings.location.label,
      today: data.today,
      tomorrow: data.tomorrow,
      timeFormat: settings.timeFormat,
      // Gleiche Werte wie fürs iOS-Widget oben: die Uhr hat keinen eigenen
      // Standort und kann den Kaaba-Bearing sonst nicht berechnen.
      qiblaBearing: qiblaBearing(settings.location.lat, settings.location.lon),
      qiblaDistanceKm: distanceToMeccaKm(settings.location.lat, settings.location.lon),
    });
  }, [
    data,
    settings.location.label,
    settings.location.lat,
    settings.location.lon,
    settings.timeFormat,
  ]);

  // 30 Tage Gebetszeiten als .ics: Web = Download, nativ = System-Share-Sheet
  // (Datei -> Kalender-App importieren).
  async function exportIcs() {
    const days = await fetchUpcomingTimings(
      settings.location.lat,
      settings.location.lon,
      calcOptions,
      30,
    );
    if (days.length === 0) return;
    const names = Object.fromEntries(
      PRAYERS.map((p) => [p, t(`prayers.${p.toLowerCase()}`)]),
    ) as Record<(typeof PRAYERS)[number], string>;
    const ics = buildPrayerIcs(days, names, settings.location.label);
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'salati-gebetszeiten.ics';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      const path = `${FileSystem.cacheDirectory}salati-gebetszeiten.ics`;
      await FileSystem.writeAsStringAsync(path, ics);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/calendar', dialogTitle: t('prayer.icsExport') });
      }
    } catch {
      // Sharing nicht verfügbar (z. B. Modul fehlt im alten Build) — still.
    }
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

  // Home-Dashboard-Karten (Einstellungen -> Dashboard anpassen, siehe
  // app/dashboard-reorder.tsx): Hero/Ramadan-Karte/Reise-Banner/Gebetszeiten-
  // Tabelle werden hier je einmal gebaut und unten anhand von
  // `visibleCardIds` in Nutzer-Reihenfolge gerendert — Hero und Tabelle sind
  // Kernfunktion und daher immer dabei (DASHBOARD_LOCKED_CARDS), Ramadan-
  // Karte/Reise-Banner bleiben zusätzlich an ihre bisherige fachliche
  // Sichtbarkeitsbedingung geknüpft (nur während Ramadan bzw. auf Reisen).
  const heroCard = (
          <ImageBackground
            source={require('../../assets/images/guides/kaaba.jpg')}
            style={[styles.hero, wide && styles.heroWide]}
            imageStyle={styles.heroImage}>
            {/* Der Innenrahmen trägt das Padding, NICHT die ImageBackground
                selbst: RN legt das Bild als absolut positioniertes Kind in die
                Polsterbox, ein Padding auf der ImageBackground lässt also
                rechts/unten einen Streifen ohne Foto stehen (auf 800 dp waren
                das 24 dp, in denen das Zahnrad ohne Bild und ohne Abdunkelung
                stand — Gerätebefund 2026-07-29, 1600×2560). */}
            <View style={styles.heroOverlay} />
            <View style={styles.heroInner}>
            <View style={styles.heroTop}>
              {/* Hero-Karte hat eine feste Bildhöhe (styles.hero) — bei sehr
                  großer System-Schriftgröße würde ungebremstes Skalieren den
                  Text über das Foto hinaus wachsen lassen (Nutzerfund: bei
                  font_scale 2.0 überlappte "Maghrib · 21:24" sichtbar die
                  Kaaba-Aufnahme). maxFontSizeMultiplier=1.3 auf diesem reinen
                  UI-Chrome-Text (Uhrzeit/Ort/Countdown, kein Lesetext) hält
                  die Karte intakt, während Nutzer weiterhin eine spürbar
                  größere Schrift bekommen (Apple/Google-Empfehlung: Cap für
                  UI-Chrome, unbegrenzt nur für Lesetext). */}
              <ThemedText type="small" style={styles.heroMuted} maxFontSizeMultiplier={1.3}>
                {settings.location.label}
              </ThemedText>
              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => router.push('/search')}
                  style={({ pressed }) => [
                    styles.settingsBtn,
                    Platform.OS === 'web' ? styles.pressableWeb : undefined,
                    pressed && styles.pressed,
                  ]}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.search')}>
                  <IconSymbol name="search" size={18} color="#f7f3ea" />
                </Pressable>
                <Link href="/settings" asChild>
                  <Pressable
                    style={({ pressed }) => [
                      styles.settingsBtn,
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t('nav.settings')}>
                    <IconSymbol name="settings-outline" size={18} color="#f7f3ea" />
                  </Pressable>
                </Link>
              </View>
            </View>
            <View style={styles.heroBottom}>
              <ThemedText type="title" style={styles.heroClock} maxFontSizeMultiplier={1.3}>
                {mounted ? formatClock(now.getHours(), now.getMinutes(), settings.timeFormat) : '--:--'}
              </ThemedText>
              {mounted && next && (
                <View style={styles.heroNext}>
                  <ThemedText type="smallBold" style={styles.heroGold} maxFontSizeMultiplier={1.3}>
                    {t(`prayers.${next.nextPrayer.toLowerCase()}`)}
                    {' · '}
                    {formatHHMM(
                      next.nextIdx >= 0 && data ? data.today[next.nextPrayer] : (data?.tomorrow.Fajr ?? ''),
                      settings.timeFormat,
                    )}
                  </ThemedText>
                  <ThemedText type="small" style={styles.heroMuted} maxFontSizeMultiplier={1.3}>
                    {t('prayer.timeLeft').replace(
                      '{time}',
                      formatCountdown(next.diffMs, countdownUnitLabels),
                    )}
                  </ThemedText>
                </View>
              )}
            </View>
            </View>
          </ImageBackground>
  );

  const ramadanCard: ReactNode = mounted && ramadanCountdown && (
            <PressableCard
              onPress={() => router.push('/fasting')}
              style={styles.ramadanCard}
              accessibilityLabel={t('fasting.ramadanCard.heading')}>
              <View style={styles.ramadanRow}>
                <IconSymbol
                  name={RAMADAN_PHASE_ICON[ramadanCountdown.phase] ?? 'moon'}
                  size={18}
                  color={colors.accent}
                />
                <ThemedText type="smallBold" themeColor="accent" style={styles.ramadanHeading}>
                  {t('fasting.ramadanCard.heading')}
                </ThemedText>
                <DisclosureChevron size={16} color={colors.textSecondary} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {ramadanCountdown.phase === 'suhoor'
                  ? t('fasting.untilSuhoorEnd')
                  : ramadanCountdown.phase === 'iftar'
                    ? t('fasting.untilIftar')
                    : t('fasting.afterIftar')}
              </ThemedText>
              {ramadanCountdown.phase !== 'done' && (
                <ThemedText type="default" themeColor="accent" style={styles.ramadanCountdown}>
                  {formatCountdown(ramadanCountdown.msRemaining, countdownUnitLabels)}
                </ThemedText>
              )}
            </PressableCard>
  );

  const travelCard: ReactNode = showTravelBanner && (
            <ThemedView type="backgroundElement" style={styles.travelCard}>
              <View style={styles.travelRow}>
                <IconSymbol name="airplane-outline" size={20} color={colors.accent} />
                <View style={styles.travelText}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('prayer.travel.banner').replace('{km}', String(Math.round(travelStatus.distanceKm)))}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('prayer.travel.qasrDesc')}
                  </ThemedText>
                </View>
              </View>
            </ThemedView>
  );

  // Warnung, wenn Android exakte Alarme verweigert UND überhaupt eine
  // Gebets-Benachrichtigung aktiv ist. Bewusst HIER statt nur tief in den
  // Einstellungen: die Verspätung fällt auf dem Gebetszeiten-Screen auf, und
  // genau dort muss die Abhilfe einen Fingertipp entfernt sein. Sobald die
  // Berechtigung erteilt ist, verschwindet der Hinweis von selbst (der Status
  // wird beim Zurückkehren in den Vordergrund neu geprüft).
  const exactAlarmCard: ReactNode = exactAlarmGranted === false &&
    Object.values(settings.notificationsEnabled).some(Boolean) && (
      <ThemedView type="backgroundElement" style={styles.travelCard}>
        <View style={styles.travelRow}>
          <IconSymbol name="alarm-outline" size={20} color={colors.accent} />
          <View style={styles.travelText}>
            <ThemedText type="smallBold" themeColor="accent">
              {t('prayer.lateWarning.title')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('prayer.lateWarning.body')}
            </ThemedText>
            <Pressable
              onPress={() => {
                openExactAlarmSettings();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('prayer.lateWarning.action')}
              style={({ pressed }) => [
                styles.actionChip,
                styles.actionChipSecondary,
                styles.lateWarningAction,
                Platform.OS === 'web' ? styles.pressableWeb : undefined,
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" themeColor="accent">
                {t('prayer.lateWarning.action')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    );

  const prayerTableCard = (
    <>
      {isLoading && (
        <View style={styles.center}>
          <ThemedActivityIndicator />
          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
            {t('prayer.loading')}
          </ThemedText>
        </View>
      )}

      {isError && !isLoading && (
        <View style={styles.center}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('prayer.unavailable')}
          </ThemedText>
        </View>
      )}

      {data && (
            <>
              <ThemedView type="backgroundElement" style={[styles.table, wide && styles.tableWide]}>
                {/* Shuruq als reine Info-Zeile nach Fajr (Audit 2026-07-19 D4):
                    kein Gebet, daher nie als "nächstes" markiert und optisch
                    zurückgenommen - die Zeit steckt längst in der API-Antwort. */}
                {(['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const).map((p, i) => {
                  const prayerIdx = p === 'Sunrise' ? -1 : PRAYERS.indexOf(p);
                  const isNext = prayerIdx >= 0 && next?.nextIdx === prayerIdx;
                  const isInfo = p === 'Sunrise';
                  // Iqama (Beginn des Gemeinschaftsgebets) gibt es nur für die
                  // 5 Pflichtgebete, nicht für die Shuruq-Infozeile.
                  const showIqama = settings.iqamaEnabled && !isInfo;
                  return (
                    <AnimatedListItem key={p} index={i}>
                      {/* Nächstes Gebet bekommt zusätzlich zum Farbton eine
                          linke Akzentkante + ein Uhr-Icon - reine Farbe allein
                          war auf hellen Themes zu subtil, um auf den ersten
                          Blick als "das hier ist wichtig" zu lesen. */}
                      <View style={[styles.row, rtl && styles.rowRtl, isNext && styles.rowNext, isNext && rtl && styles.rowNextRtl]}>
                        <View style={[styles.rowLabelGroup, rtl && styles.rowRtl]}>
                          {isNext && <IconSymbol name="time-outline" size={14} color={colors.accent} />}
                          <ThemedText
                            type={isNext ? 'smallBold' : isInfo ? 'small' : 'default'}
                            themeColor={isNext ? 'accent' : isInfo ? 'textSecondary' : 'text'}>
                            {isInfo ? t('prayer.sunrise') : t(`prayers.${p.toLowerCase()}`)}
                          </ThemedText>
                        </View>
                        <View style={[styles.timeCol, rtl && styles.timeColRtl]}>
                          <ThemedText
                            type={isNext ? 'smallBold' : isInfo ? 'small' : 'default'}
                            themeColor={isNext ? 'accent' : isInfo ? 'textSecondary' : 'text'}>
                            {formatHHMM(data.today[p], settings.timeFormat)}
                          </ThemedText>
                          {showIqama && (
                            <ThemedText type="small" themeColor="textSecondary">
                              {t('prayer.iqama')}{' '}
                              {formatIqama(
                                data.today[p],
                                settings.iqamaOffsets[p.toLowerCase() as keyof IqamaOffsets],
                                now,
                                settings.timeFormat,
                              )}
                            </ThemedText>
                          )}
                        </View>
                      </View>
                    </AnimatedListItem>
                  );
                })}
              </ThemedView>

              {data.hijri && (
                <View style={styles.hijriRow}>
                  <IconSymbol name="moon-outline" size={13} color={colors.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {data.hijri.day}. {HIJRI_MONTHS[locale][Number(data.hijri.month.number) - 1] ?? data.hijri.month.en}{' '}
                    {data.hijri.year} {t('calendar.hijriSuffix')}
                  </ThemedText>
                </View>
              )}
            </>
      )}
    </>
  );

  const cardContent: Record<DashboardCardId, ReactNode> = {
    hero: heroCard,
    ramadanCard,
    travelBanner: travelCard,
    prayerTable: prayerTableCard,
  };

  // Auf Tablets wandert die Gebetszeiten-Tabelle in eine EIGENE Spalte rechts,
  // alles andere bleibt links in der vom Nutzer gewählten Reihenfolge
  // (Dashboard anpassen). Beide Spalten strecken sich auf die Fensterhöhe,
  // damit unter dem Inhalt kein leerer Grund mehr steht.
  const leftIds = wide ? visibleCardIds.filter((id) => id !== 'prayerTable') : visibleCardIds;
  const showTableColumn = wide && visibleCardIds.includes('prayerTable');

  return (
    <ThemedView style={styles.container}>
      {Platform.OS === 'web' && <WebTopBar />}
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.scroll, wide && { maxWidth: contentWidth, flexGrow: 1 }]}>
          {exactAlarmCard}
          <View
            style={[
              styles.stack,
              wide && styles.columns,
              wide && rtl && styles.columnsRtl,
              wide && { maxHeight: spaltenHoehe },
            ]}>
            <View style={[styles.stack, wide && styles.column]}>
              {leftIds.map((id) => (
                <Fragment key={id}>{cardContent[id]}</Fragment>
              ))}
            </View>
            {showTableColumn && (
              <View style={[styles.stack, styles.column, styles.tableColumn]}>{prayerTableCard}</View>
            )}
          </View>

          {/* Aktionsleiste (Audit 2026-07-22): ≥44pt Chips statt gedrängter
              Text-Links; die Primäraktion (Wochenübersicht) ist als gefüllter
              Akzent-Chip hervorgehoben, der Rest als ruhige Sekundär-Chips. */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push('/prayer-times-week')}
              accessibilityRole="button"
              accessibilityLabel={t('prayer.weekView')}
              style={({ pressed }) => [
                styles.actionChip,
                { backgroundColor: colors.accent },
                Platform.OS === 'web' ? styles.pressableWeb : undefined,
                pressed && styles.pressed,
              ]}>
              <IconSymbol name="grid-outline" size={16} color={colors.background} />
              <ThemedText type="smallBold" style={{ color: colors.background }}>
                {t('prayer.weekView')}
              </ThemedText>
            </Pressable>
            {settings.azanChoice !== 'default' && (
              <Pressable
                onPress={playAzan}
                accessibilityRole="button"
                accessibilityLabel={t('prayer.playAzan')}
                style={({ pressed }) => [styles.actionChip, styles.actionChipSecondary, Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <IconSymbol name="musical-notes-outline" size={16} color={colors.accent} />
                <ThemedText type="smallBold" themeColor="accent">
                  {t('prayer.playAzan')}
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={exportIcs}
              accessibilityRole="button"
              accessibilityLabel={t('prayer.icsExport')}
              style={({ pressed }) => [styles.actionChip, styles.actionChipSecondary, Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
              <IconSymbol name="calendar-outline" size={16} color={colors.accent} />
              <ThemedText type="smallBold" themeColor="accent">
                {t('prayer.icsExport')}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={useMyLocation}
              accessibilityRole="button"
              accessibilityLabel={t('common.useLocation')}
              style={({ pressed }) => [styles.actionChip, styles.actionChipSecondary, Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
              <IconSymbol name="locate-outline" size={16} color={colors.accent} />
              <ThemedText type="smallBold" themeColor="accent">
                {locLoading ? t('common.locating') : t('common.useLocation')}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => refetch()}
              accessibilityRole="button"
              accessibilityLabel={t('common.refresh')}
              style={({ pressed }) => [styles.actionChip, styles.actionChipSecondary, Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
              <IconSymbol name="refresh-outline" size={16} color={colors.textSecondary} />
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('common.refresh')}
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const cardShadow = Platform.select({
  web: { boxShadow: '0 1px 3px rgba(11,11,13,0.06), 0 1px 2px rgba(11,11,13,0.08)' },
  default: {
    shadowColor: '#0b0b0d',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
}) as object;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.four,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  // Ein Behälter je Spalte: der Abstand zwischen den Karten liegt hier statt
  // im ScrollView-Container, damit die zweispaltige Anordnung dieselbe
  // Karten-Grammatik behält wie die einspaltige.
  stack: { width: '100%', alignItems: 'center', gap: Spacing.four },
  columns: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.four, flexGrow: 1 },
  columnsRtl: { flexDirection: 'row-reverse' },
  column: { flex: 1, width: undefined },
  // Die Zeitentabelle füllt ihre Spalte über die volle Höhe; die sechs Zeilen
  // verteilen sich gleichmäßig, statt oben zusammenzukleben.
  tableColumn: { justifyContent: 'flex-start' },
  heroActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Höherer Scrim + feiner Ring, damit die Icons auch über hellen Bildstellen
    // der Kaaba-Aufnahme klar lesbar bleiben (Audit 2026-07-22).
    backgroundColor: 'rgba(11,11,13,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(247,243,234,0.35)',
  },
  pressed: { opacity: 0.6 },
  hero: {
    width: '100%',
    height: 230,
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  heroInner: { flex: 1, padding: Spacing.four, justifyContent: 'space-between' },
  // Auf Tablets ist die Höhe nicht mehr fest: die Karte füllt ihre Spalte.
  heroWide: { height: undefined, flexGrow: 1, minHeight: 300 },
  heroImage: { borderRadius: Spacing.four },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,11,13,0.45)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBottom: { gap: Spacing.one },
  heroClock: { color: '#f7f3ea', fontSize: 44, lineHeight: 50 },
  heroNext: { gap: 2 },
  heroGold: { color: '#d4af37' },
  heroMuted: { color: 'rgba(247,243,234,0.85)' },
  center: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  travelCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    width: '100%',
    maxWidth: 400,
    ...cardShadow,
  },
  travelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  lateWarningAction: { alignSelf: 'flex-start', marginTop: Spacing.two },
  travelText: { flex: 1, gap: 2 },
  ramadanCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    width: '100%',
    maxWidth: 400,
    gap: Spacing.one,
  },
  ramadanRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  ramadanHeading: { flex: 1 },
  ramadanCountdown: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  table: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    width: '100%',
    maxWidth: 400,
    gap: Spacing.one,
    ...cardShadow,
  },
  // Eigene Spalte auf Tablets: volle Spaltenbreite bis 640 dp, Zeilen über die
  // Höhe verteilt statt oben zusammengedrängt.
  tableWide: { maxWidth: 640, flexGrow: 1, justifyContent: 'space-evenly' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  rowNext: {
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderLeftWidth: 3,
    borderLeftColor: Brand.gold,
    paddingLeft: Spacing.two - 3,
  },
  // In rechtslaeufiger Schrift sitzt die Akzentkante an der ANFANGSkante der
  // Zeile — das ist dort die rechte.
  rowNextRtl: {
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderRightColor: Brand.gold,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.two - 3,
  },
  rowLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  timeCol: { alignItems: 'flex-end', gap: 1 },
  timeColRtl: { alignItems: 'flex-start' },
  hijriRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  actionChipSecondary: {
    // Neutraler, in beiden Themes ruhiger Chip-Grund.
    backgroundColor: 'rgba(128,124,116,0.14)',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: Spacing.two,
    rowGap: Spacing.two,
    marginTop: Spacing.two,
  },
  pressableWeb: { cursor: 'pointer' },
});
