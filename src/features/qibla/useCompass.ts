import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { isHeadingNoisy, isLowNativeAccuracy, type HeadingSample } from './calibration';

/** Kürzeste Winkeldifferenz (für stabiles Lerp über die 0°/360°-Grenze hinweg). */
export function angleLerp(from: number, to: number, t: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
}

/**
 * Vorzeichen der Bildschirm-Rotationskorrektur (Audit 2026-07-27, Befund O3).
 *
 * `alpha` wird am GERÄTE-Rahmen (natürliches Portrait) gemessen. Dreht der
 * Nutzer den Bildschirm, muss `screen.orientation.angle` herausgerechnet
 * werden, damit „oben auf dem Bildschirm" die Referenz bleibt. Es kursieren
 * zwei Formeln:
 *
 * - `'add'`    → `360 - alpha + screenAngle`  (bisheriges Verhalten dieser App)
 * - `'subtract'` → `360 - (alpha + screenAngle)` (die häufiger zitierte Form)
 *
 * Sie unterscheiden sich um `2 × screenAngle`; im Querformat (90°) liegen
 * zwischen ihnen 180°. Welche stimmt, ist ohne echtes Gerät im Querformat
 * NICHT entscheidbar — eine Änderung auf Verdacht würde die Qibla-Nadel
 * möglicherweise erst falsch drehen. Deshalb hier bewusst keine Änderung,
 * sondern ein benannter Schalter plus Testabdeckung beider Konventionen.
 *
 * **Geräte-Prüfung (dauert 2 Minuten):** Qibla-Screen im Hochformat öffnen,
 * Gerät so hinlegen, dass die Nadel z. B. nach Norden zeigt, Position
 * beibehalten und das Gerät um 90° ins Querformat drehen (Auto-Rotation an).
 * Zeigt die Nadel weiter in dieselbe Weltrichtung, ist `'add'` richtig;
 * springt sie um ~180°, ist `'subtract'` richtig — dann hier auf
 * `'subtract'` stellen, sonst nichts ändern. `useCompass.test.ts` deckt
 * beide Konventionen mit denselben Beispielwerten ab, die Umstellung ist ein
 * Einzeiler.
 */
export type ScreenAngleConvention = 'add' | 'subtract';

export const SCREEN_ANGLE_CONVENTION: ScreenAngleConvention = 'add';

/**
 * Kompass-Heading aus einem DeviceOrientation-Event (Web).
 * iOS Safari liefert direkt `webkitCompassHeading` (0° = Norden, im
 * Uhrzeigersinn). Andere Browser liefern `alpha` (gegen den Uhrzeigersinn),
 * das nur bei `absolute === true` wirklich am Erdmagnetfeld hängt —
 * relative Werte wären als Kompass irreführend und werden verworfen.
 *
 * `convention` ist nur für die Geräte-Prüfung/Tests explizit setzbar; im
 * Betrieb gilt `SCREEN_ANGLE_CONVENTION`.
 */
export function headingFromOrientationEvent(
  e: {
    webkitCompassHeading?: number | null;
    absolute?: boolean;
    alpha: number | null;
  },
  screenAngle: number = 0,
  convention: ScreenAngleConvention = SCREEN_ANGLE_CONVENTION,
): number | null {
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
    return ((e.webkitCompassHeading % 360) + 360) % 360;
  }
  if (e.absolute && typeof e.alpha === 'number') {
    const correction = convention === 'add' ? screenAngle : -screenAngle;
    // +720 statt +360: `alpha` kann bis 360 und `correction` bis -360 gehen,
    // die Summe muss vor dem Modulo sicher positiv sein.
    return (360 - e.alpha + correction + 720) % 360;
  }
  return null;
}

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

/**
 * Liefert das Geräte-Heading (0–360°), geglättet über einen einfachen
 * Tiefpass (Lerp), um Jitter der Nadel zu vermeiden.
 *
 * - **Nativ**: `Location.watchHeadingAsync` — das vom OS fusionierte,
 *   kippkompensierte Kompass-Heading. Die frühere eigene Formel
 *   `atan2(y, x)` auf rohen Magnetometer-Werten war KEIN echtes
 *   Kompass-Heading (falsche Achsen/Referenz, nicht kippkompensiert) —
 *   die Nadel zeigte auf echten Geräten in die falsche Richtung.
 * - **Web**: `deviceorientation(absolute)`-Events; auf iOS Safari ist dafür
 *   eine explizite Nutzer-Geste nötig (`needsPermission` + Button im UI).
 *   Desktop-Browser ohne Sensor bleiben bei `available === false` und
 *   zeigen die statische Kaaba-Richtung.
 */
function webOrientationSupport(): 'none' | 'needs-gesture' | 'ready' {
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return 'none';
  const requestFn = (
    DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
  ).requestPermission;
  return typeof requestFn === 'function' ? 'needs-gesture' : 'ready';
}

