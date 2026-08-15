// Einstiegspunkt der watchOS-Begleit-App.
//
// Die App war bis 2026-07-27 eine reine Huelle (76 Zeilen, nur zwei Hinweis-
// Zeilen), die nur existierte, damit sich targets/salati-watch-complication/
// als Komplikation einbetten kann — siehe Kopfkommentar in
// expo-target.config.js in diesem Ordner, der Grund gilt unveraendert weiter.
// Jetzt zeigt sie eigenstaendig: naechstes Gebet mit Restzeit, die Tagesliste
// und die Qibla-Richtung.
//
// Aufbau (jede Datei in diesem Ordner wird in dasselbe watchOS-Target
// kompiliert, @bacons/apple-targets haengt den Ordner als synchronisierte
// Gruppe ins Xcode-Projekt):
//   WatchPrayerStore.swift    Daten: WatchConnectivity-Empfang + App-Group
//   WatchViews.swift          Oberflaeche (3 Seiten)
//   WatchHeadingProvider.swift Kompass fuer Qibla (isoliert, entfernbar)
//   WatchStrings.swift        Texte in allen 14 App-Sprachen
//
// UNGETESTET: nie kompiliert (kein macOS in dieser Umgebung) und nie auf einer
// Apple Watch gelaufen — der Betreiber besitzt weder iPhone noch Uhr. Was
// genau ungeprueft ist und wie es per TestFlight nachgeholt wird, steht in
// docs/audit-2026-07-27/APPLE-WATCH-AUSBAU.md.

import SwiftUI

@main
struct SalatiWatchApp: App {
    @StateObject private var store = WatchPrayerStore()

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(store)
                // Die Uhren-App ist nicht per .lproj lokalisiert (Begruendung
                // in WatchStrings.swift), daher setzt SwiftUI die Leserichtung
                // fuer Arabisch/Farsi/Paschtu/Urdu nicht automatisch.
                .environment(\.layoutDirection, WatchStrings.isRTL ? .rightToLeft : .leftToRight)
        }
    }
}
