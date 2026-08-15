import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ErrorBoundary } from '@/components/error-boundary';
import { GlobalBackButton } from '@/components/global-back-button';
import { MiniPlayer } from '@/components/mini-player';
import { SettingsProvider } from '@/features/settings/store';
import { refreshAllWidgets } from '@/widgets/refresh';
import { useQuranFont } from '@/features/quran/useQuranFont';
import { SharedPlayerProvider } from '@/features/quran/usePlayer';
import { syncCoursesFromRemote } from '@/features/study/courseSync';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useVorblendeFreigabe } from '@/lib/vorblende';
import { installGlobalErrorHandler } from '@/lib/errorLog';
import { QUERY_PERSIST_MAX_AGE, queryClient, queryPersister } from '@/lib/queryClient';

SplashScreen.preventAutoHideAsync();
installGlobalErrorHandler();

// Nur nativ: schon der IMPORT von expo-notifications wirft auf Web eine
// Konsolen-Warnung (Push-Token-Listener) — deshalb require im Guard statt
// Top-Level-Import; lokale Notifications plant die App auf Web ohnehin nicht.
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export default function RootLayout() {
  // Die arabische Koran-Schrift wird NICHT mehr hier geladen: sie ist seit der
  // Schriftauswahl (features/quran/fonts.ts) einstellungsabhängig, und die
  // Einstellungen stehen erst unterhalb des SettingsProvider zur Verfügung.
  // Das Laden passiert in ThemedApp per useQuranFont() — weiterhin bewusst
  // OHNE Render-Gate (Performance-Audit 2026-07-27, §4): der erste Frame der
  // App darf nicht an einer TTF hängen, die Home-, Gebetszeiten- und
  // Lern-Screens gar nicht brauchen.

  // OTA-Content: einmalig prüfen, ob in Supabase neuere Kurs-Versionen liegen,
  // und ggf. nachladen (native, mit Netz; wirft nie, blockiert nichts — die
  // gebündelten Kurse sind sofort offline nutzbar). S. features/study/courseSync.
  useEffect(() => {
    syncCoursesFromRemote();
  }, []);

  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: QUERY_PERSIST_MAX_AGE }}>
        <SettingsProvider>
          <SharedPlayerProvider>
            <ThemedApp />
          </SharedPlayerProvider>
        </SettingsProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}

/**
 * Zentraler Tap-Handler für lokale Notifications mit einem `deepLink`-Feld im
 * `data`-Payload (z. B. features/verseOfDay/notifications.ts) — springt über
 * die native `Linking`-API zur passenden Stelle in der App. Expo Router
 * verdrahtet deren `scheme` (s. app.config.ts, 'salatibox') automatisch mit
 * dem file-based Routing, ein `Linking.openURL('salatibox://…')` navigiert
 * dadurch genau wie ein von außen geöffneter Deep-Link (s. deepLinks.ts).
 * EIN einziger Listener hier statt eines eigenen pro Notification-Feature —
 * künftige Notification-Typen müssen nur denselben `data.deepLink`-Payload
 * mitgeben, kein zweiter Listener nötig.
 */
function useNotificationDeepLinkHandler() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');

    function openDeepLink(data: unknown) {
      const deepLink = (data as { deepLink?: unknown } | null | undefined)?.deepLink;
      if (typeof deepLink === 'string' && deepLink.length > 0) {
        Linking.openURL(deepLink).catch(() => {});
      }
    }

    // App lief bereits (Vordergrund/Hintergrund) und wurde per Tap geöffnet/fokussiert.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openDeepLink(response.notification.request.content.data);
    });
    // Kalter Start: App war komplett beendet, Tap auf die Notification hat sie erst gestartet —
    // dieser Fall löst KEIN addNotificationResponseReceivedListener-Event aus.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      openDeepLink(response?.notification.request.content.data);
    });

    return () => sub.remove();
  }, []);
}

