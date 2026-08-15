import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { Pressable, ScrollView, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

const TABS = [
  { name: 'index', href: '/', key: 'nav.home' },
  { name: 'qibla', href: '/qibla', key: 'nav.qibla' },
  { name: 'quran', href: '/quran', key: 'nav.quran' },
  { name: 'lernen', href: '/lernen', key: 'nav.lernen' },
  { name: 'more', href: '/more', key: 'nav.more' },
] as const;

export default function AppTabs() {
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  return (
    // Nav STATISCH über dem Inhalt (nicht absolut schwebend) — vorher scrollte
    // der Seiteninhalt sichtbar hinter die Pill (User: "Menüs überlappen").
    <Tabs style={styles.tabsRoot}>
      <TabList asChild>
        <CustomTabList rtl={rtl}>
          {/* WICHTIG: TabTrigger müssen direkte Kinder bleiben — jede
              Wrapper-View bricht expo-routers Trigger-Erkennung ("Couldn't
              find any screens for the navigator", live gesehen). Nicht-Trigger-
              Geschwister (PrayerLink) sind ok. Reihenfolge bleibt bewusst LTR
              deklariert — die RTL-Spiegelung passiert rein visuell über
              flexDirection: row-reverse (CustomTabList), nicht über
              Kind-Reorder (kein erneutes Registrieren der Trigger nötig). */}
          <TabTrigger name="index" href="/" asChild>
            <TabButton>{t('nav.home')}</TabButton>
          </TabTrigger>
          <PrayerLink />
          {TABS.slice(1).map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton>{t(tab.key)}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

/** Gebetszeiten liegen auf Web außerhalb der Tab-Gruppe ('/' ist die
    Landingpage) — Link in der Tab-Reihe, aktiv-Stil via Pfadabgleich. */
function PrayerLink() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const active = pathname.startsWith('/prayer');
  return (
    <Pressable
      onPress={() => router.push('/prayer')}
      style={({ pressed }) => pressed && styles.pressed}>
      {active ? (
        <ThemedView type="backgroundSelected" style={styles.tabButtonView}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('nav.prayerTimes')}
          </ThemedText>
        </ThemedView>
      ) : (
        <View style={styles.tabButtonView}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('nav.prayerTimes')}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      {isFocused ? (
        <ThemedView type="backgroundSelected" style={styles.tabButtonView}>
          <ThemedText type="smallBold" themeColor="accent">
            {children}
          </ThemedText>
        </ThemedView>
      ) : (
        <View style={styles.tabButtonView}>
          <ThemedText type="small" themeColor="textSecondary">
            {children}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps & { rtl?: boolean }) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { rtl, ...tabListProps } = props;

  return (
    <View {...tabListProps} style={styles.tabListContainer}>
      <ThemedView
        type="backgroundElement"
        style={[styles.innerContainer, rtl && styles.innerContainerRtl]}>
        <View style={styles.brandBlock}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.brandIcon}
            contentFit="cover"
            alt=""
          />
          <ThemedText type="smallBold" style={{ color: colors.accent }}>
            Salati
          </ThemedText>
        </View>

        {/* Auf schmalen Viewports (Handy-Browser) passen Marke + alle 5 Tabs
            nicht in eine feste Zeile — ohne diesen Scroll-Container wurden
            Marke und letzte Tabs abgeschnitten statt umzubrechen. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabScrollContent, rtl && styles.tabScrollContentRtl]}
          style={styles.tabScroll}>
          {props.children}
        </ScrollView>
        {/* Scroll-Affordanz wie in web-top-bar.tsx: die Reihe ist scrollbar,
            wurde auf schmalen Screens aber ohne Hinweis abgeschnitten. */}
        <View
          pointerEvents="none"
          style={[
            styles.edgeFade,
            rtl ? styles.edgeFadeLeft : styles.edgeFadeRight,
            {
              backgroundImage: `linear-gradient(to ${rtl ? 'left' : 'right'}, ${colors.backgroundElement}00, ${colors.backgroundElement})`,
            },
          ]}
        />
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRoot: { flex: 1 },
  slot: { flex: 1 },
  tabListContainer: {
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    minHeight: 52,
  },
  // RTL: ganze Leiste spiegeln (Marke rechts statt links, Tab-Reihenfolge
  // gedreht) statt Kinder umzusortieren — row-reverse kehrt sowohl
  // Rendering-Reihenfolge als auch justifyContent-Kante konsistent um.
  innerContainerRtl: { flexDirection: 'row-reverse', paddingLeft: Spacing.two, paddingRight: Spacing.three },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 0,
  },
  brandIcon: { width: 26, height: 26, borderRadius: 7 },

  tabScroll: {
    flexShrink: 1,
    minWidth: 0,
  },
  tabScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  tabScrollContentRtl: { flexDirection: 'row-reverse' },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    minHeight: 34,
    justifyContent: 'center',
  },
  edgeFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 28,
    borderRadius: 999,
  },
  edgeFadeRight: { right: 0 },
  edgeFadeLeft: { left: 0 },
});
