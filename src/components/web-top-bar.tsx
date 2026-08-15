import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

// Gleiche Optik wie die Tab-Pill in app-tabs.web.tsx, aber OHNE expo-router/ui
// (keine Tabs-Context-Abhängigkeit) — für Web-Routen außerhalb der Tab-Gruppe
// (/prayer & Co.), auf denen die Navigation sonst komplett verschwand.
// Muss zur Tab-Leiste (app-tabs.web.tsx) passen: Gebet · Qibla · Koran · Mehr
// (+ Start als Rücksprung zur Landing). Kalender gehört NICHT hierher — er ist
// unter "Mehr" erreichbar; als eigener Top-Link erschien er sonst nur auf
// Nicht-Tab-Routen und "poppte" beim Wechsel von der Landing in die App auf.
const LINKS = [
  { href: '/', key: 'nav.home' },
  { href: '/prayer', key: 'nav.prayerTimes' },
  { href: '/qibla', key: 'nav.qibla' },
  { href: '/quran', key: 'nav.quran' },
  { href: '/more', key: 'nav.more' },
] as const;

export function WebTopBar() {
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const pathname = usePathname();

  return (
    <View style={styles.wrap}>
      <ThemedView type="backgroundElement" style={[styles.inner, rtl && styles.innerRtl]}>
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.linkRow, rtl && styles.linkRowRtl]}
          style={styles.linkScroll}>
          {LINKS.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Pressable
                key={l.href}
                onPress={() => router.push(l.href)}
                style={({ pressed }) => [styles.pressableWeb, pressed && styles.pressed]}>
                {active ? (
                  <ThemedView type="backgroundSelected" style={styles.pill}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {t(l.key)}
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <View style={styles.pill}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t(l.key)}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        {/* Auf schmalen Screens ist die Link-Reihe horizontal scrollbar,
            wurde aber ohne jeden Hinweis hart abgeschnitten (Audit
            2026-07-19 B12) - weicher Farbverlauf als Scroll-Affordanz. */}
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
  wrap: {
    width: '100%',
    padding: Spacing.three,
    alignItems: 'center',
  },
  inner: {
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
  // RTL: gleiche Spiegelung wie CustomTabList in app-tabs.web.tsx (Marke
  // rechts, Link-Reihenfolge gedreht) — beide zeigen dieselbe Navigation.
  innerRtl: { flexDirection: 'row-reverse', paddingLeft: Spacing.two, paddingRight: Spacing.three },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 0,
  },
  brandIcon: { width: 26, height: 26, borderRadius: 7 },
  linkScroll: { flexShrink: 1, minWidth: 0 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  linkRowRtl: { flexDirection: 'row-reverse' },
  pill: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
  },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.7 },
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
