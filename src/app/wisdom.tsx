import { FlatList, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareCardModal } from '@/components/share-card';
import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { canShareContentImage, shareContentImage } from '@/features/quran/shareImage';
import { useShareCard } from '@/features/share/useShareCard';
import {
  WISDOM_ENTRIES,
  resolveWisdomText,
  wisdomOfTheDay,
  type WisdomEntry,
} from '@/features/wisdom/hooks';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function WisdomScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const shareCard = useShareCard();
  const today = wisdomOfTheDay();

  function share(entry: WisdomEntry) {
    const text = resolveWisdomText(entry.text, locale);
    Share.share({
      message: `${entry.arabic ? entry.arabic + '\n\n' : ''}${text}\n\n— ${entry.source}`,
    }).catch(() => {});
  }

  // Als Bild teilen — auf dem Web via Canvas (shareContentImage), nativ über
  // die RN-View-Karte (ShareCardModal), identisches Muster wie im Quran-Reader.
  function shareImage(entry: WisdomEntry) {
    const translation = resolveWisdomText(entry.text, locale);
    const arabic = entry.arabic ?? '';
    if (canShareContentImage) {
      shareContentImage({ arabic, translation, source: entry.source }).catch(() => {});
    } else {
      shareCard.open({ kind: 'wisdom', arabic, translation, source: entry.source });
    }
  }

  const rest = WISDOM_ENTRIES.filter((e) => e.id !== today.id);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('wisdom.title')} />

        <FlatList
          data={rest}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            // Audit 2026-07-27 (M24): die ganze Karte war ein PressableCard
            // (Text teilen) MIT einem zweiten Pressable darin (Als Bild
            // teilen). Screenreader melden dann „Taste in Taste"; im
            // Web-Export entstanden zwei verschachtelte <button> — ungültiges
            // HTML, der Browser zieht das innere beim Parsen heraus und React
            // findet danach eine andere DOM-Struktur vor als erwartet
            // (Hydration-Fehler #418, dieselbe Klasse wie zuvor auf /settings
            // bei der Adhan-Auswahl). Jetzt zwei GESCHWISTER-Pressables in
            // einem nicht-tappbaren Container, wie in settings.tsx.
            <ThemedView type="backgroundSelected" style={styles.todayCard}>
              <View style={styles.todayLabel}>
                <IconSymbol name="sparkles" size={14} color={colors.accent} />
                <ThemedText type="smallBold" themeColor="accent" numberOfLines={1} style={styles.todayLabelText}>
                  {t('wisdom.today')}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => share(today)}
                accessibilityRole="button"
                accessibilityLabel={t('wisdom.share')}
                style={({ pressed }) => [
                  styles.cardBody,
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                ]}>
                {today.arabic && <ThemedText style={styles.arabic}>{today.arabic}</ThemedText>}
                <ThemedText type="default">{resolveWisdomText(today.text, locale)}</ThemedText>
              </Pressable>
              <View style={styles.sourceRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.sourceText}>
                  — {today.source} · {t('wisdom.share')}
                </ThemedText>
                <IconSymbol name="share-outline" size={13} color={colors.textSecondary} />
                <Pressable
                  onPress={() => shareImage(today)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={t('wisdom.shareImage')}
                  style={({ pressed }) => [
                    Platform.OS === 'web' ? styles.pressableWeb : undefined,
                    pressed && styles.pressed,
                  ]}>
                  <IconSymbol name="image-outline" size={15} color={colors.textSecondary} />
                </Pressable>
              </View>
            </ThemedView>
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              {/* Gleiche Auflösung wie oben: Container ohne eigene Aktion,
                  darin zwei Geschwister-Knöpfe. */}
              <ThemedView type="backgroundElement" style={styles.card}>
                <Pressable
                  onPress={() => share(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t('wisdom.share')}
                  style={({ pressed }) => [
                    styles.cardBody,
                    Platform.OS === 'web' ? styles.pressableWeb : undefined,
                    pressed && styles.pressed,
                  ]}>
                  {item.arabic && <ThemedText style={styles.arabicSmall}>{item.arabic}</ThemedText>}
                  <ThemedText type="small">{resolveWisdomText(item.text, locale)}</ThemedText>
                </Pressable>
                <View style={styles.sourceRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.sourceText}>
                    — {item.source}
                  </ThemedText>
                  <Pressable
                    onPress={() => shareImage(item)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t('wisdom.shareImage')}
                    style={({ pressed }) => [
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <IconSymbol name="image-outline" size={15} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </ThemedView>
            </AnimatedListItem>
          )}
        />
        <ShareCardModal content={shareCard.content} onClose={shareCard.close} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  // borderRadius 20 = derselbe Wert, den PressableCard vorher gesetzt hat —
  // der Container ist jetzt eine reine ThemedView (s. M24 oben).
  todayCard: { padding: Spacing.four, gap: Spacing.two, marginBottom: Spacing.two, borderRadius: 20 },
  cardBody: { gap: Spacing.two },
  todayLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  todayLabelText: { flexShrink: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceText: { flex: 1 },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
  card: { padding: Spacing.three, gap: Spacing.one, borderRadius: 20 },
  arabic: { fontSize: 22, lineHeight: 38, textAlign: 'right' },
  arabicSmall: { fontSize: 18, lineHeight: 32, textAlign: 'right' },
});
