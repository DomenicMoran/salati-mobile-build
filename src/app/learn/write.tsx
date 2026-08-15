// Schreibübung als Gedächtnis-Test: Buchstabe aus dem Kopf zeichnen (Vorlage
// ausgeblendet), dann per „Vergleichen" die Vorlage halbtransparent ÜBER die
// eigene Zeichnung legen, ehrlich bewerten und mit „Weiter" zum nächsten
// Buchstaben — Fortschritt pro Buchstabe in salatibox:writing.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useReducer, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { IntroHelpButton } from '@/components/ui/intro-help-button';
import { IntroSheet } from '@/components/ui/intro-sheet';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { speakArabic } from '@/features/learn/audio';
import { LETTERS } from '@/features/learn/letters';
import {
  appendPoint,
  initialWriteState,
  parseWriting,
  startStroke,
  WRITE_CANVAS,
  writeReducer,
  type WritingProgress,
} from '@/features/learn/writing';
import { useExerciseIntro } from '@/hooks/use-exercise-intro';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const STORAGE_KEY = 'salatibox:writing';

// pageX/pageY plattformübergreifend lesen: RN Native liefert sie direkt am
// nativeEvent, RN-Web (Touch) nur an touches/changedTouches.
function eventPageXY(evt: GestureResponderEvent): { x: number; y: number } | null {
  const ne = evt.nativeEvent;
  if (Number.isFinite(ne.pageX) && Number.isFinite(ne.pageY)) {
    return { x: ne.pageX, y: ne.pageY };
  }
  const touch = ne.touches?.[0] ?? ne.changedTouches?.[0];
  if (touch && Number.isFinite(touch.pageX) && Number.isFinite(touch.pageY)) {
    return { x: touch.pageX, y: touch.pageY };
  }
  return null;
}

