import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

// Grün für den "ausgerichtet"-Zustand (identisch zum Halal-Scanner-halal-Grün),
// klar unterscheidbar vom sonst durchgehenden Gold der Marke.
const ALIGNED_GREEN = '#16a34a';

// Halbe horizontale Sichtfeld-Näherung einer Handy-Rückkamera (~60–70° FOV).
// Innerhalb dieses Fensters wird der Kaaba-Marker horizontal proportional zur
// Winkeldifferenz platziert; außerhalb wird er an den Rand geheftet und ein
// Dreh-Pfeil eingeblendet.
const FOV_HALF_DEG = 30;
// Winkelfenster, ab dem "ausgerichtet" gilt (enger als der Kompass, weil das
// Kamerabild eine präzisere Referenz liefert).
const ALIGN_THRESHOLD_DEG = 6;

/** Kürzeste Winkeldifferenz von `from` nach `to`, im Bereich (-180, 180]. */
function shortestDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export interface QiblaArViewProps {
  /** Aktuelles Geräte-Heading (0–360°) aus useCompass. */
  heading: number;
  /** Berechnetes Qibla-Bearing (0–360°) für den Standort. */
  bearing: number;
  /** Sensor-Verfügbarkeit aus useCompass (null = noch unbekannt). */
  available: boolean | null;
  /** Kalibrierungs-Hinweis aus useCompass. */
  needsCalibration: boolean;
  /** Zurück zur Kompass-Ansicht (auch der einzige Ausweg bei abgelehnter Kamera). */
  onClose: () => void;
}

/**
 * AR-/Kamera-Qibla-Ansicht: Live-Kamerabild als Hintergrund, darüber ein
 * Overlay, das die Qibla-Richtung relativ zur aktuellen Blickrichtung anzeigt.
 *
 * Bewusst NUR nativ: die `.web.tsx`-Variante rendert einen Hinweis. Der Sensor
 * (Heading) läuft im Eltern-Screen (useCompass, fokus-gebunden) — diese
 * Komponente abonniert KEINEN eigenen Sensor, sondern bekommt `heading` als
 * Prop. Die Kamera wird beim Unmounten (Zurück zur Kompass-Ansicht oder
 * Verlassen des Screens) automatisch von expo-camera freigegeben.
 */
