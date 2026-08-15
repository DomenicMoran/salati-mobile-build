import { useSyncExternalStore } from 'react';
import { Platform, useColorScheme as useNativeColorScheme } from 'react-native';

import { useSettings } from '@/features/settings/store';

// Bug (live per Playwright gegen den Static-Web-Export verifiziert): im
// Expo-Router-Static-Export (output:'static') wird jede Route serverseitig
// (Node, kein window/matchMedia) mit 'light' vorgerendert. Ein simpler
// useState(() => matchMedia-Wert)-Hook berechnet zwar schon beim allerersten
// Client-Render korrekt 'dark', aber React patcht das zugehörige Inline-Style
// beim Hydrations-Commit trotzdem nicht (Hydration nimmt das Server-Markup
// unverändert an, wenn kein useSyncExternalStore mit eigenem Server-Snapshot
// im Spiel ist) — die Seite blieb dauerhaft hell, obwohl der Hook-Rückgabewert
// nachweislich schon 'dark' war. useSyncExternalStore mit getServerSnapshot
// ist genau das von React für diesen Fall vorgesehene Muster: es rendert beim
// Hydrations-Pass bewusst denselben Wert wie der Server ('light', kein
// Mismatch), und wechselt danach über einen echten Post-Mount-Commit (der DOM
// tatsächlich patcht) auf den Live-matchMedia-Wert.
function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getClientSnapshot(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getServerSnapshot(): 'light' | 'dark' {
  return 'light';
}

function useWebSystemScheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

/** Systemfarbschema, überschreibbar per Settings (themeOverride). */
export function useResolvedScheme(): 'light' | 'dark' {
  const nativeSystem = useNativeColorScheme();
  const webSystem = useWebSystemScheme();
  const { settings } = useSettings();

  if (settings.themeOverride === 'light') return 'light';
  if (settings.themeOverride === 'dark') return 'dark';
  if (Platform.OS === 'web') return webSystem;
  return nativeSystem === 'dark' ? 'dark' : 'light';
}
