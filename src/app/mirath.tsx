import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { calcMirath, type Heir, type MirathInput } from '@/features/mirath/calc';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const HEIR_LABEL_KEYS: Record<Heir, string> = {
  husband: 'mirath.husband',
  wife: 'mirath.wife',
  father: 'mirath.father',
  mother: 'mirath.mother',
  son: 'mirath.son',
  daughter: 'mirath.daughter',
  brother: 'mirath.brother',
  sister: 'mirath.sister',
};

function Stepper({
  label,
  value,
  onChange,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { t } = useTranslation();
  return (
    <View style={styles.stepperRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.stepperLabel}>
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

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.stepperLabel}>
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

export default function MirathScreen() {
  const { t } = useTranslation();

  const [deceasedGender, setDeceasedGender] = useState<'male' | 'female'>('male');
  const [hasSpouse, setHasSpouse] = useState(false);
  const [wivesCount, setWivesCount] = useState(1);
  const [sons, setSons] = useState(0);
  const [daughters, setDaughters] = useState(0);
  const [fatherAlive, setFatherAlive] = useState(false);
  const [motherAlive, setMotherAlive] = useState(false);
  const [fullBrothers, setFullBrothers] = useState(0);
  const [fullSisters, setFullSisters] = useState(0);

  const input: MirathInput = {
    deceasedGender,
    hasSpouse,
    wivesCount,
    sons,
    daughters,
    fatherAlive,
    motherAlive,
    fullBrothers,
    fullSisters,
  };
  const result = calcMirath(input);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('mirath.title')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('mirath.subtitle')}
          </ThemedText>

          <AnimatedListItem index={0}>
            <ThemedView type="backgroundElement" style={styles.section}>
              <ThemedText type="smallBold">{t('mirath.deceasedGender')}</ThemedText>
              <View style={styles.genderRow}>
                <Pressable onPress={() => setDeceasedGender('male')} style={styles.genderChipPressable}>
                  <ThemedView
                    type={deceasedGender === 'male' ? 'backgroundSelected' : 'backgroundElement'}
                    style={styles.genderChip}>
                    <ThemedText type="small" themeColor={deceasedGender === 'male' ? 'accent' : 'text'}>
                      {t('mirath.genderMale')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
                <Pressable onPress={() => setDeceasedGender('female')} style={styles.genderChipPressable}>
                  <ThemedView
                    type={deceasedGender === 'female' ? 'backgroundSelected' : 'backgroundElement'}
                    style={styles.genderChip}>
                    <ThemedText type="small" themeColor={deceasedGender === 'female' ? 'accent' : 'text'}>
                      {t('mirath.genderFemale')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </View>
            </ThemedView>
          </AnimatedListItem>

          <AnimatedListItem index={1}>
            <ThemedView type="backgroundElement" style={styles.section}>
              <ToggleRow
                label={
                  deceasedGender === 'male' ? t('mirath.hasWife') : t('mirath.hasHusband')
                }
                value={hasSpouse}
                onChange={setHasSpouse}
              />
              {hasSpouse && deceasedGender === 'male' && (
                <Stepper label={t('mirath.wivesCount')} value={wivesCount} onChange={setWivesCount} max={4} />
              )}
            </ThemedView>
          </AnimatedListItem>

          <AnimatedListItem index={2}>
            <ThemedView type="backgroundElement" style={styles.section}>
              <Stepper label={t('mirath.sons')} value={sons} onChange={setSons} />
              <Stepper label={t('mirath.daughters')} value={daughters} onChange={setDaughters} />
            </ThemedView>
          </AnimatedListItem>

          <AnimatedListItem index={3}>
            <ThemedView type="backgroundElement" style={styles.section}>
              <ToggleRow label={t('mirath.fatherAlive')} value={fatherAlive} onChange={setFatherAlive} />
              <ToggleRow label={t('mirath.motherAlive')} value={motherAlive} onChange={setMotherAlive} />
            </ThemedView>
          </AnimatedListItem>

          <AnimatedListItem index={4}>
            <ThemedView type="backgroundElement" style={styles.section}>
              <Stepper label={t('mirath.fullBrothers')} value={fullBrothers} onChange={setFullBrothers} />
              <Stepper label={t('mirath.fullSisters')} value={fullSisters} onChange={setFullSisters} />
            </ThemedView>
          </AnimatedListItem>

          <AnimatedListItem index={5}>
            <ThemedView type="backgroundSelected" style={styles.resultCard}>
              <ThemedText type="smallBold" themeColor="accent" style={styles.resultTitle}>
                {t('mirath.resultTitle')}
              </ThemedText>
              {result.shares.length === 0 ? (
                <ThemedText type="default">{t('mirath.noHeirs')}</ThemedText>
              ) : (
                result.shares.map((s) => (
                  <View key={s.heir} style={styles.resultRow}>
                    <ThemedText type="default">
                      {t(HEIR_LABEL_KEYS[s.heir])}
                      {s.count > 1 ? ` (${s.count}×)` : ''}
                    </ThemedText>
                    <ThemedText type="smallBold" themeColor="accent">
                      {(s.fraction * 100).toFixed(2)} %
                    </ThemedText>
                  </View>
                ))
              )}
              {result.gharrawaynApplied && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  {t('mirath.gharrawaynNote')}
                </ThemedText>
              )}
              {result.awlApplied && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  {t('mirath.awlNote')}
                </ThemedText>
              )}
              {result.shares.length > 0 && result.unresolvedRemainder > 0 && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  {t('mirath.unresolvedNote')} ({(result.unresolvedRemainder * 100).toFixed(2)} %)
                </ThemedText>
              )}
            </ThemedView>
          </AnimatedListItem>

          <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
            {t('mirath.disclaimer')}
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
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  subtitle: { textAlign: 'center', marginBottom: Spacing.one, paddingHorizontal: Spacing.four },
  section: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  genderRow: { flexDirection: 'row', gap: Spacing.two },
  genderChipPressable: { flex: 1 },
  genderChip: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  stepperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepperLabel: { flex: 1 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepperButton: { padding: Spacing.half },
  stepperPressed: { opacity: 0.6 },
  stepperValue: { minWidth: 24, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultCard: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },
  resultTitle: { textAlign: 'center', marginBottom: Spacing.one },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  note: { marginTop: Spacing.one },
  disclaimer: { textAlign: 'center', paddingHorizontal: Spacing.three },
});
