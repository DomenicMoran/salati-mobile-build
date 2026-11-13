// Freier Gregorianisch<->Hijri-Datumsumrechner (nicht nur das aktuelle Datum
// wie calendar.tsx). Nutzt dieselbe Aladhan-API + denselben Offline-Fallback
// wie der bestehende Kalender-Screen (features/calendar), keine eigene
// Umrechnungs-Logik. Kein natives Datums-Picker-Widget nötig — Steppers
// (gleiches Muster wie zakat-fitr.tsx) genügen für Tag/Monat/Jahr und
// brauchen keinen neuen nativen Build.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { parseGregorianInput, parseHijriInput, type DateInputError } from '@/features/calendar/dateInput';
import { useGregorianToHijri, useHijriToGregorian } from '@/features/calendar/hooks';
import { gregorianToHijriOffline, hijriToGregorianOffline, HIJRI_MONTHS, type HijriYMD } from '@/features/calendar/offline';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

type Mode = 'gToH' | 'hToG';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
}) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const numeric = parseInt(value, 10);
  const current = Number.isFinite(numeric) ? numeric : min;

  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.stepperControls}>
        <Pressable
          onPress={() => onChange(String(clamp(current - 1, min, max)))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${t('a11y.decrease')}: ${label}`}
          style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperPressed]}>
          <IconSymbol name="remove-circle-outline" size={24} color={colors.accent} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={(txt) => onChange(txt.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          accessibilityLabel={label}
          style={[styles.numberInput, { color: colors.text }]}
        />
        <Pressable
          onPress={() => onChange(String(clamp(current + 1, min, max)))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${t('a11y.increase')}: ${label}`}
          style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperPressed]}>
          <IconSymbol name="add-circle-outline" size={24} color={colors.accent} />
        </Pressable>
      </ThemedView>
    </View>
  );
}

