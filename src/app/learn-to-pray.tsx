// "Beten lernen" — die RUHIGE Lern-Version (NICHT während des Gebets, dafür ist
// pray-along.tsx da). Ziel: entspannt lernen, wie man betet. Jeder Schritt zeigt
// dauerhaft und ohne Verdeckung: Haltung/Aktion + Icon, den ARABISCHEN Wortlaut,
// die lateinische UMSCHRIFT, die Übersetzung und den Hinweis. Tippen auf den
// arabischen Text spielt ihn ab (tap-to-hear). Anders als der Mitbet-Modus
// (horizontales Ein-Schritt-Paging, minimalistisch) scrollt man hier gemütlich
// vertikal durch den ganzen Ablauf mit großzügiger Typo — plus ein eigener
// Abschnitt mit den beiden kurzen Anfänger-Suren (Al-Ikhlas + Al-Kawthar).
//
// Alle religiösen Texte (Ablauf + Suren) stammen 1:1 aus den geprüften Daten in
// features/pray-along/prayers.ts (buildSteps) — hier wird nichts dupliziert.
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BackChipInset,
  Brand,
  Colors,
  MaxContentWidth,
  Spacing,
  type ThemeColor,
} from '@/constants/theme';
import { useQuranFont } from '@/features/quran/useQuranFont';
import { resolveText } from '@/features/guides/hooks';
import { speakArabic } from '@/features/learn/audio';
import {
  buildSteps,
  LEARN_CORE_TEXTS,
  POSTURE_ICON,
  PRAY_ALONG_UI,
  PRAYERS,
  type PrayerId,
  type PrayStep,
} from '@/features/pray-along/prayers';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';
import { backOr } from '@/lib/nav';

type Palette = Record<ThemeColor, string>;
type Locale = ReturnType<typeof useTranslation>['locale'];

// Fajr (2 Rak'ah) ist der pädagogische Standard: das kürzeste vollständige
// Pflichtgebet, mit dem Anfänger beginnen — zeigt trotzdem den kompletten
// Ablauf inkl. beider kurzer Suren.
const DEFAULT_PRAYER: PrayerId = 'fajr';

// Kern-Texte, die immer (unabhängig vom gewählten Gebet) gezeigt werden: die
// KOMPLETTE Al-Fatiha (7 Verse) plus die beiden kürzesten Suren Al-Ikhlas und
// Al-Kawthar. Direkt aus prayers.ts (LEARN_CORE_TEXTS) — prayers.ts bleibt die
// einzige Quelle, kein doppelter religiöser Text in dieser Datei.
const CORE_TEXTS: PrayStep[] = LEARN_CORE_TEXTS;

