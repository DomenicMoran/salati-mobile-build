// Ergebnis-Bildschirm der Analyse-Übung: Trefferquote + Liste der falsch
// zugeordneten Wörter mit Begründung, je mit Sprung in den Reader (Vers) bzw.
// ins Lexikon (Wurzel). 'nichtBewertet'-Elemente tauchen hier NICHT als
// Fehler auf (s. modell.ts) — nur als Hinweiszeile, wie viele Zuordnungen aus
// Datenlücken nicht mitgezählt wurden.
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

import type { QuranFontResult } from '../useQuranFont';
import {
  kasusTempusWertBegriff,
  satzrolleOptionBegriff,
  wortartBegriff,
  type Begriff,
} from './anzeige';
import type { BewertetesElement, Ergebnis } from './modell';

export interface ErgebnisAnsichtProps {
  ergebnis: Ergebnis;
  surah: number;
  ayah: number;
  quranFont: QuranFontResult;
  onNocheinmal: () => void;
  onZurUebersicht: () => void;
}

function begriffFuerElement(el: BewertetesElement, t: (k: string) => string, wert: string | undefined): Begriff | null {
  if (wert === undefined) return null;
  if (el.dimension === 'wortart') return wortartBegriff(wert as 'ism' | 'fiil' | 'harf', t);
  if (el.dimension === 'satzrolle') return satzrolleOptionBegriff(wert, t);
  // kasusTempus: 'nom'/'acc'/'gen' sind eindeutig Kasus, die drei Tempus-Werte
  // eindeutig Tempus — keine Überschneidung, s. modell.ts KASUS_OPTIONEN/TEMPUS_OPTIONEN.
  const typ = wert === 'nom' || wert === 'acc' || wert === 'gen' ? 'kasus' : 'tempus';
  return kasusTempusWertBegriff(typ, wert, t);
}

export function ErgebnisAnsicht({ ergebnis, surah, ayah, quranFont, onNocheinmal, onZurUebersicht }: ErgebnisAnsichtProps) {
  const { t } = useTranslation();
  const rtl = useRtl();
  const bewertet = ergebnis.richtig + ergebnis.falsch;
  const quote = bewertet === 0 ? 0 : ergebnis.richtig / bewertet;
  const falscheElemente = ergebnis.elemente.filter((e) => e.bewertung === 'falsch');

  const nachricht =
    bewertet === 0
      ? ''
      : quote === 1
        ? t('analyseUebung.ergebnis.perfekt')
        : quote >= 0.7
          ? t('analyseUebung.ergebnis.gut')
          : t('analyseUebung.ergebnis.ueben');

  return (
    <View style={styles.container}>
      <ThemedView type="backgroundElement" style={styles.scoreKarte}>
        <ThemedText type="title">
          {ergebnis.richtig} / {bewertet}
        </ThemedText>
        {nachricht !== '' && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.scoreText}>
            {nachricht}
          </ThemedText>
        )}
        {ergebnis.nichtBewertet > 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.scoreText}>
            {t('analyseUebung.ergebnis.nichtBewertetHinweis').replace('{count}', String(ergebnis.nichtBewertet))}
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.fehlerKarte}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {falscheElemente.length > 0 ? t('analyseUebung.ergebnis.fehlerTitle') : t('analyseUebung.ergebnis.keineFehler')}
        </ThemedText>
        {falscheElemente.map((el, i) => {
          const deine = begriffFuerElement(el, t, el.antwort);
          const korrekt = begriffFuerElement(el, t, el.korrekterWert ?? undefined);
          return (
            <View key={`${el.wortPosition}-${el.dimension}-${i}`} style={styles.fehlerZeile}>
              <ThemedText style={[styles.fehlerArabic, quranFont.style, rtl && styles.textRtl]}>
                {quranFont.text(el.wortText)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                {deine ? `${deine.name} → ` : ''}
                <ThemedText type="smallBold">{korrekt?.name ?? ''}</ThemedText>
              </ThemedText>
              <View style={[styles.springRow, rtl && styles.springRowRtl]}>
                <PressableCard
                  onPress={() =>
                    router.push({ pathname: '/quran/[surah]', params: { surah: String(surah), ayah: String(ayah) } })
                  }
                  type="backgroundSelected"
                  style={styles.springButton}>
                  <ThemedText type="small" themeColor="accent">
                    {t('analyseUebung.ergebnis.imReaderOeffnen')}
                  </ThemedText>
                </PressableCard>
                {el.wortRoot && (
                  <PressableCard
                    onPress={() =>
                      router.push({ pathname: '/lexikon/wurzel/[wurzel]', params: { wurzel: el.wortRoot! } })
                    }
                    type="backgroundSelected"
                    style={styles.springButton}>
                    <ThemedText type="small" themeColor="accent">
                      {t('analyseUebung.ergebnis.wurzelImLexikon')}
                    </ThemedText>
                  </PressableCard>
                )}
              </View>
            </View>
          );
        })}
      </ThemedView>

      <View style={styles.navRow}>
        <PressableCard onPress={onNocheinmal} type="backgroundSelected" style={styles.navButton}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('analyseUebung.ergebnis.nocheinmal')}
          </ThemedText>
        </PressableCard>
        <PressableCard onPress={onZurUebersicht} type="backgroundSelected" style={styles.navButton}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('analyseUebung.ergebnis.zurUebersicht')}
          </ThemedText>
        </PressableCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.four },
  scoreKarte: { alignItems: 'center', gap: Spacing.two, padding: Spacing.four, borderRadius: Spacing.three },
  scoreText: { textAlign: 'center' },
  fehlerKarte: { gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three },
  fehlerZeile: { gap: Spacing.one, paddingVertical: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,124,116,0.3)' },
  fehlerArabic: { fontSize: 22, lineHeight: 34 },
  textRtl: { textAlign: 'right' },
  springRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  springRowRtl: { flexDirection: 'row-reverse' },
  springButton: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  navRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  navButton: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four, borderRadius: Spacing.four },
});
