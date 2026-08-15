// "Naechstes Gebet"-Komplikation - Uhr-Pendant zu
// targets/salati-widget/SalatiPrayerWidget.swift (siehe dortigen
// Kopfkommentar zur Datenquelle/App-Group).
//
// DATENQUELLE (seit 2026-07-27): die App-Group-UserDefaults DER UHR, gefuellt
// von targets/salati-watch/WatchPrayerStore.swift, das die Nutzlast per
// WatchConnectivity vom iPhone empfaengt (modules/salati-watch-sync). Vorher
// las diese Datei einen Container, den auf der Uhr nie jemand beschrieb -
// ausfuehrliche Begruendung in expo-target.config.js daneben. Das Format der
// Nutzlast ist unveraendert, dieser Decoder musste nicht angepasst werden.
//
// Timeline-Provider-Logik ist
// bewusst identisch zum iOS-Widget dupliziert (jedes Xcode-Target kompiliert
// unabhaengig, kein geteiltes Swift-Compile-Membership zwischen Targets in
// diesem Setup) - bei Aenderungen an einer Seite IMMER auch die andere
// pruefen (targets/salati-widget/SalatiPrayerWidget.swift,
// src/features/prayer-times/next-prayer.ts).
//
// UNGETESTET: nie kompiliert (kein macOS in dieser Session, siehe
// USER-TODO.md) - insbesondere die vier Accessory-Familien unten
// (.accessoryCircular/.accessoryRectangular/.accessoryInline/.accessoryCorner)
// wurden nie am Simulator/einer echten Watch gerendert. .accessoryCorner ist
// zudem nur auf Apple Watch Ultra (das groessere "Corner"-Zifferblatt-Layout)
// relevant - auf anderen Watch-Modellen zeigt WidgetKit diese Familie
// automatisch nicht an, das ist so beabsichtigt.

import WidgetKit
import SwiftUI

private let appGroup = "group.de.salatibox.de"
private let storageKey = "salati.widget.prayerTimes"
private let prayerOrder = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]

private struct Timings: Codable {
    let Fajr: String
    let Sunrise: String
    let Dhuhr: String
    let Asr: String
    let Maghrib: String
    let Isha: String

    func time(for name: String) -> String {
        switch name {
        case "Fajr": return Fajr
        case "Dhuhr": return Dhuhr
        case "Asr": return Asr
        case "Maghrib": return Maghrib
        case "Isha": return Isha
        default: return "00:00"
        }
    }
}

private struct WidgetPayload: Codable {
    let locationLabel: String
    let today: Timings
    let tomorrow: Timings
    let timeFormat: String
}

private func parseTime(_ hhmm: String, on day: Date) -> Date? {
    let parts = hhmm.split(separator: ":")
    guard parts.count >= 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
    var comps = Calendar.current.dateComponents([.year, .month, .day], from: day)
    comps.hour = h
    comps.minute = m
    comps.second = 0
    return Calendar.current.date(from: comps)
}

struct ComplicationEntry: TimelineEntry {
    let date: Date
    let prayerName: String
    let prayerDate: Date
    let available: Bool
}

struct ComplicationProvider: TimelineProvider {
    func placeholder(in context: Context) -> ComplicationEntry {
        ComplicationEntry(date: Date(), prayerName: "Fajr", prayerDate: Date(), available: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (ComplicationEntry) -> Void) {
        completion(loadEntries().first ?? placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ComplicationEntry>) -> Void) {
        let entries = loadEntries()
        let refresh = entries.last?.prayerDate.addingTimeInterval(60) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: entries, policy: .after(refresh)))
    }

    /// Identische Logik zu SalatiPrayerWidget.swift.loadEntries() (siehe
    /// dortigen Kommentar) - ein Eintrag pro verbleibendem Gebet des Tages,
    /// jeweils gueltig bis zum naechsten.
    private func loadEntries() -> [ComplicationEntry] {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let json = defaults.string(forKey: storageKey),
              let data = json.data(using: .utf8),
              let payload = try? JSONDecoder().decode(WidgetPayload.self, from: data)
        else {
            return [ComplicationEntry(date: Date(), prayerName: "-", prayerDate: Date(), available: false)]
        }

        let now = Date()
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now

        var candidates: [(name: String, date: Date)] = []
        for name in prayerOrder {
            if let d = parseTime(payload.today.time(for: name), on: now) {
                candidates.append((name, d))
            }
        }
        if let fajrTomorrow = parseTime(payload.tomorrow.time(for: "Fajr"), on: tomorrow) {
            candidates.append(("Fajr", fajrTomorrow))
        }

        let future = candidates.filter { $0.date > now }.sorted { $0.date < $1.date }
        guard !future.isEmpty else {
            return [ComplicationEntry(date: now, prayerName: "-", prayerDate: now, available: false)]
        }

        var result: [ComplicationEntry] = []
        var boundary = now
        for candidate in future {
            result.append(ComplicationEntry(date: boundary, prayerName: candidate.name, prayerDate: candidate.date, available: true))
            boundary = candidate.date
        }
        return result
    }
}

struct SalatiPrayerComplicationView: View {
    @Environment(\.widgetFamily) var family
    var entry: ComplicationEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            // Kleine Restzeit-Anzeige mit Ring bis zum naechsten Gebet -
            // Gauge braucht einen 0...1-Fortschritt, den wir hier bewusst NICHT
            // ueber den vollen Tag, sondern nur "wie nah ist es" grob simulieren
            // (echte Fortschrittsbasis waere z.B. seit dem vorherigen Gebet).
            Gauge(value: 0.5) {
                Text(entry.prayerName.prefix(3))
            } currentValueLabel: {
                if entry.available {
                    Text(entry.prayerDate, style: .timer)
                        .minimumScaleFactor(0.5)
                } else {
                    Text("–")
                }
            }
            .gaugeStyle(.accessoryCircularCapacity)

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.available ? entry.prayerName : "Salati")
                    .font(.headline)
                if entry.available {
                    Text(entry.prayerDate, style: .time)
                        .font(.subheadline)
                    Text(entry.prayerDate, style: .relative)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                } else {
                    Text("App öffnen")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

        case .accessoryInline:
            if entry.available {
                Text("\(entry.prayerName) \(entry.prayerDate, style: .time)")
            } else {
                Text("Salati")
            }

        case .accessoryCorner:
            if entry.available {
                Text(entry.prayerDate, style: .timer)
                    .widgetLabel {
                        Text(entry.prayerName)
                    }
            } else {
                Text("–")
            }

        default:
            Text(entry.available ? entry.prayerName : "Salati")
        }
    }
}

struct SalatiPrayerComplication: Widget {
    let kind: String = "SalatiPrayerComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ComplicationProvider()) { entry in
            SalatiPrayerComplicationView(entry: entry)
                .containerBackground(for: .widget) {
                    Color("$widgetBackground")
                }
        }
        .configurationDisplayName("Nächstes Gebet")
        .description("Zeigt das nächste Gebet mit Countdown auf dem Zifferblatt.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}

@main
struct SalatiPrayerComplicationBundle: WidgetBundle {
    var body: some Widget {
        SalatiPrayerComplication()
    }
}
