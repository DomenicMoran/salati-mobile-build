import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { LESSONS, lessonTitle, type Lesson } from '@/features/learn/curriculum';
import {
  isPassed,
  isUnlocked,
  isUnlockedIn,
  passedCount,
  passedCountIn,
  useCourseProgress,
  useLearnProgress,
  type LearnProgress,
} from '@/features/learn/progress';
import { courseMetaById, loadCourseLessons } from '@/features/study/courses';
import { fetchPodcastIndex, formatDuration } from '@/features/podcast/data';
import { PHASE_TABLE_VIDEO } from '@/features/video/data';
import { PhaseTableCard, PhaseVideoCard } from '@/features/video/recommendation-cards';
import { useSettings } from '@/features/settings/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Ein einziger, durchgehender Koran-Lernpfad statt zweier getrennter
// Bereiche (User-Wunsch): Lesen lernen, Tajwid, Grammatik, Madinah-Arabisch
// und Alltags-Wortschatz als Phasen einer Seite. Jede Phase bleibt technisch
// der bestehende Kurs mit eigenem Storage-Key (kein Migrations-Risiko für
// vorhandenen Fortschritt).
//
// Die Phasen sperren sich NICHT mehr gegenseitig (User-Fund: "Tajwid ist
// noch gesperrt, ich kann es erst starten, wenn ich Wortschatz etc.
// abgeschlossen habe, obwohl die Reihenfolge für mich evtl. keinen Sinn
// ergibt"). Tajwid/Grammatik/Madinah-Arabisch haben untereinander keine
// echte fachliche Abhängigkeit (gleiche Begründung wie 'dialects' bereits
// `nonSequential` ist, siehe features/study/courses.ts) — und der /study-Hub
// bietet dieselben Kurse ohnehin schon immer ohne jede Kurs-übergreifende
// Sperre an, die frühere Phasen-Verkettung hier war dazu inkonsistent.
// Innerhalb jeder Phase bleibt die echte Lektion-für-Lektion-Progression
// bestehen (isUnlockedIn je Kurs-Storage-Key) — nur die Kopplung ZWISCHEN
// den Phasen ist entfernt.
//
// Nur die (leichten) Metadaten synchron am Modul-Top-Level — die vollen
// Lektionsinhalte lädt die Komponente unten async (siehe courses.ts-
// Kommentar: sonst zöge JEDE Route, die diese Datei importiert, wieder alle
// 12 Kurs-JSONs mit).
const TAJWID_META = courseMetaById('tajwid')!;
const GRAMMAR_META = courseMetaById('grammar')!;
const MADINAH_META = courseMetaById('madinah')!;
const AMAU_META = courseMetaById('amau')!;

interface Phase {
  key: string;
  courseId?: string;
  titleKey: string;
  lessons: Lesson[];
  progress: LearnProgress;
  // Optionaler Podcast-Vorschlag je Phase (User-Wunsch): vor den Uebungen kann
  // der Nutzer die passende Folge anhoeren — KEINE Pflicht. Jede Phase traegt
  // die THEMATISCH passende Einstiegsfolge (core=Buchstaben ep1, tajwid ep2,
  // grammar=Ism/Nahw ep3, madinah=Madinah-Arabisch-Reihe ep16, amau=Wortschatz-
  // Reihe ep26). Nur Phasen ohne passende Folge blieben ohne Nummer.
  // Bewusst als Feld am Phase-Objekt statt Lookup ueber `key`: SectionList
  // konsumiert `section.key` als React-Key, im renderSectionHeader ist er
  // dann nicht mehr zuverlaessig lesbar.
  episodeNo?: number;
  // Optionale, thematisch EXAKT passende Grammatik-Tabelle (kind:'table',
  // episode_no>=1000) fuer diese Phase — oeffnet denselben Video-Player. Nur
  // gesetzt, wo es genau passt (Grammatik->muslimun-Tabelle, Madinah->
  // Hinweiswoerter); Werte aus PHASE_TABLE_VIDEO. Wie episodeNo als Feld statt
  // Lookup ueber section.key (im renderSectionHeader nicht zuverlaessig lesbar).
  tableEpisodeNo?: number;
}

