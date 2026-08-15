// Sanftes, gestaffeltes Einblenden für Listen (Lektionen, Duas, Hadithe …).
// index steuert die Verzögerung, damit Listen "nacheinander" erscheinen statt
// abrupt aufzupoppen.
import type { PropsWithChildren } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

const STEP_MS = 40;
const MAX_DELAY_MS = 320;

export function AnimatedListItem({
  index,
  style,
  children,
}: PropsWithChildren<{ index: number; style?: ViewStyle | ViewStyle[] }>) {
  // System-Einstellung "Bewegung reduzieren" respektieren (Audit 2026-07-19
  // E4) - Inhalte erscheinen dann sofort statt gestaffelt einzugleiten.
  const reducedMotion = useReducedMotion();
  const delay = Math.min(index * STEP_MS, MAX_DELAY_MS);
  // WICHTIG (Web): reanimated-`entering`-Animationen sind auf Web
  // unzuverlässig - sie setzen das Element initial auf opacity:0 und die
  // Einblend-Animation schlägt unter Production/Cold-Load-Bedingungen
  // regelmässig fehl, sodass der Inhalt DAUERHAFT unsichtbar bleibt (Live-Bug
  // 2026-07-21: settings.tsx & Co. rendern auf salati.pro nur den Titel, alle
  // AnimatedListItem-Sektionen blieben leer, obwohl sie im DOM-Layout Platz
  // einnahmen). Auf Web daher gar keine Entering-Animation - Inhalt erscheint
  // sofort sichtbar. Native (iOS/Android) behält das gestaffelte Einblenden.
  const entering =
    reducedMotion || Platform.OS === 'web'
      ? undefined
      : FadeInDown.delay(delay).duration(280).springify().damping(18);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
