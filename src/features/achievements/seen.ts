// "Gesehen"-Markierung für Abzeichen: neu freigeschaltete Badges bekommen
// beim ersten Besuch des Abzeichen-Screens einen sichtbaren Unlock-Moment
// ("Neu"-Chip + Spring-Animation, Audit 2026-07-19 E2) und gelten danach
// als gesehen. Rein lokal, kein Konto (wie der restliche Fortschritt).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACHIEVEMENTS_SEEN_KEY = 'salatibox:achievements-seen';

export function parseSeenBadges(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export async function loadSeenBadges(): Promise<Set<string>> {
  return parseSeenBadges(await AsyncStorage.getItem(ACHIEVEMENTS_SEEN_KEY));
}

export async function markBadgesSeen(ids: string[]): Promise<void> {
  const seen = await loadSeenBadges();
  for (const id of ids) seen.add(id);
  await AsyncStorage.setItem(ACHIEVEMENTS_SEEN_KEY, JSON.stringify([...seen]));
}