/** Optionale Podcast-Karte im Phasen-Kopf. Laedt den Folgen-Titel aus dem
 *  (geteilten, gecachten) Podcast-Index; navigiert zum Voll-Player. Rein
 *  freiwillig — die Lektionen darunter bleiben direkt startbar. */
function PhasePodcastCard({ episodeNo }: { episodeNo: number }) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { data } = useQuery({
    queryKey: ['podcast', 'index'],
    queryFn: fetchPodcastIndex,
    staleTime: 60 * 60 * 1000,
  });
  const ep = data?.episodes.find((e) => e.episode_no === episodeNo);
  return (
    <PressableCard
      onPress={() => router.push({ pathname: '/podcast/[episode]', params: { episode: episodeNo } })}
      type="backgroundElement"
      style={[styles.row, styles.podcastCard]}>
      <ThemedView type="backgroundSelected" style={styles.numberBadge}>
        <IconSymbol name="headset" size={16} color={colors.accent} />
      </ThemedView>
      <View style={styles.rowText}>
        <ThemedText type="smallBold" themeColor="accent">
          {t('learn.podcastIntro')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {ep ? `${ep.title} · ${formatDuration(ep.duration_sec)}` : t('learn.podcastOptional')}
        </ThemedText>
      </View>
      <IconSymbol name="play-circle" size={24} color={colors.accent} />
    </PressableCard>
  );
}

