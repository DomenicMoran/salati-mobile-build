// „Nach meiner Moschee ausrichten" — der Aushang der eigenen Gemeinde wird zur
// Einstellung.
//
// Das ist die ehrlichste Antwort auf „welche Methode ist die richtige?":
// keine. Richtig ist die, nach der die eigene Gemeinde betet. Bisher konnte man
// die nur durch Ausprobieren finden — 23 Behörden × 2 Asr-Schulen × 4
// Hochbreiten-Regeln, und danach blieben immer noch Minuten übrig. Hier tippt
// der Nutzer die Zeiten EINES Tages ab; die Suche (features/prayer-times/
// mosque-match.ts) findet die Kombination mit der kleinsten Abweichung und legt
// den Rest in die Minuten-Korrektur.
import { useMemo, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionRow, ListCard, ListSection, ValueRow } from '@/components/ui/list';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchTimingsByCoords } from '@/features/prayer-times/api';
import {
  hatEingaben,
  matchMosqueTimes,
  refineOffsets,
  type MosqueMatch,
  type MosqueTimesInput,
} from '@/features/prayer-times/mosque-match';
import { useMethodLabels } from '@/features/settings/MethodPicker';
import { methodName, methodParamsLabel, methodById } from '@/features/settings/methods';
import { useSettings } from '@/features/settings/store';
import { NO_PRAYER_TIME_OFFSETS } from '@/features/settings/types';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

const FELDER = [
  { id: 'fajr', labelKey: 'prayers.fajr' },
  { id: 'sunrise', labelKey: 'settings.timeAdjust.sunrise' },
  { id: 'dhuhr', labelKey: 'prayers.dhuhr' },
  { id: 'asr', labelKey: 'prayers.asr' },
  { id: 'maghrib', labelKey: 'prayers.maghrib' },
  { id: 'isha', labelKey: 'prayers.isha' },
] as const;

/** Ab dieser Restabweichung stimmt etwas Grundsätzliches nicht (falscher Ort,
 * Iqama- statt Adhan-Zeiten). Dann warnt der Screen, statt so zu tun, als sei
 * das Ergebnis brauchbar. */
const WARNSCHWELLE_MINUTEN = 20;

