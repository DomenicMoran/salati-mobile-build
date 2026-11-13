import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedSwitch } from '@/components/ui/themed-switch';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  NISAB_GOLD_GRAMS,
  REFERENCE_GOLD_PRICE_PER_GRAM,
  ZAKAT_CURRENCIES,
  ZAKAT_RATE,
  calcZakat,
  parseAmount,
} from '@/features/zakat/calc';
import { nextZakatDueDate, useZakatReminder } from '@/features/zakat/reminder';
import { useGoldPrice } from '@/features/zakat/useGoldPrice';
import { requestNotificationPermission } from '@/features/prayer-times/notifications';
import { useSettings } from '@/features/settings/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { hapticLight } from '@/lib/haptics';
import { useTranslation } from '@/lib/i18n';

interface FieldDef {
  key: 'cash' | 'goldValue' | 'silverValue' | 'businessAssets' | 'debts' | 'goldPricePerGram';
  labelKey: string;
}

const FIELDS: FieldDef[] = [
  { key: 'cash', labelKey: 'zakat.cash' },
  { key: 'goldValue', labelKey: 'zakat.gold' },
  { key: 'silverValue', labelKey: 'zakat.silver' },
  { key: 'businessAssets', labelKey: 'zakat.business' },
  { key: 'debts', labelKey: 'zakat.debts' },
  { key: 'goldPricePerGram', labelKey: 'zakat.goldPrice' },
];

