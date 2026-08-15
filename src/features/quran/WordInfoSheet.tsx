import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { wordToLetterList } from '@/features/learn/letters';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { useQuranFont } from './useQuranFont';
import { wordTajweedRuleFamilies } from './tajweedRuleInfo';

export interface WordInfoWord {
  arabic: string;
  translation: string;
  transliteration: string;
  tajweedRules?: string[];
}

interface WordInfoSheetProps {
  /** Sheet sichtbar? Getrennt von `word`, damit ein Ladezustand (word noch
   * null) oder ein "keine Daten"-Fund (word bleibt null nach Laden) das Sheet
   * nicht versehentlich unsichtbar machen. */
  visible: boolean;
  /** Angetipptes Wort mit Daten, oder null solange geladen wird / keine
   * Daten gefunden wurden. */
  word: WordInfoWord | null;
  onClose: () => void;
  /** Wort-Daten werden noch geladen (z. B. erster Tap in dieser Sure/Seite). */
  loading?: boolean;
  /** Laden fehlgeschlagen (Netzwerkfehler) — von einem "keine Daten"-Zustand
   * unterscheiden wir hier bewusst nicht: beides zeigt denselben ehrlichen
   * Hinweis statt eines stillen Fehlers. */
  error?: boolean;
  /** Audio-URL für das einzelne Wort (nur im normalen Reader verfügbar). */
  audioUrl?: string | null;
  onPlay?: () => void;
  /** Übersetzung in der App-Sprache (z. B. gepflegtes deutsches Gloss für die
   * Kernsuren). Wenn gesetzt, ersetzt sie das englische quran.com-Gloss und der
   * "nur Englisch"-Hinweis entfällt. */
  translationOverride?: string | null;
}

/**
 * Wiederverwendbares Wort-Lexikon-Sheet: Grundbedeutung + Aussprache + (falls
 * eine Tajwid-Regel greift) eine kurze Begründung, warum das Wort so
 * ausgesprochen wird — nutzbar im normalen Reader UND im Mushaf (Task #55).
 * Zeigt bewusst KEINE Wurzel/Grundform an: quran.com liefert dafür keine
 * verlässlichen Daten (live geprüft, 2026-07-17 — word_fields=root wird
 * stillschweigend ignoriert), und eine geratene Wurzel zu einem religiösen
 * Text wäre eine Falschangabe. Stattdessen ein kurzer, ehrlicher Hinweis.
 */
export function WordInfoSheet({
  visible,
  word,
  onClose,
  loading,
  error,
  audioUrl,
  onPlay,
  translationOverride,
}: WordInfoSheetProps) {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const quranFont = useQuranFont();
  const ruleFamilies = wordTajweedRuleFamilies(word?.tajweedRules);
  const letterList = word ? wordToLetterList(word.arabic) : [];
  // Deutsches Gloss (falls vorhanden) bevorzugen, sonst das englische von quran.com.
  const displayTranslation = translationOverride ?? word?.translation ?? '';
  const hasContent = !!word && (displayTranslation !== '' || word.transliteration !== '');
  const showNoData = !loading && !error && !hasContent;

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
              {t('quran.wordInfo.title')}
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
              <View style={styles.wordRow}>
                <ThemedText style={[styles.arabic, quranFont.style]}>{quranFont.text(word.arabic)}</ThemedText>
                {!!audioUrl && !!onPlay && (
                  <Pressable
                    onPress={onPlay}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11y.playAudio')}
                    style={({ pressed }) => [
                      styles.playBtn,
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
                  <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                    {t('quran.wordInfo.translationLabel')}
                  </ThemedText>
                  <ThemedText type="default">{displayTranslation}</ThemedText>
                  {/* Wort-für-Wort-Übersetzung kommt von quran.com und ist dort NUR auf
                      Englisch verfügbar (weder `language`- noch
                      `word_translation_language`-Parameter ändern das, live geprüft) —
                      anders als die vollständige Vers-Übersetzung darüber im Reader, die
                      in der jeweiligen App-Sprache läuft. Ohne diesen Hinweis würden
                      nicht-englischsprachige Nutzer denken, das sei bereits ihre Sprache.
                      Bei einem gepflegten deutschen Gloss (translationOverride) entfällt
                      der Hinweis, weil dann bereits die App-Sprache angezeigt wird. */}
                  {locale !== 'en' && !translationOverride && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.languageNote}>
                      {t('quran.wordInfo.translationLanguageNote')}
                    </ThemedText>
                  )}
                </View>
              )}

              {ruleFamilies.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                    {t('quran.wordInfo.pronunciationLabel')}
                  </ThemedText>
                  {ruleFamilies.map((family) => (
                    <ThemedView key={family} type="backgroundElement" style={styles.ruleBox}>
                      <ThemedText type="small">{t(`quran.wordInfo.rules.${family}`)}</ThemedText>
                    </ThemedView>
                  ))}
                </View>
              )}

              {letterList.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                    {t('quran.wordInfo.lettersLabel')}
                  </ThemedText>
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
                </View>
              )}

              <ThemedText type="small" themeColor="textSecondary" style={styles.rootNote}>
                {t('quran.wordInfo.rootNote')}
              </ThemedText>
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
    maxHeight: '70%',
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
  centerText: { textAlign: 'center' },
  wordRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.three },
  arabic: { fontSize: 34, lineHeight: 52, textAlign: 'right', writingDirection: 'rtl' },
  playBtn: { marginLeft: 'auto' },
  playBtnInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  transliteration: { fontStyle: 'italic', marginBottom: Spacing.one },
  section: { marginTop: Spacing.three, gap: Spacing.one },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 1 },
  languageNote: { fontStyle: 'italic', opacity: 0.8, marginTop: 2 },
  ruleBox: { padding: Spacing.two, borderRadius: Spacing.two, marginTop: 2 },
  // row-reverse: die Buchstaben-Chips folgen der Lesereihenfolge des Wortes
  // (rechts nach links), wie die Wort-für-Wort-Zeile im Reader.
  letterRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.two, marginTop: 2 },
  letterChip: { alignItems: 'center', gap: 2, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two, minWidth: 44 },
  letterChar: { fontSize: 22, lineHeight: 34 },
  rootNote: { marginTop: Spacing.four, fontStyle: 'italic', opacity: 0.8 },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});
