import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { parseAmount } from '@/features/zakat/calc';
import { calcZakatFitr } from '@/features/zakat/fitr';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

function Stepper({
  label,
  value,
  onChange,
  max = 30,
  rtl,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  rtl: boolean;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { t } = useTranslation();
  return (
    <View style={[styles.stepperRow, rtl && styles.stepperRowRtl]}>
      <ThemedText type="small" themeColor="textSecondary" style={[styles.stepperLabel, rtl && styles.rtlText]}>
        {label}
      </ThemedText>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={() => onChange(Math.max(0, value - 1))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${t('a11y.decrease')}`}
          style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperPressed]}>
          <IconSymbol name="remove-circle-outline" size={26} color={colors.accent} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.stepperValue}>
          {value}
        </ThemedText>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${t('a11y.increase')}`}
          style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperPressed]}>
          <IconSymbol name="add-circle-outline" size={26} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

export default function ZakatFitrScreen() {
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [householdSize, setHouseholdSize] = useState(1);
  const [amountText, setAmountText] = useState('');

  const result = calcZakatFitr({
    householdSize,
    amountPerPerson: parseAmount(amountText),
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('zakatFitr.title')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('zakatFitr.subtitle')}
          </ThemedText>

          {/* Fachliche Trennung von der Vermögens-Zakat: eigener erklärender
              Absatz statt eines gemeinsamen Screens, damit niemand annimmt,
              beide Abgaben seien dasselbe oder gegenseitig anrechenbar. */}
          <ThemedView type="backgroundElement" style={styles.introCard}>
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
              {t('zakatFitr.intro')}
            </ThemedText>
          </ThemedView>

          <AnimatedListItem index={0}>
            <ThemedView type="backgroundElement" style={styles.section}>
              <Stepper
                label={t('zakatFitr.householdSize')}
                value={householdSize}
                onChange={setHouseholdSize}
                rtl={rtl}
              />
            </ThemedView>
          </AnimatedListItem>

          <AnimatedListItem index={1}>
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                {t('zakatFitr.amountPerPerson')}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.inputBox}>
                <TextInput
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { color: colors.text }]}
                />
              </ThemedView>
            </View>
          </AnimatedListItem>

          <AnimatedListItem index={2}>
            <ThemedView type="backgroundSelected" style={styles.resultCard}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('zakatFitr.total')}
              </ThemedText>
              {result.amountMissing ? (
                <ThemedText type="default">{t('zakatFitr.amountMissing')}</ThemedText>
              ) : (
                <ThemedText style={styles.totalAmount}>{result.total.toFixed(2)}</ThemedText>
              )}
            </ThemedView>
          </AnimatedListItem>

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('zakatFitr.disclaimer')}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  subtitle: { textAlign: 'center', marginBottom: Spacing.one, paddingHorizontal: Spacing.four },
  introCard: { borderRadius: Spacing.three, padding: Spacing.three, marginBottom: Spacing.one },
  section: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  stepperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepperRowRtl: { flexDirection: 'row-reverse' },
  stepperLabel: { flex: 1 },
  rtlText: { textAlign: 'right' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepperButton: { padding: Spacing.half },
  stepperPressed: { opacity: 0.6 },
  stepperValue: { minWidth: 24, textAlign: 'center' },
  field: { gap: Spacing.one },
  inputBox: { borderRadius: Spacing.two },
  input: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 16 },
  resultCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  totalAmount: { fontSize: 40, lineHeight: 52, fontWeight: '700' },
  note: { textAlign: 'center', marginTop: Spacing.two },
});
