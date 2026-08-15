import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { backOr } from '@/lib/nav';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { speakArabic } from '@/features/learn/audio';
import { GUIDES, guideById, isTextFallback, resolveText } from '@/features/guides/hooks';
import { PRAY_ALONG_ENTRY } from '@/features/pray-along/prayers';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

const GUIDE_ICONS: Record<string, IconName> = {
  wudu: 'water',
  ghusl: 'water-outline',
  tayammum: 'sunny-outline',
  'how-to-pray': 'body',
  rakat: 'calculator',
  witr: 'moon',
  jumuah: 'calendar',
};

// Echte Fotos (Unsplash-Lizenz, Nachweis in assets/images/guides/CREDITS.md)
// als Kopfbild je Guide — User-Wunsch "Bilder für Wudu und ähnliches".
const GUIDE_IMAGES: Record<string, number> = {
  wudu: require('../../../assets/images/guides/wudu.jpg'),
  ghusl: require('../../../assets/images/guides/ghusl.jpg'),
  tayammum: require('../../../assets/images/guides/tayammum.jpg'),
  'how-to-pray': require('../../../assets/images/guides/salah.jpg'),
  rakat: require('../../../assets/images/guides/pray.jpg'),
  witr: require('../../../assets/images/guides/salah.jpg'),
  jumuah: require('../../../assets/images/guides/pray.jpg'),
  janazah: require('../../../assets/images/guides/beads.jpg'),
  'hajj-umrah': require('../../../assets/images/guides/kaaba.jpg'),
  itikaf: require('../../../assets/images/guides/quran.jpg'),
  'eid-prayer': require('../../../assets/images/guides/pray.jpg'),
};

// Ohne generateStaticParams rendert `expo export --platform web` diese Route
// nur als EIN generisches, parameterloses Template — der Server kennt guide
// dabei nicht (guideById(undefined) -> undefined), zeigt also die Fehler-
// Fallback-UI ("Etwas ist schiefgelaufen."). Der Client liest guide danach
// aus der echten URL und rendert den echten Titel — Server- und Client-
// Markup weichen voneinander ab (React #418, gleiches Muster wie
// study/[course]/index.tsx).
export function generateStaticParams() {
  return GUIDES.map((g) => ({ guide: g.id }));
}

export default function GuideDetailScreen() {
  const { guide: guideId } = useLocalSearchParams<{ guide: string }>();
  const guide = guideById(guideId);
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  // Audit 2026-07-27: Unbekannte Guide-Id (Deep-Link, alter Lesezeichen-Link)
  // zeigte nur "Fehler" — ohne Kopf, also auf nativ ohne sichtbaren Ausgang
  // (Guides-Stack: headerShown:false, Zurueck-Chip Web-only).
  if (!guide) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('guides.title')} onBack={() => backOr('/guides')} />
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const rtl = isRtlLocale(locale);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.header, rtl && styles.headerRtl]}>
          <Pressable
            onPress={() => backOr('/guides')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.headerTitleRow}>
            <IconSymbol name={GUIDE_ICONS[guide.id] ?? 'book'} size={18} color={colors.accent} />
            <ThemedText type="subtitle" style={styles.headerTitle}>
              {resolveText(guide.title, locale)}
            </ThemedText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={guide.steps}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              {GUIDE_IMAGES[guide.id] != null && (
                <Image
                  source={GUIDE_IMAGES[guide.id]}
                  style={styles.headerImage}
                  contentFit="cover"
                  contentPosition="center"
                  alt=""
                />
              )}
              <ThemedView type="backgroundSelected" style={styles.introCard}>
                <ThemedText type="small">{resolveText(guide.intro, locale)}</ThemedText>
                {!!guide.source && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.guideSource}>
                    — {guide.source}
                  </ThemedText>
                )}
              </ThemedView>
              {guide.id === 'how-to-pray' && (
                <>
                  <PressableCard
                    onPress={() => router.push('/learn-to-pray')}
                    type="backgroundSelected"
                    style={[styles.prayAlongCta, rtl && styles.prayAlongCtaRtl]}>
                    <ThemedView type="backgroundElement" style={styles.prayAlongIcon}>
                      <IconSymbol name="school-outline" size={18} color={colors.accent} />
                    </ThemedView>
                    <View style={styles.prayAlongText}>
                      <ThemedText type="smallBold" themeColor="accent">
                        {t('learnToPray.title')}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('learnToPray.subtitle')}
                      </ThemedText>
                    </View>
                    <DisclosureChevron size={18} color={colors.textSecondary} />
                  </PressableCard>
                  <PressableCard
                    onPress={() => router.push('/pray-along')}
                    type="backgroundSelected"
                    style={[styles.prayAlongCta, rtl && styles.prayAlongCtaRtl]}>
                    <ThemedView type="backgroundElement" style={styles.prayAlongIcon}>
                      <IconSymbol name="play" size={18} color={colors.accent} />
                    </ThemedView>
                    <View style={styles.prayAlongText}>
                      <ThemedText type="smallBold" themeColor="accent">
                        {resolveText(PRAY_ALONG_ENTRY.title, locale)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {resolveText(PRAY_ALONG_ENTRY.subtitle, locale)}
                      </ThemedText>
                    </View>
                    <DisclosureChevron size={18} color={colors.textSecondary} />
                  </PressableCard>
                </>
              )}
            </>
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              <ThemedView type="backgroundElement" style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <ThemedView type="backgroundSelected" style={styles.numberBadge}>
                    <ThemedText type="small">{index + 1}</ThemedText>
                  </ThemedView>
                  <ThemedText type="smallBold" style={styles.stepTitle}>
                    {resolveText(item.title, locale)}
                  </ThemedText>
                </View>
                {item.arabic && (
                  <Pressable
                    onPress={() => speakArabic(item.arabic!)}
                    accessibilityRole="button"
                    accessibilityHint={t('a11y.playAudio')}
                    style={({ pressed }) => [
                      styles.arabicRow,
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText style={styles.arabic}>{item.arabic}</ThemedText>
                    <IconSymbol name="volume-high" size={16} color={colors.accent} />
                  </Pressable>
                )}
                {item.translit && (
                  <ThemedText type="small" themeColor="accent" style={styles.translit}>
                    {item.translit}
                  </ThemedText>
                )}
                <ThemedText type="small" themeColor="textSecondary">
                  {resolveText(item.text, locale)}
                </ThemedText>
                {isTextFallback(item.text, locale) && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.fallbackNotice}>
                    ⓘ {t('learn.contentFallbackNotice')}
                  </ThemedText>
                )}
              </ThemedView>
            </AnimatedListItem>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  headerRtl: { flexDirection: 'row-reverse' },
  headerTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerTitle: { textAlign: 'center' },
  headerSpacer: { width: 16 },
  pressed: { opacity: 0.6 },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  headerImage: {
    width: '100%',
    height: 170,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  introCard: { padding: Spacing.three, borderRadius: Spacing.three, marginBottom: Spacing.one },
  guideSource: { marginTop: Spacing.one },
  prayAlongCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  prayAlongCtaRtl: { flexDirection: 'row-reverse' },
  prayAlongIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  prayAlongText: { flex: 1, gap: Spacing.half },
  stepCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepTitle: { flex: 1 },
  numberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arabicRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.two },
  arabic: { fontSize: 22, lineHeight: 40, textAlign: 'right' },
  translit: { fontStyle: 'italic' },
  fallbackNotice: { fontStyle: 'italic' },
  pressableWeb: { cursor: 'pointer' },
});
