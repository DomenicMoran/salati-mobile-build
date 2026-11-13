import { useSsrSafeAudioPlayer } from '@/lib/ssrSafeAudio';
import { router, useLocalSearchParams } from 'expo-router';
import { backOr } from '@/lib/nav';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAyahPlayer } from '@/features/quran/usePlayer';
import { useSurahReading } from '@/features/quran/hooks';
import { knownCount, useHifzProgress } from '@/features/hifz/progress';
import { recognitionAvailable, recognizeArabicStreaming } from '@/features/hifz/speech';
import { useHydrated } from '@/hooks/use-hydrated';
import {
  beschreibeWhisperFehler,
  istModellFehler,
  whisperDiagnose,
  whisperSupported,
  WhisperFehler,
  type WhisperDiagnose,
  type WhisperFehlerInfo,
  type WhisperRecorder,
} from '@/features/hifz/whisperCheck';
import {
  aktuelleModellGroesse,
  istWhisperModellHeruntergeladen,
  whisperModellHerunterladen,
} from '@/features/hifz/whisperModel';
import { formatBytes } from '@/features/settings/storage';
import {
  alignWords,
  bestTranscript,
  firstSubstitution,
  gradeFromSimilarity,
  normalizeArabic,
  type RecitationGrade,
  type WordAlignment,
} from '@/features/hifz/similarity';
import { letterTipKey } from '@/features/hifz/letterTips';
import { indexForAyah, parseReciteParams, shouldAutoMarkKnown } from '@/features/hifz/reciteFlow';
import { useSettings } from '@/features/settings/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { hapticSuccess, hapticWarning } from '@/lib/haptics';
import { useTranslation } from '@/lib/i18n';

// Live aufgedeckte Wörter (Audit 2026-07-27, N4): siehe hifz/recite-surah.tsx —
// Brand.gold erreichte auf Papier nur 1.90:1, der "near"-Ton #c99a2e 2.33:1.
// Jetzt colors.accent (Light #785A00 = 5.81:1) bzw. für "near" Light #94500F
// = 5.56:1 / Dark #e8a13c = 8.98:1.
const NEAR_WORD_COLOR = { light: '#94500F', dark: '#e8a13c' } as const;

type MicState = 'idle' | 'listening' | 'recording' | 'transcribing' | 'done' | 'error';

/**
 * Lehrer-Tipps für "fast richtige" Wörter: reine Buchstaben-Ersetzung
 * erkennen und den Makhradsch-Tipp zum Ziel-Buchstaben liefern (max. 2,
 * damit das Feedback fokussiert bleibt).
 */
function letterTipLines(
  words: WordAlignment[],
): { word: string; spoken: string; tipKey: string }[] {
  const lines: { word: string; spoken: string; tipKey: string }[] = [];
  for (const w of words) {
    if (w.status !== 'near' || !w.nearSpoken) continue;
    const sub = firstSubstitution(w.nearSpoken, normalizeArabic(w.word));
    if (!sub) continue;
    const tipKey = letterTipKey(sub.target);
    if (!tipKey) continue;
    lines.push({ word: w.word, spoken: w.nearSpoken, tipKey });
    if (lines.length >= 2) break;
  }
  return lines;
}

/**
 * Detail für ein einzelnes angetipptes Wort: "erwartet: X, erkannt: Y" —
 * User-Feedback: reine Farbmarkierung zeigt nicht, WAS konkret abwich.
 * Bei near ist closestSpoken == nearSpoken (innerhalb der Toleranz, sicher);
 * bei miss ist es nur ein unverbindlicher "am ehesten gehört"-Kandidat
 * (kann auch fehlen, wenn kein gesprochenes Wort mehr übrig war) — deshalb
 * bewusst unterschiedliche Labels (recognizedLabel vs. closestGuessLabel).
 */
function wordDetail(w: WordAlignment): {
  recognized: string | null;
  confident: boolean;
  tipKey: string | null;
} {
  if (!w.closestSpoken) return { recognized: null, confident: false, tipKey: null };
  const sub = w.status === 'near' ? firstSubstitution(w.closestSpoken, normalizeArabic(w.word)) : null;
  return {
    recognized: w.closestSpoken,
    confident: w.status === 'near',
    tipKey: sub ? letterTipKey(sub.target) : null,
  };
}