/**
 * Aktualisiert die Android-Homescreen-Widgets ZUSÄTZLICH zum 30-Min-System-Tick
 * (updatePeriodMillis): (a) sobald die App in den Vordergrund kommt → frische
 * Gebetszeiten sofort sichtbar; (b) wenn eine Notification eintrifft (v. a. die
 * Adhan-Notification zur Gebetszeit) während der Prozess lebt → das Widget
 * springt genau zur neuen Gebetszeit aufs nächste Gebet. Ein vollständig
 * gekillter Prozess bleibt vom System-Tick abgedeckt. Auf iOS/Web No-Op
 * (refreshAllWidgets ist dort leer, Hook läuft nur auf Android).
 */
function useWidgetAutoRefresh() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let last = 0;
    const refresh = () => {
      const now = Date.now();
      if (now - last < 4000) return; // Debounce dicht aufeinanderfolgender Trigger
      last = now;
      void refreshAllWidgets();
    };
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const notifSub = Notifications.addNotificationReceivedListener(() => refresh());
    return () => {
      appSub.remove();
      notifSub.remove();
    };
  }, []);
}

// useResolvedScheme() braucht die Settings (themeOverride) — muss deshalb
// innerhalb von SettingsProvider gerendert werden, nicht in RootLayout selbst.
function ThemedApp() {
  const colorScheme = useResolvedScheme();
  useNotificationDeepLinkHandler();
  useWidgetAutoRefresh();
  // Gewählte Koran-Schrift früh anstoßen (nachladend, ohne Render-Gate) —
  // damit sie beim Öffnen des Readers bereits steht.
  useQuranFont();
  // Web: gibt die kurz ausgeblendete Seite frei, sobald Einstellungen und
  // Sprachdatei stehen (s. src/lib/vorblende.ts). Nativ ohne Wirkung.
  useVorblendeFreigabe();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="storage" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications-overview" options={{ presentation: 'modal' }} />
        <Stack.Screen name="dashboard-reorder" options={{ presentation: 'modal' }} />
        <Stack.Screen name="duas" />
        <Stack.Screen name="hadith" />
        <Stack.Screen name="search" />
        <Stack.Screen name="learn" />
        <Stack.Screen name="quiz" />
        <Stack.Screen name="tv-connect" />
        <Stack.Screen name="hifz" />
        <Stack.Screen name="tasbih" />
        <Stack.Screen name="dhikr-after-salah" />
        <Stack.Screen name="guides" />
        <Stack.Screen name="phrases" />
        <Stack.Screen name="pray-along" />
        <Stack.Screen name="learn-to-pray" />
        <Stack.Screen name="wisdom" />
        <Stack.Screen name="tracker" />
        <Stack.Screen name="fasting" />
        <Stack.Screen name="khatmah" />
        <Stack.Screen name="zakat" />
        <Stack.Screen name="zakat-fitr" />
        <Stack.Screen name="mirath" />
        <Stack.Screen name="hijri-converter" />
        <Stack.Screen name="names" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="prayer-times-week" />
        <Stack.Screen name="prayer-times-source" />
        <Stack.Screen name="prayer-times-mosque" />
        <Stack.Screen name="radio" />
        <Stack.Screen name="media" />
        <Stack.Screen name="podcast" />
        <Stack.Screen name="videos" />
        <Stack.Screen name="handouts" />
        <Stack.Screen name="halal" />
        <Stack.Screen name="halal-scanner" />
        <Stack.Screen name="mosques" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="getting-started" />
        <Stack.Screen name="themes" />
        <Stack.Screen name="ki-native" />
        <Stack.Screen name="sync" options={{ presentation: 'modal' }} />
        <Stack.Screen name="impressum" options={{ presentation: 'modal' }} />
        <Stack.Screen name="datenschutz" options={{ presentation: 'modal' }} />
        <Stack.Screen name="agb" options={{ presentation: 'modal' }} />
        <Stack.Screen name="changelog" options={{ presentation: 'modal' }} />
        <Stack.Screen name="lizenzen" options={{ presentation: 'modal' }} />
      </Stack>
      <GlobalBackButton />
      <MiniPlayer />
    </ThemeProvider>
  );
}
