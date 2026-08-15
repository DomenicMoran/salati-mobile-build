// Zentraler Hook für den System-weiten "Bewegung reduzieren"-Status (iOS:
// Einstellungen > Bedienungshilfen > Bewegung; Android: Einstellungen >
// Bedienungshilfen > Animationen entfernen; Web: prefers-reduced-motion).
// Nutzt die React-Native-Standard-API (AccessibilityInfo), die auch unter
// react-native-web via `prefers-reduced-motion`-Media-Query implementiert
// ist — funktioniert also plattformübergreifend ohne Sonderfall.
//
// Ergänzt (nicht ersetzt) reanimated's eigenes `useReducedMotion()`, das
// bereits an mehreren Stellen genutzt wird (animated-list-item.tsx,
// achievements.tsx, names.tsx, LessonPlayer.tsx): dieser Hook ist für
// Stellen gedacht, die KEINE Reanimated-Shared-Values nutzen (z. B. eine
// einfache bedingte Verzweigung ohne Reanimated-Import).
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReducedMotion(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
      setReducedMotion(enabled);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
