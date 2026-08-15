// Volle Adhan-Aufnahmen (apps/mobile/assets/audio/azan/). Herkunft und Lizenz
// je Aufnahme: docs/audit-2026-07-27/ADHAN-LIZENZEN.md, Nennung in
// app/lizenzen.tsx (CC-BY/CC-BY-SA verlangen sie, CC0 nicht — wir nennen alle
// drei einheitlich).
// Zwei Verwendungen, plattformabhängig getrennt — siehe unten:
//   1. Wiedergabe IN DER APP (Gebetszeiten-Screen, Vorhören in den
//      Einstellungen) — immer die volle Aufnahme über expo-audio.
//   2. System-Benachrichtigungston — Android: dieselbe volle MP3 über den
//      Notification-Channel; iOS: ein < 30 s langer Schnitt (Apple-Limit).
import type { AzanChoice } from '@/features/settings/types';

// require() mit statischem Literal-Pfad ist Pflicht (Metro löst Assets zur
// Build-Zeit auf, kein dynamisches require(`...${var}`) möglich).
const AZAN_SOURCES = {
  adhan1: require('../../../assets/audio/azan/adhan1.mp3'),
  adhan2: require('../../../assets/audio/azan/adhan2.mp3'),
  fajr: require('../../../assets/audio/azan/fajr.mp3'),
} as const;

/** Audioquelle für eine Auswahl, oder null für 'default' (kein voller Adhan). */
export function azanSource(choice: AzanChoice) {
  return choice === 'default' ? null : AZAN_SOURCES[choice];
}

/**
 * Name der Android-Raw-Resource für den Notification-Channel-Ton.
 *
 * KEINE Kopie der MP3 nötig: Metro legt jedes nicht-Bild-Asset im Release-
 * Build als `res/raw/<pfad_mit_unterstrichen>` ab (metro `getAssetDestPathAndroid`
 * → `getAndroidResourceIdentifier`), also `assets/audio/azan/adhan1.mp3` →
 * `res/raw/assets_audio_azan_adhan1.mp3`. Verifiziert im Build-Output
 * (`android/app/build/generated/res/react/release/raw/`), inklusive
 * `keep.xml`-Eintrag `@raw/assets_audio_azan_adhan1` — das Resource-Shrinking
 * (enableShrinkResourcesInReleaseBuilds) entfernt die Dateien also nicht.
 * Expo-notifications' `SoundResolver` schneidet die Endung ab und sucht per
 * `getIdentifier(name, "raw", packageName)`; findet es nichts (Debug-Build mit
 * Metro-Server, wo die Assets nicht in res/raw liegen), fällt es still auf den
 * System-Standardton zurück — kein Crash, kein stummer Alarm.
 *
 * Anders als auf iOS gibt es auf Android KEINE Längenbegrenzung für den
 * Channel-Ton, deshalb hier die volle Aufnahme statt des Schnitts.
 */
export function androidChannelSound(choice: AzanChoice): string | undefined {
  return choice === 'default' ? undefined : `assets_audio_azan_${choice}.mp3`;
}

/**
 * Dateiname des iOS-Benachrichtigungstons (`content.sound`). Apple erlaubt nur
 * Töne UNTER 30 s in PCM/MA4/µLaw/aLaw — alle drei Aufnahmen sind 2:34–4:04 min
 * lang, deshalb liegt in assets/audio/azan/notification/ je ein phrasen-
 * genauer 16,2–23-s-Schnitt als CAF/IMA-ADPCM (erzeugt von
 * scripts/make-adhan-notification-sounds.mjs, eingebunden über die `sounds`-
 * Option des expo-notifications-Plugins in app.config.ts). Der VOLLE Ruf
 * spielt danach in der App weiter (Gebetszeiten-Screen).
 */
export function iosNotificationSound(choice: AzanChoice): string | undefined {
  return choice === 'default' ? undefined : `adhan_${choice}.caf`;
}