export default function HijriConverterScreen() {
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const hijriMonths = HIJRI_MONTHS[locale];

  const [mode, setMode] = useState<Mode>('gToH');

  const today = useMemo(() => new Date(), []);
  const todayHijri = useMemo(() => gregorianToHijriOffline(today), [today]);

  // Gregorianische Eingabe
  const [gDay, setGDay] = useState(String(today.getDate()));
  const [gMonth, setGMonth] = useState(String(today.getMonth() + 1));
  const [gYear, setGYear] = useState(String(today.getFullYear()));

  // Hijri-Eingabe — vorbelegt mit dem heutigen Hijri-Datum (Offline-Schätzung
  // als Startwert, der Nutzer ändert es meist ohnehin sofort).
  const [hDay, setHDay] = useState(String(todayHijri.day));
  const [hMonth, setHMonth] = useState(String(todayHijri.month));
  const [hYear, setHYear] = useState(String(todayHijri.year));

  // Audit 2026-07-27 (M21): Prüfung liegt jetzt in features/calendar/dateInput
  // (rein und testbar) und liefert einen BENANNTEN Grund — vorher fiel jede
  // ungültige Eingabe stumm auf „—" zurück.
  const gParsed = useMemo(() => parseGregorianInput(gDay, gMonth, gYear), [gDay, gMonth, gYear]);
  const hParsed = useMemo(() => parseHijriInput(hDay, hMonth, hYear), [hDay, hMonth, hYear]);
  const gDate = gParsed.ok ? gParsed.value : null;
  const hValid = hParsed.ok;
  const hDayNum = hParsed.ok ? hParsed.value.day : 0;
  const hMonthNum = hParsed.ok ? hParsed.value.month : 0;
  const hYearNum = hParsed.ok ? hParsed.value.year : 0;
  // Der eingegebene Monat soll auch dann benannt werden, wenn Tag/Jahr noch
  // unfertig sind — sonst verschwindet der Monatsname beim Tippen.
  const hMonthPreview = parseInt(hMonth, 10);

  const inputError: DateInputError | null =
    mode === 'gToH' ? (gParsed.ok ? null : gParsed.error) : hParsed.ok ? null : hParsed.error;
  const inputErrorText = inputError ? t(`hijriConverter.error.${inputError}`) : null;

  const gToHQuery = useGregorianToHijri(gDate ?? today, gDate !== null && mode === 'gToH');
  // Nur mit geprüfter Eingabe abrufen — vorher ging bei ungültigen Feldern
  // ein Request mit NaN an die API (Antwort dann zwangsläufig unbrauchbar).
  const hToGQuery = useHijriToGregorian(hDayNum, hMonthNum, hYearNum, hValid && mode === 'hToG');

  const gToHResult: (HijriYMD & { offline: boolean }) | null = useMemo(() => {
    if (!gDate) return null;
    if (gToHQuery.data) {
      return {
        day: Number(gToHQuery.data.hijri.day),
        month: gToHQuery.data.hijri.month.number,
        year: Number(gToHQuery.data.hijri.year),
        offline: false,
      };
    }
    if (gToHQuery.isError) {
      return { ...gregorianToHijriOffline(gDate), offline: true };
    }
    return null;
  }, [gDate, gToHQuery.data, gToHQuery.isError]);

  const hToGResult: { day: number; month: number; year: number; offline: boolean } | null = useMemo(() => {
    if (!hValid) return null;
    if (hToGQuery.data) {
      const g = hToGQuery.data.gregorian;
      return { day: Number(g.day), month: g.month.number, year: Number(g.year), offline: false };
    }
    if (hToGQuery.isError) {
      const d = hijriToGregorianOffline({ day: hDayNum, month: hMonthNum, year: hYearNum });
      return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(), offline: true };
    }
    return null;
  }, [hValid, hDayNum, hMonthNum, hYearNum, hToGQuery.data, hToGQuery.isError]);

  const gLoading = mode === 'gToH' && !!gDate && gToHQuery.isLoading;
  const hLoading = mode === 'hToG' && hValid && hToGQuery.isLoading;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('hijriConverter.title')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('hijriConverter.subtitle')}
          </ThemedText>

          <AnimatedListItem index={0}>
            <View style={[styles.modeRow, rtl && styles.modeRowRtl]}>
              <Pressable
                onPress={() => setMode('gToH')}
                accessibilityRole="button"
                style={{ flex: 1 }}>
                <ThemedView type={mode === 'gToH' ? 'backgroundSelected' : 'backgroundElement'} style={styles.modeChip}>
                  <ThemedText type="smallBold" themeColor={mode === 'gToH' ? 'accent' : 'text'}>
                    {t('hijriConverter.modeGregorianToHijri')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setMode('hToG')}
                accessibilityRole="button"
                style={{ flex: 1 }}>
                <ThemedView type={mode === 'hToG' ? 'backgroundSelected' : 'backgroundElement'} style={styles.modeChip}>
                  <ThemedText type="smallBold" themeColor={mode === 'hToG' ? 'accent' : 'text'}>
                    {t('hijriConverter.modeHijriToGregorian')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </View>
          </AnimatedListItem>

          {mode === 'gToH' ? (
            <AnimatedListItem index={1}>
              <ThemedView type="backgroundElement" style={styles.section}>
                <ThemedText type="smallBold" style={rtl && styles.rtlText}>
                  {t('hijriConverter.gregorianDate')}
                </ThemedText>
                <View style={styles.fieldRow}>
                  <NumberField label={t('hijriConverter.day')} value={gDay} onChange={setGDay} min={1} max={31} />
                  <NumberField label={t('hijriConverter.month')} value={gMonth} onChange={setGMonth} min={1} max={12} />
                  <NumberField label={t('hijriConverter.year')} value={gYear} onChange={setGYear} min={1} max={9999} />
                </View>
              </ThemedView>
            </AnimatedListItem>
          ) : (
            <AnimatedListItem index={1}>
              <ThemedView type="backgroundElement" style={styles.section}>
                <ThemedText type="smallBold" style={rtl && styles.rtlText}>
                  {t('hijriConverter.hijriDate')}
                </ThemedText>
                <View style={styles.fieldRow}>
                  <NumberField label={t('hijriConverter.day')} value={hDay} onChange={setHDay} min={1} max={30} />
                  <NumberField label={t('hijriConverter.month')} value={hMonth} onChange={setHMonth} min={1} max={12} />
                  <NumberField label={t('hijriConverter.year')} value={hYear} onChange={setHYear} min={1} max={9999} />
                </View>
                {Number.isInteger(hMonthPreview) && hMonthPreview >= 1 && hMonthPreview <= 12 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {hijriMonths[hMonthPreview - 1]}
                  </ThemedText>
                )}
              </ThemedView>
            </AnimatedListItem>
          )}

          <AnimatedListItem index={2}>
            <ThemedView type="backgroundSelected" style={styles.resultCard}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('hijriConverter.result')}
              </ThemedText>
              {/* Audit 2026-07-27 (M21): statt eines nichtssagenden „—" steht
                  hier jetzt der Grund. Der Gedankenstrich bleibt nur für den
                  einen Fall, in dem es wirklich nichts zu sagen gibt: Eingabe
                  gültig, Ergebnis noch nicht da (weder Abruf noch Fehler). */}
              {inputErrorText ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
                  {inputErrorText}
                </ThemedText>
              ) : mode === 'gToH' ? (
                gLoading ? (
                  <ThemedActivityIndicator />
                ) : gToHResult ? (
                  <ThemedText style={styles.resultText}>
                    {gToHResult.day} {hijriMonths[gToHResult.month - 1]} {gToHResult.year} {t('calendar.hijriSuffix')}
                  </ThemedText>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    —
                  </ThemedText>
                )
              ) : hLoading ? (
                <ThemedActivityIndicator />
              ) : hToGResult ? (
                <ThemedText style={styles.resultText}>
                  {hToGResult.day}. {t(`calendar.months.${hToGResult.month}`)} {hToGResult.year}
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  —
                </ThemedText>
              )}
              {((mode === 'gToH' && gToHResult?.offline) || (mode === 'hToG' && hToGResult?.offline)) && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.offlineNotice}>
                  {t('hijriConverter.offlineNotice')}
                </ThemedText>
              )}
            </ThemedView>
          </AnimatedListItem>

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('hijriConverter.disclaimer')}
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
  subtitle: { textAlign: 'center', paddingHorizontal: Spacing.four },
  rtlText: { textAlign: 'right' },
  modeRow: { flexDirection: 'row', gap: Spacing.two },
  modeRowRtl: { flexDirection: 'row-reverse' },
  modeChip: { borderRadius: Spacing.three, padding: Spacing.two, alignItems: 'center' },
  section: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  fieldRow: { flexDirection: 'row', gap: Spacing.two },
  field: { flex: 1, gap: Spacing.one },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  stepperButton: { padding: Spacing.half },
  stepperPressed: { opacity: 0.6 },
  numberInput: { flex: 1, textAlign: 'center', paddingVertical: Spacing.two, fontSize: 16 },
  resultCard: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.one, alignItems: 'center' },
  resultText: { fontSize: 24, lineHeight: 32, fontWeight: '700', textAlign: 'center' },
  errorText: { textAlign: 'center' },
  offlineNotice: { textAlign: 'center', marginTop: Spacing.one },
  note: { textAlign: 'center' },
});
