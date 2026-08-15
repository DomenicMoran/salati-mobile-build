// Web-Stub fuer app-icon.ts: Metro loest diese Datei auf Web statt app-icon.ts
// auf. Auf Web gibt es kein umschaltbares App-Icon - die nativen Module
// react-native-change-icon / expo-dynamic-app-icon existieren dort nicht und
// wuerden schon beim Import "Cannot find native module ..." werfen und damit
// den gesamten Settings-Screen schwarz rendern (Audit 2026-07-21). Dieser
// Stub liefert dieselbe API mit web-sicheren No-ops; Icon/Name-Auswahl in
// settings.tsx ist ueber appIconSupported()===false ohnehin ausgeblendet.

import { APP_ICON_VARIANTS, type AppIconVariant } from './app-icon-shared';

export { APP_ICON_VARIANTS, type AppIconVariant };

export function appIconSupported(): boolean {
  return false;
}

export function appIconNameSwitchSupported(): boolean {
  return false;
}

export async function getCurrentAppIcon(): Promise<AppIconVariant> {
  return 'Default';
}

export async function setAppIcon(_variant: AppIconVariant): Promise<void> {
  // no-op auf Web
}
