import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  recognizeArabicContinuous,
  recognitionAvailable,
  type ContinuousController,
} from '@/features/hifz/speech';
import type { RevealedWord } from '@/features/hifz/reciteProgress';
import {
  beschreibeWhisperFehler,
  whisperDiagnose,
  whisperSupported,
  type WhisperDiagnose,
  type WhisperFehlerInfo,
} from '@/features/hifz/whisperCheck';
import {
  aktuelleModellGroesse,
  istWhisperModellHeruntergeladen,
  whisperModellHerunterladen,
} from '@/features/hifz/whisperModel';
import { useSurahReading } from '@/features/quran/hooks';
import { useSettings } from '@/features/settings/store';
import { formatBytes } from '@/features/settings/storage';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

// Aufgedeckte Verswörter (Audit 2026-07-27, N4): vorher Brand.gold (#d4af37)
// mit 1.90:1 auf Papier bzw. #c99a2e mit 2.33:1 für den „near"-Zustand — beide
// verfehlten selbst die Large-Text-Schwelle 3:1. „hit" nutzt jetzt
// colors.accent (Light #785A00 = 5.81:1, Dark Brand.gold auf Ink = 9.35:1),
// „near" einen wärmeren, klar unterscheidbaren Ton mit ebenfalls sicherem
// Kontrast: Light #94500F = 5.56:1, Dark #e8a13c = 8.98:1.
const NEAR_WORD_COLOR = { light: '#94500F', dark: '#e8a13c' } as const;

