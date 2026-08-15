import { useSyncExternalStore } from 'react';

import { useSettings } from '@/features/settings/store';
import {
  ensureLocale,
  getLocalesServerVersion,
  getLocalesVersion,
  subscribeToLocales,
  translate,
} from './translate';

export { detectDeviceLocale, type Locale } from './locale-detect';
export { ensureLocale, isLocaleLoaded, preloadLocale, translate } from './translate';

/**
 * Übersetzungs-Hook, gebunden an die persistierte Spracheinstellung.
 *
 * Nur `de`/`en` sind statisch gebündelt (s. translate.ts) — für alle anderen
 * Sprachen stößt der Hook das Nachladen an und rendert neu, sobald die Datei da
 * ist. `useSyncExternalStore` mit eigenem Server-Snapshot statt `useState`:
 * beim statischen Web-Export (`output: 'static'`) rendert der Server-Durchlauf
 * ohne nachgeladene Locale vor; ein `useState`-Wert würde beim Hydrate nicht neu
 * abgeglichen bzw. bei abweichendem Startwert die Hydration brechen.
 */
export function useTranslation() {
  const { settings } = useSettings();
  const locale = settings.language;
  // Idempotent und ohne synchronen State-Update — der Reload läuft über den
  // Store-Snapshot unten, nicht über einen Effekt (spart einen Frame Verzug).
  ensureLocale(locale);
  useSyncExternalStore(subscribeToLocales, getLocalesVersion, getLocalesServerVersion);
  return {
    locale,
    t: (key: string) => translate(locale, key),
  };
}
