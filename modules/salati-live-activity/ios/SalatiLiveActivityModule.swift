// Natives Gegenstueck zu ../index.ts. App-seitiger Start/Update/End der
// "naechstes Gebet"-Live-Activity ueber ActivityKit. Die DARSTELLUNG liegt in
// der WidgetKit-Extension (targets/salati-widget/PrayerLiveActivity.swift) —
// eine Live Activity wird immer aus dem App-Prozess gestartet, aber von der
// Widget-Extension gerendert.
//
// WICHTIG: SalatiPrayerActivityAttributes muss ZEICHENGENAU identisch sein mit
// der Definition in targets/salati-widget/PrayerLiveActivity.swift (getrennte
// Compile-Units, ActivityKit ordnet ueber Typname + ContentState-Struktur zu).
//
// ActivityKit-APIs (ActivityContent/staleDate) sind iOS 16.2+, Live Activities
// generell iOS 16.1+ — alle Aufrufe daher mit `if #available(iOS 16.2, *)`
// abgesichert. Aeltere Geraete/Web/Android bekommen ueber
// requireOptionalNativeModule ohnehin nie dieses Modul (isSupported()==false).
//
// UNVERIFIZIERT auf diesem Rechner (kein macOS/Xcode/iPhone, s. AGENTS.md) —
// echte Verifikation erst bei EAS-Build + TestFlight auf einem iPhone.
import ActivityKit
import ExpoModulesCore

struct SalatiPrayerActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var title: String
    var prayer: String
    var time: String
  }
}

public class SalatiLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SalatiLiveActivity")

    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    Function("start") { (title: String, prayer: String, time: String) in
      guard #available(iOS 16.2, *) else { return }
      let state = SalatiPrayerActivityAttributes.ContentState(title: title, prayer: prayer, time: time)
      Task {
        // Immer nur EINE Activity: bestehende zuerst beenden, dann neu starten.
        for activity in Activity<SalatiPrayerActivityAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
        do {
          _ = try Activity.request(
            attributes: SalatiPrayerActivityAttributes(),
            content: ActivityContent(state: state, staleDate: nil)
          )
        } catch {
          // Live Activities koennen vom Nutzer/System deaktiviert sein — kein
          // Absturz, einfach nichts tun.
        }
      }
    }

    Function("update") { (title: String, prayer: String, time: String) in
      guard #available(iOS 16.2, *) else { return }
      let state = SalatiPrayerActivityAttributes.ContentState(title: title, prayer: prayer, time: time)
      Task {
        for activity in Activity<SalatiPrayerActivityAttributes>.activities {
          await activity.update(ActivityContent(state: state, staleDate: nil))
        }
      }
    }

    Function("end") {
      guard #available(iOS 16.2, *) else { return }
      Task {
        for activity in Activity<SalatiPrayerActivityAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }
  }
}