export default function ZakatScreen() {
  const { t, locale } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>({});
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { anchor, enabled, setAnchorToday, setEnabled } = useZakatReminder(locale);
  const { settings, update } = useSettings();
  const currency = settings.zakatCurrency;
  const { data: goldPrice } = useGoldPrice(currency);

  async function toggleReminder(next: boolean) {
    if (next && Platform.OS !== 'web') {
      const granted = await requestNotificationPermission();
      if (!granted) return;
    }
    setEnabled(next);
  }

  const result = calcZakat({
    cash: parseAmount(values.cash ?? ''),
    goldValue: parseAmount(values.goldValue ?? ''),
    silverValue: parseAmount(values.silverValue ?? ''),
    businessAssets: parseAmount(values.businessAssets ?? ''),
    debts: parseAmount(values.debts ?? ''),
    goldPricePerGram: parseAmount(values.goldPricePerGram ?? ''),
  });

  // Leichtes Haptik nur an der Schwelle, an der ein konkretes Zakat-Ergebnis
  // NEU erscheint (aboveNisab false → true) - nicht bei jedem Tastendruck,
  // sonst würde es bei jeder Ziffer im Eingabefeld nerven.
  const wasAboveNisab = useRef(false);
  useEffect(() => {
    if (result.aboveNisab && !wasAboveNisab.current) hapticLight();
    wasAboveNisab.current = result.aboveNisab;
  }, [result.aboveNisab]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('zakat.title')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('zakat.subtitle')}
          </ThemedText>

          {/* Währungsauswahl (Mehrwährungs-Erweiterung 2026-07-21): bestimmt, in
              welcher Währung Live-/Referenz-Goldpreis vorgeschlagen werden UND in
              welcher Währung die eingegebenen Vermögenswerte implizit gemeint
              sind. Ein Wechsel leert bewusst das Goldpreis-Feld - der zuvor in
              der ALTEN Währung eingegebene/übernommene Wert wäre in der neuen
              Währung ein stiller Falschwert (echte Zakat-Pflicht-Aussage). */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.currencyLabel}>
            {t('zakat.currencyLabel')}
          </ThemedText>
          <View style={styles.currencyRow}>
            {ZAKAT_CURRENCIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  if (c === currency) return;
                  update({ zakatCurrency: c });
                  setValues((prev) => ({ ...prev, goldPricePerGram: '' }));
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: currency === c }}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView
                  type={currency === c ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.currencyChip}>
                  <ThemedText type="small" themeColor={currency === c ? 'accent' : 'text'}>
                    {c}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </View>

          {/* Zakat al-Fitr ist fachlich eine ANDERE, eigenständige Pflichtabgabe
              (Pro-Kopf-Betrag zum Ramadan-Ende, kein Nisab) - deshalb bewusst ein
              eigener Screen statt eines gemeinsamen Formulars, mit klarem Link
              statt einer stillen Vermischung beider Rechner. */}
          <Pressable
            onPress={() => router.push('/zakat-fitr')}
            accessibilityRole="button"
            style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
            <ThemedView type="backgroundElement" style={styles.fitrLinkCard}>
              <IconSymbol name="gift-outline" size={22} color={colors.accent} />
              <View style={styles.fitrLinkText}>
                <ThemedText type="smallBold">{t('zakat.fitrLinkTitle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('zakat.fitrLinkDesc')}
                </ThemedText>
              </View>
              <IconSymbol name="chevron-forward" size={20} color={colors.textSecondary} />
            </ThemedView>
          </Pressable>

          {FIELDS.map((f, i) => (
            <AnimatedListItem key={f.key} index={i}>
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(f.labelKey)}
                </ThemedText>
                <ThemedView type="backgroundElement" style={styles.inputBox}>
                  <TextInput
                    value={values[f.key] ?? ''}
                    onChangeText={(text) => setValues((prev) => ({ ...prev, [f.key]: text }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text }]}
                  />
                </ThemedView>
                {/* Vorschlag statt stillem Default (Audit D6 + 2026-07-20): Default 0
                    ließ den Rechner irreführend mit "keine Zakat fällig" starten.
                    Live-Kurs bevorzugt (price.ts: gold-api.com + frankfurter.app),
                    nur ohne jeden je erfolgreichen Live-Preis (nie online gewesen)
                    fällt der Vorschlag auf die statische Referenz zurück - beides
                    ist ein ANGEBOT, nie eine stille Vorbelegung. */}
                {f.key === 'goldPricePerGram' && !(values.goldPricePerGram ?? '').trim() && (
                  <Pressable
                    onPress={() =>
                      setValues((prev) => ({
                        ...prev,
                        goldPricePerGram: String(
                          goldPrice ? goldPrice.pricePerGram.toFixed(2) : REFERENCE_GOLD_PRICE_PER_GRAM[currency],
                        ),
                      }))
                    }
                    accessibilityRole="button"
                    style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                    <ThemedText type="small" themeColor="accent">
                      {goldPrice
                        ? t('zakat.goldPriceLive')
                            .replace('{price}', goldPrice.pricePerGram.toFixed(2))
                            .replace('{currency}', currency)
                            .replace('{date}', new Date(goldPrice.fetchedAt).toLocaleDateString(locale))
                        : t('zakat.goldPriceRef')
                            .replace('{price}', String(REFERENCE_GOLD_PRICE_PER_GRAM[currency]))
                            .replace('{currency}', currency)}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </AnimatedListItem>
          ))}

          <AnimatedListItem index={FIELDS.length}>
            <ThemedView type="backgroundSelected" style={styles.resultCard}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('zakat.base')}: {result.base.toFixed(2)} {currency} · {t('zakat.nisab')} ({NISAB_GOLD_GRAMS} g):{' '}
                {result.nisab.toFixed(2)} {currency}
              </ThemedText>
              {result.priceMissing ? (
                <ThemedText type="default">{t('zakat.priceMissing')}</ThemedText>
              ) : result.aboveNisab ? (
                <>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('zakat.due')} ({ZAKAT_RATE * 100} %)
                  </ThemedText>
                  <ThemedText style={styles.dueAmount}>
                    {result.due.toFixed(2)} {currency}
                  </ThemedText>
                </>
              ) : (
                <ThemedText type="default">{t('zakat.belowNisab')}</ThemedText>
              )}
            </ThemedView>
          </AnimatedListItem>

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('zakat.note')}
          </ThemedText>

          {Platform.OS !== 'web' && (
            <AnimatedListItem index={FIELDS.length + 1}>
              <ThemedView type="backgroundElement" style={styles.reminderCard}>
                <View style={styles.reminderRow}>
                  <View style={styles.reminderText}>
                    <ThemedText type="smallBold">{t('zakat.reminder.title')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('zakat.reminder.desc')}
                    </ThemedText>
                  </View>
                  <ThemedSwitch value={enabled} onValueChange={toggleReminder} />
                </View>
                {enabled && (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      {anchor
                        ? t('zakat.reminder.due').replace(
                            '{date}',
                            nextZakatDueDate(anchor, new Date()).toLocaleDateString(locale),
                          )
                        : t('zakat.reminder.noAnchor')}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      themeColor="accent"
                      onPress={setAnchorToday}
                      style={styles.setAnchorLink}>
                      {t('zakat.reminder.setToday')}
                    </ThemedText>
                  </>
                )}
              </ThemedView>
            </AnimatedListItem>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  pressableWeb: { cursor: 'pointer' },
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: { paddingTop: Spacing.three, paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two, paddingHorizontal: Spacing.four },
  currencyLabel: { textAlign: 'center' },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  currencyChip: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  fitrLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  fitrLinkText: { flex: 1, gap: Spacing.half },
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
  dueAmount: { fontSize: 40, lineHeight: 52, fontWeight: '700' },
  note: { textAlign: 'center', marginTop: Spacing.two },
  reminderCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.two },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  reminderText: { flex: 1, gap: Spacing.half },
  setAnchorLink: { textDecorationLine: 'underline' },
});