// „Leerer Mushaf – ganze Sure" (K, User-Wunsch 2026-07-22): die ganze Sure ist
// verdeckt; man startet das Modell, sagt „Bismillah…" und rezitiert durchgehend.
// Das Modell läuft KONTINUIERLICH und deckt Verse Wort für Wort auf, sobald es
// sie korrekt erkennt (falsch → trotzdem aufgedeckt, aber markiert). Läuft bis
// Sure fertig oder Stopp gedrückt (recognizeArabicContinuous).
export default function ReciteSurahScreen() {
  const { surah } = useLocalSearchParams<{ surah: string }>();
  const surahNumber = Number(surah);
  const { settings } = useSettings();
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const { data, isLoading } = useSurahReading(surahNumber, settings.quranTranslation, settings.quranReciter);
  const ayahs = useMemo(() => data?.ayahs ?? [], [data]);

  const [modelReady, setModelReady] = useState<boolean | null>(null);
  const [modelDlPct, setModelDlPct] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  // Läuft die finale Voll-Auswertung der GESAMTEN Aufnahme (nach Stopp) — kann
  // bei langen Suren mehrere überlappende Blöcke dauern. Danach ist die Sure
  // vollständig „aufgelöst" (s. summary).
  const [finalizing, setFinalizing] = useState(false);
  // Abschluss-Ergebnis: wie viele Wörter am Ende aufgedeckt wurden.
  const [summary, setSummary] = useState<{ revealed: number; total: number } | null>(null);
  // On-Screen-Fehler statt stummem console.error (User-Report: „komplett
  // kaputt", ohne ablesbare Ursache nicht diagnostizierbar).
  const [startErr, setStartErr] = useState<{ info: WhisperFehlerInfo; diag: WhisperDiagnose | null } | null>(null);
  const [showErrDetail, setShowErrDetail] = useState(false);
  // Ehrlicher Erwartungs-Hinweis (aufklappbar, dezent): das On-Device-Modell
  // ist kein Lehrer-Ersatz. Standardmäßig eingeklappt, damit es nicht drängt.
  const [showRecInfo, setShowRecInfo] = useState(false);
  const controllerRef = useRef<ContinuousController | null>(null);

  function permStatusLabel(status: string): string {
    if (status === 'granted') return t('hifz.speechError.yes');
    if (status === 'denied') return t('hifz.speechError.no');
    return t('hifz.speechError.unknown');
  }

  useEffect(() => {
    if (!whisperSupported()) return;
    let cancelled = false;
    istWhisperModellHeruntergeladen().then((d) => {
      if (!cancelled) setModelReady(d);
    });
    return () => {
      cancelled = true;
      controllerRef.current?.stop().catch(() => undefined);
    };
  }, []);

  // Erwarteter Gesamttext (alle Verse) + Wort-Grenzen je Vers für das Zurück-
  // Mappen der flachen Wort-Ausrichtung auf die einzelnen Verse.
  const verseWordCounts = useMemo(
    () => ayahs.map((a) => a.arabic.split(/\s+/).filter(Boolean).length),
    [ayahs],
  );
  const expectedFull = useMemo(
    () => ayahs.map((a) => a.arabic).join(' '),
    [ayahs],
  );
  // Gesamt-Wortzahl der Sure — Bezugsgröße für die Abschluss-Zählung (summary).
  const totalWords = useMemo(() => verseWordCounts.reduce((s, c) => s + c, 0), [verseWordCounts]);

  // Monotones Aufdecken (User-Bug 2026-07-22: „erkennt nur die ersten Verse,
  // dann verliert es den Faden und löscht die ersten wieder" + „ein Wort aus
  // Vers 1 wird beim Vers 7 als Treffer gewertet"). Die Aufdeck-Treffer kommen
  // jetzt POSITIONS-gekoppelt aus der Erkennung (speech.ts → reciteProgress.ts
  // windowedReveal): je Teil-Transkript nur Treffer NAHE der aktuellen Front,
  // global indiziert. Kein globales alignWords(partial, ganzeSure) mehr, das ein
  // spätes/frühes gleichlautendes Wort fälschlich zuordnen konnte. Der beste je
  // erreichte Status pro Wort wird festgehalten und NIE herabgestuft
  // (undefined < near < hit) — ein späteres Fenster ohne die frühen Verse deckt
  // daher nichts wieder zu.
  const [revealed, setRevealed] = useState<Record<number, 'hit' | 'near'>>({});
  // Spiegel des aufgedeckten Standes als Ref — die finale Voll-Auswertung
  // (stop()) deckt über onPartial→applyReveals asynchron auf; direkt nach dem
  // awaiteten stop() ist der State-Batch evtl. noch nicht geflusht, der Ref ist
  // aber sofort aktuell → verlässliche Abschluss-Zählung.
  const revealedRef = useRef<Record<number, 'hit' | 'near'>>({});
  const applyReveals = useCallback((reveals: RevealedWord[]) => {
    if (reveals.length === 0) return;
    setRevealed((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const r of reveals) {
        if (next[r.index] === 'hit') continue; // schon maximal
        if (next[r.index] === 'near' && r.status === 'near') continue;
        next[r.index] = r.status;
        changed = true;
      }
      if (changed) revealedRef.current = next;
      return changed ? next : prev;
    });
  }, []);

  async function downloadModel() {
    if (modelDlPct !== null) return;
    setModelDlPct(0);
    try {
      await whisperModellHerunterladen((p) => setModelDlPct(Math.round(p.anteil * 100)));
      setModelReady(true);
    } catch {
      /* ignore — Button bleibt nutzbar */
    } finally {
      setModelDlPct(null);
    }
  }

  async function start() {
    if (running || starting) return;
    setStarting(true);
    setStartErr(null);
    setRevealed({});
    revealedRef.current = {};
    setSummary(null);
    try {
      controllerRef.current = await recognizeArabicContinuous({
        expectedText: expectedFull,
        // Positions-gekoppelte Treffer direkt aufdecken (kein globales
        // Alignment mehr, s. applyReveals-Kommentar).
        onPartial: (_tr, reveals) => applyReveals(reveals),
      });
      setRunning(true);
    } catch (e) {
      console.error('[hifz recite-surah] Erkennung konnte nicht gestartet werden:', String(e));
      const info = beschreibeWhisperFehler(e);
      const diag = await whisperDiagnose().catch(() => null);
      setStartErr({ info, diag });
      setShowErrDetail(false);
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    const c = controllerRef.current;
    controllerRef.current = null;
    setRunning(false);
    // Der finale Durchlauf wertet die GESAMTE Aufnahme in überlappenden Blöcken
    // aus und meldet seine Treffer über onPartial→applyReveals — danach ist die
    // Sure vollständig aufgedeckt. Solange läuft, „finalizing" anzeigen.
    if (c) {
      setFinalizing(true);
      await c.stop().catch((e) => {
        console.warn('[hifz recite-surah] Stopp/Final-Transkription fehlgeschlagen:', String(e));
        return '';
      });
      setSummary({ revealed: Object.keys(revealedRef.current).length, total: totalWords });
      setFinalizing(false);
    }
  }

  // Globaler Wort-Offset je Vers: die Reveals sind global über die ganze Sure
  // indiziert (reciteProgress.ts) — off + wortIndexImVers = globaler Index in
  // `revealed`. Offset mutationsfrei berechnen (Summe der Wortzahlen davor) —
  // der React-Compiler-Lint verbietet ein `let off += …` im Render.
  const perVerse = useMemo(
    () =>
      ayahs.map((a, i) => {
        const off = verseWordCounts.slice(0, i).reduce((s, c) => s + c, 0);
        return { ayah: a, off };
      }),
    [ayahs, verseWordCounts],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          {Platform.OS === 'web' ? (
            <View style={styles.closeSpacer} />
          ) : (
            <Pressable onPress={() => backOr('/hifz')} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('a11y.close')}>
              <IconSymbol name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
          <ThemedText type="subtitle">{data?.meta.englishName ?? ''}</ThemedText>
          <View style={styles.closeSpacer} />
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          {t('hifz.surahRecite.intro')}
        </ThemedText>

        {settings.speechExercisesEnabled && whisperSupported() && (
          <View style={styles.disclaimer}>
            <Pressable
              onPress={() => setShowRecInfo((s) => !s)}
              accessibilityRole="button"
              hitSlop={6}
              style={({ pressed }) => [
                styles.disclaimerHead,
                Platform.OS === 'web' ? styles.pressableWeb : undefined,
                pressed && styles.pressed,
              ]}>
              <IconSymbol name="information-circle" size={14} color={colors.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimerCta}>
                {t('hifz.recognitionNoteCta')}
              </ThemedText>
              <IconSymbol name={showRecInfo ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
            </Pressable>
            {showRecInfo && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimerBody}>
                {t('hifz.recognitionDisclaimer')}
              </ThemedText>
            )}
          </View>
        )}

        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}

        {!isLoading && (
          <ScrollView contentContainerStyle={styles.content}>
            {perVerse.map(({ ayah, off }) => (
              <View key={ayah.numberInSurah} style={styles.verseCard}>
                <ThemedText type="small" themeColor="accent" style={styles.verseNum}>
                  {ayah.numberInSurah}
                </ThemedText>
                <View style={styles.verseWordsRow}>
                  {ayah.arabic
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((w, wi) => {
                      const st = revealed[off + wi];
                      if (st === 'hit' || st === 'near') {
                        return (
                          <ThemedText
                            key={wi}
                            style={[
                              styles.verseWord,
                              { color: st === 'near' ? NEAR_WORD_COLOR[scheme] : colors.accent },
                            ]}>
                            {w}
                          </ThemedText>
                        );
                      }
                      // noch nicht (korrekt) erkannt → verdeckt
                      return (
                        <View key={wi} style={[styles.verseBlank, { width: Math.min(80, 24 + w.length * 5) }]} />
                      );
                    })}
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {settings.speechExercisesEnabled && whisperSupported() && recognitionAvailable() && (
          <View style={styles.footer}>
            {finalizing && (
              <ThemedView type="backgroundElement" style={styles.summaryCard}>
                <ThemedActivityIndicator />
                <ThemedText type="small" themeColor="textSecondary">
                  {t('hifz.surahRecite.finalizing')}
                </ThemedText>
              </ThemedView>
            )}
            {!finalizing && summary && (
              <ThemedView type="backgroundElement" style={styles.summaryCard}>
                <IconSymbol
                  name={summary.revealed >= summary.total ? 'checkmark-circle' : 'information-circle'}
                  size={18}
                  color={summary.revealed >= summary.total ? Brand.gold : colors.textSecondary}
                />
                <ThemedText type="small" themeColor="textSecondary" style={styles.summaryText}>
                  {summary.revealed >= summary.total && summary.total > 0
                    ? t('hifz.surahRecite.doneAll')
                    : t('hifz.surahRecite.doneSome')
                        .replace('{n}', String(summary.revealed))
                        .replace('{total}', String(summary.total))}
                </ThemedText>
              </ThemedView>
            )}
            {startErr && (
              <ThemedView type="backgroundElement" style={styles.errCard}>
                <View style={styles.errHeadRow}>
                  <IconSymbol name="alert-circle" size={16} color={colors.text} />
                  <ThemedText type="smallBold">{t('hifz.speechError.heading')}</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`hifz.speechError.${startErr.info.i18nKey}Msg`)}
                </ThemedText>
                {startErr.diag && (
                  <View style={styles.diagRow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('hifz.speechError.model')}:{' '}
                      {startErr.diag.modellVorhanden ? t('hifz.speechError.yes') : t('hifz.speechError.no')}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('hifz.speechError.permission')}: {permStatusLabel(startErr.diag.mikrofonStatus)}
                    </ThemedText>
                  </View>
                )}
                {/* Dauerhaft verweigertes Mikrofon (Audit 2026-07-27, N9): ohne
                    diesen Weg endet der Screen in einer Sackgasse. */}
                {startErr.diag?.mikrofonStatus === 'denied' && (
                  <Pressable
                    onPress={() => void Linking.openSettings()}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.openSettings')}
                    hitSlop={6}
                    style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('common.openSettings')}
                    </ThemedText>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setShowErrDetail((s) => !s)}
                  accessibilityRole="button"
                  hitSlop={6}
                  style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                  <ThemedText type="small" themeColor="accent">
                    {showErrDetail ? t('hifz.speechError.hideDetails') : t('hifz.speechError.showDetails')}
                  </ThemedText>
                </Pressable>
                {showErrDetail && (
                  <ThemedView type="backgroundSelected" style={styles.errDetail}>
                    <ThemedText type="code" themeColor="textSecondary" selectable>
                      {t('hifz.speechError.code')}: {startErr.info.code ?? '—'}
                    </ThemedText>
                    {startErr.info.detail ? (
                      <ThemedText type="code" themeColor="textSecondary" selectable>
                        {startErr.info.detail}
                      </ThemedText>
                    ) : null}
                  </ThemedView>
                )}
              </ThemedView>
            )}
            {modelReady === false ? (
              <Pressable
                onPress={downloadModel}
                disabled={modelDlPct !== null}
                accessibilityRole="button"
                style={({ pressed }) => [styles.primaryBtn, { backgroundColor: Brand.gold }, pressed && styles.pressed]}>
                <IconSymbol name="download-outline" size={20} color={Brand.ink} />
                <ThemedText type="smallBold" style={styles.primaryLabel}>
                  {modelDlPct !== null
                    ? t('hifz.modelDownload').replace('{p}', String(modelDlPct))
                    : `${t('settings.storage.whisperModel.download')} · ${formatBytes(aktuelleModellGroesse())}`}
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={running ? stop : start}
                disabled={modelReady === null || starting || finalizing}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: running ? '#e5544b' : Brand.gold },
                  (pressed || finalizing) && styles.pressed,
                ]}>
                <IconSymbol name={running ? 'stop' : 'mic'} size={20} color={running ? '#fff' : Brand.ink} />
                <ThemedText type="smallBold" style={[styles.primaryLabel, running && { color: '#fff' }]}>
                  {finalizing
                    ? t('hifz.surahRecite.finalizing')
                    : starting
                      ? t('hifz.listening')
                      : running
                        ? t('hifz.surahRecite.stop')
                        : t('hifz.surahRecite.start')}
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  closeSpacer: { width: 20 },
  intro: { textAlign: 'center', paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  disclaimer: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  disclaimerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  disclaimerCta: { textAlign: 'center', flexShrink: 1 },
  disclaimerBody: { textAlign: 'center', marginTop: Spacing.one, opacity: 0.9 },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  verseCard: { gap: Spacing.two },
  verseNum: { textAlign: 'right' },
  verseWordsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'flex-start' },
  verseWord: { fontSize: 24, lineHeight: 44, paddingHorizontal: 4 },
  verseBlank: { height: 5, borderRadius: 2.5, backgroundColor: 'rgba(150,150,150,0.4)', alignSelf: 'center' },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    minHeight: 54,
  },
  primaryLabel: { fontSize: 16, color: Brand.ink },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
  errCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
    marginBottom: Spacing.two,
    backgroundColor: 'rgba(248,113,113,0.16)',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
  },
  summaryText: { flexShrink: 1 },
  errHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  errDetail: { padding: Spacing.two, borderRadius: Spacing.two, gap: 2 },
});
