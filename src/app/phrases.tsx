// „Was gesagt wird" — die gebräuchlichen Formeln (Begrüßung, Alltag, Anlässe)
// und der Ablauf der Freitagspredigt mit den Sätzen des Imams.
//
// Ergänzt den Praxis-Guide „Das Freitagsgebet" (guides/jumuah), der den ABLAUF
// beschreibt: hier steht, was dabei gesprochen wird, was es heißt und was man
// darauf antwortet. Daten: features/phrases (dort auch die Sprachabdeckung).
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { isTextFallback } from '@/features/guides/hooks';
import { speakArabic } from '@/features/learn/audio';
import { PHRASE_GROUPS, resolveText, type Phrase, type PhraseGroup } from '@/features/phrases';
import { useQuranFont } from '@/features/quran/useQuranFont';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

type Locale = ReturnType<typeof useTranslation>['locale'];

export default function PhrasesScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const rtl = isRtlLocale(locale);

  const [groupId, setGroupId] = useState(PHRASE_GROUPS[0]?.id ?? '');
  const group = useMemo(
    () => PHRASE_GROUPS.find((g) => g.id === groupId) ?? PHRASE_GROUPS[0],
    [groupId],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('phrases.title')} subtitle={t('phrases.subtitle')} />

        <FlatList
          data={group?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {PHRASE_GROUPS.map((g) => (
                  <GroupChip
                    key={g.id}
                    group={g}
                    active={g.id === group?.id}
                    locale={locale}
                    accent={colors.accent}
                    textSecondary={colors.textSecondary}
                    onPress={() => setGroupId(g.id)}
                  />
                ))}
              </ScrollView>
              {group ? (
                <ThemedView type="backgroundSelected" style={styles.introCard}>
                  <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                    {resolveText(group.intro, locale)}
                  </ThemedText>
                </ThemedView>
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={Math.min(index, 8)}>
              <PhraseCard phrase={item} locale={locale} rtl={rtl} />
            </AnimatedListItem>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function GroupChip({
  group,
  active,
  locale,
  accent,
  textSecondary,
  onPress,
}: {
  group: PhraseGroup;
  active: boolean;
  locale: Locale;
  accent: string;
  textSecondary: string;
  onPress: () => void;
}) {
  const label = resolveText(group.title, locale);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        active ? { backgroundColor: accent } : styles.chipInactive,
        Platform.OS === 'web' ? styles.pressableWeb : undefined,
        pressed && styles.pressed,
      ]}>
      <IconSymbol name={group.icon as IconName} size={16} color={active ? Brand.ink : textSecondary} />
      <ThemedText type="smallBold" style={{ color: active ? Brand.ink : textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function PhraseCard({ phrase, locale, rtl }: { phrase: Phrase; locale: Locale; rtl: boolean }) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // Arabisch in der eingestellten Koran-Schrift, inklusive der auf sie
  // umgerechneten Zeilenhöhe — sonst schneidet Android die hohen Zeichen ab
  // (features/quran/fonts.ts).
  const quranFont = useQuranFont();
  const arabicMetrics = quranFont.metrics(ARABIC_SIZE, ARABIC_LINE_HEIGHT);
  const replyMetrics = quranFont.metrics(REPLY_SIZE, REPLY_LINE_HEIGHT);
  const hasArabic = phrase.arabic !== '';

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {hasArabic && (
        <Pressable
          onPress={() => speakArabic(phrase.arabic)}
          accessibilityRole="button"
          accessibilityLabel={phrase.translit}
          accessibilityHint={t('phrases.tapToHear')}
          style={({ pressed }) => [
            styles.arabicPress,
            Platform.OS === 'web' ? styles.pressableWeb : undefined,
            pressed && styles.pressed,
          ]}>
          <ThemedText style={[styles.arabic, quranFont.style, arabicMetrics]}>{phrase.arabic}</ThemedText>
          <ThemedText type="smallBold" themeColor="accent" style={styles.translit}>
            {phrase.translit}
          </ThemedText>
        </Pressable>
      )}

      <ThemedText type="default" style={rtl && styles.textRtl}>
        {resolveText(phrase.meaning, locale)}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={[styles.when, rtl && styles.textRtl]}>
        {resolveText(phrase.when, locale)}
      </ThemedText>

      {phrase.reply && (
        <ThemedView type="backgroundSelected" style={styles.replyBox}>
          <View style={[styles.replyLabelRow, rtl && styles.rowReverse]}>
            <IconSymbol name="return-down-forward" size={14} color={colors.accent} />
            <ThemedText type="small" themeColor="accent" style={styles.replyLabel}>
              {t('phrases.reply')}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => speakArabic(phrase.reply!.arabic)}
            accessibilityRole="button"
            accessibilityLabel={phrase.reply.translit}
            accessibilityHint={t('phrases.tapToHear')}
            style={({ pressed }) => [
              Platform.OS === 'web' ? styles.pressableWeb : undefined,
              pressed && styles.pressed,
            ]}>
            <ThemedText style={[styles.arabic, quranFont.style, replyMetrics]}>{phrase.reply.arabic}</ThemedText>
            <ThemedText type="small" themeColor="accent" style={styles.translit}>
              {phrase.reply.translit}
            </ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
            {resolveText(phrase.reply.meaning, locale)}
          </ThemedText>
        </ThemedView>
      )}

      {phrase.source ? (
        <ThemedText type="small" themeColor="textSecondary" style={[styles.source, rtl && styles.textRtl]}>
          {phrase.source}
        </ThemedText>
      ) : null}

      {/* Sicherheitsnetz: der Bestand ist in allen 14 Sprachen vollständig
          (phrases.test.ts prüft das). Käme später ein Eintrag ohne Übersetzung
          dazu, stünde hier Englisch — dann wird das gesagt statt
          stillschweigend hingenommen (wie in guides/[guide].tsx). */}
      {isTextFallback(phrase.meaning, locale) && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.fallbackNotice}>
          ⓘ {t('learn.contentFallbackNotice')}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const ARABIC_SIZE = 26;
const ARABIC_LINE_HEIGHT = 48;
const REPLY_SIZE = 20;
const REPLY_LINE_HEIGHT = 38;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: BackChipInset },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  listHeader: { gap: Spacing.three, paddingBottom: Spacing.one },
  chipRow: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: 999, minHeight: 44 },
  chipInactive: { backgroundColor: 'rgba(150,150,150,0.14)' },
  introCard: { padding: Spacing.three, borderRadius: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  arabicPress: { gap: 2, marginBottom: Spacing.one },
  arabic: { textAlign: 'right', writingDirection: 'rtl' },
  translit: { fontStyle: 'italic', textAlign: 'right', writingDirection: 'rtl' },
  when: { lineHeight: 22 },
  replyBox: { marginTop: Spacing.two, padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.one },
  replyLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  replyLabel: { textTransform: 'uppercase', letterSpacing: 1 },
  rowReverse: { flexDirection: 'row-reverse' },
  source: { marginTop: Spacing.two, fontStyle: 'italic', opacity: 0.75 },
  fallbackNotice: { marginTop: Spacing.one, fontStyle: 'italic', opacity: 0.8 },
  textRtl: { textAlign: 'right' },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});
