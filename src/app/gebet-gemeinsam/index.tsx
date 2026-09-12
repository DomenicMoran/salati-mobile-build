// "Gemeinsam beten" (Dschamāʿa) — wie man sich beim Gemeinschaftsgebet
// aufstellt und welche Regeln dabei gelten. Diagramme zuerst (Aufstellungen),
// Regeln danach, je Regel sichtbar mit Sicherheitsgrad + Rechtsschule +
// Quelle (s. Kopfkommentar in features/gebet-gemeinsam/daten.ts zur
// Sorgfaltspflicht bei religiösen Rechtsaussagen).
//
// Dupliziert bewusst NICHTS aus study/data/fiqh-ibadat.json (fiqh-13:
// Freitagsgebet/Moschee-Etikette/Frauenreihen, fiqh-11: Sutra des Imams) —
// beide sind hier nur verlinkt.
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing, type ThemeColor } from '@/constants/theme';
import {
  AUFSTELLUNGEN,
  GEBET_GEMEINSAM_QUERVERWEISE,
  GEBET_GEMEINSAM_REGELN,
  GEBET_GEMEINSAM_SECTIONS,
  type GebetGemeinsamRegel,
  type Sicherheitsgrad,
} from '@/features/gebet-gemeinsam/daten';
import { AufstellungDiagramm } from '@/features/gebet-gemeinsam/AufstellungDiagramm';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const SECTION_TITLE_KEY: Record<(typeof GEBET_GEMEINSAM_SECTIONS)[number], string> = {
  aufstellung: 'gebetGemeinsam.sections.aufstellung',
  rezitation: 'gebetGemeinsam.sections.rezitation',
  mahram: 'gebetGemeinsam.sections.mahram',
};

const GRAD_ICON: Record<Sicherheitsgrad, IconName> = {
  anerkannt: 'checkmark-circle',
  strittig: 'swap-horizontal',
  empfehlung: 'bulb-outline',
};

