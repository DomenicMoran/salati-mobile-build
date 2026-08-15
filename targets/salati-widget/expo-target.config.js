// iOS-WidgetKit-Extension "Nächstes Gebet" — Pendant zum bestehenden Android-
// Homescreen-Widget (react-native-android-widget, siehe app.config.ts
// widgets-Plugin-Block + src/widgets/). Gebaut mit @bacons/apple-targets,
// das bei `npx expo prebuild -p ios` aus diesem Ordner ein natives
// WidgetKit-Extension-Xcode-Target generiert (Info.plist wird von der
// Bibliothek automatisch geschrieben, siehe deren with-widget.js — hier
// NICHT von Hand anlegen).
//
// WICHTIG: `npx expo prebuild -p ios` läuft NUR auf macOS/Linux (CocoaPods) —
// auf diesem Windows-Dev-Rechner konnte das Target daher noch NIE tatsächlich
// generiert/kompiliert werden. Dieser Ordner ist geprüftes Grundgerüst nach
// der offiziellen Doku-Struktur, aber ungetestet bis zum ersten Mac-/EAS-Build.
//
// Datenfluss: die App schreibt die Tages-Gebetszeiten als JSON in die
// gemeinsame App-Group-UserDefaults (src/features/prayer-times/ios-widget.ts,
// nutzt ExtensionStorage aus @bacons/apple-targets — dasselbe Paket, JS-Seite).
// Der Swift-Code hier (SalatiPrayerWidget.swift) liest denselben Schlüssel und
// berechnet "nächstes Gebet" pro Timeline-Eintrag selbst — funktioniert daher
// auch, wenn die App länger nicht im Vordergrund war (WidgetKit-Standard).

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'SalatiPrayerWidget',
  colors: {
    $accent: '#d4af37', // Brand.gold, siehe src/constants/theme.ts
    $widgetBackground: '#0b0b0d', // Brand.ink
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.de.salatibox.de'],
  },
  deploymentTarget: '17.0',
};
