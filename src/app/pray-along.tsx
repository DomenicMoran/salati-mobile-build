import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
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
import { useKeepScreenAwake } from '@/features/pray-along/keepAwake';
import {
  FONT_SCALE,
  FONT_SIZE_OPTIONS,
  type PrayAlongFontSize,
  type PrayAlongPrefs,
  usePrayAlongPrefs,
} from '@/features/pray-along/prefs';
import {
  buildSteps,
  POSTURE_ICON,
  PRAY_ALONG_UI,
  PRAYERS,
  prayerById,
  type PrayerId,
  type PrayStep,
} from '@/features/pray-along/prayers';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';
import { isRtlLocale } from '@/lib/locale-detect';

type Palette = Record<ThemeColor, string>;

export default function PrayAlongScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const rtl = isRtlLocale(locale);

  const [prayerId, setPrayerId] = useState<PrayerId | null>(null);

  // Bildschirm wachhalten, sobald ein Gebet läuft (Web: Wake Lock; nativ No-op).
  useKeepScreenAwake(prayerId !== null);

  if (!prayerId) {
    return (
      <PrayerPicker
        colors={colors}
        rtl={rtl}
        locale={locale}
        onBack={() => backOr('/guides')}
        onSelect={setPrayerId}
        backLabel={t('a11y.back')}
      />
    );
  }

  return (
    <PrayerFlow
      key={prayerId}
      prayerId={prayerId}
      colors={colors}
      rtl={rtl}
      locale={locale}
      onExit={() => setPrayerId(null)}
    />
  );
}

