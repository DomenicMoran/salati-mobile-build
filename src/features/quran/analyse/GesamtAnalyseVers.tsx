import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';

import { fragmentListe, harfAnzeige, ismEigenschaftenAnzeige, relationAnzeige, stammSegment, verbEigenschaftenAnzeige, verbTypAnzeige, verneinungAnzeige, wortWortart } from './wortAnalyseModel';
import { Fachbegriff } from './Fachbegriff';
import type { FragmentAnzeige, MerkmalAnzeige } from './wortAnalyseModel';
import type { MorphWord } from '../morphologieTypen';
import type { QuranFontResult } from '../useQuranFont';

/** Compact, simultaneous word-by-word grammar view. It intentionally has no
 * tabs/disclosures: tapping the reader's single full-analysis control exposes
 * each word, its corpus segments, relevant inflection, polarity and syntax. */
export function GesamtAnalyseVers({
  words,
  verseWords,
  displayWords,
  quranFont,
  showEvidenceLegend = true,
}: {
  words: MorphWord[];
  verseWords: MorphWord[];
  displayWords?: string[];
  quranFont: QuranFontResult;
  showEvidenceLegend?: boolean;
}) {
  const { t } = useTranslation();
  const rtl = useRtl();
  const { width, fontScale } = useWindowDimensions();
  const einspaltig = width < 390 || fontScale > 1.15;

  return (
    <View style={styles.container}>
      {showEvidenceLegend ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.legend}>
          ✓ {t('grammatik.herkunft.beleg.label')} · ↗ {t('grammatik.herkunft.hergeleitet.label')}
        </ThemedText>
      ) : null}
      {words.map((word, index) => {
        const type = wortWortart(word);
        const stem = stammSegment(word);
        const fragments = fragmentListe(word, t);
        const noun = type === 'ism' ? ismEigenschaftenAnzeige(word, stem, verseWords, t) : null;
        const verb = type === 'fiil' ? verbEigenschaftenAnzeige(word, stem, t) : null;
        const verbTypes = type === 'fiil' ? verbTypAnzeige(word, t) : [];
        const particle = type === 'harf' ? harfAnzeige(word, t) : null;
        const negation = verneinungAnzeige(word, t);
        const syntax = relationAnzeige(word, verseWords, t);
        const features: (MerkmalAnzeige | null)[] = noun
          ? [noun.genus, noun.numerus, noun.bestimmtheit, noun.kasus]
          : verb
            ? [verb.tempus, verb.modus, verb.genusVerbi, verb.person, verb.genus, verb.numerus]
            : [];
        const verbform = verb?.verbform;
        const displayWord = displayWords?.[index] ?? word.text;

        return (
          <ThemedView key={`${word.position}:${word.text}`} type="backgroundElement" style={styles.wordCard}>
            <View style={[styles.wordHeader, rtl && styles.rtl]}>
              <ThemedText type="smallBold" themeColor="textSecondary">{word.position}</ThemedText>
              <ThemedText style={[styles.arabic, quranFont.style]}>{quranFont.text(displayWord)}</ThemedText>
              <ThemedText type="smallBold" themeColor="accent">
                {type ? <Fachbegriff text={t(`grammatik.wortarten.${type}.name`)} ar={t(`grammatik.wortarten.${type}.ar`)} /> : t('quran.wortAnalyse.attributeUnknown')}
              </ThemedText>
            </View>

            <View style={styles.segments}>
              {fragments.map((fragment, i) => (
                <GesamtFragmentZeile key={`${word.position}:segment:${i}`} fragment={fragment} quranFont={quranFont} rtl={rtl} />
              ))}
            </View>

            <View style={[styles.statusLine, einspaltig && styles.statusLineStack, rtl && !einspaltig && styles.rtl]}>
              <ThemedText type="small" themeColor="textSecondary" style={[styles.statusItem, einspaltig && styles.statusItemFull, rtl && styles.textRtl]}>
                <ThemedText type="smallBold">{t('quran.wortAnalyse.negationLabel')}: </ThemedText>
                {negation ? <ThemedText style={[styles.arabicInline, quranFont.style]}>{quranFont.text(negation.segmentText)}</ThemedText> : t('quran.wortAnalyse.negationNoneShort')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={[styles.statusItem, einspaltig && styles.statusItemFull, rtl && styles.textRtl]}>
                <ThemedText type="smallBold">{t('quran.wortAnalyse.satzrolleTitle')}: </ThemedText>
                {syntax?.name ?? t('quran.wortAnalyse.satzrolleUnknownShort')}
              </ThemedText>
            </View>
            {word.syntax?.relation === 'neg' && syntax?.headText ? (
              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                {t('quran.wortAnalyse.negatedByLabel').replace('{wort}', syntax.headText)}
              </ThemedText>
            ) : syntax?.headText ? (
              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                {t('quran.wortAnalyse.satzrolleHeadLabel').replace('{wort}', syntax.headText)}
              </ThemedText>
            ) : syntax ? (
              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                {t('quran.wortAnalyse.satzrolleHeadNone')}
              </ThemedText>
            ) : null}

            <View style={[styles.featureGrid, rtl && styles.gridRtl]}>
              {features.map((feature, featureIndex) => {
                const featureKey = noun
                  ? ['genus', 'numerus', 'bestimmtheit', 'kasus'][featureIndex]
                  : ['tempus', 'modus', 'genusVerbi', 'person', 'genus', 'numerus'][featureIndex];
                const baseKey = noun ? 'grammatik.ismEigenschaften' : 'grammatik.verbEigenschaften';
                return feature ? (
                  <KompaktesMerkmal key={feature.schluessel} merkmal={feature} einspaltig={einspaltig} />
                ) : (
                  <View key={`${baseKey}.${featureKey}`} style={[styles.unknownRow, einspaltig && styles.cellFull]}>
                    <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                      {t(`${baseKey}.${featureKey}.name`)}: {t('quran.wortAnalyse.attributeUnknownShort')}
                    </ThemedText>
                  </View>
                );
              })}
              {verb && (
                verbform ? (
                  <KompaktesMerkmal
                    merkmal={{
                      schluessel: 'grammatik.verbEigenschaften.verbform',
                      label: verbform.label,
                      ar: verbform.ar,
                      info: '',
                      wert: String(verbform.formName),
                      wertName: verbform.formName,
                      wertAr: verbform.formAr,
                      herkunft: verbform.herkunft,
                      herkunftLabel: verbform.herkunftLabel,
                      herkunftInfo: verbform.herkunftInfo,
                      begruendung: verbform.begruendung,
                    }}
                    einspaltig={einspaltig}
                  />
                ) : (
                  <View style={[styles.unknownRow, einspaltig && styles.cellFull]}>
                    <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                      {t('grammatik.verbEigenschaften.verbform.name')}: {t('quran.wortAnalyse.attributeUnknownShort')}
                    </ThemedText>
                  </View>
                )
              )}
            </View>

            {particle && (
              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                <ThemedText type="smallBold">{particle.name}</ThemedText>
              </ThemedText>
            )}

            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
              {word.root ? <>{t('quran.wortAnalyse.rootLabel')}: <ThemedText style={[styles.arabicInline, quranFont.style]}>{quranFont.text(word.root)}</ThemedText> · </> : null}
              {t('quran.wortAnalyse.lemmaLabel')}: <ThemedText style={[styles.arabicInline, quranFont.style]}>{quranFont.text(word.lemma)}</ThemedText>
            </ThemedText>
            {verbTypes.map((verbType) => (
              <ThemedText key={verbType.kategorie} type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                <Fachbegriff text={verbType.name} ar={verbType.ar} />
              </ThemedText>
            ))}

          </ThemedView>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two, marginTop: Spacing.three },
  legend: { textAlign: 'center', marginBottom: Spacing.one },
  wordCard: { padding: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Spacing.two, gap: Spacing.one },
  wordHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  rtl: { flexDirection: 'row-reverse' },
  arabic: { fontSize: 24, lineHeight: 38, flexShrink: 1, marginHorizontal: Spacing.two },
  segments: { gap: Spacing.one },
  fragmentRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Spacing.two },
  fragmentRtl: { flexDirection: 'row-reverse' },
  fragmentArabic: { fontSize: 23, lineHeight: 34 },
  fragmentLabel: { flex: 1, minWidth: 120 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gridRtl: { flexDirection: 'row-reverse' },
  featureCell: { flexBasis: '48%', flexGrow: 1, minWidth: 150, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  cellFull: { flexBasis: '100%', minWidth: 0 },
  featureValue: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.one },
  rationaleButton: { alignSelf: 'flex-start', marginTop: 2, paddingVertical: 2, minHeight: 28, justifyContent: 'center' },
  rationaleText: { lineHeight: 18 },
  statusLine: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.one },
  statusLineStack: { flexDirection: 'column', alignItems: 'stretch' },
  statusItem: { flexGrow: 1, flexBasis: '45%' },
  statusItemFull: { flexGrow: 0, flexBasis: 'auto', width: '100%' },
  unknownRow: { flexBasis: '48%', flexGrow: 1, minWidth: 150, gap: 2, marginBottom: Spacing.one },
  arabicInline: { writingDirection: 'rtl' },
  textRtl: { textAlign: 'right' },
  herkunftBeleg: { fontWeight: '600' },
  herkunftHergeleitet: { fontStyle: 'italic', opacity: 0.75 },
});

/** In the dense per-verse overview, keep segment text + its role/category
 * visible together; the long dictionary explanation remains in the word sheet. */
function GesamtFragmentZeile({ fragment, quranFont, rtl }: { fragment: FragmentAnzeige; quranFont: QuranFontResult; rtl: boolean }) {
  const stem = fragment.kind === 'stem';
  const { t } = useTranslation();
  const segmentLabel = stem
    ? t(`grammatik.posTags.${fragment.segment.pos}.name`)
    : fragment.name;
  return (
    <ThemedView
      type={stem ? 'backgroundSelected' : 'backgroundElement'}
      style={[styles.fragmentRow, rtl && styles.fragmentRtl]}
      accessibilityRole="summary"
      accessibilityLabel={`${fragment.kindLabel}: ${fragment.name}`}>
      <ThemedText style={[styles.fragmentArabic, quranFont.style]}>{quranFont.text(fragment.segment.text)}</ThemedText>
      <ThemedText type="smallBold" themeColor={stem ? 'accent' : 'textSecondary'} style={[styles.fragmentLabel, rtl && styles.textRtl]}>
        {fragment.kindLabel} · {segmentLabel}
      </ThemedText>
    </ThemedView>
  );
}

/** Core values stay visible at once; only the optional explanatory derivation
 * can be expanded, so the overview remains compact on phones. */
function KompaktesMerkmal({ merkmal, einspaltig }: { merkmal: MerkmalAnzeige; einspaltig: boolean }) {
  const [warumOffen, setWarumOffen] = useState(false);
  const rtl = useRtl();
  const { t } = useTranslation();
  const hergeleitet = merkmal.herkunft === 'hergeleitet';
  return (
    <View style={[styles.featureCell, einspaltig && styles.cellFull]}>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={rtl && styles.textRtl}
        accessibilityLabel={`${merkmal.herkunftInfo} ${merkmal.label}: ${merkmal.wertName}`}>
        {merkmal.label}: <ThemedText type="smallBold">{merkmal.wertName}</ThemedText>{' '}
        <ThemedText
          type="smallBold"
          themeColor={hergeleitet ? 'textSecondary' : 'accent'}
          style={hergeleitet ? styles.herkunftHergeleitet : styles.herkunftBeleg}
          accessibilityLabel={merkmal.herkunftInfo}>
          {hergeleitet ? '↗' : '✓'}
        </ThemedText>
      </ThemedText>
      {merkmal.begruendung ? (
        <>
          <Pressable
            onPress={() => setWarumOffen((open) => !open)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: warumOffen }}
            accessibilityLabel={`${t('quran.wortAnalyse.rationaleLabel')}: ${merkmal.label}`}
            style={styles.rationaleButton}>
            <ThemedText type="small" themeColor="accent">
              {t(warumOffen ? 'quran.wortAnalyse.rationaleHide' : 'quran.wortAnalyse.rationaleLabel')}
            </ThemedText>
          </Pressable>
          {warumOffen ? (
            <ThemedText type="small" themeColor="textSecondary" style={[styles.rationaleText, rtl && styles.textRtl]}>
              {merkmal.begruendung}
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
