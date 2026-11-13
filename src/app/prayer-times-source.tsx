// „Woher deine Gebetszeiten kommen" — der Erklär- und Quellen-Bildschirm.
//
// ANLASS: Die App traf bisher eine Reihe fachlicher Entscheidungen (Behörde,
// Asr-Schattenlänge, Hochbreiten-Regel), von denen der Nutzer keine sah. Wenn
// die Zeiten dann nicht zum Aushang der Moschee passten, blieb ihm nur
// „stimmt nicht". Dieser Bildschirm legt alles offen: welche Stelle die Zeiten
// herausgibt, mit welchen Winkeln, was gerade eingestellt ist — und die drei
// Wege, die eigenen Zeiten zu treffen.
//
// Alle Zahlen kommen aus dem Katalog (features/settings/methods.ts), kein Text
// wiederholt sie als Prosa: sonst stimmt die Erklärung eines Tages nicht mehr
// mit der Rechnung überein.
import { router } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionRow, ListCard, ListSection, NavRow, ValueRow } from '@/components/ui/list';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { recommendMethod } from '@/features/prayer-times/method-country';
import { useMethodLabels } from '@/features/settings/MethodPicker';
import { methodById, methodName, methodParamsLabel } from '@/features/settings/methods';
import { useSettings } from '@/features/settings/store';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

/**
 * Die Belege, die für JEDE Einstellung gelten. Die Quelle der gerade gewählten
 * Behörde kommt aus dem Katalog dazu — sie ist die wichtigste und steht oben.
 */
const QUELLEN = [
  { key: 'aladhan', url: 'https://aladhan.com/calculation-methods' },
  { key: 'adhan', url: 'https://github.com/batoulapps/adhan-js' },
  { key: 'diyanet', url: 'https://vakithesaplama.diyanet.gov.tr/temkin.php' },
  { key: 'moonsighting', url: 'https://www.moonsighting.com/how-we.html' },
  { key: 'highLat', url: 'https://www.e-cfr.org' },
] as const;

function oeffne(url: string) {
  Linking.openURL(url).catch(() => {});
}

export default function PrayerTimesSourceScreen() {
  const { t, locale } = useTranslation();
  const { settings, update } = useSettings();
  const rtl = isRtlLocale(locale);
  const labels = useMethodLabels();

  const methode = methodById(settings.method);
  const empfehlung = recommendMethod(settings.location.country);
  const empfohlene = methodById(empfehlung.methodId);
  const weichtAb = empfehlung.basis === 'country' && empfehlung.methodId !== settings.method;

  const korrekturen = Object.values(settings.prayerTimeOffsets).filter((v) => v !== 0).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('prayerSource.title')} subtitle={t('prayerSource.subtitle')} align="left" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.inner}>
            <Absatz text={t('prayerSource.intro')} rtl={rtl} />

            {/* Was gerade gilt — vor jeder Erklärung, denn das ist die Frage,
                mit der man diesen Bildschirm öffnet. */}
            <ListSection title={t('prayerSource.currentTitle')} footer={t('prayerSource.currentFooter')}>
              <ListCard>
                <ValueRow label={t('settings.location')} value={settings.location.label} />
                <ValueRow label={t('settings.method')} value={methodName(settings.method)} />
                {methode ? (
                  <ValueRow label={t('prayerSource.angles')} value={methodParamsLabel(methode, labels)} />
                ) : null}
                <ValueRow
                  label={t('settings.asrSchool')}
                  value={settings.school === 1 ? t('settings.asrLater') : t('settings.asrEarlier')}
                />
                <ValueRow
                  label={t('settings.highLatitude.title')}
                  value={t(`settings.highLatitude.${settings.highLatitudeRule}`)}
                />
                <ValueRow
                  label={t('settings.timeAdjust.title')}
                  value={
                    korrekturen === 0
                      ? t('prayerSource.noAdjust')
                      : t('prayerSource.adjustCount').replace('{n}', String(korrekturen))
                  }
                />
              </ListCard>
            </ListSection>

            {weichtAb && empfohlene ? (
              <ListSection
                title={t('prayerSource.countryTitle')}
                footer={t('prayerSource.countryFooter')
                  .replace('{country}', settings.location.label)
                  .replace('{method}', empfohlene.name)}>
                <ListCard>
                  {/* Aktionszeile statt Verweis in die Einstellungen: der
                      Hinweis nennt die Behörde, also soll ein Tipp sie auch
                      setzen — sonst müsste der Nutzer sie dort aus 23
                      Einträgen wiederfinden. */}
                  <ActionRow
                    label={t('settings.methodCountryApply').replace('{method}', empfohlene.shortName)}
                    onPress={() => update({ method: empfohlene.id })}
                  />
                </ListCard>
              </ListSection>
            ) : null}

            {/* Die drei Wege zu den eigenen Zeiten — die eigentliche Antwort
                auf „warum stimmen meine Zeiten nicht?". */}
            <ListSection title={t('prayerSource.howTitle')}>
              <ListCard>
                <NavRow
                  label={t('prayerSource.howMosque')}
                  hint={t('prayerSource.howMosqueHint')}
                  onPress={() => router.push('/prayer-times-mosque')}
                />
                <NavRow
                  label={t('prayerSource.howSettings')}
                  hint={t('prayerSource.howSettingsHint')}
                  onPress={() => router.push('/settings')}
                />
                <NavRow
                  label={t('prayerSource.howMosques')}
                  hint={t('prayerSource.howMosquesHint')}
                  onPress={() => router.push('/mosques')}
                />
              </ListCard>
            </ListSection>

            <Erklaerung titel={t('prayerSource.dataTitle')} text={t('prayerSource.dataText')} rtl={rtl} />
            <Erklaerung titel={t('prayerSource.methodTitle')} text={t('prayerSource.methodText')} rtl={rtl} />
            <Erklaerung titel={t('prayerSource.asrTitle')} text={t('prayerSource.asrText')} rtl={rtl} />
            <Erklaerung titel={t('prayerSource.highLatTitle')} text={t('prayerSource.highLatText')} rtl={rtl} />

            <ListSection title={t('prayerSource.sourcesTitle')} footer={t('prayerSource.sourcesFooter')}>
              <ListCard>
                {methode ? (
                  <NavRow
                    label={methode.name}
                    hint={methode.source.replace('https://', '')}
                    onPress={() => oeffne(methode.source)}
                  />
                ) : null}
                {QUELLEN.map((q) => (
                  <NavRow
                    key={q.key}
                    label={t(`prayerSource.sources.${q.key}`)}
                    hint={q.url.replace('https://', '')}
                    onPress={() => oeffne(q.url)}
                  />
                ))}
              </ListCard>
            </ListSection>

            <Absatz text={t('agb.religiousContentText')} rtl={rtl} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Absatz({ text, rtl }: { text: string; rtl: boolean }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={[styles.absatz, rtl && styles.textRtl]}>
      {text}
    </ThemedText>
  );
}

function Erklaerung({ titel, text, rtl }: { titel: string; text: string; rtl: boolean }) {
  return (
    <View style={styles.erklaerung}>
      <ThemedText type="smallBold" accessibilityRole="header" style={rtl && styles.textRtl}>
        {titel}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingBottom: Spacing.six },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four },
  absatz: { paddingVertical: Spacing.three },
  erklaerung: { paddingVertical: Spacing.three, gap: Spacing.one },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
});
