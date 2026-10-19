// Ein Übungsschritt: EIN Wort im Fokus. Vor dem Aufdecken nur die
// Auswahl-Schaltflächen (nichts wird verraten), danach Wort-für-Wort-Abgleich
// mit Begründung — inkl. eines nicht gewerteten "Weitere Merkmale"-Abschnitts
// für hergeleitete Zusatzangaben (Bestimmtheit/Numerus/Verbform), wie von der
// Aufgabenstellung gefordert.
import { StyleSheet, View } from 'react-native';

import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

import { relationAnzeige } from '../analyse/wortAnalyseModel';
import { GesamtAnalyseVers } from '../analyse/GesamtAnalyseVers';
import type { MorphWord } from '../morphologieTypen';
import type { QuranFontResult } from '../useQuranFont';

import {
  KASUS_TEMPUS_OPTIONEN_BEGRIFFE,
  SATZROLLE_OPTIONEN_BEGRIFFE,
  WORTART_OPTIONEN_BEGRIFFE,
  kasusTempusLabel,
  kasusTempusWertBegriff,
  satzrolleOptionBegriff,
  wortartBegriff,
} from './anzeige';
import { AntwortAuswahl } from './AntwortAuswahl';
import { ErgebnisZeile } from './ErgebnisZeile';
import {
  KASUS_OPTIONEN,
  TEMPUS_OPTIONEN,
  WORTART_OPTIONEN,
  bewerteDimension,
  type Antwort,
  type UebungsSchritt,
} from './modell';

export interface WortFokusKarteProps {
  schritt: UebungsSchritt;
  index: number;
  gesamt: number;
  verseWords: MorphWord[];
  satzrolleOptionenListe: string[];
  antwort: Antwort;
  onAntwortChange: (patch: Partial<Antwort>) => void;
  aufgedeckt: boolean;
  onAufdecken: () => void;
  onWeiter: () => void;
  istLetzter: boolean;
  quranFont: QuranFontResult;
}

