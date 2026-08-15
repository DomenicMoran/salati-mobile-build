import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import {
  completedDays,
  isJourneyActive,
  isJourneyComplete,
  journeyStorageKey,
  parseJourneyProgress,
  type JourneyProgress,
} from '@/features/themes/journeyProgress';
import { JOURNEYS } from '@/features/themes/journeys';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

async function loadAllProgress(): Promise<Record<string, JourneyProgress | null>> {
  const entries = await AsyncStorage.multiGet(JOURNEYS.map((j) => journeyStorageKey(j.id)));
  const result: Record<string, JourneyProgress | null> = {};
  JOURNEYS.forEach((journey, i) => {
    result[journey.id] = parseJourneyProgress(entries[i]?.[1] ?? null);
  });
  return result;
}

export default function JourneysHubScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [progressByJourney, setProgressByJourney] = useState<Record<string, JourneyProgress | null>>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadAllProgress()
        .then((result) => {
          if (!cancelled) setProgressByJourney(result);
        })
        .catch(() => {
          // Storage-Lesefehler darf den Hub nicht dauerhaft ohne Fortschritts-
          // Anzeige stecken lassen (gleiches Muster wie useJourneyProgress in
          // journeyProgress.ts) - sicherer Default: keine Reise hat Fortschritt.
          if (!cancelled) setProgressByJourney({});
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Gestartete, noch nicht abgeschlossene Reisen wandern in eine eigene
  // "Aktiv"-Sektion oben, statt in der Gesamtliste unterzugehen (Live-
  // Feedback: ein gestarteter Plan blieb bisher stur an seiner alphabetisch/
  // Reihenfolge-Position stehen und musste jedes Mal neu gesucht werden).
  // Alles andere (nicht gestartet ODER bereits fertig) bleibt in "Alle Pläne".
  const activeJourneys = JOURNEYS.filter((j) => isJourneyActive(progressByJourney[j.id] ?? null, j.days.length));
  const activeIds = new Set(activeJourneys.map((j) => j.id));
  const restJourneys = JOURNEYS.filter((j) => !activeIds.has(j.id));

  const sections = [
    ...(activeJourneys.length > 0
      ? [{ key: 'active', title: t('journeys.activeSection'), data: activeJourneys }]
      : []),
    { key: 'all', title: t('journeys.allSection'), data: restJourneys },
  ].filter((s) => s.data.length > 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('journeys.title')} subtitle={t('journeys.subtitle')} />

        <SegmentedTabs
          tabs={[
            { key: 'collections', label: t('journeys.tabCollections') },
            { key: 'journeys', label: t('journeys.tabJourneys') },
          ]}
          activeKey="journeys"
          onChange={(key) => {
            if (key === 'collections') router.replace('/themes');
          }}
        />

        <SectionList
          sections={sections}
          keyExtractor={(j) => j.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            sections.length > 1 ? (
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
                {section.title}
              </ThemedText>
            ) : null
          }
          renderItem={({ item, index, section }) => {
            const progress = progressByJourney[item.id];
            const done = progress ? completedDays(progress) : 0;
            const total = item.days.length;
            const complete = progress ? isJourneyComplete(progress, total) : false;
            const active = section.key === 'active';
            return (
              <AnimatedListItem index={index}>
                <PressableCard
                  type={active ? 'backgroundSelected' : 'backgroundElement'}
                  onPress={() => router.push({ pathname: '/themes/journeys/[id]', params: { id: item.id } })}
                  style={styles.row}>
                  <ThemedView type={active ? 'backgroundElement' : 'backgroundSelected'} style={styles.iconBadge}>
                    <IconSymbol
                      name={complete ? 'checkmark-circle' : item.icon}
                      size={18}
                      color={colors.accent}
                    />
                  </ThemedView>
                  <View style={styles.rowText}>
                    <ThemedText type="default">{t(item.titleKey)}</ThemedText>
                    {active ? (
                      <>
                        <ThemedView type="backgroundElement" style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${(done / total) * 100}%` }]} />
                        </ThemedView>
                        <ThemedText type="small" themeColor="textSecondary">
                          {`${done}/${total} ${t('journeys.days')}`}
                        </ThemedText>
                      </>
                    ) : (
                      <ThemedText type="small" themeColor="textSecondary">
                        {progress
                          ? `${done}/${total} ${t('journeys.days')}`
                          : `${total} ${t('journeys.days')}`}
                      </ThemedText>
                    )}
                  </View>
                  {active && (
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('journeys.continuePlan')}
                    </ThemedText>
                  )}
                  <DisclosureChevron size={18} color={colors.textSecondary} />
                </PressableCard>
              </AnimatedListItem>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
  sectionHeader: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Brand.gold, borderRadius: 3 },
});
