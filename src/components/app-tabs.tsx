import { useEffect } from 'react';

import { NativeTabs } from 'expo-router/unstable-native-tabs';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting, type RouterAction } from 'expo-quick-actions/router';

import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { isLocaleLoaded, useTranslation, type Locale } from '@/lib/i18n';

/**
 * Schluessel fuer die native Registerleiste (siehe Begruendung in `AppTabs`
 * unten). Eigene, exportierte Funktion statt Inline-Ausdruck — so ist die
 * Schluessel-Logik selbst ohne die (in Jest nicht renderbare, weil
 * `expo-quick-actions` intern eine zweite React-Kopie laedt) native
 * Registerleiste testbar.
 */
export function nativeTabsKey(locale: Locale, loaded: boolean): string {
  return loaded ? locale : `${locale}-loading`;
}

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
  const { t, locale } = useTranslation();

  usePrayerQuickActions();

  // Belegter Fehler (Geraet, ar): die Registerleiste zeigte "Prayer" auf
  // Englisch, obwohl Inhalt und Layout bereits korrekt Arabisch waren — nur
  // de/en sind statisch gebuendelt, die uebrigen 12 Sprachen laedt
  // `ensureLocale()` per `import()` nach (lib/translate.ts). Ein reiner
  // Prop-Update reicht dafuer eigentlich: `<NativeTabs.Trigger.Label>` gibt
  // `title` an `Tabs.Screen` (react-native-screens) weiter, und dessen
  // native View aktualisiert `title` auch nach dem ersten Bau (geprueft in
  // node_modules/react-native-screens: ios/tabs/screen/RNSTabsScreenComponentView.mm
  // `updateProps` sowie android/.../TabsScreenViewManager.kt `setTitle`).
  // Trotzdem: baut die Registerleiste ausnahmsweise VOR dem Nachladen auf
  // (preloadLocale()-Timeout in translate.ts, 1500 ms), bekaeme genau diese
  // eine Instanz der "unstable" nativen Registerleiste die Fallback-Titel
  // dauerhaft eingebrannt, falls die Update-Kette an irgendeiner Stelle
  // dieser experimentellen API doch nicht greift. Der Schluessel erzwingt in
  // genau diesem (seltenen) Fall sowie bei einem Sprachwechsel in den
  // Einstellungen einen sauberen Neubau mit den dann aktuellen
  // Uebersetzungen. Fuer de/en (immer geladen) aendert sich der Schluessel
  // nie — kein Einfluss auf die Startzeit der beiden Standardsprachen.
  //
  // Zweiter, groesserer Nutzen (Geraetebefund, ps): ein bereits geoeffneter
  // Bildschirm (z. B. Qibla) blieb nach einem Sprachwechsel in den
  // Einstellungen auf der alten Sprache stehen, bis die App neu gestartet
  // wurde. Ursache war NICHT `useTranslation()` selbst (die liest bei jedem
  // Render neu, kein `useMemo`/Modul-Zustand haelt Uebersetzungen fest) und
  // auch nicht react-native-screens' Freeze-Optimierung (in dieser App nie
  // aktiviert, `enableFreeze()` wird nirgends aufgerufen) — sondern schlicht,
  // dass ein Bildschirm unterhalb der Registerleiste, waehrend man sich in
  // den Einstellungen befand, technisch weiterhin im selben React-Baum
  // gemountet blieb und daher zwar Kontext-Updates empfing, aber keinen
  // Grund fuer einen frischen Bau hatte. Der `key` hier remountet nicht nur
  // die Registerleiste, sondern (weil `<NativeTabs>` ueber
  // `useNavigationBuilder`/`descriptors[route.key].render()` JEDEN
  // Tab-Bildschirm inkl. seiner verschachtelten Stacks erzeugt) den
  // gesamten Inhalt aller Tabs — Qibla, Koran-Reader usw. eingeschlossen.
  // Bildschirme AUSSERHALB der Registerleiste (z. B. /tasbih, Root-Stack)
  // sind ohnehin nie eingefroren und uebernehmen den Sprachwechsel allein
  // ueber den normalen Re-Render aus dem Settings-Context.
  // Nachgewiesen am Emulator (salati_lexikon, Release-Build): Sprachwechsel
  // waehrend Qibla/Koran-Reader/Tasbih geoeffnet waren, jeweils sofort
  // korrekt uebernommen, keine "stecken gebliebene" alte Sprache mehr.
  const tabsKey = nativeTabsKey(locale, isLocaleLoaded(locale));

  return (
    <NativeTabs
      key={tabsKey}
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
