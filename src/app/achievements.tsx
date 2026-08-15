import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { loadSeenBadges, markBadgesSeen } from '@/features/achievements/seen';
import { type BadgeWithStatus, useAchievements } from '@/features/achievements/store';
import { maybeRequestReview } from '@/features/settings/ratingPrompt';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { hapticSuccess } from '@/lib/haptics';
import { useTranslation } from '@/lib/i18n';

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { badges, unlockedCount, total, loaded } = useAchievements();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const reducedMotion = useReducedMotion();

  // Frisch freigeschaltete (noch nie gesehene) Badges bekommen einen
  // Unlock-Moment; danach als gesehen persistieren (Audit 2026-07-19 E2).
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const unlockedKey = badges
    .filter((b) => b.unlocked)
    .map((b) => b.id)
    .join(',');
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const unlockedIds = unlockedKey === '' ? [] : unlockedKey.split(',');
    loadSeenBadges().then((seen) => {
      if (cancelled) return;
      const fresh = unlockedIds.filter((id) => !seen.has(id));
      if (fresh.length > 0) {
        setFreshIds(new Set(fresh));
        markBadgesSeen(fresh).catch(() => {});
        // Frisch freigeschaltetes Abzeichen = positiver Moment ohne laufende
        // Aufgabe im Weg - derselbe Ankerpunkt wie der (einmalige) native
        // Store-Rating-Dialog (siehe ratingPrompt.ts) bekommt zusätzlich ein
        // kurzes Erfolgs-Haptik.
        hapticSuccess();
        maybeRequestReview().catch(() => {});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loaded, unlockedKey]);

  if (!loaded) return <ThemedView style={styles.container} />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('achievements.title')} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {t('achievements.subtitle')}
        </ThemedText>
        <View style={styles.progressWrap}>
          <ThemedView type="backgroundElement" style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(unlockedCount / total) * 100}%` }]} />
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            {unlockedCount}/{total}
          </ThemedText>
        </View>

        <FlatList
          data={badges}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index} style={styles.cardWrap}>
              <BadgeCard badge={item} />
            </AnimatedListItem>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );

  function BadgeCard({ badge }: { badge: BadgeWithStatus }) {
    const fresh = freshIds.has(badge.id);
    const iconCircle = (
      <View style={[styles.iconCircle, { borderColor: badge.unlocked ? Brand.gold : colors.textSecondary }]}>
        <IconSymbol
          name={badge.unlocked ? badge.icon : 'lock-closed'}
          size={22}
          color={badge.unlocked ? Brand.gold : colors.textSecondary}
        />
      </View>
    );
    return (
      <ThemedView
        type={badge.unlocked ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.card, !badge.unlocked && styles.cardLocked]}>
        {fresh && (
          <View style={styles.freshChip}>
            <ThemedText type="smallBold" style={styles.freshChipText}>
              {t('achievements.fresh')}
            </ThemedText>
          </View>
        )}
        {fresh && !reducedMotion ? (
          <Animated.View entering={ZoomIn.springify().damping(9)}>{iconCircle}</Animated.View>
        ) : (
          iconCircle
        )}
        <ThemedText
          type="smallBold"
          themeColor={badge.unlocked ? 'text' : 'textSecondary'}
          style={styles.cardTitle}>
          {t(`achievements.badges.${badge.id}.title`)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardDesc}>
          {t(`achievements.badges.${badge.id}.desc`)}
        </ThemedText>
      </ThemedView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Brand.gold, borderRadius: 4 },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  row: { gap: Spacing.two },
  cardWrap: { flex: 1 },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    minHeight: 150,
  },
  cardLocked: { opacity: 0.55 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  cardTitle: { textAlign: 'center' },
  cardDesc: { textAlign: 'center' },
  freshChip: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: Brand.gold,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  freshChipText: { color: Brand.ink, fontSize: 11, lineHeight: 14 },
});
