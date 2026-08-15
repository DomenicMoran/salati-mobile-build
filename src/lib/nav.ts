import { router, type Href } from 'expo-router';

/**
 * Zurück-Navigation mit Deep-Link-Fallback: kommt man direkt per URL/Link auf
 * einen Detail-Screen (leerer History-Stack, v. a. auf Web), wirft
 * `router.back()` einen "GO_BACK was not handled"-Fehler — dann stattdessen
 * zur Übersichtsseite wechseln.
 */
export function backOr(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
