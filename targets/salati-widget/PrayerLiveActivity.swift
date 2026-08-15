// iOS Live Activity ("nächstes Gebet" auf dem Sperrbildschirm + in der Dynamic
// Island) — UI-Teil. Kompiliert in DERSELBEN @bacons/apple-targets
// WidgetKit-Extension wie SalatiPrayerWidget (s. SalatiPrayerWidget.swift,
// WidgetBundle unten registriert beide). Bewusst KEIN separates
// expo-widgets-Target mehr — das kollidierte mit @bacons/apple-targets im
// prebuild (s. Kommentar in ../../src/features/prayer-times/live-activity.ios.tsx
// + Memory project_salati_expo_widgets_bacons_conflict).
//
// Das STARTEN/BEENDEN der Activity passiert app-seitig im lokalen Expo-Module
// modules/salati-live-activity (ActivityKit Activity.request) — eine
// WidgetKit-Extension kann eine Live Activity NICHT selbst starten, sie liefert
// nur die Darstellung.
//
// WICHTIG: SalatiPrayerActivityAttributes muss ZEICHENGENAU identisch sein mit
// der Definition in modules/salati-live-activity/ios/SalatiLiveActivityModule.swift.
// App-Prozess und Widget-Extension sind getrennte Compile-Units; ActivityKit
// ordnet die laufende Activity über den Typnamen + die ContentState-Struktur
// zu. Wird eine der beiden Definitionen geändert, MUSS die andere synchron
// nachgezogen werden (dasselbe Duplizierungs-Muster wie beim Timings-Decoder
// in SalatiPrayerWidget.swift).
//
// UNVERIFIZIERT: Dieser Rechner hat kein macOS/Xcode/iPhone (s. AGENTS.md) —
// der Swift-Code konnte nie kompiliert oder am Gerät getestet werden. Verifiziert
// sind bisher nur `expo prebuild -p ios` (Mod-Phase, kein @bacons-Crash mehr),
// tsc, expo lint und jest. Echte Verifikation erst bei EAS-Build + TestFlight
// auf einem iPhone.
import ActivityKit
import WidgetKit
import SwiftUI

struct SalatiPrayerActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var title: String
        var prayer: String
        var time: String
    }
}

@available(iOS 16.1, *)
struct PrayerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SalatiPrayerActivityAttributes.self) { context in
            // Sperrbildschirm / Banner-Darstellung.
            VStack(alignment: .leading, spacing: 4) {
                Text(context.state.title)
                    .font(.caption)
                    .foregroundColor(Color("$accent"))
                    .lineLimit(1)
                Text("\(context.state.prayer) · \(context.state.time)")
                    .font(.headline)
                    .fontWeight(.bold)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .activityBackgroundTint(Color("$widgetBackground"))
            .activitySystemActionForegroundColor(Color("$accent"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.prayer)
                        .font(.headline)
                        .fontWeight(.bold)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.time)
                        .font(.headline)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.title)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            } compactLeading: {
                Text(context.state.prayer)
                    .fontWeight(.bold)
            } compactTrailing: {
                Text(context.state.time)
            } minimal: {
                Text(context.state.time)
            }
            .keylineTint(Color("$accent"))
        }
    }
}
