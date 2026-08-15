// Natives Home: Gebetszeiten (auf Web ersetzt index.web.tsx dies durch die
// Landingpage; der Screen selbst bleibt dort unter /prayer erreichbar).
//
// Erststart-Weiche (Audit C2): beim allerersten Mount das Onboarding-Flag
// prüfen und einmalig zum skippbaren Einrichtungs-Flow umleiten. Bewusst
// HIER statt im Root-Layout (kein Eingriff in die Stack-Initialisierung)
// und nur in useEffect (SSR-/Hydration-sicher, kein Top-Level-Storage-Zugriff).
// Auf Web greift die Weiche nie: isOnboardingDone() liefert dort immer true
// UND diese Datei wird auf Web ohnehin durch index.web.tsx ersetzt.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import PrayerTimesScreen from '@/components/prayer-times-screen';
import { isOnboardingDone } from '@/features/onboarding/flag';
import { UpdateBanner } from '@/features/updates/UpdateBanner';

export default function HomeTab() {
  useEffect(() => {
    let cancelled = false;
    isOnboardingDone().then((done) => {
      if (!cancelled && !done) router.replace('/onboarding');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // UpdateBanner: einzige Einbindung des OTA-Hinweises. Er prüft höchstens
  // einmal pro Tag und rendert nur dann etwas, wenn ein Update tatsächlich
  // geladen und startbereit ist (features/updates/otaUpdate.ts) — bis dahin
  // ist dieser Screen unverändert der reine Gebetszeiten-Screen.
  return (
    <View style={{ flex: 1 }}>
      <PrayerTimesScreen />
      <UpdateBanner />
    </View>
  );
}