export default function HifzPracticeScreen() {
  const { surah, ayah: ayahParam, recite } = useLocalSearchParams<{
    surah: string;
    ayah?: string;
    recite?: string;
  }>();
  const surahNumber = Number(surah);
  // Reader-Einstieg: /hifz/[surah]?ayah=N&recite=1 (siehe reciteFlow.ts)
  const { targetAyah, reciteRequested } = parseReciteParams({ ayah: ayahParam, recite });
  const { settings } = useSettings();
  const hydrated = useHydrated();
  const { t } = useTranslation();
  const { progress, mark } = useHifzProgress();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const { data, isLoading, isError } = useSurahReading(
    surahNumber,
    settings.quranTranslation,
    settings.quranReciter,
  );

  // Vers-Index: solange der User nicht selbst navigiert hat (null), gilt der
  // Deep-Link-Zielvers aus dem Koran-Reader (?ayah=N) — abgeleitet statt per
  // Effect gesetzt, damit kein Cascading-Render entsteht.
  const [indexOverride, setIndex] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const [micState, setMicState] = useState<MicState>('idle');
  const [micResult, setMicResult] = useState<{
    score: number;
    grade: RecitationGrade;
    words: WordAlignment[];
    /** Die für den Score gewählte Transkript-Variante — roh, ohne Alignment. */
    transcript: string;
  } | null>(null);
  // Antippen eines nicht-perfekten Wortes zeigt darunter "erwartet vs.
  // erkannt" (siehe wordDetailLine) — User-Feedback: reine Farbmarkierung
  // war "zu streng" ohne sichtbaren Grund. null = nichts aufgeklappt.
  const [expandedWordIndex, setExpandedWordIndex] = useState<number | null>(null);
  // Nur noch EIN Modus: On-Device-Whisper (Koran-Finetune, whisperModel.ts).
  // Der frühere "Schnell/Browser"-Modus (Browser-SpeechRecognition bzw. ein
  // zweiter Erkennungspfad) wurde auf Nutzerwunsch entfernt — er war ungenauer
  // und verwirrend. Aufsagen prüft immer über das On-Device-Modell.
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  // Live-Zwischentranskript während des Aufsagens — füllt den „leeren Mushaf"
  // Wort für Wort, während man spricht (s. recognizeArabicStreaming).
  const [livePartial, setLivePartial] = useState<string | null>(null);
  // Modell-Bereitschaft: null = noch nicht geprüft. Das Aufsagen setzt ein
  // vollständig geladenes Modell VORAUS — nicht mehr Download während der
  // Aufnahme (scheiterte, s. User-Report). Download läuft persistent weiter,
  // auch wenn man den Screen verlässt (whisperModel-Singleton).
  const [modelReady, setModelReady] = useState<boolean | null>(null);
  const [modelDlPct, setModelDlPct] = useState<number | null>(null);
  // Distinkter, on-screen sichtbarer Fehler statt der früheren generischen
  // „nicht verfügbar"-Meldung: Code + Klartext + rohe Diagnose (Modell da?
  // Mikrofon erlaubt? Roh-Exception) — damit der Nutzer die echte Ursache
  // ablesen und 1:1 durchgeben kann (User-Report: „komplett kaputt", ohne
  // Logcat nicht diagnostizierbar).
  const [micErr, setMicErr] = useState<{ info: WhisperFehlerInfo; diag: WhisperDiagnose | null } | null>(null);
  const [showErrDetail, setShowErrDetail] = useState(false);
  // Ehrlicher Erwartungs-Hinweis (aufklappbar, dezent): das On-Device-Modell
  // ist kein Lehrer-Ersatz. Standardmäßig eingeklappt, damit es nicht drängt.
  const [showRecInfo, setShowRecInfo] = useState(false);
  const recorderRef = useRef<WhisperRecorder | null>(null);

  async function showMicError(e: unknown) {
    const info = beschreibeWhisperFehler(e);
    const diag = await whisperDiagnose().catch(() => null);
    setMicErr({ info, diag });
    setShowErrDetail(false);
    // Modell-Problem (Download/Init/kaputter Header) → Modell wurde verworfen
    // (whisperCheck.loadWhisperContext). modelReady zurücksetzen, damit die UI
    // den Download erneut anbietet.
    if (istModellFehler(e)) setModelReady(false);
    setMicState('error');
  }

  // Freigabe-Status → Klartext-Label für die Diagnose.
  function permStatusLabel(status: string): string {
    if (status === 'granted') return t('hifz.speechError.yes');
    if (status === 'denied') return t('hifz.speechError.no');
    return t('hifz.speechError.unknown');
  }

  useEffect(() => {
    if (!hydrated || !settings.speechExercisesEnabled || !whisperSupported()) return;
    let cancelled = false;
    istWhisperModellHeruntergeladen().then((d) => {
      if (!cancelled) setModelReady(d);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, settings.speechExercisesEnabled]);

  async function downloadModelForRecite() {
    if (modelDlPct !== null) return;
    setModelDlPct(0);
    try {
      await whisperModellHerunterladen((p) => setModelDlPct(Math.round(p.anteil * 100)));
      setModelReady(true);
    } catch {
      setMicState('error');
    } finally {
      setModelDlPct(null);
    }
  }

  const ayahs = data?.ayahs ?? [];
  const index =
    indexOverride ??
    indexForAyah(
      ayahs.map((a) => a.numberInSurah),
      targetAyah,
    ) ??
    0;
  const ayah = ayahs[index];
  const player = useAyahPlayer(
    ayahs.map((a) => ({ numberInSurah: a.numberInSurah, audio: a.audio })),
    data?.meta.englishName ?? '',
  );

  // Puls-Animation für den großen Aufsage-Button während Aufnahme/Analyse
  // (Duolingo-artiges, satt-haptisches Feedback). Bewusst nur Scale/Opacity,
  // KEIN Layout-entering — das läuft auch im Web-Export zuverlässig.
  const micBusy = micState === 'recording' || micState === 'listening' || micState === 'transcribing';
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (micBusy) {
      pulse.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 180 });
    }
  }, [micBusy, pulse]);
  const reciteScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.035 }] }));
  const reciteHaloStyle = useAnimatedStyle(() => ({ opacity: 0.4 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.55 }] }));

  // Aufsagen prüfen: nimmt bis zur erkannten Sprechpause auf (AUTO-STOPP per
  // Stille-Erkennung, s. speech.ts), transkribiert danach on-device mit dem
  // Koran-Modell und bewertet. EIN Tap, kein manuelles Stoppen.
  async function runRecitation() {
    if (!ayah) return;
    setMicResult(null);
    setMicErr(null);
    setLivePartial(null);
    setMicState('listening');
    try {
      const alternatives = await recognizeArabicStreaming({
        expectedText: ayah.arabic,
        onProgress: (p) => setDownloadPercent(p.status === 'downloading' ? p.percent : null),
        // Live-Füllung des Mushaf, während der Nutzer rezitiert.
        onPartial: (t) => setLivePartial(t),
      });
      setDownloadPercent(null);
      setLivePartial(null);
      // Aufnahme lief, aber es kam kein Ton/keine Sprache an (leerer Puffer /
      // zu leise) → als distinkter „noSpeech"-Fehler zeigen statt eines
      // verwirrenden 0-%-Ergebnisses.
      if (alternatives.length === 0) {
        await showMicError(WhisperFehler.noSpeech);
        return;
      }
      const { transcript, score } = bestTranscript(alternatives, ayah.arabic);
      setMicResult({
        score,
        grade: gradeFromSimilarity(score),
        words: alignWords(transcript, ayah.arabic),
        transcript,
      });
      setExpandedWordIndex(null);
      // Gute Aufsage = Vers gilt als aufgesagt → automatisch abhaken.
      if (shouldAutoMarkKnown(score)) {
        hapticSuccess();
        mark(surahNumber, ayah.numberInSurah, 'known');
      } else {
        hapticWarning();
      }
      setMicState('done');
    } catch (e) {
      console.error('[hifz recite] Erkennung fehlgeschlagen:', e instanceof Error ? e.message : String(e));
      setDownloadPercent(null);
      setLivePartial(null);
      await showMicError(e);
    }
  }

  const status = progress[surahNumber]?.[ayah?.numberInSurah ?? -1];
  const known = knownCount(progress, surahNumber);

  // Einzelwort-Vorspielen (Husary-Wort-Audio von quran.com) beim Antippen
  // eines markierten Wortes — "so klingt es richtig", wie beim Lehrer.
  const wordPlayer = useSsrSafeAudioPlayer(null);
  function playMissedWord(wordIndex: number) {
    if (!ayah) return;
    const pad = (n: number) => String(n).padStart(3, '0');
    wordPlayer.replace(
      `https://audio.qurancdn.com/wbw/${pad(surahNumber)}_${pad(ayah.numberInSurah)}_${pad(wordIndex + 1)}.mp3`,
    );
    wordPlayer.play();
  }

  function goTo(nextIndex: number) {
    if (nextIndex >= 0 && nextIndex < ayahs.length) {
      player.stop();
      recorderRef.current?.cancel();
      recorderRef.current = null;
      setIndex(nextIndex);
      setHidden(true);
      // Vers-Wechsel: Mikrofon-Ergebnis des vorherigen Verses verwerfen
      setMicState('idle');
      setMicResult(null);
      setMicErr(null);
      setExpandedWordIndex(null);
      setDownloadPercent(null);
      setLivePartial(null);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          {/* Web hat bereits den schwebenden Zurück-Chip - ein zweites ✕
              daneben war doppelt (Audit 2026-07-19 B8); nativ bleibt es. */}
          {Platform.OS === 'web' ? (
            <View style={styles.closeSpacer} />
          ) : (
            <Pressable
              onPress={() => backOr('/hifz')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.close')}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <IconSymbol name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
          <ThemedText type="subtitle">{data?.meta.englishName ?? ''}</ThemedText>
          <ThemedText type="small" themeColor="accent">
            {ayahs.length > 0 ? `${known}/${ayahs.length}` : ''}
          </ThemedText>
        </View>

        {ayahs.length > 0 && (
          <View style={styles.progressWrap}>
            <ThemedView type="backgroundElement" style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(known / ayahs.length) * 100}%` }]} />
            </ThemedView>
          </View>
        )}

        {/* Ohne-Ton-Testmodus (gapTest.tsx): braucht kein Mikrofon, deshalb
            unabhängig vom aktuellen Vers nutzbar - schon oben sichtbar,
            sobald mindestens ein Vers dieser Sure "Kann ich" markiert ist. */}
        <View style={styles.gapTestLinkWrap}>
          {settings.speechExercisesEnabled && whisperSupported() && (
            <Pressable
              onPress={() => router.push({ pathname: '/hifz/recite-surah', params: { surah: surahNumber } })}
              accessibilityRole="button"
              style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={[styles.actionChip, styles.chipRow]}>
                <IconSymbol name="mic" size={14} color={colors.accent} />
                <ThemedText type="small" themeColor="accent">{t('hifz.surahRecite.cta')}</ThemedText>
              </ThemedView>
            </Pressable>
          )}
          {known > 0 && (
            <Pressable
              onPress={() => router.push({ pathname: '/hifz/gap-test', params: { surah: surahNumber } })}
              accessibilityRole="button"
              style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={[styles.actionChip, styles.chipRow]}>
                <IconSymbol name="eye-off-outline" size={14} color={colors.text} />
                <ThemedText type="small">{t('hifz.gapTestCta')}</ThemedText>
              </ThemedView>
            </Pressable>
          )}
        </View>

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
        {isError && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('quran.loadError')}
            </ThemedText>
          </View>
        )}

        {ayah && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.stepLabelRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('quran.verse')} {ayah.numberInSurah} / {ayahs.length}
              </ThemedText>
              {status === 'known' && <IconSymbol name="checkmark-circle" size={13} color={colors.accent} />}
            </View>

            <PressableCard onPress={() => setHidden((h) => !h)} style={styles.card}>
              {micState === 'listening' ? (
                // Live-Mushaf: füllt sich WÄHREND des Aufsagens Wort für Wort.
                // livePartial ist ein wachsendes Präfix des Gesprochenen →
                // alignWords markiert bereits Gesagtes als hit/near, den Rest
                // als miss (= noch leer). Fehler (near) werden bernstein gefüllt.
                (() => {
                  const liveWords = livePartial ? alignWords(livePartial, ayah.arabic) : null;
                  const rawWords = ayah.arabic.split(/\s+/).filter(Boolean);
                  return (
                    <>
                      <View style={styles.mushafBlanksRow}>
                        {rawWords.map((w, i) => {
                          const st = liveWords?.[i]?.status;
                          return st && st !== 'miss' ? (
                            <ThemedText
                              key={i}
                              style={[
                                styles.liveWord,
                                { color: st === 'near' ? NEAR_WORD_COLOR[scheme] : colors.accent },
                              ]}>
                              {w}
                            </ThemedText>
                          ) : (
                            <View key={i} style={[styles.mushafBlank, { width: Math.min(72, 22 + w.length * 5) }]} />
                          );
                        })}
                      </View>
                      <ThemedText type="small" themeColor="accent">
                        {t('hifz.listening')}
                      </ThemedText>
                    </>
                  );
                })()
              ) : hidden ? (
                <>
                  {/* Leerer Mushaf: pro Wort eine Lücke — man sieht die Struktur
                      des Verses und sagt aus dem Gedächtnis auf. */}
                  <View style={styles.mushafBlanksRow}>
                    {ayah.arabic
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((w, i) => (
                        <View key={i} style={[styles.mushafBlank, { width: Math.min(72, 22 + w.length * 5) }]} />
                      ))}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('hifz.tapToReveal')}
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText style={styles.arabic}>{ayah.arabic}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {ayah.translation}
                  </ThemedText>
                </>
              )}
            </PressableCard>

            {/* Sekundäre Aktionen: Anhören + Text verbergen/zeigen */}
            <View style={styles.secondaryRow}>
              <Pressable
                onPress={() => (player.playing ? player.pause() : player.playFrom(index, false))}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { borderColor: colors.backgroundSelected },
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                ]}>
                <IconSymbol
                  name={player.playing && player.currentIndex === index ? 'pause' : 'volume-high'}
                  size={16}
                  color={colors.accent}
                />
                <ThemedText type="smallBold" themeColor="accent">
                  {t('hifz.listen')}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setHidden((h) => !h)}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { borderColor: colors.backgroundSelected },
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                ]}>
                <IconSymbol name={hidden ? 'eye' : 'eye-off'} size={16} color={colors.text} />
                <ThemedText type="smallBold">{hidden ? t('hifz.reveal') : t('hifz.hide')}</ThemedText>
              </Pressable>
            </View>

            {/* Primärer Aufsage-Button — groß, prominent, EIN Tap, Auto-Stopp.
                Während des Zuhörens rot + Puls; das Stoppen erkennt die App
                selbst an der Sprechpause (s. runRecitation). */}
            {settings.speechExercisesEnabled && hydrated && whisperSupported() && (
              <View style={styles.reciteWrap}>
                {modelReady === false ? (
                  // Modell noch nicht vollständig geladen → erst laden (persistent,
                  // Screen kann verlassen werden — Download läuft weiter).
                  <Pressable
                    onPress={downloadModelForRecite}
                    disabled={modelDlPct !== null}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.reciteButton,
                      styles.reciteFill,
                      { backgroundColor: Brand.gold },
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.pressed,
                    ]}>
                    <IconSymbol name="download-outline" size={20} color={Brand.ink} />
                    <ThemedText type="smallBold" style={[styles.reciteLabel, { color: Brand.ink }]}>
                      {modelDlPct !== null
                        ? t('hifz.modelDownload').replace('{p}', String(modelDlPct))
                        : `${t('settings.storage.whisperModel.download')} · ${formatBytes(aktuelleModellGroesse())}`}
                    </ThemedText>
                  </Pressable>
                ) : (
                  <>
                    {micBusy && <Animated.View pointerEvents="none" style={[styles.reciteHalo, reciteHaloStyle]} />}
                    <Animated.View style={[styles.reciteFill, reciteScaleStyle]}>
                      <Pressable
                        onPress={runRecitation}
                        disabled={micBusy || modelReady === null}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.reciteButton,
                          { backgroundColor: micBusy ? '#e5544b' : Brand.gold },
                          Platform.OS === 'web' ? styles.pressableWeb : undefined,
                          pressed && styles.pressed,
                        ]}>
                        <IconSymbol name="mic" size={22} color={micBusy ? '#fff' : Brand.ink} />
                        <ThemedText
                          type="smallBold"
                          style={[styles.reciteLabel, { color: micBusy ? '#fff' : Brand.ink }]}>
                          {micBusy ? t('hifz.listening') : t('hifz.micCheck')}
                        </ThemedText>
                      </Pressable>
                    </Animated.View>
                  </>
                )}
              </View>
            )}
            {modelReady === false && modelDlPct === null && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.micNote}>
                {t('hifz.modelNeededHint')}
              </ThemedText>
            )}

            {downloadPercent !== null && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('hifz.modelDownload').replace('{p}', String(downloadPercent))}
              </ThemedText>
            )}

            {/* Einstieg aus dem Koran-Reader: den Aufsage-Check aktiv anbieten */}
            {reciteRequested &&
              micState === 'idle' &&
              settings.speechExercisesEnabled &&
              hydrated &&
              (recognitionAvailable() || whisperSupported()) && (
                <ThemedText type="small" themeColor="accent" style={styles.micNote}>
                  {t('hifz.reciteFromReaderHint')}
                </ThemedText>
              )}

            {micState === 'done' && micResult && (
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.micResult,
                  micResult.grade === 'excellent' && styles.micExcellent,
                  micResult.grade === 'good' && styles.micGood,
                  micResult.grade === 'retry' && styles.micRetry,
                ]}>
                <View style={styles.chipRow}>
                  <IconSymbol
                    name={micResult.grade === 'excellent' ? 'star' : micResult.grade === 'good' ? 'thumbs-up' : 'refresh'}
                    size={16}
                    color={colors.text}
                  />
                  <ThemedText type="smallBold">
                    {Math.round(micResult.score * 100)}% · {t(`hifz.grade.${micResult.grade}`)}
                  </ThemedText>
                </View>
                {/* Wort-für-Wort wie beim Lehrer: exakt = neutral, fast
                    richtig = bernstein, gefehlt = rot. Antippen spielt das
                    Wort in Husary-Rezitation vor (wbw-Einzelwort-Audio) UND
                    klappt bei near/miss das Detail auf ("erwartet vs.
                    erkannt") — User-Feedback: reine Farbe zeigt nicht, WAS
                    abwich. */}
                {micResult.words.some((w) => w.status !== 'hit') && (
                  <>
                    <View style={styles.micWordsRow}>
                      {micResult.words.map((w, i) => (
                        <Animated.View
                          key={i}
                          entering={FadeIn.delay(i * 70).duration(280)}>
                        <Pressable
                          onPress={() => {
                            playMissedWord(i);
                            if (w.status !== 'hit') setExpandedWordIndex((cur) => (cur === i ? null : i));
                          }}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityLabel={t('a11y.playAudio')}
                          style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                          <ThemedText
                            style={[
                              styles.micWord,
                              w.status === 'near' && {
                                backgroundColor:
                                  scheme === 'dark' ? 'rgba(212,175,55,0.30)' : 'rgba(180,140,30,0.18)',
                                color: scheme === 'dark' ? '#e2c368' : '#8a6a12',
                              },
                              w.status === 'miss' && {
                                backgroundColor:
                                  scheme === 'dark' ? 'rgba(224,93,68,0.28)' : 'rgba(192,67,46,0.16)',
                                color: scheme === 'dark' ? '#e0604a' : '#a53a26',
                              },
                              expandedWordIndex === i && w.status !== 'hit' && styles.micWordExpanded,
                            ]}>
                            {w.word}
                          </ThemedText>
                        </Pressable>
                        </Animated.View>
                      ))}
                    </View>
                    {expandedWordIndex !== null &&
                      micResult.words[expandedWordIndex] &&
                      micResult.words[expandedWordIndex].status !== 'hit' &&
                      (() => {
                        const w = micResult.words[expandedWordIndex];
                        const detail = wordDetail(w);
                        return (
                          <ThemedView type="backgroundSelected" style={styles.wordDetail}>
                            <ThemedText type="small">
                              {t('hifz.expectedLabel')}: {w.word}
                            </ThemedText>
                            <ThemedText type="small" themeColor={detail.confident ? 'text' : 'textSecondary'}>
                              {detail.recognized
                                ? `${t(detail.confident ? 'hifz.recognizedLabel' : 'hifz.closestGuessLabel')}: „${detail.recognized}“`
                                : t('hifz.notRecognizedLabel')}
                            </ThemedText>
                            {detail.tipKey && (
                              <ThemedText type="small" themeColor="textSecondary">
                                {t(`hifz.letterTips.${detail.tipKey}`)}
                              </ThemedText>
                            )}
                          </ThemedView>
                        );
                      })()}
                    {letterTipLines(micResult.words).map((line, i) => (
                      <ThemedText key={i} type="small" themeColor="textSecondary" style={styles.micNote}>
                        {line.word}: {t('hifz.nearLabel')} {`„${line.spoken}“`} — {t(`hifz.letterTips.${line.tipKey}`)}
                      </ThemedText>
                    ))}
                    {micResult.transcript !== '' && (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.micNote}>
                        {t('hifz.youSaid').replace('{transcript}', micResult.transcript)}
                      </ThemedText>
                    )}
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('hifz.micMissedHint')} {t('hifz.tapWordHint')}
                    </ThemedText>
                  </>
                )}
                {/* Auto-Abhaken: ab Note "good" wird der Vers als "Kann ich"
                    markiert (shouldAutoMarkKnown) — hier die Bestätigung. */}
                {micResult.grade !== 'retry' && (
                  <View style={styles.chipRow}>
                    <IconSymbol name="checkmark-circle" size={14} color={colors.accent} />
                    <ThemedText type="small" themeColor="accent">
                      {t('hifz.autoMarked')}
                    </ThemedText>
                  </View>
                )}
                <ThemedText type="small" themeColor="textSecondary" style={styles.micNote}>
                  {t('hifz.micNote')}
                </ThemedText>
              </ThemedView>
            )}
            {micState === 'error' && micErr && (
              <ThemedView type="backgroundElement" style={[styles.micResult, styles.micRetry]}>
                <View style={styles.chipRow}>
                  <IconSymbol name="alert-circle" size={16} color={colors.text} />
                  <ThemedText type="smallBold">{t('hifz.speechError.heading')}</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.micNote}>
                  {t(`hifz.speechError.${micErr.info.i18nKey}Msg`)}
                </ThemedText>
                {/* Diagnose: Modell vorhanden? Mikrofon-Freigabe? — beantwortet
                    die häufigsten realen Ursachen direkt auf dem Screen. */}
                {micErr.diag && (
                  <View style={styles.diagRow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('hifz.speechError.model')}:{' '}
                      {micErr.diag.modellVorhanden ? t('hifz.speechError.yes') : t('hifz.speechError.no')}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('hifz.speechError.permission')}: {permStatusLabel(micErr.diag.mikrofonStatus)}
                    </ThemedText>
                  </View>
                )}
                {/* Dauerhaft verweigertes Mikrofon (Audit 2026-07-27, N9): ohne
                    diesen Weg endet der Screen in einer Sackgasse. */}
                {micErr.diag?.mikrofonStatus === 'denied' && (
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
                {/* Aufklappbares technisches Detail (Code + rohe Exception) —
                    selektierbar, damit der Nutzer es 1:1 durchgeben kann. */}
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
                  <ThemedView type="backgroundSelected" style={styles.wordDetail}>
                    <ThemedText type="code" themeColor="textSecondary" selectable>
                      {t('hifz.speechError.code')}: {micErr.info.code ?? '—'}
                    </ThemedText>
                    {micErr.info.detail ? (
                      <ThemedText type="code" themeColor="textSecondary" selectable>
                        {micErr.info.detail}
                      </ThemedText>
                    ) : null}
                  </ThemedView>
                )}
              </ThemedView>
            )}

            <View style={styles.gradeRow}>
              <PressableCard
                onPress={() => {
                  mark(surahNumber, ayah.numberInSurah, 'learning');
                  goTo(index);
                }}
                style={[styles.gradeButton, styles.chipRow]}>
                <IconSymbol name="refresh" size={14} color={colors.text} />
                <ThemedText type="default">{t('hifz.stillLearning')}</ThemedText>
              </PressableCard>
              <PressableCard
                onPress={() => {
                  mark(surahNumber, ayah.numberInSurah, 'known');
                  goTo(index + 1 < ayahs.length ? index + 1 : index);
                }}
                type="backgroundSelected"
                style={[styles.gradeButton, styles.chipRow]}>
                <IconSymbol name="checkmark" size={14} color={colors.accent} />
                <ThemedText type="smallBold" themeColor="accent">
                  {t('hifz.gotIt')}
                </ThemedText>
              </PressableCard>
            </View>

            <View style={styles.navRow}>
              <Pressable
                onPress={() => goTo(index - 1)}
                disabled={index === 0}
                style={({ pressed }) => [
                  styles.chipRow,
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                ]}>
                <IconSymbol name="chevron-back" size={14} color={index === 0 ? colors.textSecondary : colors.accent} />
                <ThemedText type="small" themeColor={index === 0 ? 'textSecondary' : 'accent'}>
                  {t('learn.back')}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => goTo(index + 1)}
                disabled={index + 1 >= ayahs.length}
                style={({ pressed }) => [
                  styles.chipRow,
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  type="small"
                  themeColor={index + 1 >= ayahs.length ? 'textSecondary' : 'accent'}>
                  {t('learn.next')}
                </ThemedText>
                <IconSymbol
                  name="chevron-forward"
                  size={14}
                  color={index + 1 >= ayahs.length ? colors.textSecondary : colors.accent}
                />
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three + BackChipInset },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  // Platzhalter in ✕-Breite, damit der Titel auf Web zentriert bleibt.
  closeSpacer: { width: 20 },
  progressWrap: { paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  gapTestLinkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Brand.gold, borderRadius: 3 },
  content: { padding: Spacing.four, gap: Spacing.three, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  stepLabelRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    minHeight: 140,
    justifyContent: 'center',
  },
  arabic: { fontSize: 26, lineHeight: 46, textAlign: 'center' },
  hiddenDots: { fontSize: 32, lineHeight: 44 },
  // Leerer Mushaf: Wort-Lücken (RTL: erstes Vers-Wort rechts).
  mushafBlanksRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  mushafBlank: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.45)',
  },
  // Live gefülltes Wort während des Aufsagens (bereits erkannt).
  liveWord: { fontSize: 22, lineHeight: 40, paddingHorizontal: 4 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  actionChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Sekundäre Aktionen (Anhören/Verbergen): dezente Outline-Buttons nebeneinander.
  secondaryRow: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center', marginTop: Spacing.two },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  // Primärer Aufsage-Button: groß, prominent, mit Puls-Halo.
  reciteWrap: { alignItems: 'center', justifyContent: 'center', marginTop: Spacing.three },
  reciteFill: { alignSelf: 'stretch' },
  reciteHalo: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: Brand.gold,
  },
  reciteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 999,
    minHeight: 56,
    shadowColor: Brand.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  reciteLabel: { fontSize: 16, letterSpacing: 0.2 },
  micResult: { padding: Spacing.three, borderRadius: Spacing.two, alignItems: 'center', gap: Spacing.two },
  micWordsRow: {
    flexDirection: 'row-reverse', // RTL: erstes Vers-Wort rechts
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  micWord: {
    fontSize: 20,
    lineHeight: 34,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  micWordExpanded: {
    textDecorationLine: 'underline',
  },
  wordDetail: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    gap: 2,
    alignSelf: 'stretch',
  },
  micNote: { textAlign: 'center' },
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
  diagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.three },
  modeRow: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center', marginTop: Spacing.two },
  modeChip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  micExcellent: { backgroundColor: 'rgba(74,222,128,0.25)' },
  micGood: { backgroundColor: 'rgba(212,175,55,0.2)' },
  micRetry: { backgroundColor: 'rgba(248,113,113,0.2)' },
  gradeRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  gradeButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
});
