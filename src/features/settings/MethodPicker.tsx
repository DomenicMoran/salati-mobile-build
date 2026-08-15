// Auswahl der Berechnungsmethode — eigener Picker statt des allgemeinen
// EditionPicker.
//
// WARUM EIGEN: Der EditionPicker zeigt eine Zeile Text pro Eintrag. Bei 23
// Behörden reicht das nicht: „Gulf Region" und „Kuwait" sind ohne die Winkel
// nicht unterscheidbar, und niemand weiß auswendig, dass die marokkanischen
// Zeiten unter „Ministère des Habous" stehen. Hier trägt jede Zeile deshalb
// den Namen der Behörde, ihre Winkel und — wenn zutreffend — den Hinweis, dass
// sie die des eigenen Landes ist. Gruppiert nach Weltregion, damit die Liste
// überflogen werden kann.

import { useMemo } from 'react';
import { Modal, Platform, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

import {
  METHOD_REGION_ORDER,
  PRAYER_METHODS,
  methodParamsLabel,
  type MethodLabels,
  type MethodRegionId,
  type PrayerMethod,
} from './methods';

/** Die Beschriftungen für {@link methodParamsLabel} an einer Stelle. */
export function useMethodLabels(): MethodLabels {
  const { t } = useTranslation();
  return {
    fajr: t('prayers.fajr'),
    isha: t('prayers.isha'),
    minutesAfterMaghrib: t('settings.methodParams.minutesAfterMaghrib'),
    degree: t('settings.methodParams.degree'),
    decimal: t('settings.methodParams.decimal'),
  };
}

interface Props {
  visible: boolean;
  selected: number;
  /** Vorschlag für das aktuelle Land — bekommt eine eigene Marke. */
  recommended?: number;
  /** Landesname für die Marke („Für Deutschland üblich"). */
  countryLabel?: string;
  onSelect: (id: number) => void;
  onClose: () => void;
}

export function MethodPicker({ visible, selected, recommended, countryLabel, onSelect, onClose }: Props) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const rtl = isRtlLocale(locale);
  const labels = useMethodLabels();

  const sections = useMemo(() => {
    const nachRegion = new Map<MethodRegionId, PrayerMethod[]>();
    for (const m of PRAYER_METHODS) {
      const liste = nachRegion.get(m.region);
      if (liste) liste.push(m);
      else nachRegion.set(m.region, [m]);
    }
    return METHOD_REGION_ORDER.filter((r) => nachRegion.has(r)).map((r) => ({
      title: t(`settings.methodRegions.${r}`),
      data: nachRegion.get(r) ?? [],
    }));
  }, [t]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet} accessibilityViewIsModal importantForAccessibility="yes">
          <SafeAreaView style={styles.safe}>
            <View style={[styles.header, rtl && styles.headerRtl]}>
              <ThemedText type="subtitle">{t('settings.method')}</ThemedText>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
                <ThemedText
                  type="link"
                  themeColor="accent"
                  style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                  {t('common.done')}
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={[styles.hint, rtl && styles.textRtl]}>
              {t('settings.methodPickerHint')}
            </ThemedText>
            <SectionList
              sections={sections}
              keyExtractor={(m) => String(m.id)}
              style={styles.list}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  accessibilityRole="header"
                  style={[styles.sectionTitle, rtl && styles.textRtl]}>
                  {section.title}
                </ThemedText>
              )}
              renderItem={({ item }) => {
                const istGewaehlt = item.id === selected;
                const istEmpfohlen = item.id === recommended;
                return (
                  <Pressable
                    onPress={() => onSelect(item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: istGewaehlt }}
                    accessibilityLabel={[
                      item.name,
                      methodParamsLabel(item, labels),
                      istEmpfohlen && countryLabel
                        ? t('settings.methodForCountry').replace('{country}', countryLabel)
                        : '',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    style={({ pressed }) => [
                      styles.row,
                      { borderBottomColor: theme.separator },
                      rtl && styles.rowRtl,
                      pressed && styles.pressed,
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                    ]}>
                    <View style={styles.rowMain}>
                      {/* Die Auswahl trägt NUR das Häkchen — Fettung zusätzlich
                          wäre die dritte Kodierung derselben Information
                          (components/ui/list.tsx, Design-Audit 2026-07-29). */}
                      <ThemedText type="default" style={rtl && styles.textRtl}>
                        {item.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                        {methodParamsLabel(item, labels)}
                      </ThemedText>
                      {istEmpfohlen && countryLabel ? (
                        <ThemedText type="small" themeColor="accent" style={rtl && styles.textRtl}>
                          {t('settings.methodForCountry').replace('{country}', countryLabel)}
                        </ThemedText>
                      ) : null}
                    </View>
                    {istGewaehlt ? (
                      <ThemedText type="default" themeColor="accent">
                        ✓
                      </ThemedText>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </SafeAreaView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  safe: { flexShrink: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.four,
    paddingBottom: Spacing.two,
  },
  headerRtl: { flexDirection: 'row-reverse' },
  hint: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  list: { paddingHorizontal: Spacing.four },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.6, paddingTop: Spacing.four, paddingBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  rowMain: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  pressableWeb: { cursor: 'pointer' },
});
