// Eine aufgedeckte Antwort-Zeile: eigene Antwort gegen Korpusbefund, richtig
// oder falsch erkennbar über Zeichen UND Text (nicht nur Farbe, s.
// Aufgabenstellung), plus Begründung. `bewertung` ist hier absichtlich nie
// 'nichtBewertet' — diese Dimension wurde erst gar nicht gestellt (s.
// modell.ts aktiveDimensionen()).
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

import { Fachbegriff } from '../analyse/Fachbegriff';
import type { Begriff } from './anzeige';

export interface ErgebnisZeileProps {
  titel: string;
  titelAr?: string;
  richtig: boolean;
  deineAntwort: Begriff;
  /** Nur nötig (und übergeben), wenn `richtig` false ist. */
  korrekt?: Begriff;
  info: string;
}

export function ErgebnisZeile({ titel, titelAr, richtig, deineAntwort, korrekt, info }: ErgebnisZeileProps) {
  const rtl = useRtl();
  const { t } = useTranslation();

  return (
    <View style={[styles.zeile, rtl && styles.zeileRtl, richtig ? styles.zeileRichtig : styles.zeileFalsch]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={rtl && styles.textRtl}>
        <Fachbegriff text={titel} ar={titelAr} />
      </ThemedText>
      <View style={[styles.antwortZeile, rtl && styles.antwortZeileRtl]}>
        <ThemedText type="default" style={rtl && styles.textRtl}>
          {t('analyseUebung.exercise.deineAntwort')}: <Fachbegriff text={deineAntwort.name} ar={deineAntwort.ar} />
        </ThemedText>
        <ThemedText type="smallBold" themeColor={richtig ? 'accent' : 'text'} style={richtig ? styles.markeRichtig : styles.markeFalsch}>
          {richtig ? `✓ ${t('analyseUebung.exercise.richtig')}` : `✗ ${t('analyseUebung.exercise.falsch')}`}
        </ThemedText>
      </View>
      {!richtig && korrekt ? (
        <ThemedText type="default" style={rtl && styles.textRtl}>
          {t('analyseUebung.exercise.richtigWaere')}: <Fachbegriff text={korrekt.name} ar={korrekt.ar} />
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
        {info}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  zeile: { gap: Spacing.one, paddingVertical: Spacing.two, borderLeftWidth: 3, paddingLeft: Spacing.two },
  // Manuelles Kippen statt logischer start/end-Werte: die App nutzt
  // I18nManager.forceRTL() bewusst nicht (s. hooks/use-rtl.ts) — RN-Logical-
  // Properties würden also NICHT automatisch kippen.
  zeileRtl: { borderLeftWidth: 0, borderRightWidth: 3, paddingLeft: 0, paddingRight: Spacing.two },
  zeileRichtig: { borderLeftColor: 'rgba(74,222,128,0.7)', borderRightColor: 'rgba(74,222,128,0.7)' },
  zeileFalsch: { borderLeftColor: 'rgba(248,113,113,0.7)', borderRightColor: 'rgba(248,113,113,0.7)' },
  antwortZeile: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  antwortZeileRtl: { flexDirection: 'row-reverse' },
  markeRichtig: { color: '#2f9e57' },
  markeFalsch: { color: '#d1453b' },
  textRtl: { textAlign: 'right' },
});