export function useCompass() {
  const [heading, setHeading] = useState(0);
  const smoothedRef = useRef(0);
  // Hydration-sicher: Erstzustand ist auf Server (Static Export, kein window)
  // und Client identisch (null/false) — die echte Sensor-Erkennung passiert
  // erst im Effect. Ein Lazy-Initializer mit window-Check bakte vorher
  // "Kein Magnetometer" ins HTML und riss auf jedem Browser mit Sensor-API
  // einen React-#418-Hydration-Mismatch.
  const [available, setAvailable] = useState<boolean | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [webGranted, setWebGranted] = useState(false);

  // Kalibrierungs-Hinweis: `nativeAccuracyRef` hält die vom OS gemeldete
  // Kalibrierungsstufe (nur nativ, s. calibration.ts), `samplesRef` ein
  // gleitendes Fenster jüngster Headings für die Jitter-Heuristik (v. a.
  // Web, wo keine native Genauigkeit existiert). Refs statt State, weil sie
  // bei jedem Sensor-Tick (mehrmals pro Sekunde) mutieren — ein State-Update
  // je Sample wäre unnötig teuer, nur das abgeleitete `needsCalibration`
  // rendert.
  const samplesRef = useRef<HeadingSample[]>([]);
  const nativeAccuracyRef = useRef<number | null>(null);
  const [needsCalibration, setNeedsCalibration] = useState(false);

  function recordHeadingSample(h: number) {
    samplesRef.current = [...samplesRef.current, { heading: h, t: Date.now() }].slice(-20);
    setNeedsCalibration(isLowNativeAccuracy(nativeAccuracyRef.current) || isHeadingNoisy(samplesRef.current));
  }

  // Fokus- statt Mount-gebunden: expo-router hält Screens beim Wegnavigieren
  // GEMOUNTET — mit useEffect lief der Sensor (und damit die Ausrichtungs-
  // Vibration) nach Verlassen des Qibla-Screens einfach weiter
  // (Gerätebug Honor Magic V5: "vibriert bei jedem Schritt").
  useFocusEffect(
    useCallback(() => {
    let mounted = true;
    // Neues Fenster pro Fokus: alte Samples/Genauigkeit einer vorherigen
    // Sitzung sollen nicht in die Kalibrierungs-Bewertung der neuen einfließen.
    samplesRef.current = [];
    nativeAccuracyRef.current = null;

    if (Platform.OS === 'web') {
      const support = webOrientationSupport();
      if (support === 'none') {
        // via Timeout statt direktem setState im Effect-Body (Lint-Regel).
        const t = setTimeout(() => {
          if (mounted) setAvailable(false);
        }, 0);
        return () => {
          mounted = false;
          clearTimeout(t);
        };
      }
      // iOS Safari: Sensor-Zugriff erst nach Nutzer-Geste möglich.
      if (support === 'needs-gesture' && !webGranted) {
        const t = setTimeout(() => {
          if (mounted) setNeedsPermission(true);
        }, 0);
        return () => {
          mounted = false;
          clearTimeout(t);
        };
      }
      const handler = (e: Event) => {
        const screenAngle =
          typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : 0;
        const raw = headingFromOrientationEvent(e as OrientationEvent, screenAngle);
        if (raw == null || !mounted) return;
        setAvailable(true);
        setNeedsPermission(false);
        smoothedRef.current = angleLerp(smoothedRef.current, raw, 0.15);
        setHeading(smoothedRef.current);
        recordHeadingSample(smoothedRef.current);
      };
      window.addEventListener('deviceorientationabsolute', handler, true);
      window.addEventListener('deviceorientation', handler, true);
      // Desktop ohne Sensor feuert nie ein Event — nach kurzer Wartezeit
      // ehrlich als "nicht verfügbar" markieren statt ewig offen zu lassen.
      const timer = setTimeout(() => {
        if (mounted) setAvailable((prev) => prev ?? false);
      }, 2500);
      return () => {
        mounted = false;
        clearTimeout(timer);
        window.removeEventListener('deviceorientationabsolute', handler, true);
        window.removeEventListener('deviceorientation', handler, true);
      };
    }

    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' && mounted) {
          ({ status } = await Location.requestForegroundPermissionsAsync());
        }
        if (!mounted || status !== 'granted') {
          if (mounted) setAvailable(false);
          return;
        }
        sub = await Location.watchHeadingAsync((h) => {
          if (!mounted) return;
          // trueHeading (geografisch) bevorzugen; -1 = unbekannt.
          const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (raw < 0) return;
          setAvailable(true);
          // iOS: <20°=3 (hoch) ... >50°=0 (keine), s. calibration.ts. Android
          // liefert dieselbe 0–3-Stufung aus dem SensorManager.
          nativeAccuracyRef.current = typeof h.accuracy === 'number' ? h.accuracy : null;
          smoothedRef.current = angleLerp(smoothedRef.current, raw, 0.15);
          setHeading(smoothedRef.current);
          recordHeadingSample(smoothedRef.current);
        });
      } catch {
        if (mounted) setAvailable(false);
      }
    })();

    return () => {
      mounted = false;
      sub?.remove();
    };
    }, [webGranted]),
  );

  /** iOS-Safari-Sensor-Freigabe — muss aus einer Nutzer-Geste heraus aufgerufen werden. */
  async function requestWebPermission(): Promise<boolean> {
    try {
      const requestFn = (
        DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      ).requestPermission;
      if (typeof requestFn === 'function') {
        const res = await requestFn();
        if (res !== 'granted') return false;
      }
      setNeedsPermission(false);
      setWebGranted(true);
      return true;
    } catch {
      return false;
    }
  }

  return { heading, available, needsPermission, needsCalibration, requestWebPermission };
}
