// Gemeinsame "Karte" für tappbare Listen-/Grid-Items: sanfte Press-Skalierung
// + dezenter Schatten + Haptik (nativ). Ersetzt die bisherigen reinen
// ThemedView-Boxen, die keinerlei Tap-Feedback gaben.
import * as Haptics from 'expo-haptics';
import {
  Platform,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedView, type ThemedViewProps } from '@/components/themed-view';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

const AnimatedThemedView = Animated.createAnimatedComponent(ThemedView);

// Für kleine Aktions-Icons (Lesezeichen, Kopieren, Label-Chips, Wort-Info …),
// die INNERHALB einer PressableCard sitzen, deren eigenes onPress etwas
// anderes tut (z. B. navigieren/abspielen). Web rendert accessibilityRole=
// "button" als natives <button> — Klicks auf verschachtelte <button>-
// Elemente bubbeln dort zum äußeren Button hoch (anders als bei RNs Touch-
// Responder-System nativ), was sonst BEIDE Aktionen gleichzeitig auslöst.
export function stopNestedPressBubble(e: GestureResponderEvent) {
  e.stopPropagation?.();
}

export interface PressableCardProps extends Omit<PressableProps, 'style'> {
  type?: ThemedViewProps['type'];
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  elevated?: boolean;
}

export function PressableCard({
  type = 'backgroundElement',
  style,
  disabled,
  elevated = true,
  onPressIn,
  onPressOut,
  accessibilityRole = 'button',
  accessibilityState,
  ...props
}: PressableCardProps) {
  const scale = useSharedValue(1);
  // Kein natives Presse-Feedback bei aktivierter "Bewegung reduzieren" —
  // PressableCard ist die am häufigsten wiederverwendete Animation der App
  // (praktisch jede Liste/jedes Grid), daher zentral statt pro Nutzung geprüft.
  const reducedMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      onPressIn={(e) => {
        // Reanimated-SharedValue-Zuweisung, keine React-State-Mutation — React
        // Compiler kennt SharedValue nicht und meldet hier einen Fehlalarm.
        // eslint-disable-next-line react-hooks/immutability
        scale.value = reducedMotion ? 0.97 : withTiming(0.97, { duration: 90 });
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // eslint-disable-next-line react-hooks/immutability
        scale.value = reducedMotion ? 1 : withTiming(1, { duration: 120 });
        onPressOut?.(e);
      }}
      {...props}>
      <AnimatedThemedView
        type={type}
        style={[
          styles.card,
          elevated && !disabled && styles.elevated,
          disabled && styles.disabled,
          animatedStyle,
          style,
        ]}>
        {props.children as React.ReactNode}
      </AnimatedThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
  },
  elevated: Platform.select({
    web: { boxShadow: '0 1px 3px rgba(11,11,13,0.06), 0 1px 2px rgba(11,11,13,0.08)' },
    default: {
      shadowColor: '#0b0b0d',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
  }) as ViewStyle,
  disabled: {
    opacity: 0.55,
  },
});
