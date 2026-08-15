import { Platform } from 'react-native';
import { changeIcon, getIcon, resetIcon } from 'react-native-change-icon';
import { getAppIcon as getIosIcon, setAppIcon as setIosIcon } from 'expo-dynamic-app-icon';

import { APP_ICON_VARIANTS, type AppIconVariant } from './app-icon-shared';

export { APP_ICON_VARIANTS, type AppIconVariant };

// Custom-App-Icon (Android + iOS) + App-Name (nur Android). Auf Android sind
// Icon UND Name je Alias fest gekoppelt (siehe AndroidManifest.xml
// activity-alias-Eintraege ".MainActivityDefault/.MainActivityEmerald/
// .MainActivitySalatibox") - daher 3 feste Presets statt zweier getrennter
// Picker. Auf iOS ist nur das Icon umschaltbar (CFBundleAlternateIcons via
// plugins/withIosAlternateIcons.js, Icon-Keys "emerald"/"light" - der
// App-NAME ist auf iOS zur Laufzeit generell nicht änderbar, Apple-
// Einschränkung) - settings.tsx blendet die Namens-Auswahl dort entsprechend
// aus, zeigt aber die Icon-Auswahl auch auf iOS.
//
// Web: es gibt kein Custom-App-Icon; die native-only Imports oben (react-
// native-change-icon / expo-dynamic-app-icon) wuerden auf Web schon beim
// Modul-Laden "Cannot find native module ..." werfen und den ganzen
// Settings-Screen schwarz rendern. Deshalb existiert ein Web-Stub
// app-icon.web.ts, den Metro auf Web statt dieser Datei aufloest.

const IOS_ICON_KEYS: Partial<Record<AppIconVariant, string>> = {
  Emerald: 'emerald',
  Salatibox: 'light',
};

export function appIconSupported(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

/** Auf iOS kann nur das Icon umgeschaltet werden, nicht der App-Name. */
export function appIconNameSwitchSupported(): boolean {
  return Platform.OS === 'android';
}

/** Aktuell aktiver Alias ('Default' wenn noch nie umgeschaltet oder Lookup fehlschlägt). */
export async function getCurrentAppIcon(): Promise<AppIconVariant> {
  if (Platform.OS === 'android') {
    try {
      const current = await getIcon();
      return (APP_ICON_VARIANTS.find((v) => v.id === current)?.id ?? 'Default') as AppIconVariant;
    } catch {
      return 'Default';
    }
  }
  if (Platform.OS === 'ios') {
    try {
      const current = getIosIcon(); // 'DEFAULT' | 'emerald' | 'light'
      const entry = Object.entries(IOS_ICON_KEYS).find(([, key]) => key === current);
      return (entry?.[0] as AppIconVariant | undefined) ?? 'Default';
    } catch {
      return 'Default';
    }
  }
  return 'Default';
}

export async function setAppIcon(variant: AppIconVariant): Promise<void> {
  if (Platform.OS === 'android') {
    // Wirft ANDROID:ICON_ALREADY_USED wenn variant bereits aktiv ist - kein
    // echter Fehler aus Nutzersicht, daher hier verschluckt statt geworfen.
    if (variant === 'Default') {
      await resetIcon().catch(() => {});
      return;
    }
    await changeIcon(variant).catch(() => {});
    return;
  }
  if (Platform.OS === 'ios') {
    const iosKey = IOS_ICON_KEYS[variant] ?? 'DEFAULT';
    try {
      setIosIcon(iosKey);
    } catch {
      // still fehlschlagen, wie auf Android
    }
  }
}
