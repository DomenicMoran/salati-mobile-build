// watchOS-Komplikation ("Naechstes Gebet") via WidgetKit - Uhr-Pendant zu
// targets/salati-widget/ (iOS-Homescreen-Widget). Seit watchOS 9 sind
// Komplikationen technisch WidgetKit-Widgets mit den zusaetzlichen
// .accessoryCircular/.accessoryRectangular/.accessoryInline/.accessoryCorner-
// Widget-Familien (siehe SalatiPrayerComplication.swift) - kein ClockKit
// mehr noetig.
//
// WICHTIG: braucht ein bereits vorhandenes "watch"-Target im selben Xcode-
// Projekt, um sich einzubetten - siehe targets/salati-watch/expo-target.config.js
// Kopfkommentar. Beide Targets MUESSEN zusammen existieren.
//
// App-Group MUSS identisch mit targets/salati-watch/expo-target.config.js
// sein - die Uhren-App schreibt hinein, diese Komplikation liest heraus.
//
// KORREKTUR 2026-07-27 (der frueher hier stehende Satz war falsch): App-Groups
// teilen Daten NUR zwischen Prozessen auf demselben Geraet. "group.de.salatibox.de"
// existiert auf iPhone und Uhr als zwei getrennte Container. Die iPhone-App
// (src/features/prayer-times/ios-widget.ts) schreibt ausschliesslich in den
// Container des iPhones - der Container der Uhr blieb dadurch leer, und diese
// Komplikation zeigte in der Praxis dauerhaft ihren Leerzustand ("-"). Der
// Schreibpfad auf der Uhr existiert erst seit
// targets/salati-watch/WatchPrayerStore.swift: das iPhone schickt dieselbe
// JSON-Nutzlast per WatchConnectivity (modules/salati-watch-sync), die
// Uhren-App legt sie in der App-Group der Uhr ab und ruft
// WidgetCenter.reloadAllTimelines(). Der Decoder unten bleibt unveraendert.
// Damit gilt fuer die Uhr dasselbe wie fuer WearOS: es braucht einen echten
// Geraete-zu-Geraete-Sync (dort src/features/prayer-times/wear-sync.ts).
//
// UNGETESTET: wie targets/salati-widget/ nie mit `npx expo prebuild -p ios`
// generiert (kein macOS in dieser Session, siehe USER-TODO.md).
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch-widget',
  name: 'SalatiPrayerComplication',
  // Bundle-ID bewusst NICHT ".watch.complication": Apple Developer Portal
  // lehnt jede App-ID-Registrierung ab, die den String "complication"
  // enthaelt, mit einer irrefuehrenden "Identifier is not available"-
  // Meldung (409 ENTITY_ERROR.ATTRIBUTE.INVALID) - reproduzierbar mit
  // mehreren unbenutzten Test-Strings verifiziert, kein echter Namens-
  // konflikt. ".watch.clock" ist funktional identisch (nur ein Bezeichner)
  // und wurde erfolgreich registriert.
  bundleIdentifier: '.watch.clock',
  colors: {
    $accent: '#d4af37', // Brand.gold, siehe src/constants/theme.ts
    $widgetBackground: '#0b0b0d', // Brand.ink
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.de.salatibox.de'],
  },
  deploymentTarget: '11.0',
};