// ── Schritt 1: Gebets-Auswahl ────────────────────────────────────────────────
function PrayerPicker({
  colors,
  rtl,
  locale,
  onBack,
  onSelect,
  backLabel,
}: {
  colors: Palette;
  rtl: boolean;
  locale: ReturnType<typeof useTranslation>['locale'];
  onBack: () => void;
  onSelect: (id: PrayerId) => void;
  backLabel: string;
}) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.header, rtl && styles.rowReverse]}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            style={({ pressed }) => [
              Platform.OS === 'web' ? styles.pressableWeb : undefined,
              pressed && styles.pressed,
            ]}>
            <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.headerTitleRow}>
            <IconSymbol name="body" size={18} color={colors.accent} />
            <ThemedText type="subtitle" style={styles.headerTitleText}>
              {resolveText(PRAY_ALONG_UI.title, locale)}
            </ThemedText>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.pickerList}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.pickerPrompt}>
            {resolveText(PRAY_ALONG_UI.pickPrompt, locale)}
          </ThemedText>

          {PRAYERS.map((p, index) => (
            <AnimatedListItem key={p.id} index={index}>
              <PressableCard onPress={() => onSelect(p.id)} style={[styles.prayerRow, rtl && styles.rowReverse]}>
                <ThemedView type="backgroundSelected" style={styles.prayerIcon}>
                  <IconSymbol name={p.icon} size={20} color={colors.accent} />
                </ThemedView>
                <View style={styles.prayerText}>
                  <ThemedText type="default">{resolveText(p.name, locale)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {resolveText(p.timeName, locale)}
                  </ThemedText>
                </View>
                <DisclosureChevron size={18} color={colors.textSecondary} />
              </PressableCard>
            </AnimatedListItem>
          ))}

          <ThemedView type="backgroundSelected" style={styles.disclaimerCard}>
            <ThemedText type="small" themeColor="textSecondary">
              ⓘ {resolveText(PRAY_ALONG_UI.disclaimer, locale)}
            </ThemedText>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ── Schritt 2: Voller Schritt-für-Schritt-Ablauf ─────────────────────────────
function PrayerFlow({
  prayerId,
  colors,
  rtl,
  locale,
  onExit,
}: {
  prayerId: PrayerId;
  colors: Palette;
  rtl: boolean;
  locale: ReturnType<typeof useTranslation>['locale'];
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { prefs, update } = usePrayAlongPrefs();
  const steps = useMemo(
    () => buildSteps(prayerId, { witrSurahInThird: prefs.witrSurahInThird }),
    [prayerId, prefs.witrSurahInThird],
  );
  const prayer = prayerById(prayerId);
  const listRef = useRef<FlatList<PrayStep>>(null);
  const [index, setIndex] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  const total = steps.length;
  const current = steps[index];

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      listRef.current?.scrollToIndex({ index: clamped, animated: true });
      setIndex(clamped);
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => undefined);
      }
    },
    [total],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex((prev) => (page !== prev && page >= 0 && page < total ? page : prev));
    },
    [width, total],
  );

  const progress = total > 1 ? (index + 1) / total : 1;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Kopf: Zurück zur Auswahl + Fortschritt */}
        <View style={[styles.header, rtl && styles.rowReverse]}>
          <Pressable
            onPress={onExit}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={resolveText(PRAY_ALONG_UI.change, locale)}
            style={({ pressed }) => [
              Platform.OS === 'web' ? styles.pressableWeb : undefined,
              pressed && styles.pressed,
            ]}>
            <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.headerTitleRow}>
            <ThemedText type="smallBold">{prayer ? resolveText(prayer.name, locale) : ''}</ThemedText>
          </View>
          <Pressable
            onPress={() => setPanelOpen(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('prayAlong.customize')}
            style={({ pressed }) => [
              Platform.OS === 'web' ? styles.pressableWeb : undefined,
              pressed && styles.pressed,
            ]}>
            <IconSymbol name="settings-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressMetaRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {resolveText(PRAY_ALONG_UI.step, locale)} {index + 1} / {total}
            </ThemedText>
            {current?.rakah != null && (
              <ThemedText type="small" themeColor="accent">
                {resolveText(PRAY_ALONG_UI.rakahLabel, locale)} {current.rakah}
              </ThemedText>
            )}
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={steps}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScrollToIndexFailed={() => undefined}
          extraData={prefs}
          renderItem={({ item }) => (
            <StepPage step={item} width={width} colors={colors} rtl={rtl} locale={locale} prefs={prefs} />
          )}
        />

        {/* Fuß: Vor/Zurück + Beenden */}
        <View style={[styles.footer, rtl && styles.rowReverse]}>
          <NavButton
            label={resolveText(PRAY_ALONG_UI.prev, locale)}
            icon={rtl ? 'chevron-forward' : 'chevron-back'}
            onPress={() => goTo(index - 1)}
            disabled={index === 0}
            colors={colors}
            rtl={rtl}
          />
          {index === total - 1 ? (
            <NavButton
              label={resolveText(PRAY_ALONG_UI.finish, locale)}
              icon="checkmark-done"
              onPress={onExit}
              colors={colors}
              rtl={rtl}
              primary
            />
          ) : (
            <NavButton
              label={resolveText(PRAY_ALONG_UI.next, locale)}
              icon={rtl ? 'chevron-back' : 'chevron-forward'}
              onPress={() => goTo(index + 1)}
              colors={colors}
              rtl={rtl}
              primary
              iconTrailing
            />
          )}
        </View>

        <CustomizePanel
          visible={panelOpen}
          onClose={() => setPanelOpen(false)}
          prefs={prefs}
          update={update}
          colors={colors}
          rtl={rtl}
          t={t}
          prayerId={prayerId}
          locale={locale}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function StepPage({
  step,
  width,
  colors,
  rtl,
  locale,
  prefs,
}: {
  step: PrayStep;
  width: number;
  colors: Palette;
  rtl: boolean;
  locale: ReturnType<typeof useTranslation>['locale'];
  prefs: PrayAlongPrefs;
}) {
  // Reihenfolge (User-Wunsch 2026-07-22): HINWEISE zuerst → gesprochener Text
  // als großer Held (Umschrift, mit tap-to-hear) → Übersetzung → arabische
  // Schrift KOMPAKT ganz unten. Reihenfolge, Sichtbarkeit und Schriftgröße
  // sind über die Anpassen-Einstellungen (prefs) frei konfigurierbar, damit man
  // den Screen fürs Mitbeten optimal einrichten kann.
  const scale = FONT_SCALE[prefs.fontSize];
  // Arabisch in der eingestellten Koran-Schrift (features/quran/fonts.ts).
  const quranFont = useQuranFont();

  // Gesprochener Text als Held: Umschrift groß, tap-to-hear.
  const heroBlock = step.transliteration ? (
    <Pressable
      key="hero"
      onPress={() => step.arabic && speakArabic(step.arabic)}
      disabled={!step.arabic}
      accessibilityRole="button"
      accessibilityHint={resolveText(PRAY_ALONG_UI.tapToHear, locale)}
      style={({ pressed }) => [
        styles.speakCard,
        Platform.OS === 'web' ? styles.pressableWeb : undefined,
        pressed && step.arabic && styles.pressed,
      ]}>
      <ThemedView type="backgroundElement" style={styles.speakInner}>
        <View style={styles.speakHeaderRow}>
          {step.repeat ? (
            <ThemedText type="smallBold" themeColor="accent">
              {step.repeat}
            </ThemedText>
          ) : (
            <View />
          )}
          {step.arabic && <IconSymbol name="volume-high" size={18} color={colors.accent} />}
        </View>
        <ThemedText
          themeColor="accent"
          style={[styles.speakText, { fontSize: 34 * scale, lineHeight: 46 * scale }]}>
          {step.transliteration}
        </ThemedText>
      </ThemedView>
    </Pressable>
  ) : null;

  // Übersetzung.
  const translationBlock = prefs.showTranslation ? (
    <ThemedText
      key="translation"
      type="default"
      style={[styles.translation, { fontSize: 16 * scale, lineHeight: 24 * scale }, rtl && styles.textRtl]}>
      {resolveText(step.translation, locale)}
    </ThemedText>
  ) : null;

  // Arabische Schrift kompakt (optional).
  const arabicBlock =
    prefs.showArabic && step.arabic ? (
      <Pressable
        key="arabic"
        onPress={() => speakArabic(step.arabic!)}
        accessibilityRole="button"
        accessibilityHint={resolveText(PRAY_ALONG_UI.tapToHear, locale)}
        style={({ pressed }) => [
          styles.arabicCard,
          Platform.OS === 'web' ? styles.pressableWeb : undefined,
          pressed && styles.pressed,
        ]}>
        <ThemedText style={[styles.arabicText, quranFont.style, { fontSize: 26 * scale, lineHeight: 46 * scale }]}>
          {step.arabic}
        </ThemedText>
      </Pressable>
    ) : null;

  // Anordnung: Umschrift zuerst (Standard) oder arabischer Text zuerst.
  const body = prefs.arabicFirst
    ? [arabicBlock, heroBlock, translationBlock]
    : [heroBlock, translationBlock, arabicBlock];

  return (
    <View style={[styles.page, { width }]}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <ThemedView type="backgroundSelected" style={styles.postureBadge}>
          <IconSymbol name={POSTURE_ICON[step.posture]} size={30} color={colors.accent} />
        </ThemedView>
        <ThemedText type="subtitle" style={styles.postureLabel}>
          {resolveText(step.label, locale)}
        </ThemedText>

        {/* Hinweise: was zu tun ist */}
        {prefs.showNotes && step.note && (
          <ThemedView type="backgroundElement" style={styles.noteCard}>
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
              ⓘ {resolveText(step.note, locale)}
            </ThemedText>
          </ThemedView>
        )}

        {body}
      </ScrollView>
    </View>
  );
}

// ── Anpassen-Panel: Schriftgröße, sichtbare Elemente, Reihenfolge ─────────────
function CustomizePanel({
  visible,
  onClose,
  prefs,
  update,
  colors,
  rtl,
  t,
  prayerId,
  locale,
}: {
  visible: boolean;
  onClose: () => void;
  prefs: PrayAlongPrefs;
  update: (patch: Partial<PrayAlongPrefs>) => void;
  colors: Palette;
  rtl: boolean;
  t: ReturnType<typeof useTranslation>['t'];
  prayerId: PrayerId;
  locale: ReturnType<typeof useTranslation>['locale'];
}) {
  const FONT_LABEL: Record<PrayAlongFontSize, string> = {
    small: t('settings.fontSmall'),
    medium: t('settings.fontMedium'),
    large: t('settings.fontLarge'),
    xlarge: t('settings.fontXLarge'),
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.close')}
        onPress={onClose}
      />
      <ThemedView style={styles.sheet} accessibilityViewIsModal importantForAccessibility="yes">
        <View style={[styles.sheetHandle, { backgroundColor: colors.textSecondary }]} />
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <View style={[styles.sheetHeader, rtl && styles.rowReverse]}>
            <ThemedText type="subtitle" style={styles.sheetTitle}>
              {t('prayAlong.customize')}
            </ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.close')}
              style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
              <IconSymbol name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Schriftgröße */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.sheetSectionLabel}>
            {t('prayAlong.fontSize')}
          </ThemedText>
          <View style={[styles.segmented, rtl && styles.rowReverse]}>
            {FONT_SIZE_OPTIONS.map((size) => {
              const active = prefs.fontSize === size;
              return (
                <Pressable
                  key={size}
                  onPress={() => update({ fontSize: size })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={FONT_LABEL[size]}
                  style={({ pressed }) => [
                    styles.segment,
                    active ? styles.segmentActive : styles.segmentInactive,
                    Platform.OS === 'web' ? styles.pressableWeb : undefined,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: active ? Brand.ink : colors.textSecondary }}>
                    {FONT_LABEL[size]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* Sichtbare Elemente */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.sheetSectionLabel}>
            {t('prayAlong.show')}
          </ThemedText>
          <ToggleRow
            label={t('prayAlong.showTranslation')}
            value={prefs.showTranslation}
            onToggle={() => update({ showTranslation: !prefs.showTranslation })}
            colors={colors}
            rtl={rtl}
          />
          <ToggleRow
            label={t('prayAlong.showArabic')}
            value={prefs.showArabic}
            onToggle={() => update({ showArabic: !prefs.showArabic })}
            colors={colors}
            rtl={rtl}
          />
          <ToggleRow
            label={t('prayAlong.showNotes')}
            value={prefs.showNotes}
            onToggle={() => update({ showNotes: !prefs.showNotes })}
            colors={colors}
            rtl={rtl}
          />

          {/* Witr: madhhab-abhängige Option, nur beim Witr-Gebet sichtbar. */}
          {prayerId === 'witr' && (
            <>
              <ToggleRow
                label={resolveText(PRAY_ALONG_UI.witrSurahLabel, locale)}
                value={prefs.witrSurahInThird}
                onToggle={() => update({ witrSurahInThird: !prefs.witrSurahInThird })}
                colors={colors}
                rtl={rtl}
              />
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={[styles.witrScholarNote, rtl && styles.textRtl]}>
                {resolveText(PRAY_ALONG_UI.witrScholarNote, locale)}
              </ThemedText>
            </>
          )}

          {/* Anordnung */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.sheetSectionLabel}>
            {t('prayAlong.arrangement')}
          </ThemedText>
          <View style={[styles.segmented, rtl && styles.rowReverse]}>
            {([false, true] as const).map((arabicFirst) => {
              const active = prefs.arabicFirst === arabicFirst;
              const label = arabicFirst ? t('prayAlong.arabicFirst') : t('prayAlong.translitFirst');
              return (
                <Pressable
                  key={String(arabicFirst)}
                  onPress={() => update({ arabicFirst })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.segment,
                    active ? styles.segmentActive : styles.segmentInactive,
                    Platform.OS === 'web' ? styles.pressableWeb : undefined,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: active ? Brand.ink : colors.textSecondary }}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
  colors,
  rtl,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  colors: Palette;
  rtl: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.toggleRow,
        rtl && styles.rowReverse,
        Platform.OS === 'web' ? styles.pressableWeb : undefined,
        pressed && styles.pressed,
      ]}>
      <ThemedText type="default" style={styles.toggleLabel}>
        {label}
      </ThemedText>
      <IconSymbol
        name={value ? 'checkbox' : 'square-outline'}
        size={24}
        color={value ? colors.accent : colors.textSecondary}
      />
    </Pressable>
  );
}

function NavButton({
  label,
  icon,
  onPress,
  disabled,
  colors,
  rtl,
  primary,
  iconTrailing,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  colors: Palette;
  rtl: boolean;
  primary?: boolean;
  iconTrailing?: boolean;
}) {
  const iconColor = primary ? Brand.ink : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.navButton,
        rtl && styles.rowReverse,
        primary ? styles.navButtonPrimary : styles.navButtonSecondary,
        disabled && styles.navButtonDisabled,
        Platform.OS === 'web' ? styles.pressableWeb : undefined,
        pressed && !disabled && styles.pressed,
      ]}>
      {!iconTrailing && <IconSymbol name={icon} size={18} color={iconColor} />}
      <ThemedText type="smallBold" style={{ color: iconColor }}>
        {label}
      </ThemedText>
      {iconTrailing && <IconSymbol name={icon} size={18} color={iconColor} />}
    </Pressable>
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

  // Picker
  pickerList: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  pickerPrompt: { paddingHorizontal: Spacing.one, marginBottom: Spacing.one },
  prayerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  prayerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  prayerText: { flex: 1, gap: Spacing.half },
  disclaimerCard: { padding: Spacing.three, borderRadius: Spacing.three, marginTop: Spacing.two },

  // Progress
  progressWrap: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
    marginBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  progressMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.25)', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Brand.gold },

  // Step page
  page: { flex: 1 },
  pageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  postureBadge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  postureLabel: { textAlign: 'center' },
  // Held: gesprochener Text (Umschrift) groß
  speakCard: { width: '100%' },
  speakInner: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },
  speakHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 },
  speakText: { textAlign: 'center', lineHeight: 40 },
  // Arabisch kompakt ganz unten (optional)
  arabicCard: {
    width: '100%',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.35)',
  },
  arabicText: {
    fontSize: 26,
    lineHeight: 50,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  translation: { textAlign: 'center' },
  noteCard: { width: '100%', borderRadius: Spacing.three, padding: Spacing.three },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 24,
    minWidth: 130,
    justifyContent: 'center',
  },
  navButtonPrimary: { backgroundColor: Brand.gold },
  navButtonSecondary: { backgroundColor: 'rgba(150,150,150,0.18)' },
  navButtonDisabled: { opacity: 0.4 },

  // Anpassen-Panel (Bottom-Sheet, Muster analog components/ui/intro-sheet.tsx)
  backdrop: { flex: 1, backgroundColor: 'rgba(11,11,13,0.45)' },
  sheet: {
    maxHeight: '85%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.two,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
    marginBottom: Spacing.two,
  },
  sheetContent: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.two },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { flex: 1 },
  sheetSectionLabel: { textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.three },
  witrScholarNote: { marginTop: Spacing.one, lineHeight: 18, opacity: 0.9 },
  segmented: { flexDirection: 'row', gap: Spacing.one },
  segment: {
    flex: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: Brand.gold },
  segmentInactive: { backgroundColor: 'rgba(150,150,150,0.18)' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  toggleLabel: { flex: 1 },
});