export default function LearnToPrayScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const rtl = isRtlLocale(locale);

  const [prayerId, setPrayerId] = useState<PrayerId>(DEFAULT_PRAYER);
  const steps = useMemo(() => buildSteps(prayerId), [prayerId]);
  const total = steps.length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Kopf: zurück + Titel */}
        <View style={[styles.header, rtl && styles.rowReverse]}>
          <Pressable
            onPress={() => backOr('/getting-started')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}
            style={({ pressed }) => [
              Platform.OS === 'web' ? styles.pressableWeb : undefined,
              pressed && styles.pressed,
            ]}>
            <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.headerTitleRow}>
            <IconSymbol name="school-outline" size={18} color={colors.accent} />
            <ThemedText type="subtitle" style={styles.headerTitleText}>
              {t('learnToPray.title')}
            </ThemedText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={steps}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {/* Ruhiger Einstieg: erklärt, dass dies der Lern- (nicht Mitbet-)Modus ist */}
              <ThemedView type="backgroundSelected" style={styles.introCard}>
                <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                  {t('learnToPray.intro')}
                </ThemedText>
              </ThemedView>

              {/* Gebets-Auswahl (Chips) */}
              <ThemedText type="smallBold" style={[styles.sectionLabel, rtl && styles.textRtl]}>
                {t('learnToPray.pickPrompt')}
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}>
                {PRAYERS.map((p) => {
                  const active = p.id === prayerId;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setPrayerId(p.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={resolveText(p.name, locale)}
                      style={({ pressed }) => [
                        styles.chip,
                        active ? styles.chipActive : styles.chipInactive,
                        Platform.OS === 'web' ? styles.pressableWeb : undefined,
                        pressed && styles.pressed,
                      ]}>
                      <IconSymbol name={p.icon} size={16} color={active ? Brand.ink : colors.textSecondary} />
                      <ThemedText type="smallBold" style={{ color: active ? Brand.ink : colors.textSecondary }}>
                        {resolveText(p.name, locale)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={Math.min(index, 8)}>
              <StepCard
                step={item}
                stepNo={index + 1}
                total={total}
                colors={colors}
                rtl={rtl}
                locale={locale}
                stepWord={resolveText(PRAY_ALONG_UI.step, locale)}
                rakahWord={resolveText(PRAY_ALONG_UI.rakahLabel, locale)}
                hearHint={resolveText(PRAY_ALONG_UI.tapToHear, locale)}
              />
            </AnimatedListItem>
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              <View style={[styles.surahHeading, rtl && styles.rowReverse]}>
                <IconSymbol name="book" size={18} color={colors.accent} />
                <ThemedText type="subtitle" style={styles.surahHeadingText}>
                  {t('learnToPray.coreTitle')}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={[styles.surahSub, rtl && styles.textRtl]}>
                {t('learnToPray.coreSubtitle')}
              </ThemedText>
              {CORE_TEXTS.map((sura, i) => (
                <SurahCard
                  key={i}
                  step={sura}
                  colors={colors}
                  rtl={rtl}
                  locale={locale}
                  hearHint={resolveText(PRAY_ALONG_UI.tapToHear, locale)}
                />
              ))}
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

// Arabisch verse-für-Vers rendern: mehrzeilige Texte (Al-Fatiha, per '\n'
// zusammengesetzt) bekommen so jeden Vers in einer eigenen Zeile; einzeilige
// Suren bleiben eine Zeile. Nichts wird abgeschnitten.
function ArabicLines({ text }: { text: string }) {
  // Arabisch in der eingestellten Koran-Schrift (features/quran/fonts.ts).
  const quranFont = useQuranFont();
  return (
    <>
      {text.split('\n').map((line, i) => (
        <ThemedText key={i} style={[styles.arabicText, quranFont.style]}>
          {quranFont.text(line)}
        </ThemedText>
      ))}
    </>
  );
}

function TranslitLines({ text, rtl }: { text: string; rtl: boolean }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <ThemedText
          key={i}
          type="default"
          themeColor="accent"
          style={[styles.translit, rtl && styles.textRtl]}>
          {line}
        </ThemedText>
      ))}
    </>
  );
}

// ── Ein Schritt des Ablaufs — alles dauerhaft sichtbar, nichts verdeckt ───────
function StepCard({
  step,
  stepNo,
  total,
  colors,
  rtl,
  locale,
  stepWord,
  rakahWord,
  hearHint,
}: {
  step: PrayStep;
  stepNo: number;
  total: number;
  colors: Palette;
  rtl: boolean;
  locale: Locale;
  stepWord: string;
  rakahWord: string;
  hearHint: string;
}) {
  const { t } = useTranslation();
  return (
    <ThemedView type="backgroundElement" style={styles.stepCard}>
      {/* Kopfzeile: Nummer + Haltungs-Icon + Titel */}
      <View style={[styles.stepHeader, rtl && styles.rowReverse]}>
        <ThemedView type="backgroundSelected" style={styles.postureBadge}>
          <IconSymbol name={POSTURE_ICON[step.posture]} size={22} color={colors.accent} />
        </ThemedView>
        <View style={styles.stepHeaderText}>
          <View style={[styles.metaRow, rtl && styles.rowReverse]}>
            <ThemedText type="small" themeColor="textSecondary">
              {stepWord} {stepNo} / {total}
            </ThemedText>
            {step.rakah != null && (
              <ThemedText type="small" themeColor="accent">
                {rakahWord} {step.rakah}
              </ThemedText>
            )}
          </View>
          <ThemedText type="smallBold" style={[styles.stepTitle, rtl && styles.textRtl]}>
            {resolveText(step.label, locale)}
          </ThemedText>
        </View>
      </View>

      {/* Arabischer Wortlaut (groß, tap-to-hear) */}
      {step.arabic && (
        <Pressable
          onPress={() => speakArabic(step.arabic!)}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.playAudio')}
          accessibilityHint={hearHint}
          style={({ pressed }) => [
            styles.arabicCard,
            Platform.OS === 'web' ? styles.pressableWeb : undefined,
            pressed && styles.pressed,
          ]}>
          <View style={styles.arabicHeaderRow}>
            {step.repeat ? (
              <ThemedText type="smallBold" themeColor="accent">
                {step.repeat}
              </ThemedText>
            ) : (
              <View />
            )}
            <IconSymbol name="volume-high" size={18} color={colors.accent} />
          </View>
          <ArabicLines text={step.arabic} />
        </Pressable>
      )}

      {/* Lateinische Umschrift */}
      {step.transliteration && <TranslitLines text={step.transliteration} rtl={rtl} />}

      {/* Übersetzung */}
      <ThemedText type="default" style={[styles.translation, rtl && styles.textRtl]}>
        {resolveText(step.translation, locale)}
      </ThemedText>

      {/* Hinweis */}
      {step.note && (
        <ThemedView type="backgroundSelected" style={styles.noteCard}>
          <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
            ⓘ {resolveText(step.note, locale)}
          </ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
}

// ── Dedizierte Suren-Karte (Al-Ikhlas / Al-Kawthar) ──────────────────────────
function SurahCard({
  step,
  colors,
  rtl,
  locale,
  hearHint,
}: {
  step: PrayStep;
  colors: Palette;
  rtl: boolean;
  locale: Locale;
  hearHint: string;
}) {
  const { t } = useTranslation();
  return (
    <ThemedView type="backgroundElement" style={styles.stepCard}>
      <View style={[styles.surahTitleRow, rtl && styles.rowReverse]}>
        <IconSymbol name="bookmark-outline" size={16} color={colors.accent} />
        <ThemedText type="smallBold" style={[styles.stepTitle, rtl && styles.textRtl]}>
          {resolveText(step.label, locale)}
        </ThemedText>
      </View>
      {step.arabic && (
        <Pressable
          onPress={() => speakArabic(step.arabic!)}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.playAudio')}
          accessibilityHint={hearHint}
          style={({ pressed }) => [
            styles.arabicCard,
            Platform.OS === 'web' ? styles.pressableWeb : undefined,
            pressed && styles.pressed,
          ]}>
          <View style={styles.arabicHeaderRow}>
            <View />
            <IconSymbol name="volume-high" size={18} color={colors.accent} />
          </View>
          <ArabicLines text={step.arabic} />
        </Pressable>
      )}
      {step.transliteration && <TranslitLines text={step.transliteration} rtl={rtl} />}
      <ThemedText type="default" style={[styles.translation, rtl && styles.textRtl]}>
        {resolveText(step.translation, locale)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  rowReverse: { flexDirection: 'row-reverse' },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  headerTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerTitleText: { textAlign: 'center' },
  headerSpacer: { width: 22 },

  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  listHeader: { gap: Spacing.two },
  introCard: { padding: Spacing.four, borderRadius: Spacing.three },
  sectionLabel: { marginTop: Spacing.one, paddingHorizontal: Spacing.one },
  chipRow: { gap: Spacing.two, paddingVertical: Spacing.one, paddingHorizontal: Spacing.half },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
  },
  chipActive: { backgroundColor: Brand.gold },
  chipInactive: { backgroundColor: 'rgba(150,150,150,0.18)' },

  // Schritt-Karte
  stepCard: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.three },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  postureBadge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  stepHeaderText: { flex: 1, gap: Spacing.half },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepTitle: { flex: 1 },

  arabicCard: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.35)',
    gap: Spacing.one,
  },
  arabicHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 },
  arabicText: {
    fontSize: 30,
    lineHeight: 60,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  translit: { fontStyle: 'italic', lineHeight: 28 },
  translation: { lineHeight: 26 },
  noteCard: { borderRadius: Spacing.three, padding: Spacing.three },

  // Footer / Suren
  footer: { gap: Spacing.three, marginTop: Spacing.three },
  surahHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, justifyContent: 'center' },
  surahHeadingText: { textAlign: 'center' },
  surahSub: { textAlign: 'center', paddingHorizontal: Spacing.three },
  surahTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
