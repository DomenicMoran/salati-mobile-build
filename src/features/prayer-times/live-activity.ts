// Default/Fallback-Variante (Android + Web via Metro-Platform-Split, s.
// notifications.web.ts für dasselbe Muster): Live Activities (ActivityKit)
// sind ein iOS-exklusives Konzept, es gibt kein Android-Äquivalent hierfür —
// Android hat sein eigenes, funktional ähnliches Pendant bereits über
// updateOngoingCountdown() in notifications.ts (dauerhafte Notification).
// Die echte Implementierung liegt in live-activity.ios.tsx (nur dort wird
// 'expo-widgets' importiert) — dieser No-op stellt sicher, dass Android/Web
// NIEMALS versuchen, das iOS-only Modul zu laden, unabhängig davon, wie sich
// dessen natives Android-Binding im Detail verhält.
import type { NextPrayerResult, TimeFormat } from './next-prayer';
import type { NotificationPrefs } from '@/features/settings/types';

export async function updatePrayerLiveActivity(
  _next: NextPrayerResult,
  _prefs: NotificationPrefs,
  _locale: string,
  _timeFormat: TimeFormat,
): Promise<void> {
  // Android/Web: bewusst leer, s. Kopfkommentar.
}
