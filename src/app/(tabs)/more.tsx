import { router } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { ListCard, ListGroupHeading } from '@/components/ui/list';
import { NavTile } from '@/components/ui/nav-tile';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, IconBadge, MaxContentWidth, Spacing } from '@/constants/theme';
import { LERNEN_NAV } from '@/lib/lernenNav';
import { splitSequential, useLayout } from '@/hooks/use-layout';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

// Thematische Gruppierung statt einer flachen Liste
// (User-Feedback "App muss übersichtlicher/sortierter sein").
// `as const` hält die hrefs als Literale für expo-routers typisierte Routen.
// Die Lern-Sektion („Lernen") ist eine VERKNÜPFUNG auf dieselben Einträge wie
// im Lernen-Tab (gemeinsame Quelle lib/lernenNav.ts) — die wichtigsten Studium-
// Werkzeuge sind so an beiden Orten erreichbar, ohne Funktion zu duplizieren.
const SECTIONS = [
  {
    titleKey: 'more.sections.learning',
    items: LERNEN_NAV,
  },
  {
    titleKey: 'more.sections.practice',
    items: [
      { href: '/tracker', labelKey: 'nav.tracker', icon: 'checkmark-circle' },
      { href: '/guides', labelKey: 'nav.guides', icon: 'body' },
      { href: '/phrases', labelKey: 'nav.phrases', icon: 'chatbubbles' },
      { href: '/duas', labelKey: 'nav.duas', icon: 'hand-left' },
      { href: '/tasbih', labelKey: 'nav.tasbih', icon: 'repeat' },
      { href: '/fasting', labelKey: 'nav.fasting', icon: 'moon' },
      { href: '/khatmah', labelKey: 'nav.khatmah', icon: 'calendar' },
      { href: '/calendar', labelKey: 'nav.calendar', icon: 'calendar-outline' },
      { href: '/themes', labelKey: 'nav.themes', icon: 'compass-outline' },
      { href: '/themes/journeys', labelKey: 'nav.journeys', icon: 'walk-outline' },
      { href: '/challenges', labelKey: 'nav.challenges', icon: 'flag' },
      { href: '/achievements', labelKey: 'nav.achievements', icon: 'trophy' },
    ],
  },
  {
    titleKey: 'more.sections.tools',
    items: [
      { href: '/zakat', labelKey: 'nav.zakat', icon: 'cash' },
      { href: '/zakat-fitr', labelKey: 'nav.zakatFitr', icon: 'gift-outline' },
      { href: '/mirath', labelKey: 'nav.mirath', icon: 'people' },
      { href: '/hijri-converter', labelKey: 'nav.hijriConverter', icon: 'swap-horizontal' },
      { href: '/halal', labelKey: 'nav.halal', icon: 'restaurant' },
      { href: '/halal-scanner', labelKey: 'nav.halalScanner', icon: 'barcode' },
      { href: '/mosques', labelKey: 'nav.mosques', icon: 'location' },
    ],
  },
  {
    titleKey: 'more.sections.app',
    items: [
      { href: '/tv-connect', labelKey: 'nav.tvConnect', icon: 'tv-outline' },
      { href: '/sync', labelKey: 'nav.sync', icon: 'sync' },
      { href: '/settings', labelKey: 'nav.settings', icon: 'settings' },
      { href: '/changelog', labelKey: 'nav.changelog', icon: 'sparkles-outline' },
    ],
  },
] as const satisfies readonly {
  titleKey: string;
  items: readonly { href: string; labelKey: string; icon: IconName }[];
}[];

export default function MoreScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // Audit 2026-07-27 (N5/N6): die beiden Einstiegskarten und die Sektions-
  // Ueberschriften waren fest linksbuendig — in ar/fa/ur/ps stand der
  // Icon-Badge auf der falschen Seite.
  const rtl = useRtl();
  // Breitbild: die vier Sektionen stehen auf Tablets nebeneinander statt in
  // einer 800-dp-Spalte untereinander (Gerätebefund 2026-07-29).
  const { sectionColumns, contentWidth } = useLayout();
  const sektionSpalten = splitSequential(SECTIONS, sectionColumns, (s) => s.items.length + 2);

  let itemIndex = 0;

  return (
    <ThemedView type="groupedBackground" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {t('nav.more')}
        </ThemedText>

        <ScrollView contentContainerStyle={[styles.list, { maxWidth: contentWidth }]}>
          <PressableCard
              onPress={() => router.push('/search')}
              type="groupedCard"
              style={[styles.kiCard, rtl && styles.kiCardRtl]}>
              <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                <IconSymbol name="search" size={18} color={colors.accent} />
              </ThemedView>
              <View style={[styles.kiText, rtl && styles.kiTextRtl]}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('search.globalTitle')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('search.moreDesc')}
                </ThemedText>
              </View>
              <DisclosureChevron size={18} color={colors.textSecondary} />
          </PressableCard>
          {/* Web: eigenständige statische Seite (public/ki.html). Nativ: eigener
              Router-Screen (ki-native.tsx). Beide arbeiten seit 2026-07-28 im
              Zitat-Modus (features/ki/zitat.ts): die Antwort besteht
              ausschließlich aus wörtlichen Passagen der gefundenen Quellen,
              kein Sprachmodell, kein Download, kein WebGPU. */}
          <PressableCard
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.location.href = '/ki';
                } else {
                  router.push('/ki-native');
                }
              }}
              type="groupedCard"
              style={[styles.kiCard, rtl && styles.kiCardRtl]}>
              <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                <IconSymbol name="sparkles" size={18} color={colors.accent} />
              </ThemedView>
              <View style={[styles.kiText, rtl && styles.kiTextRtl]}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('landing.ctaKi')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('more.kiDesc')}
                </ThemedText>
              </View>
              <DisclosureChevron size={18} color={colors.textSecondary} />
          </PressableCard>
          <View style={sectionColumns > 1 ? [styles.columnsRow, rtl && styles.columnsRowRtl] : undefined}>
            {sektionSpalten.map((spalte, spaltenIndex) => (
              <View key={spaltenIndex} style={sectionColumns > 1 ? styles.column : undefined}>
                {spalte.map((section) => (
                  <View key={section.titleKey} style={styles.section}>
                    <ListGroupHeading title={t(section.titleKey)} />
                    <ListCard>
                      {section.items.map((item) => (
                        <NavTile
                          key={item.href}
                          index={itemIndex++}
                          label={t(item.labelKey)}
                          icon={item.icon}
                          onPress={() => router.push(item.href)}
                        />
                      ))}
                    </ListCard>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.credit}>
            Salati · {t('common.credit')}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  kiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  kiCardRtl: { flexDirection: 'row-reverse' },
  kiText: { flex: 1, gap: 2 },
  kiTextRtl: { alignItems: 'flex-end' },
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three },
  title: { textAlign: 'center', marginBottom: Spacing.three },
  list: {
    paddingHorizontal: Spacing.three,
    // Die Abstaende zwischen den Gruppen kommen aus ListGroupHeading
    // (marginTop/-Bottom) — hier nur noch der Grundabstand der Karten.
    gap: Spacing.two,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  section: {},
  columnsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.four },
  columnsRowRtl: { flexDirection: 'row-reverse' },
  column: { flex: 1, minWidth: 0 },
  credit: { textAlign: 'center', marginTop: Spacing.two },
  iconBadge: {
    width: IconBadge.row,
    height: IconBadge.row,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
