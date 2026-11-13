import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { decodeSyncPayload, exportProgressCode, importProgressCode } from '@/features/sync/codeSync';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

type ImportState =
  | { kind: 'idle' }
  // Zwischenschritt vor dem Überschreiben: der Import ersetzt den lokalen
  // Fortschritt, und wer einen Code vom ÄLTEREN Gerät einfügt, verlöre damit
  // den neueren Stand ohne jede Warnung. Das Exportdatum steht in der Rückfrage,
  // weil man erst daran erkennen kann, ob der Code der jüngere ist.
  //
  // Bewusst inline statt `Alert.alert`: auf Web ist Alert in React Native
  // wirkungslos, und Handy<->Web ist hier ein ausdrücklicher Anwendungsfall
  // (siehe features/sync/codeSync.ts) — ein Modal, das dort nicht erscheint,
  // wäre genau auf dem Weg wirkungslos, der die Rückfrage am nötigsten hat.
  | { kind: 'confirm'; exportedAt: string }
  | { kind: 'success'; count: number }
  | { kind: 'error' };

export default function SyncScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const [exportCode, setExportCode] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ kind: 'idle' });

  const handleExport = async () => {
    setExporting(true);
    setCopied(false);
    try {
      setExportCode(await exportProgressCode());
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!exportCode) return;
    await Clipboard.setStringAsync(exportCode);
    setCopied(true);
  };

  // Erster Schritt: Code nur PRÜFEN, noch nichts schreiben. Das entwertet
  // zugleich den häufigsten Fehlerfall — ein unvollständig kopierter Code
  // scheitert hier, bevor irgendetwas überschrieben wurde.
  const handleImport = () => {
    try {
      const payload = decodeSyncPayload(importText);
      setImportState({ kind: 'confirm', exportedAt: payload.exportedAt });
    } catch {
      setImportState({ kind: 'error' });
    }
  };

  // Zweiter Schritt: erst hier wird geschrieben.
  const handleConfirmImport = async () => {
    setImporting(true);
    try {
      const { restoredKeys } = await importProgressCode(importText);
      setImportState({ kind: 'success', count: restoredKeys.length });
    } catch {
      setImportState({ kind: 'error' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('sync.title')} variant="modal" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
            {t('sync.intro')}
          </ThemedText>

          <AnimatedListItem index={0}>
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                {t('sync.exportTitle').toUpperCase()}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                <Pressable
                  onPress={handleExport}
                  disabled={exporting}
                  accessibilityRole="button"
                  accessibilityLabel={t('sync.exportButton')}
                  style={styles.primaryButton}>
                  <ThemedView type="backgroundSelected" style={styles.primaryButtonInner}>
                    {exporting ? (
                      <ThemedActivityIndicator size="small" />
                    ) : (
                      <ThemedText type="smallBold" themeColor="accent">
                        {t('sync.exportButton')}
                      </ThemedText>
                    )}
                  </ThemedView>
                </Pressable>

                {exportCode && (
                  <>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.exportHint}>
                      {t('sync.exportHint')}
                    </ThemedText>
                    <ThemedView type="backgroundSelected" style={styles.codeBox}>
                      <ThemedText type="small" selectable style={styles.codeText}>
                        {exportCode}
                      </ThemedText>
                    </ThemedView>
                    <Pressable
                      onPress={handleCopy}
                      accessibilityRole="button"
                      accessibilityLabel={copied ? t('sync.copied') : t('sync.copyButton')}
                      style={styles.copyButton}>
                      <IconSymbol name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.accent} />
                      <ThemedText type="small" themeColor="accent">
                        {copied ? t('sync.copied') : t('sync.copyButton')}
                      </ThemedText>
                    </Pressable>
                  </>
                )}
              </ThemedView>
            </View>
          </AnimatedListItem>

          <AnimatedListItem index={1}>
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                {t('sync.importTitle').toUpperCase()}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedView type="backgroundSelected" style={styles.inputBox}>
                  <TextInput
                    value={importText}
                    onChangeText={(v) => {
                      setImportText(v);
                      setImportState({ kind: 'idle' });
                    }}
                    placeholder={t('sync.importPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    style={[styles.textInput, { color: colors.text }]}
                  />
                </ThemedView>
                {importState.kind !== 'confirm' && (
                  <Pressable
                    onPress={handleImport}
                    disabled={importText.trim().length === 0}
                    accessibilityRole="button"
                    accessibilityLabel={t('sync.importButton')}
                    style={styles.primaryButton}>
                    <ThemedView type="backgroundSelected" style={styles.primaryButtonInner}>
                      <ThemedText type="smallBold" themeColor="accent">
                        {t('sync.importButton')}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                )}

                {importState.kind === 'confirm' && (
                  <ThemedView type="backgroundSelected" style={styles.confirmBox}>
                    <View style={styles.confirmHeading}>
                      <IconSymbol name="alert-circle-outline" size={16} color={colors.text} />
                      <ThemedText type="smallBold">{t('sync.confirmTitle')}</ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.confirmBody}>
                      {t('sync.confirmBody').replace(
                        '{date}',
                        new Date(importState.exportedAt).toLocaleDateString(locale, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }),
                      )}
                    </ThemedText>
                    <View style={styles.confirmActions}>
                      <Pressable
                        onPress={() => setImportState({ kind: 'idle' })}
                        disabled={importing}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.cancel')}
                        style={styles.confirmButton}>
                        <ThemedText type="smallBold" themeColor="textSecondary">
                          {t('common.cancel')}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={handleConfirmImport}
                        disabled={importing}
                        accessibilityRole="button"
                        accessibilityLabel={t('sync.confirmAction')}
                        style={styles.confirmButton}>
                        {importing ? (
                          <ThemedActivityIndicator size="small" />
                        ) : (
                          <ThemedText type="smallBold" themeColor="accent">
                            {t('sync.confirmAction')}
                          </ThemedText>
                        )}
                      </Pressable>
                    </View>
                  </ThemedView>
                )}

                {importState.kind === 'success' && (
                  <ThemedText type="small" themeColor="accent" style={styles.feedback}>
                    {t('sync.importSuccess')}
                  </ThemedText>
                )}
                {importState.kind === 'error' && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.feedback}>
                    {t('sync.importError')}
                  </ThemedText>
                )}
              </ThemedView>
            </View>
          </AnimatedListItem>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  intro: { marginBottom: Spacing.three, lineHeight: 20 },
  section: { gap: Spacing.two },
  sectionLabel: { marginLeft: Spacing.one },
  card: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.three },
  primaryButton: { alignSelf: 'flex-start' },
  confirmBox: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  confirmHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  confirmBody: { lineHeight: 20 },
  // 44 px Mindesthöhe wie bei den übrigen Tippzielen der App.
  confirmActions: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  confirmButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  primaryButtonInner: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    minWidth: 140,
    alignItems: 'center',
  },
  exportHint: { lineHeight: 18 },
  codeBox: { padding: Spacing.three, borderRadius: Spacing.two },
  codeText: { fontFamily: 'monospace', lineHeight: 18 },
  copyButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, alignSelf: 'flex-start' },
  inputBox: { borderRadius: Spacing.two, padding: Spacing.three, minHeight: 100 },
  textInput: { fontSize: 14, fontFamily: 'monospace', minHeight: 84 },
  feedback: { lineHeight: 18 },
});