export default function QiblaArView({ heading, bearing, available, needsCalibration, onClose }: QiblaArViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();

  // delta > 0  → Qibla liegt im Uhrzeigersinn rechts der Blickrichtung → rechts drehen.
  const delta = shortestDelta(heading, bearing);
  const withinView = Math.abs(delta) <= FOV_HALF_DEG;
  const aligned = available === true && Math.abs(delta) <= ALIGN_THRESHOLD_DEG;

  // Horizontale Marker-Position: innerhalb des FOV proportional, sonst am Rand
  // geheftet. maxOffset hält den Marker mit Rand sichtbar.
  const clamped = Math.max(-FOV_HALF_DEG, Math.min(FOV_HALF_DEG, delta));
  const maxOffset = width * 0.4;
  const markerX = (clamped / FOV_HALF_DEG) * maxOffset;

  // Haptischer Impuls beim Einrasten auf die Qibla — mit Cooldown, damit das
  // Pendeln des Headings beim Gehen nicht bei jedem Durchlauf vibriert
  // (gleiches Muster wie der Kompass-Screen).
  const wasAligned = useRef(false);
  const lastHapticAt = useRef(0);
  useEffect(() => {
    if (aligned && !wasAligned.current) {
      const now = Date.now();
      if (now - lastHapticAt.current > 5000) {
        lastHapticAt.current = now;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
    wasAligned.current = aligned;
  }, [aligned]);

  // Kamera-Berechtigung noch nicht geladen.
  if (!permission) {
    return (
      <ThemedView style={styles.fallbackContainer}>
        <SafeAreaView style={styles.fallbackSafe}>
          <BackButton label={t('qibla.ar.backToCompass')} onPress={onClose} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Kamera-Berechtigung fehlt: sauber erklären + anfragen. Bei endgültiger
  // Ablehnung (canAskAgain === false) klare Meldung + Weg zurück zum Kompass,
  // KEIN Crash.
  if (!permission.granted) {
    return (
      <ThemedView style={styles.fallbackContainer}>
        <SafeAreaView style={styles.fallbackSafe}>
          <View style={styles.fallbackBody}>
            <IconSymbol name="camera-outline" size={44} color={Brand.gold} />
            <ThemedText type="subtitle" style={styles.fallbackTitle}>
              {t('qibla.ar.permissionTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.fallbackText}>
              {permission.canAskAgain ? t('qibla.ar.permissionBody') : t('qibla.ar.cameraDenied')}
            </ThemedText>
            {/* Dauerhaft verweigert (Audit 2026-07-27, N9): requestPermission()
                zeigt dann keinen Systemdialog mehr — stattdessen direkt in die
                Systemeinstellungen fuehren. Im normalen Fall heisst der Knopf
                „Weiter"/„Continue" statt „Kamera erlauben" (Apple-Ablehnung
                1.33.0, Guideline 5.1.1(iv)) — er fuehrt zur Systemabfrage,
                erlaubt aber selbst nichts. */}
            <Pressable
              onPress={() =>
                permission.canAskAgain ? void requestPermission() : void Linking.openSettings()
              }
              accessibilityRole="button"
              accessibilityLabel={
                permission.canAskAgain ? t('common.continue') : t('common.openSettings')
              }
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedView type="backgroundSelected" style={styles.primaryButtonInner}>
                <ThemedText type="smallBold" themeColor="accent">
                  {permission.canAskAgain ? t('common.continue') : t('common.openSettings')}
                </ThemedText>
              </ThemedView>
            </Pressable>
            <BackButton label={t('qibla.ar.backToCompass')} onPress={onClose} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const ringColor = aligned ? ALIGNED_GREEN : Brand.gold;

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Overlay über dem Kamerabild. pointerEvents box-none, damit nur die
          Buttons Taps abfangen, nicht die gesamte Fläche. */}
      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Kopfzeile: Zurück-Button + Instruktion. */}
        <View style={styles.header} pointerEvents="box-none">
          <BackButton label={t('qibla.ar.backToCompass')} onPress={onClose} overlay />
          <View style={styles.instructionPill}>
            <ThemedText type="small" style={styles.overlayText}>
              {aligned ? t('qibla.aligned') : t('qibla.ar.instruction')}
            </ThemedText>
          </View>
        </View>

        {/* Bildmitte: Horizont-Linie + Kaaba-Marker. */}
        <View style={styles.centerRow} pointerEvents="none">
          {/* Dreh-Pfeil, wenn die Qibla außerhalb des Sichtfelds liegt. */}
          {!withinView && (
            <View style={[styles.turnArrow, delta > 0 ? styles.turnRight : styles.turnLeft]}>
              <IconSymbol name={delta > 0 ? 'chevron-forward' : 'chevron-back'} size={48} color={Brand.gold} />
              <ThemedText type="smallBold" style={styles.overlayText}>
                {delta > 0 ? t('qibla.ar.turnRight') : t('qibla.ar.turnLeft')}
              </ThemedText>
            </View>
          )}

          {/* Kaaba-Marker: horizontal je nach Winkeldifferenz verschoben. */}
          <View style={[styles.marker, { transform: [{ translateX: markerX }] }]}>
            <View style={[styles.markerRing, { borderColor: ringColor }]}>
              <ThemedText type="subtitle" style={styles.kaaba}>
                🕋
              </ThemedText>
            </View>
            {aligned && (
              <View style={styles.alignedBadge}>
                <IconSymbol name="checkmark-circle" size={18} color="#ffffff" />
              </View>
            )}
          </View>
        </View>

        {/* Fußzeile: Bearing-Grad + Dreh-/Ausrichtungs-Text + Kalibrier-Hinweis. */}
        <View style={styles.footer} pointerEvents="none">
          {available === true && (
            <View style={[styles.footerPill, aligned && styles.footerPillAligned]}>
              <ThemedText type="smallBold" style={styles.overlayText}>
                {aligned
                  ? t('qibla.aligned')
                  : `${Math.round(bearing)}° · ${
                      delta > 0 ? t('qibla.ar.turnRight') : t('qibla.ar.turnLeft')
                    }`}
              </ThemedText>
            </View>
          )}
          {needsCalibration && (
            <View style={styles.footerPill}>
              <IconSymbol name="compass-outline" size={16} color={Brand.gold} />
              <ThemedText type="small" style={styles.overlayText}>
                {t('qibla.calibrateHint')}
              </ThemedText>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function BackButton({ label, onPress, overlay }: { label: string; onPress: () => void; overlay?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [
        styles.backButton,
        overlay ? styles.backButtonOverlay : styles.backButtonPlain,
        Platform.OS === 'web' && styles.pressableWeb,
        pressed && styles.pressed,
      ]}>
      <IconSymbol name="chevron-back" size={18} color={overlay ? '#ffffff' : Brand.gold} />
      <ThemedText type="smallBold" style={overlay ? styles.overlayText : undefined} themeColor={overlay ? undefined : 'accent'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  instructionPill: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  centerRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: { alignItems: 'center', justifyContent: 'center' },
  markerRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kaaba: { fontSize: 40, lineHeight: 48 },
  alignedBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: ALIGNED_GREEN,
    borderRadius: 12,
    padding: 2,
  },
  turnArrow: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
    top: '50%',
    marginTop: -40,
  },
  turnLeft: { left: 16 },
  turnRight: { right: 16 },
  footer: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  footerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    maxWidth: 360,
  },
  footerPillAligned: { backgroundColor: 'rgba(22,163,74,0.75)' },
  overlayText: { color: '#ffffff', textAlign: 'center' },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonOverlay: { backgroundColor: 'rgba(0,0,0,0.5)' },
  backButtonPlain: { alignSelf: 'center' },
  fallbackContainer: { flex: 1 },
  fallbackSafe: { flex: 1, padding: 24, justifyContent: 'center' },
  fallbackBody: { alignItems: 'center', gap: 12 },
  fallbackTitle: { textAlign: 'center' },
  fallbackText: { textAlign: 'center', maxWidth: 340, lineHeight: 20 },
  primaryButton: { alignSelf: 'center', marginTop: 8 },
  primaryButtonInner: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 24,
    minWidth: 160,
    alignItems: 'center',
  },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
});
