import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * ActivityIndicator mit Marken-Akzentfarbe statt des OS-Standard-Grau —
 * bisher nutzten alle ~20 Ladeanzeigen der App den unbunten Plattform-
 * Default, was dem Design-Ziel ("perfekt gestaltet", Babbel/Duolingo-
 * Anspruch) widersprach. `color` bleibt überschreibbar für Sonderfälle.
 */
export function ThemedActivityIndicator({ color, ...rest }: ActivityIndicatorProps) {
  const theme = useTheme();
  return <ActivityIndicator color={color ?? theme.accent} {...rest} />;
}