export default function LearnOverviewScreen() {
  const { progress } = useLearnProgress();
  const { progress: tajwidProgress } = useCourseProgress(TAJWID_META.storageKey);
  const { progress: grammarProgress } = useCourseProgress(GRAMMAR_META.storageKey);
  const { progress: madinahProgress } = useCourseProgress(MADINAH_META.storageKey);
  const { progress: amauProgress } = useCourseProgress(AMAU_META.storageKey);
  const { settings } = useSettings();
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  // Lektionsinhalte der 4 Phasen-Kurse erst async laden (eigenes Chunk pro
  // Kurs) — bis dahin zeigt der Screen einen Ladezustand statt falscher
  // Nullwerte in der Fortschrittsanzeige.
  const [phaseLessons, setPhaseLessons] = useState<{
    tajwid: Lesson[];
    grammar: Lesson[];
    madinah: Lesson[];
    amau: Lesson[];
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadCourseLessons(TAJWID_META.id),
      loadCourseLessons(GRAMMAR_META.id),
      loadCourseLessons(MADINAH_META.id),
      loadCourseLessons(AMAU_META.id),
    ]).then(([tajwid, grammar, madinah, amau]) => {
      if (!cancelled) setPhaseLessons({ tajwid, grammar, madinah, amau });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const done = passedCount(progress);
  const tajwidLessons = phaseLessons?.tajwid ?? [];
  const grammarLessons = phaseLessons?.grammar ?? [];
  const madinahLessons = phaseLessons?.madinah ?? [];
  const amauLessons = phaseLessons?.amau ?? [];
  const tajwidDone = passedCountIn(tajwidLessons, tajwidProgress);
  const grammarDone = passedCountIn(grammarLessons, grammarProgress);
  const madinahDone = passedCountIn(madinahLessons, madinahProgress);
  const amauDone = passedCountIn(amauLessons, amauProgress);
  // Kopf-Fortschritt zaehlt seit dem Zusammenfuehren von Lesen-lernen +
  // Studium-Vertiefung alle Phasen dieser Seite zusammen (User-Fund:
  // Anzeige zeigte weiter nur die Kern-Lesen-Lektionen, nicht mehr den
  // tatsaechlichen Gesamtumfang).
  const totalLessons =
    LESSONS.length + tajwidLessons.length + grammarLessons.length + madinahLessons.length + amauLessons.length;
  const totalDone = done + tajwidDone + grammarDone + madinahDone + amauDone;
  const fillWidth = useSharedValue(0);

  useEffect(() => {
    // Wert-Änderung "kommt an": ease-out statt Default-inOut (Design-Regel)
    fillWidth.value = withTiming(totalLessons > 0 ? (totalDone / totalLessons) * 100 : 0, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [totalDone, totalLessons, fillWidth]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fillWidth.value}%` }));

  // Audit 2026-07-27: Ladezweig ohne Kopf = auf nativ ohne sichtbaren Ausgang
  // (Lern-Stack: headerShown:false, Zurueck-Chip Web-only).
  if (!phaseLessons) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('learn.title')} subtitle={t('learn.subtitle')} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const phases: Phase[] = [
    { key: 'core', titleKey: 'learn.phaseRead', lessons: LESSONS, progress, episodeNo: 1 },
    {
      key: 'tajwid',
      courseId: TAJWID_META.id,
      titleKey: `study.courses.${TAJWID_META.id}.title`,
      lessons: tajwidLessons,
      progress: tajwidProgress,
      episodeNo: 2,
    },
    {
      key: 'grammar',
      courseId: GRAMMAR_META.id,
      titleKey: `study.courses.${GRAMMAR_META.id}.title`,
      lessons: grammarLessons,
      progress: grammarProgress,
      episodeNo: 3,
      tableEpisodeNo: PHASE_TABLE_VIDEO.grammar,
    },
    {
      key: 'madinah',
      courseId: MADINAH_META.id,
      titleKey: `study.courses.${MADINAH_META.id}.title`,
      lessons: madinahLessons,
      progress: madinahProgress,
      episodeNo: 16,
      tableEpisodeNo: PHASE_TABLE_VIDEO.madinah,
    },
    {
      key: 'amau',
      courseId: AMAU_META.id,
      titleKey: `study.courses.${AMAU_META.id}.title`,
      lessons: amauLessons,
      progress: amauProgress,
      episodeNo: 26,
    },
  ];
  const sections = phases.map((p) => ({
    ...p,
    data: p.lessons,
    doneCount: passedCountIn(p.lessons, p.progress),
  }));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('learn.title')} subtitle={t('learn.subtitle')} />

        <View style={styles.progressWrap}>
          <ThemedView type="backgroundElement" style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, fillStyle]} />
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            {totalDone} / {totalLessons}
          </ThemedText>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            const phase = section as unknown as Phase;
            const { episodeNo, tableEpisodeNo } = phase;
            return (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
                    {t(section.titleKey)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {section.doneCount}/{section.lessons.length}
                  </ThemedText>
                </View>
                {episodeNo ? <PhasePodcastCard episodeNo={episodeNo} /> : null}
                {/* Video-Empfehlung: gleiche episode_no wie der Podcast, da
                    inhaltsgleich (Lektion als Video). */}
                {episodeNo ? <PhaseVideoCard episodeNo={episodeNo} /> : null}
                {/* Optional: exakt passende Grammatik-Tabelle (kind:'table'). */}
                {tableEpisodeNo ? <PhaseTableCard episodeNo={tableEpisodeNo} /> : null}
              </View>
            );
          }}
          ListHeaderComponent={
            <>
              {/* Immer verfügbar (User-Wunsch): als Einstieg für Neue, danach
                  als wiederholbarer Wissens-Test — recordResult behält stets
                  das beste Ergebnis, Wiederholen kann nichts zurücksetzen. */}
              <PressableCard
                onPress={() => router.push('/learn/placement')}
                type={done === 0 ? 'backgroundSelected' : 'backgroundElement'}
                style={[styles.row, styles.writeCard]}>
                <ThemedView type="backgroundElement" style={styles.numberBadge}>
                  <IconSymbol name="rocket" size={16} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">
                    {t(done === 0 ? 'learn.placementCta' : 'learn.placementRepeatCta')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(done === 0 ? 'learn.placementCtaDesc' : 'learn.placementRepeatDesc')}
                  </ThemedText>
                </View>
                <DisclosureChevron size={18} color={colors.textSecondary} />
              </PressableCard>
              <PressableCard
                onPress={() => router.push('/learn/write')}
                type="backgroundSelected"
                style={[styles.row, styles.writeCard]}>
                <ThemedView type="backgroundElement" style={styles.numberBadge}>
                  <IconSymbol name="create" size={16} color={colors.accent} />
                </ThemedView>
                <View style={styles.rowText}>
                  <ThemedText type="default">{t('write.title')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('write.subtitle')}
                  </ThemedText>
                </View>
                <DisclosureChevron size={18} color={colors.textSecondary} />
              </PressableCard>
            </>
          }
          ListFooterComponent={
            <PressableCard
              onPress={() => router.push('/study')}
              type="backgroundElement"
              style={[styles.row, styles.writeCard, styles.footerCard]}>
              <ThemedView type="backgroundElement" style={styles.numberBadge}>
                <IconSymbol name="school" size={16} color={colors.accent} />
              </ThemedView>
              <View style={styles.rowText}>
                <ThemedText type="default">{t('learn.deepenCta')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('learn.deepenCtaDesc')}
                </ThemedText>
              </View>
              <DisclosureChevron size={18} color={colors.textSecondary} />
            </PressableCard>
          }
          renderItem={({ item, index, section }) => {
            const phase = section as unknown as Phase & { doneCount: number };
            // Nur noch lektionsinterne Sperre je Kurs (isUnlockedIn) — keine
            // Sperre mehr ZWISCHEN den Phasen (siehe Kommentar oben am Modul).
            const unlocked =
              settings.freeUnlock ||
              (phase.courseId
                ? courseMetaById(phase.courseId)?.nonSequential || isUnlockedIn(phase.lessons, phase.progress, item.id)
                : isUnlocked(progress, item.id));
            const passed = isPassed(phase.progress, item.id);
            const result = phase.progress[item.id];
            return (
              <AnimatedListItem index={index}>
                <PressableCard
                  disabled={!unlocked}
                  onPress={() =>
                    phase.courseId
                      ? router.push({
                          pathname: '/study/[course]/[lesson]',
                          params: { course: phase.courseId, lesson: item.id },
                        })
                      : router.push({ pathname: '/learn/[lesson]', params: { lesson: item.id } })
                  }
                  type={passed ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.row}>
                  <ThemedView type="backgroundSelected" style={styles.numberBadge}>
                    {passed ? (
                      <IconSymbol name="checkmark" size={16} color={colors.accent} />
                    ) : (
                      <ThemedText type="small">{index + 1}</ThemedText>
                    )}
                  </ThemedView>
                  <View style={styles.rowText}>
                    <ThemedText type="default">{lessonTitle(item, locale, t)}</ThemedText>
                    <View style={styles.statusRow}>
                      {!unlocked && <IconSymbol name="lock-closed" size={12} color={colors.textSecondary} />}
                      <ThemedText type="small" themeColor="textSecondary">
                        {!unlocked
                          ? t('learn.locked')
                          : result
                            ? `${result.score}/${result.total}`
                            : t('learn.start')}
                      </ThemedText>
                    </View>
                  </View>
                  <IconSymbol
                    name="chevron-forward"
                    size={18}
                    color={passed ? colors.accent : colors.textSecondary}
                  />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Brand.gold, borderRadius: 4 },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  writeCard: { marginBottom: Spacing.two },
  // Optionaler Podcast-Vorschlag: dezente Akzent-Umrandung, damit er sich als
  // freiwilliges Angebot von den nummerierten Pflicht-Lektionen abhebt.
  podcastCard: { marginBottom: Spacing.two, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
  footerCard: { marginTop: Spacing.two, marginBottom: 0 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  sectionHeader: { textTransform: 'uppercase', letterSpacing: 0.5 },
});
