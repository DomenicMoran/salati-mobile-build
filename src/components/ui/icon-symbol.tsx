// Einheitliches Icon-System für alle Nicht-Tab-Icons (Tab-Bar nutzt weiterhin
// native SF Symbols/Material via app-tabs.tsx). Ionicons statt Emoji, damit
// Icons auf jeder Plattform (iOS/Android/Web) gleich sauber aussehen.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Platform, View } from 'react-native';

import { useHydrated } from '@/hooks/use-hydrated';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface IconSymbolProps {
  name: IconName;
  size?: number;
  color: string;
}

export function IconSymbol({ name, size = 20, color }: IconSymbolProps) {
  // Hydration-Guard (nur Web/Static-Export): @expo/vector-icons rendert
  // serverseitig OHNE Font-Styles (fontFamily/Farbe/userSelect), clientseitig
  // MIT — das riss auf jeder Seite mit Icon im Erstrender einen React-#418-
  // Hydration-Mismatch (per Dev-Export-Diff verifiziert, 2026-07-17).
  // Bis zur Hydration einen größengleichen Platzhalter rendern (kein CLS);
  // die Icon-Schrift lädt ohnehin erst clientseitig.
  const hydrated = useHydrated();
  if (Platform.OS === 'web' && !hydrated) {
    return <View style={{ width: size, height: size }} accessible={false} />;
  }
  // `accessible={false}` (Audit 2026-07-27, N7): Ionicons rendert die Glyphe
  // als Text — VoiceOver/TalkBack lasen sonst den rohen Zeichencode vor bzw.
  // erzeugten einen zusätzlichen Fokus-Stopp neben dem umgebenden Button.
  // Die Bedeutung trägt immer das `accessibilityLabel` des Elternelements.
  return (
    <Ionicons name={name} size={size} color={color} accessible={false} importantForAccessibility="no" />
  );
}