export default function WritingScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const intro = useExerciseIntro('write');
  const [selected, setSelected] = useState(0);
  const [state, dispatch] = useReducer(writeReducer, initialWriteState);
  const [currentStroke, setCurrentStroke] = useState('');
  const [progress, setProgress] = useState<WritingProgress>({});
  // Während des Zeichnens darf die Seite nicht mitscrollen (User-Bug).
  const [drawing, setDrawing] = useState(false);

  // Zeichen-Zustand in Refs: Gesten-Handler laufen mit hoher Frequenz und
  // dürfen nicht pro Move-Event ein Re-Render auslösen.
  const canvasRef = useRef<View>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const strokeRef = useRef('');
  const rafRef = useRef<number | null>(null);

  const letter = LETTERS[selected];

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
        if (!cancelled) setProgress(parseWriting(raw));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Punkte pro Frame gebündelt in den State schreiben (statt pro Move-Event
  // ein Re-Render) — macht das Zeichnen auf 120-Hz-Geräten flüssig.
  function flushStroke() {
    rafRef.current = null;
    setCurrentStroke(strokeRef.current);
  }
  function scheduleFlush() {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushStroke);
  }

  function handleGrant(evt: GestureResponderEvent) {
    setDrawing(true);
    const page = eventPageXY(evt);
    // Koordinaten über pageX/pageY minus Canvas-Ursprung statt
    // locationX/locationY — locationX springt, sobald der Finger/Zeiger über
    // andere Views wandert (Web wie Native unzuverlässig).
    canvasRef.current?.measureInWindow((x, y) => {
      originRef.current = { x, y };
      if (page) {
        strokeRef.current = startStroke(page.x - x, page.y - y);
        scheduleFlush();
      }
    });
  }

  function handleMove(evt: GestureResponderEvent) {
    const origin = originRef.current;
    const page = eventPageXY(evt);
    if (!origin || !page || !strokeRef.current) return;
    strokeRef.current = appendPoint(strokeRef.current, page.x - origin.x, page.y - origin.y);
    scheduleFlush();
  }

  function endStroke() {
    setDrawing(false);
    const finished = strokeRef.current;
    strokeRef.current = '';
    originRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setCurrentStroke('');
    if (finished) dispatch({ type: 'strokeEnd', stroke: finished });
  }

  function clear() {
    strokeRef.current = '';
    setCurrentStroke('');
    dispatch({ type: 'clear' });
  }

  function advance(hit: boolean) {
    if (hit) {
      const next = { ...progress, [letter.id]: (progress[letter.id] ?? 0) + 1 };
      setProgress(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }
    strokeRef.current = '';
    setCurrentStroke('');
    dispatch({ type: 'next' });
    setSelected((s) => (s + 1) % LETTERS.length);
  }

  const comparing = state.phase === 'compare';
  const canCompare = state.strokes.length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          title={t('write.title')}
          subtitle={t('write.subtitle')}
          right={<IntroHelpButton onPress={intro.show} color={colors.textSecondary} />}
        />
        <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={!drawing}>
          {/* Buchstaben-Auswahl */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.letterRow}>
            {LETTERS.map((l, i) => (
              <Pressable
                key={l.id}
                onPress={() => {
                  setSelected(i);
                  clear();
                }}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedView
                  type={i === selected ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.letterChip}>
                  {/* Die eigene Glyphe des GERADE zu übenden Buchstabens ist
                      während des Zeichnens ausgeblendet — sonst wäre die
                      Auswahlleiste selbst eine Vorschau und unterläuft den
                      Gedächtnis-Test (Nutzer-Fund: "sieht man oben immer
                      eine Vorschau"). Andere Buchstaben bleiben sichtbar,
                      damit man weiterhin gezielt wählen kann. */}
                  <ThemedText style={styles.letterChipText}>
                    {i === selected && !comparing ? '？' : l.arabic}
                  </ThemedText>
                  {(progress[l.id] ?? 0) > 0 && (
                    <ThemedText type="small" themeColor="accent">
                      {progress[l.id]}✓
                    </ThemedText>
                  )}
                </ThemedView>
              </Pressable>
            ))}
          </ScrollView>

          {/* Zeichenfläche: Vorlage ist beim Zeichnen ausgeblendet (Gedächtnis-
              Test) und erscheint erst beim Vergleichen ÜBER der Zeichnung. */}
          <View style={styles.canvasWrap}>
            {/* Plain View statt ThemedView: braucht die ref für measureInWindow.
                Responder-Props direkt am View (statt PanResponder):
                onResponderTerminationRequest=false ist der Kernfix — die
                umgebende ScrollView darf den Responder mitten im Strich NICHT
                übernehmen (Default true → Strich bricht ab, Seite scrollt). */}
            <View
              ref={canvasRef}
              style={[styles.canvas, { backgroundColor: colors.backgroundElement }]}
              onStartShouldSetResponder={() => !comparing}
              onMoveShouldSetResponder={() => !comparing}
              onResponderTerminationRequest={() => false}
              onResponderGrant={handleGrant}
              onResponderMove={handleMove}
              onResponderRelease={endStroke}
              onResponderTerminate={endStroke}>
              <Svg width={WRITE_CANVAS} height={WRITE_CANVAS} style={StyleSheet.absoluteFill} pointerEvents="none">
                {[...state.strokes, currentStroke].filter(Boolean).map((points, i) => (
                  <Polyline
                    key={i}
                    points={points}
                    fill="none"
                    stroke={colors.accent}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </Svg>
              {comparing && (
                <ThemedText style={[styles.template, { color: colors.textSecondary }]} pointerEvents="none">
                  {letter.arabic}
                </ThemedText>
              )}
            </View>
          </View>

          <View style={styles.nameRow}>
            <ThemedText type="subtitle">{letter.name}</ThemedText>
            <Pressable
              onPress={() => speakArabic(letter.arabicName)}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.playAudio')}
              style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
              <IconSymbol name="volume-high" size={20} color={colors.accent} />
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            <PressableCard onPress={clear} disabled={!canCompare && currentStroke === ''} style={styles.actionButton}>
              <View style={styles.actionInner}>
                <IconSymbol name="refresh" size={16} color={colors.text} />
                <ThemedText type="small">{t('write.clear')}</ThemedText>
              </View>
            </PressableCard>
            {!comparing ? (
              <PressableCard
                onPress={() => dispatch({ type: 'compare' })}
                disabled={!canCompare}
                type="backgroundSelected"
                style={styles.actionButton}>
                <View style={styles.actionInner}>
                  <IconSymbol name="eye-outline" size={16} color={colors.accent} />
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('write.compare')}
                  </ThemedText>
                </View>
              </PressableCard>
            ) : (
              <>
                <PressableCard
                  onPress={() => advance(true)}
                  type="backgroundSelected"
                  style={styles.actionButton}>
                  <View style={styles.actionInner}>
                    <IconSymbol name="checkmark" size={16} color={colors.accent} />
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('write.hit')}
                    </ThemedText>
                  </View>
                </PressableCard>
                <PressableCard onPress={() => advance(false)} style={styles.actionButton}>
                  <View style={styles.actionInner}>
                    <IconSymbol name="arrow-forward" size={16} color={colors.text} />
                    <ThemedText type="small">{t('write.next')}</ThemedText>
                  </View>
                </PressableCard>
              </>
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {t(comparing ? 'write.hint' : 'write.drawFromMemory')}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
      <IntroSheet
        visible={intro.visible}
        onClose={intro.dismiss}
        title={t('practice.intro.write.title')}
        what={t('practice.intro.write.what')}
        why={t('practice.intro.write.why')}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: { paddingTop: Spacing.three, paddingBottom: Spacing.five, alignItems: 'center', alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  letterRow: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  letterChip: {
    minWidth: 52,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  letterChipText: { fontSize: 26, lineHeight: 40 },
  canvasWrap: { alignItems: 'center' },
  canvas: {
    // Web: verhindert, dass der Browser Touch-Gesten als Scroll/Zoom frisst,
    // und dass Draggen Text selektiert — sonst kommen keine Move-Events an.
    touchAction: 'none' as never,
    userSelect: 'none' as never,
    width: WRITE_CANVAS,
    height: WRITE_CANVAS,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Vergleichs-Overlay: halbtransparent ÜBER der eigenen Zeichnung.
  template: { fontSize: 180, lineHeight: 260, opacity: 0.45 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  actionRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  actionButton: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  actionInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { textAlign: 'center', marginTop: Spacing.three, paddingHorizontal: Spacing.five },
  pressableWeb: { cursor: 'pointer' },
});
