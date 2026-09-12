// Wort-Sheet des Koran-Readers: EIN Sheet für einen Wort-Tap (Zusammenführung
// von vormals zwei separaten Sheets, 2026-09 — Übersichtlichkeit war die
// Hauptanforderung des Auftraggebers, zwei Sheets hinter einem Schalter
// hinter demselben Tap waren das Gegenteil davon). Zeigt IMMER die
// Grundbedeutung + Aussprache + Buchstaben-Aufschlüsselung (unabhängig von
// Morphologiedaten), UND — sobald die Morphologiedaten des Verses geladen
// sind — die vollständige Fragment-für-Fragment-Wortanalyse (Wurzel,
// Wortart, Satzrolle/Iʿrab). Die Tiefe steckt in aufklappbaren Abschnitten
// (Aufklappbar), damit das Sheet trotz mehr Inhalt übersichtlich bleibt:
// Fragmente und Wortart starten offen (Kernaussage der Analyse), Satzrolle/
// Buchstaben/Aussprache starten zugeklappt.
//
// Datenquellen: die morphologischen Rohdaten kommen über useVerseMorphologie
// (morphologieHooks.ts) — geladen NUR während das Sheet sichtbar ist
// (`enabled: visible`), dieselbe Sure-weite Cache-Instanz wird beim
// nächsten Wort desselben Verses wiederverwendet. Die lexikalischen
// Basisdaten (Arabisch/Umschrift/Bedeutung/Audio) kommen dagegen als Prop
// `word` vom Aufrufer (wordByWord im Reader). Fehlen die Morphologiedaten
// (offline, Sure noch nicht geladen, kein Treffer für die Position), zeigt
// das Sheet trotzdem alles, was ohne sie geht, und sagt für den
// Grammatikteil ehrlich, dass die Daten fehlen — es wirkt nie leer.
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { wordToLetterList } from '@/features/learn/letters';
import { useRtl } from '@/hooks/use-rtl';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

import { Aufklappbar } from './analyse/Aufklappbar';
import { Fachbegriff } from './analyse/Fachbegriff';
import { FragmentZeile } from './analyse/FragmentZeile';
import { MerkmalZeile } from './analyse/MerkmalZeile';
import { useWurzelHaeufigkeit } from './analyse/useWurzelHaeufigkeit';
import {
  fragmentListe,
  harfAnzeige,
  ismEigenschaftenAnzeige,
  relationAnzeige,
  stammSegment,
  verbEigenschaftenAnzeige,
  verbTypAnzeige,
  verneinungAnzeige,
  wortWortart,
} from './analyse/wortAnalyseModel';
import type { WurzelTypKategorie } from './grammatik';
import { useVerseMorphologie } from './morphologieHooks';
import { wordTajweedRuleFamilies } from './tajweedRuleInfo';
import { useQuranFont } from './useQuranFont';

export interface WordInfoWord {
  arabic: string;
  translation: string;
  transliteration: string;
  tajweedRules?: string[];
}

export interface WortAnalyseSheetProps {
  /** Sheet sichtbar? Steuert zugleich, ob die Morphologiedaten des Verses
   * geladen werden (`enabled` in useVerseMorphologie) — kein Netzabruf,
   * solange niemand hinschaut. */
  visible: boolean;
  onClose: () => void;
  /** Fundstelle des Wortes — Grundlage für den Morphologie-Abruf. */
  surah: number;
  ayah: number;
  /** 1-basierte Position im Vers, siehe MorphWord.position. */
  position: number;
  /** Lexikalische Basisdaten (Arabisch/Umschrift/Bedeutung). `null` solange
   * geladen wird / kein Treffer. */
  word: WordInfoWord | null;
  /** Ladezustand der LEXIKALISCHEN Basisdaten. Die Morphologie (Fragmente,
   * Wortart, Satzrolle) hat ihren eigenen, unabhängigen Ladezustand. */
  loading?: boolean;
  error?: boolean;
  /** Gepflegtes deutsches Gloss, falls vorhanden — ersetzt word.translation. */
  translationOverride?: string | null;
  /** Audio-URL für das einzelne Wort (nur im normalen Reader verfügbar). */
  audioUrl?: string | null;
  onPlay?: () => void;
  /** Wurzel angetippt — Aufrufer öffnet die Wurzel-Route (baut ein anderer Agent). */
  onWurzelOeffnen: (wurzel: string) => void;
  /** "Im Lexikon öffnen" — keine eigene Navigation, der Aufrufer entscheidet. */
  onLexikonOeffnen: () => void;
  /** Verbtyp angetippt (z. B. "Aǧwaf") — Aufrufer öffnet `/lexikon/verbtyp/<kategorie>`.
   * Trifft die Wurzel mehrere Kategorien gleichzeitig (z. B. mahmūz UND
   * nāqiṣ), meldet das Sheet die vom Nutzer ANGETIPPTE Kategorie, nie
   * willkürlich die erste. */
  onVerbTypOeffnen: (kategorie: WurzelTypKategorie) => void;
}