export function WortFokusKarte({
  schritt,
  index,
  gesamt,
  verseWords,
  satzrolleOptionenListe,
  antwort,
  onAntwortChange,
  aufgedeckt,
  onAufdecken,
  onWeiter,
  istLetzter,
  quranFont,
}: WortFokusKarteProps) {
  const { t } = useTranslation();
  const { wort, dimensionen } = schritt;

  const vollstaendig = dimensionen.every((d) => {
    if (d === 'wortart') return antwort.wortart !== undefined;
    if (d === 'kasusTempus') return antwort.kasusTempus !== undefined;
    return antwort.satzrolle !== undefined;
  });

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.fortschritt}>
        {t('analyseUebung.exercise.fortschritt').replace('{index}', String(index)).replace('{total}', String(gesamt))}
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.wortKarte}>
        <ThemedText style={[styles.arabic, quranFont.style]}>{quranFont.text(wort.word.text)}</ThemedText>
      </ThemedView>

      {!aufgedeckt && (
        <View style={styles.fragen}>
          {dimensionen.includes('wortart') && (
            <AntwortAuswahl
              titel={t('analyseUebung.exercise.wortartLabel')}
              optionen={WORTART_OPTIONEN_BEGRIFFE(t, WORTART_OPTIONEN)}
              ausgewaehlt={antwort.wortart}
              onWahl={(wert) => onAntwortChange({ wortart: wert as Antwort['wortart'] })}
            />
          )}
          {dimensionen.includes('kasusTempus') && wort.kasusTempus && (
            <AntwortAuswahl
              titel={kasusTempusLabel(wort.kasusTempus.typ, t).name}
              titelAr={kasusTempusLabel(wort.kasusTempus.typ, t).ar}
              optionen={KASUS_TEMPUS_OPTIONEN_BEGRIFFE(
                wort.kasusTempus.typ,
                wort.kasusTempus.typ === 'kasus' ? KASUS_OPTIONEN : TEMPUS_OPTIONEN,
                t,
              )}
              ausgewaehlt={antwort.kasusTempus}
              onWahl={(wert) => onAntwortChange({ kasusTempus: wert })}
            />
          )}
          {dimensionen.includes('satzrolle') && (
            <AntwortAuswahl
              titel={t('analyseUebung.exercise.satzrolleLabel')}
              optionen={SATZROLLE_OPTIONEN_BEGRIFFE(satzrolleOptionenListe, t)}
              ausgewaehlt={antwort.satzrolle}
              onWahl={(wert) => onAntwortChange({ satzrolle: wert })}
            />
          )}
          <PressableCard
            onPress={onAufdecken}
            disabled={!vollstaendig}
            type="backgroundSelected"
            style={[styles.hauptButton, !vollstaendig && styles.hauptButtonDeaktiviert]}>
            <ThemedText type="smallBold" themeColor="accent">
              {t('analyseUebung.exercise.aufdecken')}
            </ThemedText>
          </PressableCard>
        </View>
      )}

      {aufgedeckt && (
        <View style={styles.fragen}>
          {dimensionen.includes('wortart') && wort.wortart && (
            <ErgebnisZeile
              titel={t('analyseUebung.exercise.wortartLabel')}
              richtig={bewerteDimension(wort, 'wortart', antwort) === 'richtig'}
              deineAntwort={wortartBegriff(antwort.wortart!, t)}
              korrekt={wortartBegriff(wort.wortart, t)}
              info={wortartBegriff(wort.wortart, t).info}
            />
          )}
          {dimensionen.includes('kasusTempus') && wort.kasusTempus && (
            <ErgebnisZeile
              titel={kasusTempusLabel(wort.kasusTempus.typ, t).name}
              titelAr={kasusTempusLabel(wort.kasusTempus.typ, t).ar}
              richtig={bewerteDimension(wort, 'kasusTempus', antwort) === 'richtig'}
              deineAntwort={kasusTempusWertBegriff(wort.kasusTempus.typ, antwort.kasusTempus!, t)}
              korrekt={kasusTempusWertBegriff(wort.kasusTempus.typ, wort.kasusTempus.wert, t)}
              info={kasusTempusWertBegriff(wort.kasusTempus.typ, wort.kasusTempus.wert, t).info}
            />
          )}
          {dimensionen.includes('satzrolle') &&
            (() => {
              // Die AUSFÜHRLICHE Begründung kommt aus relationAnzeige() (echtes
              // Bezugswort statt generischem Platzhalter) — s. anzeige.ts.
              const relation = relationAnzeige(wort.word, verseWords, t);
              if (!relation) return null;
              return (
                <ErgebnisZeile
                  titel={t('analyseUebung.exercise.satzrolleLabel')}
                  richtig={bewerteDimension(wort, 'satzrolle', antwort) === 'richtig'}
                  deineAntwort={satzrolleOptionBegriff(antwort.satzrolle!, t)}
                  korrekt={{ name: relation.name, ar: relation.ar }}
                  info={relation.info}
                />
              );
            })()}

          <GesamtAnalyseVers
            words={[wort.word]}
            verseWords={verseWords}
            displayWords={[wort.word.text]}
            quranFont={quranFont}
          />

          <PressableCard onPress={onWeiter} type="backgroundSelected" style={styles.hauptButton}>
            <ThemedText type="smallBold" themeColor="accent">
              {istLetzter ? t('analyseUebung.exercise.ergebnisAnsehen') : t('analyseUebung.exercise.weiter')}
            </ThemedText>
          </PressableCard>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  fortschritt: { textAlign: 'center' },
  wortKarte: { alignItems: 'center', paddingVertical: Spacing.five, borderRadius: Spacing.three },
  arabic: { fontSize: 44, lineHeight: 72 },
  fragen: { gap: Spacing.four },
  hauptButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: Spacing.three },
  hauptButtonDeaktiviert: { opacity: 0.4 },
});