export default function PrayerTimesMosqueScreen() {
  const { t, locale } = useTranslation();
  const { settings, update } = useSettings();
  const theme = useTheme();
  const rtl = isRtlLocale(locale);
  const labels = useMethodLabels();

  const [eingabe, setEingabe] = useState<MosqueTimesInput>({});
  const [treffer, setTreffer] = useState<MosqueMatch | null>(null);
  const [sucht, setSucht] = useState(false);
  const [uebernommen, setUebernommen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const heute = useMemo(() => new Date(), []);
  const datumsText = useMemo(
    () => heute.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' }),
    [heute, locale],
  );

  function feldGeaendert(id: keyof MosqueTimesInput, wert: string) {
    setEingabe((v) => ({ ...v, [id]: wert }));
    setTreffer(null);
    setUebernommen(false);
    setFehler(null);
  }

  async function suchen() {
    Keyboard.dismiss();
    if (!hatEingaben(eingabe)) {
      setFehler(t('mosqueMatch.needInput'));
      setTreffer(null);
      return;
    }
    const { lat, lon } = settings.location;
    const ergebnis = matchMosqueTimes(eingabe, lat, lon, heute);
    setFehler(null);
    setUebernommen(false);
    if (!ergebnis) {
      setTreffer(null);
      return;
    }
    // Die Suche lief lokal (184 Kombinationen). Angezeigt werden aber die
    // API-Zeiten, sobald Netz da ist — die Korrektur muss deshalb gegen genau
    // die nachgerechnet werden, sonst liegt sie um bis zu eine Minute daneben
    // (Begründung in refineOffsets). Eine einzige Anfrage, die Methode steht
    // ja schon fest; ohne Netz bleibt es beim lokalen Ergebnis.
    setSucht(true);
    setTreffer(ergebnis);
    try {
      const antwort = await fetchTimingsByCoords(lat, lon, heute, {
        method: ergebnis.method,
        school: ergebnis.school,
        highLatitude: ergebnis.highLatitude,
        offsets: NO_PRAYER_TIME_OFFSETS,
      });
      if (antwort && !antwort.degenerate) setTreffer(refineOffsets(ergebnis, eingabe, antwort.timings));
    } catch {
      // Kein Netz — das lokale Ergebnis steht bereits und ist dann das richtige.
    } finally {
      setSucht(false);
    }
  }

  async function uebernehmen() {
    if (!treffer) return;
    await update({
      method: treffer.method,
      school: treffer.school,
      highLatitudeRule: treffer.highLatitude,
      prayerTimeOffsets: treffer.offsets,
    });
    setUebernommen(true);
  }

  const methode = treffer ? methodById(treffer.method) : undefined;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('mosqueMatch.title')} subtitle={t('mosqueMatch.subtitle')} align="left" />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <View style={styles.inner}>
            <ListSection footer={t('mosqueMatch.introFooter')}>
              <ListCard>
                <ValueRow label={t('settings.location')} value={settings.location.label} />
                <ValueRow label={t('mosqueMatch.forDate')} value={datumsText} />
              </ListCard>
            </ListSection>

            <ListSection title={t('mosqueMatch.enterTitle')} footer={t('mosqueMatch.enterFooter')}>
              <ListCard>
                {FELDER.map((feld) => (
                  <View key={feld.id} style={[styles.zeile, rtl && styles.zeileRtl]}>
                    <ThemedText type="default" style={[styles.zeilenLabel, rtl && styles.textRtl]}>
                      {t(feld.labelKey)}
                    </ThemedText>
                    <TextInput
                      value={eingabe[feld.id] ?? ''}
                      onChangeText={(v) => feldGeaendert(feld.id, v)}
                      placeholder={t('mosqueMatch.placeholder')}
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numbers-and-punctuation"
                      inputMode="text"
                      maxLength={5}
                      accessibilityLabel={`${t(feld.labelKey)} — ${t('mosqueMatch.placeholder')}`}
                      style={[styles.feld, { color: theme.text, borderColor: theme.separator }]}
                    />
                  </View>
                ))}
              </ListCard>
            </ListSection>

            <ListSection footer={fehler ?? undefined}>
              <ListCard>
                <ActionRow label={t('mosqueMatch.search')} onPress={suchen} busy={sucht} />
              </ListCard>
            </ListSection>

            {treffer ? (
              <ListSection
                title={t('mosqueMatch.resultTitle')}
                footer={
                  treffer.maxAbweichung > WARNSCHWELLE_MINUTEN
                    ? t('mosqueMatch.resultWarn')
                    : treffer.ohneKorrekturBrauchbar
                      ? t('mosqueMatch.resultExact')
                      : t('mosqueMatch.resultAdjusted')
                }>
                <ListCard>
                  <ValueRow label={t('settings.method')} value={methodName(treffer.method)} />
                  {methode ? (
                    <ValueRow label={t('mosqueMatch.resultAngles')} value={methodParamsLabel(methode, labels)} />
                  ) : null}
                  <ValueRow
                    label={t('settings.asrSchool')}
                    value={treffer.school === 1 ? t('settings.asrLater') : t('settings.asrEarlier')}
                  />
                  <ValueRow
                    label={t('settings.highLatitude.title')}
                    value={t(`settings.highLatitude.${treffer.highLatitude}`)}
                  />
                  <ValueRow
                    label={t('settings.timeAdjust.title')}
                    value={korrekturText(treffer, (key) => t(key), t('settings.timeAdjust.minutesShort'))}
                  />
                  <ValueRow
                    label={t('mosqueMatch.deviation')}
                    value={`${String(treffer.schnittAbweichung).replace('.', labels.decimal)} ${t('settings.timeAdjust.minutesShort')}`}
                  />
                </ListCard>
              </ListSection>
            ) : null}

            {treffer ? (
              <ListSection footer={uebernommen ? t('mosqueMatch.applied') : t('mosqueMatch.applyFooter')}>
                <ListCard>
                  <ActionRow
                    label={uebernommen ? t('mosqueMatch.appliedShort') : t('mosqueMatch.apply')}
                    onPress={uebernehmen}
                    disabled={uebernommen}
                  />
                </ListCard>
              </ListSection>
            ) : null}

            <ListSection title={t('mosqueMatch.whyTitle')}>
              <ListCard>
                <View style={styles.absatz}>
                  <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                    {t('mosqueMatch.whyText')}
                  </ThemedText>
                </View>
              </ListCard>
            </ListSection>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * „Fadschr +2, Ischa −3 Min." — MIT dem Namen des Gebets. Eine reine Zahlenreihe
 * („+1, −1, +1") verrät nicht, welche Zeit verschoben wird, und genau das will
 * man vor dem Übernehmen wissen.
 */
function korrekturText(treffer: MosqueMatch, t: (key: string) => string, minuten: string): string {
  const teile = FELDER.filter((f) => treffer.offsets[f.id] !== 0).map((f) => {
    const wert = treffer.offsets[f.id];
    return `${t(f.labelKey)} ${wert > 0 ? '+' : '−'}${Math.abs(wert)}`;
  });
  return teile.length === 0 ? t('mosqueMatch.noAdjust') : `${teile.join(', ')} ${minuten}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingBottom: Spacing.six },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  zeileRtl: { flexDirection: 'row-reverse' },
  zeilenLabel: { flex: 1 },
  feld: {
    minWidth: 92,
    textAlign: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
  },
  absatz: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
});