export default function GebetGemeinsamScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('gebetGemeinsam.title')} subtitle={t('gebetGemeinsam.subtitle')} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Querverweise auf bereits geprüfte Inhalte, statt sie zu duplizieren. */}
          <AnimatedListItem index={0}>
            <View style={styles.crossLinks}>
              <PressableCard
                onPress={() =>
                  router.push({
                    pathname: '/study/[course]/[lesson]',
                    params: GEBET_GEMEINSAM_QUERVERWEISE.studyFreitagsUndMoscheeEtikette,
                  })
                }
                style={styles.crossLinkCard}>
                <IconSymbol name="library-outline" size={18} color={colors.accent} />
                <ThemedText type="small" themeColor="text" style={styles.crossLinkText}>
                  {t('gebetGemeinsam.seeAlsoFreitag')}
                </ThemedText>
              </PressableCard>
              <PressableCard
                onPress={() =>
                  router.push({
                    pathname: '/study/[course]/[lesson]',
                    params: GEBET_GEMEINSAM_QUERVERWEISE.studySutraDesImams,
                  })
                }
                style={styles.crossLinkCard}>
                <IconSymbol name="library-outline" size={18} color={colors.accent} />
                <ThemedText type="small" themeColor="text" style={styles.crossLinkText}>
                  {t('gebetGemeinsam.seeAlsoSutra')}
                </ThemedText>
              </PressableCard>
            </View>
          </AnimatedListItem>

          {/* 1) Diagramme — wie stellt man sich auf, je Konstellation. */}
          <AnimatedListItem index={1}>
            <ThemedText type="heading" style={styles.sectionHeading}>
              {t('gebetGemeinsam.sections.aufstellung')}
            </ThemedText>
          </AnimatedListItem>
          {AUFSTELLUNGEN.map((konstellation, i) => (
            <AnimatedListItem key={konstellation.id} index={2 + i}>
              <ThemedView type="groupedCard" style={styles.diagrammCard}>
                <ThemedText type="smallBold" themeColor="text">
                  {t(konstellation.titelKey)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(konstellation.beschreibungKey)}
                </ThemedText>
                <AufstellungDiagramm
                  reihen={konstellation.reihen}
                  imamLabel={t('gebetGemeinsam.legende.imam')}
                  mannLabel={t('gebetGemeinsam.legende.mann')}
                  frauLabel={t('gebetGemeinsam.legende.frau')}
                  qiblaLabel={t('gebetGemeinsam.legende.qibla')}
                  accessibilityLabel={`${t(konstellation.titelKey)}. ${t(konstellation.beschreibungKey)}`}
                />
              </ThemedView>
            </AnimatedListItem>
          ))}
          <AnimatedListItem index={2 + AUFSTELLUNGEN.length}>
            <View style={styles.legendRow}>
              <LegendEntry shape="●" label={t('gebetGemeinsam.legende.imam')} colors={colors} />
              <LegendEntry shape="■" label={t('gebetGemeinsam.legende.mann')} colors={colors} />
              <LegendEntry shape="◆" label={t('gebetGemeinsam.legende.frau')} colors={colors} />
            </View>
          </AnimatedListItem>

          {/* 2) Regeln, sektionsweise, je Regel mit Grad + Rechtsschule + Quelle. */}
          {GEBET_GEMEINSAM_SECTIONS.map((section, sectionIndex) => (
            <View key={section}>
              <AnimatedListItem index={3 + AUFSTELLUNGEN.length + sectionIndex}>
                <ThemedText type="heading" style={styles.sectionHeading}>
                  {t(SECTION_TITLE_KEY[section])}
                </ThemedText>
              </AnimatedListItem>
              {GEBET_GEMEINSAM_REGELN[section].map((regel, i) => (
                <AnimatedListItem
                  key={regel.id}
                  index={4 + AUFSTELLUNGEN.length + sectionIndex + i}>
                  <RegelCard regel={regel} colors={colors} t={t} />
                </AnimatedListItem>
              ))}
            </View>
          ))}

          <ThemedText type="small" themeColor="textSecondary" style={styles.footerNote}>
            {t('gebetGemeinsam.footerHinweis')}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function LegendEntry({
  shape,
  label,
  colors,
}: {
  shape: string;
  label: string;
  colors: Record<ThemeColor, string>;
}) {
  return (
    <View style={styles.legendEntry}>
      <ThemedText themeColor="accent" style={styles.legendShape}>
        {shape}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function RegelCard({
  regel,
  colors,
  t,
}: {
  regel: GebetGemeinsamRegel;
  colors: Record<ThemeColor, string>;
  t: (key: string) => string;
}) {
  const isEmpfehlung = regel.grad === 'empfehlung';
  return (
    <ThemedView
      type="groupedCard"
      style={[
        styles.regelCard,
        isEmpfehlung && { borderStyle: 'dashed', borderWidth: 1, borderColor: colors.separator },
      ]}>
      <View style={styles.regelBadgeRow}>
        <View style={[styles.gradBadge, { backgroundColor: colors.backgroundSelected }]}>
          <IconSymbol name={GRAD_ICON[regel.grad]} size={14} color={colors.accent} />
          <ThemedText type="small" themeColor="accent" style={styles.gradBadgeText}>
            {t(`gebetGemeinsam.grad.${regel.grad}`)}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {t(`gebetGemeinsam.madhhab.${regel.madhhab}`)}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" themeColor="text">
        {t(regel.titelKey)}
      </ThemedText>
      <ThemedText type="small" themeColor="text">
        {t(regel.textKey)}
      </ThemedText>
      {regel.source && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.sourceLine}>
          {t('gebetGemeinsam.quelle')}: {regel.source}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    padding: Spacing.three,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  crossLinks: { gap: Spacing.two, marginBottom: Spacing.two },
  crossLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
  },
  crossLinkText: { flex: 1 },
  sectionHeading: { marginTop: Spacing.three, marginBottom: Spacing.one },
  diagrammCard: {
    padding: Spacing.three,
    gap: Spacing.one,
    borderRadius: 20,
    marginBottom: Spacing.two,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
    marginBottom: Spacing.two,
  },
  legendEntry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  legendShape: { fontSize: 16 },
  regelCard: {
    padding: Spacing.three,
    gap: Spacing.one,
    borderRadius: 20,
    marginBottom: Spacing.two,
  },
  regelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  gradBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
  },
  gradBadgeText: { fontWeight: '700' },
  sourceLine: { fontStyle: 'italic' },
  footerNote: { marginTop: Spacing.three, marginBottom: Spacing.four, textAlign: 'center' },
});