/**
 * Das EINE Wort-Sheet des Koran-Readers: Grundbedeutung + Aussprache +
 * Buchstaben-Aufschlüsselung (immer verfügbar) plus vollständige
 * Fragment-für-Fragment-Wortanalyse (Wurzel, Morphologie, Iʿrab), sobald die
 * Morphologiedaten geladen sind. Ersetzt die frühere Aufteilung in
 * WordInfoSheet (schlank) und WortAnalyseSheet (tief) hinter einem Schalter.
 */
export function WortAnalyseSheet({
  visible,
  onClose,
  surah,
  ayah,
  position,
  word,
  loading,
  error,
  translationOverride,
  audioUrl,
  onPlay,
  onWurzelOeffnen,
  onLexikonOeffnen,
  onVerbTypOeffnen,
}: WortAnalyseSheetProps) {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const rtl = useRtl();
  const quranFont = useQuranFont();

  const {
    verse,
    isLoading: morphLoading,
    isError: morphError,
  } = useVerseMorphologie(surah, ayah, visible);
  const morphWord = verse?.find((w) => w.position === position);

  const displayTranslation = translationOverride ?? word?.translation ?? '';
  const hasContent = !!word && (displayTranslation !== '' || word.transliteration !== '');
  const showNoData = !loading && !error && !hasContent;
  const ruleFamilies = wordTajweedRuleFamilies(word?.tajweedRules);
  const letterList = word ? wordToLetterList(word.arabic) : [];

  const wa = morphWord ? wortWortart(morphWord) : null;
  const stamm = morphWord ? stammSegment(morphWord) : null;
  const fragmente = morphWord ? fragmentListe(morphWord, t) : [];
  const ismAnzeige = stamm && wa === 'ism' ? ismEigenschaftenAnzeige(stamm, t) : null;
  const verbAnzeige = stamm && wa === 'fiil' ? verbEigenschaftenAnzeige(stamm, t) : null;
  const harfInfo = morphWord && wa === 'harf' ? harfAnzeige(morphWord, t) : null;
  const verbTypen = morphWord && wa === 'fiil' ? verbTypAnzeige(morphWord, t) : [];
  const verneinung = morphWord ? verneinungAnzeige(morphWord, t) : null;
  const relation = morphWord ? relationAnzeige(morphWord, verse, t) : null;

  const { anzahl: wurzelAnzahl } = useWurzelHaeufigkeit(morphWord?.root ?? null, visible);

  // Morphologie geladen, aber für DIESE Position kein Wort gefunden (sollte
  // bei korrekter Fundstelle nicht vorkommen — defensiv statt stumm leer).
  const morphOhneTreffer = !morphLoading && !morphError && verse !== undefined && !morphWord;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.close')}
        onPress={onClose}
      />
      <ThemedView style={styles.sheet} accessibilityViewIsModal importantForAccessibility="yes">
        <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
              {t('quran.wortAnalyse.title')}
            </ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.close')}
              style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
              <IconSymbol name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {loading && (
            <View style={styles.center}>
              <ThemedActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                {t('common.loading')}
              </ThemedText>
            </View>
          )}

          {(error || showNoData) && (
            <View style={styles.center}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {t('quran.wordInfo.noData')}
              </ThemedText>
            </View>
          )}

          {!loading && !error && word && hasContent && (
            <>
              {/* 1. Kopf — Kernaussage, immer sichtbar */}
              <View style={[styles.wordRow, rtl && styles.wordRowRtl]}>
                <ThemedText style={[styles.arabic, quranFont.style]}>{quranFont.text(word.arabic)}</ThemedText>
                {!!audioUrl && !!onPlay && (
                  <Pressable
                    onPress={onPlay}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11y.playAudio')}
                    style={({ pressed }) => [
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedView type="backgroundSelected" style={styles.playBtnInner}>
                      <IconSymbol name="volume-high" size={16} color={colors.accent} />
                    </ThemedView>
                  </Pressable>
                )}
              </View>

              {word.transliteration !== '' && (
                <ThemedText type="smallBold" themeColor="accent" style={styles.transliteration}>
                  {word.transliteration}
                </ThemedText>
              )}

              {displayTranslation !== '' && (
                <View style={styles.section}>
                  <ThemedText type="small" themeColor="textSecondary" style={[styles.sectionLabel, rtl && styles.textRtl]}>
                    {t('quran.wordInfo.translationLabel')}
                  </ThemedText>
                  <ThemedText type="default" style={rtl && styles.textRtl}>
                    {displayTranslation}
                  </ThemedText>
                  {/* Wort-für-Wort-Übersetzung kommt von quran.com und ist dort NUR
                      auf Englisch verfügbar (weder `language`- noch
                      `word_translation_language`-Parameter ändern das, live
                      geprüft) — anders als die vollständige Vers-Übersetzung im
                      Reader, die in der jeweiligen App-Sprache läuft. Ohne diesen
                      Hinweis würden nicht-englischsprachige Nutzer denken, das sei
                      bereits ihre Sprache. Bei einem gepflegten deutschen Gloss
                      (translationOverride) entfällt der Hinweis, weil dann bereits
                      die App-Sprache angezeigt wird. */}
                  {locale !== 'en' && !translationOverride && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.languageNote}>
                      {t('quran.wordInfo.translationLanguageNote')}
                    </ThemedText>
                  )}
                </View>
              )}

              <ThemedText type="small" themeColor="textSecondary" style={[styles.fundstelle, rtl && styles.textRtl]}>
                {t('quran.wortAnalyse.fundstelle')
                  .replace('{surah}', String(surah))
                  .replace('{ayah}', String(ayah))
                  .replace('{position}', String(position))}
              </ThemedText>

              {/* 2. Wurzel und Grundform */}
              {morphWord && (
                <View style={styles.section}>
                  {morphWord.root ? (
                    <Pressable
                      onPress={() => onWurzelOeffnen(morphWord.root as string)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('quran.wortAnalyse.rootLabel')}: ${morphWord.root}`}
                      style={({ pressed }) => [styles.wurzelRow, rtl && styles.wurzelRowRtl, pressed && styles.pressed]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('quran.wortAnalyse.rootLabel')}
                      </ThemedText>
                      <ThemedText type="smallBold" themeColor="accent" style={[styles.arabicInline, quranFont.style]}>
                        {quranFont.text(morphWord.root)}
                      </ThemedText>
                      {wurzelAnzahl !== undefined && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {t('quran.wortAnalyse.rootFrequency').replace('{count}', String(wurzelAnzahl))}
                        </ThemedText>
                      )}
                    </Pressable>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('quran.wortAnalyse.rootNone')}
                    </ThemedText>
                  )}
                  <View style={[styles.lemmaRow, rtl && styles.wurzelRowRtl]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('quran.wortAnalyse.lemmaLabel')}
                    </ThemedText>
                    <ThemedText style={[styles.arabicInline, quranFont.style]}>
                      {quranFont.text(morphWord.lemma)}
                    </ThemedText>
                  </View>
                </View>
              )}

              {morphLoading && (
                <View style={styles.center}>
                  <ThemedActivityIndicator />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('common.loading')}
                  </ThemedText>
                </View>
              )}

              {/* Ehrlicher Hinweis statt leerer Grammatikteil: greift offline,
                  wenn die Sure noch nicht geladen ist, oder wenn Morphologie
                  geladen wurde, aber kein Treffer für diese Position da ist. */}
              {(morphError || morphOhneTreffer) && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  {t('quran.wortAnalyse.morphologyNoData')}
                </ThemedText>
              )}

              {morphWord && (
                <>
                  {/* 3. Fragment-Aufschlüsselung — Kernaussage der Analyse, offen */}
                  <Aufklappbar titel={t('quran.wortAnalyse.fragmentsTitle')} defaultOffen>
                    <View style={styles.fragmentListe}>
                      {fragmente.map((f, i) => (
                        <FragmentZeile key={i} fragment={f} quranFont={quranFont} />
                      ))}
                    </View>
                  </Aufklappbar>

                  {/* 4. Wortart-Karte — Kernaussage der Analyse, offen */}
                  {wa && (
                    <Aufklappbar titel={t('quran.wortAnalyse.wortartTitle')} defaultOffen>
                      <ThemedText type="smallBold" style={rtl && styles.textRtl}>
                        <Fachbegriff text={t(`grammatik.wortarten.${wa}.name`)} ar={t(`grammatik.wortarten.${wa}.ar`)} />
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                        {t(`grammatik.wortarten.${wa}.info`)}
                      </ThemedText>

                      {wa === 'ism' &&
                        ismAnzeige &&
                        [ismAnzeige.genus, ismAnzeige.numerus, ismAnzeige.bestimmtheit, ismAnzeige.kasus]
                          .filter((m): m is NonNullable<typeof m> => m !== null)
                          .map((m) => <MerkmalZeile key={m.schluessel} merkmal={m} />)}

                      {wa === 'fiil' && verbAnzeige && (
                        <>
                          {[
                            verbAnzeige.tempus,
                            verbAnzeige.genusVerbi,
                            verbAnzeige.modus,
                            verbAnzeige.person,
                            verbAnzeige.genus,
                            verbAnzeige.numerus,
                          ]
                            .filter((m): m is NonNullable<typeof m> => m !== null)
                            .map((m) => <MerkmalZeile key={m.schluessel} merkmal={m} />)}
                          {verbAnzeige.verbform && (
                            <View style={styles.verbformBox}>
                              <ThemedText type="small" themeColor="textSecondary">
                                <Fachbegriff text={verbAnzeige.verbform.label} ar={verbAnzeige.verbform.ar} />
                              </ThemedText>
                              <View style={[styles.wertZeile, rtl && styles.wurzelRowRtl]}>
                                <ThemedText type="default">
                                  <Fachbegriff text={verbAnzeige.verbform.formName} ar={verbAnzeige.verbform.formAr} />
                                </ThemedText>
                                <ThemedText
                                  type="small"
                                  themeColor={verbAnzeige.verbform.herkunft === 'hergeleitet' ? 'textSecondary' : 'accent'}
                                  style={verbAnzeige.verbform.herkunft === 'hergeleitet' ? styles.hergeleitet : styles.beleg}>
                                  {verbAnzeige.verbform.herkunftLabel}
                                </ThemedText>
                              </View>
                              <ThemedText type="small" themeColor="textSecondary">
                                {verbAnzeige.verbform.formInfo}
                              </ThemedText>
                            </View>
                          )}
                          {/* Verbtyp(en) der Wurzel — nur bei Verben mit
                              Wurzel (verbTypAnzeige liefert sonst []). Mehrere
                              Treffer (z. B. mahmūz UND nāqiṣ) erscheinen als
                              eigene Zeilen, damit der Nutzer wählt statt eine
                              willkürliche Familie zu öffnen. */}
                          {verbTypen.length > 0 && (
                            <View style={styles.verbTypListe}>
                              <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                                {t('quran.wortAnalyse.verbTypLabel')}
                              </ThemedText>
                              {verbTypen.map((vt) => (
                                <Pressable
                                  key={vt.kategorie}
                                  onPress={() => onVerbTypOeffnen(vt.kategorie)}
                                  accessibilityRole="button"
                                  accessibilityLabel={vt.name}
                                  style={({ pressed }) => [
                                    styles.verbTypRow,
                                    rtl && styles.wurzelRowRtl,
                                    pressed && styles.pressed,
                                  ]}>
                                  <View style={styles.verbTypText}>
                                    <ThemedText type="smallBold" themeColor="accent" style={rtl && styles.textRtl}>
                                      <Fachbegriff text={vt.name} ar={vt.ar} />
                                    </ThemedText>
                                    <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                                      {vt.info}
                                    </ThemedText>
                                  </View>
                                  <IconSymbol
                                    name={rtl ? 'chevron-back' : 'chevron-forward'}
                                    size={16}
                                    color={colors.textSecondary}
                                  />
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </>
                      )}

                      {wa === 'harf' && harfInfo && (
                        <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                          <ThemedText type="smallBold">
                            <Fachbegriff text={harfInfo.name} ar={harfInfo.ar} />
                          </ThemedText>
                          : {harfInfo.info}
                        </ThemedText>
                      )}
                    </Aufklappbar>
                  )}

                  {/* 5. Verneinung — nur falls zutreffend, deutlich hervorgehoben */}
                  {verneinung && (
                    <ThemedView type="backgroundSelected" style={styles.verneinungBox}>
                      <ThemedText type="smallBold" themeColor="accent" style={rtl && styles.textRtl}>
                        <Fachbegriff text={verneinung.name} ar={verneinung.ar} />
                      </ThemedText>
                      <ThemedText style={[styles.arabicInline, quranFont.style]}>
                        {quranFont.text(verneinung.segmentText)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                        {verneinung.info}
                      </ThemedText>
                    </ThemedView>
                  )}

                  {/* 6. Satzrolle (Iʿrab) — Tiefe, standardmäßig zugeklappt */}
                  <Aufklappbar titel={t('quran.wortAnalyse.satzrolleTitle')}>
                    {relation ? (
                      <>
                        <ThemedText type="smallBold" style={rtl && styles.textRtl}>
                          <Fachbegriff text={relation.name} ar={relation.ar} />
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                          {relation.info}
                        </ThemedText>
                        {relation.head != null ? (
                          <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                            {t('quran.wortAnalyse.satzrolleHeadLabel').replace(
                              '{wort}',
                              relation.headText ?? String(relation.head),
                            )}
                          </ThemedText>
                        ) : (
                          <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                            {t('quran.wortAnalyse.satzrolleHeadNone')}
                          </ThemedText>
                        )}
                      </>
                    ) : (
                      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
                        {t('quran.wortAnalyse.satzrolleNoData')}
                      </ThemedText>
                    )}
                  </Aufklappbar>
                </>
              )}

              {/* 7. Buchstaben-Aufschlüsselung — braucht KEINE Morphologiedaten,
                  daher immer verfügbar (auch offline / Sure noch nicht geladen).
                  Tiefe, standardmäßig zugeklappt. */}
              {letterList.length > 0 && (
                <Aufklappbar titel={t('quran.wordInfo.lettersLabel')}>
                  <View style={styles.letterRow}>
                    {letterList.map((l, li) => (
                      <ThemedView key={li} type="backgroundElement" style={styles.letterChip}>
                        <ThemedText style={[styles.letterChar, quranFont.style]}>{quranFont.text(l.char)}</ThemedText>
                        {l.name && (
                          <ThemedText type="small" themeColor="textSecondary">
                            {l.name}
                          </ThemedText>
                        )}
                      </ThemedView>
                    ))}
                  </View>
                </Aufklappbar>
              )}

              {/* 8. Aussprache/Tajwid — braucht KEINE Morphologiedaten, daher
                  immer verfügbar. Tiefe, standardmäßig zugeklappt. */}
              {ruleFamilies.length > 0 && (
                <Aufklappbar titel={t('quran.wordInfo.pronunciationLabel')}>
                  {ruleFamilies.map((family) => (
                    <ThemedView key={family} type="backgroundElement" style={styles.ruleBox}>
                      <ThemedText type="small" style={rtl && styles.textRtl}>
                        {t(`quran.wordInfo.rules.${family}`)}
                      </ThemedText>
                    </ThemedView>
                  ))}
                </Aufklappbar>
              )}

              {/* 9. Aktion */}
              <Pressable
                onPress={onLexikonOeffnen}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.lexikonButton,
                  { backgroundColor: colors.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('quran.wortAnalyse.lexikonButton')}
                </ThemedText>
              </Pressable>
            </>
          )}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,11,13,0.45)' },
  sheet: {
    maxHeight: '85%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.two,
  },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, opacity: 0.4, marginBottom: Spacing.two },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.one },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  title: { textTransform: 'uppercase', letterSpacing: 1 },
  center: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  centerText: { textAlign: 'center', paddingVertical: Spacing.two },
  wordRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.three },
  wordRowRtl: { flexDirection: 'row', justifyContent: 'flex-start' },
  arabic: { fontSize: 34, lineHeight: 52, textAlign: 'right', writingDirection: 'rtl' },
  arabicInline: { writingDirection: 'rtl' },
  playBtnInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  transliteration: { fontStyle: 'italic', marginBottom: Spacing.one },
  fundstelle: { marginTop: 2 },
  section: { marginTop: Spacing.three, gap: Spacing.one },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 1 },
  languageNote: { fontStyle: 'italic', opacity: 0.8, marginTop: 2 },
  ruleBox: { padding: Spacing.two, borderRadius: Spacing.two, marginTop: 2 },
  wurzelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  wurzelRowRtl: { flexDirection: 'row-reverse' },
  lemmaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: 2 },
  fragmentListe: { gap: Spacing.two },
  verbformBox: { marginTop: Spacing.one, gap: 2 },
  verbTypListe: { marginTop: Spacing.two, gap: Spacing.one },
  verbTypRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  verbTypText: { flex: 1, gap: 2 },
  wertZeile: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  hergeleitet: { fontStyle: 'italic', opacity: 0.75 },
  beleg: { fontWeight: '600' },
  verneinungBox: { padding: Spacing.three, borderRadius: Spacing.two, marginTop: Spacing.three, gap: Spacing.one },
  // row-reverse: die Buchstaben-Chips folgen der Lesereihenfolge des Wortes
  // (rechts nach links), wie die Wort-für-Wort-Zeile im Reader.
  letterRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.two },
  letterChip: { alignItems: 'center', gap: 2, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two, minWidth: 44 },
  letterChar: { fontSize: 22, lineHeight: 34 },
  lexikonButton: {
    marginTop: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  textRtl: { textAlign: 'right' },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});
