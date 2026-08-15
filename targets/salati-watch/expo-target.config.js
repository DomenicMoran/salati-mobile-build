// watchOS-Begleit-App (Companion Watch App).
//
// STAND 2026-07-27: keine Huelle mehr — die App zeigt jetzt naechstes Gebet
// mit Restzeit, die Tagesliste und die Qibla-Richtung (SalatiWatchApp.swift
// und die Nachbardateien). Der urspruengliche Existenzgrund gilt aber
// unveraendert weiter, deshalb bleibt er hier stehen: sie muss existieren,
// damit sich targets/salati-watch-complication/ (Typ
// "watch-widget") als Komplikation einbetten kann: @bacons/apple-targets
// sucht beim Anlegen eines "watch-widget"-Targets im Xcode-Projekt nach
// einem bereits vorhandenen "watch"-Target (isWatchOSTarget()) und bettet
// die Komplikation dort ein - ohne dieses Target hier wuerde die Komplikation
// (mit einer Warnung) faelschlich in die iPhone-App eingebettet und waere auf
// der Uhr nicht sichtbar. Quelle: node_modules/@bacons/apple-targets/build/
// with-xcode-changes.js (isWatchOSExtensionTarget()-Fallback-Pfad), geprueft
// in dieser Session (siehe SalatiWatchApp.swift Kopfkommentar).
//
// Bundle-ID bewusst als ".watch" (= de.salatibox.de.watch): moderne watchOS-
// Companion-Apps (watchOS 6+, "single target"-Stil, kein WatchKit-1-Extension-
// Modell mehr) brauchen KEIN explizites WKCompanionAppBundleIdentifier-Info.plist-
// Feld - Xcode erkennt die Companion-Beziehung automatisch daran, dass die
// Bundle-ID der Uhr-App die Bundle-ID der iPhone-App als Praefix hat
// (getTargetInfoPlistForType("watch") liefert bewusst {} zurueck, siehe
// node_modules/@bacons/apple-targets/build/target.js).
//
// UNGETESTET: wie targets/salati-widget/ nie mit `npx expo prebuild -p ios`
// generiert/in Xcode geoeffnet (kein macOS in dieser Session, siehe
// USER-TODO.md).
//
// deploymentTarget explizit (nicht der Plugin-Default) fuer Klarheit direkt
// im Config-File, analog zu targets/salati-widget/expo-target.config.js.
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'SalatiWatch',
  bundleIdentifier: '.watch',
  deploymentTarget: '11.0',
  // App-Store-Ablehnung 2026-07-19 (Build 15, ITMS-90391/90713): watchOS-
  // Companion-Apps sind ein eigenes Bundle und brauchen ein eigenes
  // AppIcon.appiconset (anders als das WidgetKit-Target daneben, das das
  // Icon der iPhone-App mitbenutzt) - ohne "icon" hier generiert
  // @bacons/apple-targets keins.
  //
  // App-Store-Ablehnung 2026-07-27 (1.33.0, Guideline 4 Design): bis dahin lag
  // hier eine Kopie des iPhone-Icons (goldener Achtstern auf fast schwarzem
  // Grund). watchOS beschneidet Icons zu einem Kreis und zeigt sie auf
  // schwarzem Zifferblatt - mit schwarzem Grund verschwimmt der Rand und das
  // Icon wirkt nicht kreisrund. Seither ein eigenes Uhr-Icon mit hellem
  // Goldverlauf und dunklem Stern, erzeugt von scripts/make-watch-icon.mjs
  // (1024x1024; watchOS braucht als Quelle nur diese eine Groesse, siehe
  // Kopfkommentar des Skripts).
  icon: './icon.png',
  // App-Group der UHR (nicht die des iPhones — App-Groups sind pro Geraet,
  // siehe ausfuehrliche Begruendung im Kopf von WatchPrayerStore.swift).
  // Die Uhren-App schreibt die per WatchConnectivity empfangene Nutzlast
  // hier hinein, targets/salati-watch-complication/ liest sie von dort.
  // Beide Ziele MUESSEN dieselbe Gruppe deklarieren, sonst sieht die
  // Komplikation nichts.
  entitlements: {
    'com.apple.security.application-groups': ['group.de.salatibox.de'],
  },
  // Setzt ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME fuer dieses Ziel
  // (configuration-list.js: nur wenn ein $accent-Farbset existiert) — damit
  // System-Elemente der Uhren-App im Markengold statt Systemblau erscheinen.
  // Identischer Wert wie in targets/salati-watch-complication/.
  colors: {
    $accent: '#d4af37', // Brand.gold, siehe src/constants/theme.ts
  },
  // Explizit verlinkt statt sich auf Swifts Auto-Linking zu verlassen —
  // derselbe Code-Pfad, den das Plugin fuer den Typ "watch-widget" ohnehin
  // schon nutzt (target.js TARGET_REGISTRY -> with-widget.js:255 ->
  // ensureFrameworks). WatchConnectivity: Empfang vom iPhone
  // (WatchPrayerStore.swift), WidgetKit: Komplikations-Reload nach Empfang,
  // CoreLocation: Kompass der Qibla-Seite (WatchHeadingProvider.swift).
  frameworks: ['SwiftUI', 'WatchConnectivity', 'WidgetKit', 'CoreLocation'],
};
