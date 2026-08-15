import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedSwitch } from '@/components/ui/themed-switch';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

/**
 * Wiederkehrende Einstellungs-Zeile: Beschriftung (+ optionaler Hinweis) links,
 * Schalter rechts. Ersetzt das zuvor überall in settings.tsx duplizierte
 * switchRow/switchLabel-Muster (Entzerrung) und kapselt die RTL-Spiegelung
 * (row-reverse + rechtsbündiger Text) an einer Stelle, statt sie an jeder
 * einzelnen Zeile zu wiederholen.
 */
export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  return (
    <View style={[styles.row, rtl && styles.rowRtl]}>
      <View style={[styles.label, rtl && styles.labelRtl]}>
        <ThemedText type="default" style={rtl && styles.rtlText}>
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <ThemedSwitch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Kein eigener unterer Rand mehr: der iOS-Inset-Trenner wird jetzt zentral
  // von der Sektion NUR zwischen Zeilen gezeichnet (Audit 2026-07-22).
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  label: { flex: 1, gap: 2, paddingRight: Spacing.two },
  labelRtl: { paddingRight: 0, paddingLeft: Spacing.two },
  rtlText: { textAlign: 'right' },
});
