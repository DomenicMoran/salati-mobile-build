import { useEffect } from 'react';

import { NativeTabs } from 'expo-router/unstable-native-tabs';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting, type RouterAction } from 'expo-quick-actions/router';

import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Android App-Shortcuts (Icon lang gedrückt halten) + iOS Homescreen Quick
// Actions — EIN gemeinsames JS-API (expo-quick-actions, evanbacon, aktiv
// gepflegt) deckt beide Plattformen ab. Bewusst KEIN Config-Plugin-Eintrag
// in app.config.ts: der optional ist nur für eigene Adaptive-Icons/statische
// iOS-Actions nötig (s. Paket-README) — hier reichen Titel + interner
// Router-Pfad, das native Modul linkt sich wie jedes andere kleine
// Expo-Modul (z. B. expo-haptics) automatisch, ohne Manifest-/Info.plist-
// Änderungen. KEIN echtes Siri-Shortcut/App-Intent (das bräuchte eigenes
// natives Swift, s. Session-Abschlussbericht) — nur der Homescreen-
// Schnellzugriff, den Apple selbst teils zusätzlich als Siri-Vorschlag
// aufgreift, ohne dass wir das explizit ansteuern.
function usePrayerQuickActions() {
  const { t } = useTranslation();

  // Warnung im Paket-Quellcode: NICHT im Root-_layout.tsx verwenden (würde
  // dort vor Router-Bereitschaft navigieren) — AppTabs (gerendert aus
  // (tabs)/_layout.tsx) ist bereits eine Sub-Layout-Route, passt.
  useQuickActionRouting();

  useEffect(() => {
    QuickActions.setItems<RouterAction>([
      { id: 'prayer', title: t('nav.prayerTimes'), params: { href: '/prayer' } },
      { id: 'qibla', title: t('nav.qibla'), params: { href: '/qibla' } },
      { id: 'radio', title: t('nav.radio'), params: { href: '/radio' } },
    ]).catch(() => {});
  }, [t]);
}

export default function AppTabs() {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { t } = useTranslation();

  usePrayerQuickActions();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('nav.prayerTimes')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.fill" md="schedule" selectedColor={colors.accent} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="qibla">
        <NativeTabs.Trigger.Label>{t('nav.qibla')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="location.north.line.fill"
          md="explore"
          selectedColor={colors.accent}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="quran">
        <NativeTabs.Trigger.Label>{t('nav.quran')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book.fill" md="menu_book" selectedColor={colors.accent} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="lernen">
        <NativeTabs.Trigger.Label>{t('nav.lernen')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="graduationcap.fill"
          md="school"
          selectedColor={colors.accent}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>{t('nav.more')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis" md="more_horiz" selectedColor={colors.accent} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
