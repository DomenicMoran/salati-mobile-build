// Salati WidgetKit-Widgets — Datenquelle: App-Group-UserDefaults, geschrieben
// von src/features/prayer-times/ios-widget.ts (JS-Seite). WidgetKit-Extensions
// lesen NIE den JS-Prozess direkt (eigener nativer Prozess) — die Logik
// ("nächstes Gebet", Qibla, Theme) steht daher hier in Swift.
//
// Widgets in diesem Bundle:
//   • SalatiPrayerWidget  — nächstes Gebet (small/medium/large + Lock-Screen)
//   • SalatiCountdownWidget — kompakter Countdown zum nächsten Gebet
//   • SalatiQiblaWidget   — Qibla-Richtung + Entfernung
// Farbthema (durchsichtig/schwarz/weiß/lila/orange …) kommt aus der App-
// Einstellung settings.widgetTheme (gespiegelt zu src/widgets/widgetTheme.ts).
//
// UNGETESTET auf diesem Windows-Rechner (kein Xcode). Vor dem ersten Einsatz
// auf einem Mac in Xcode/Simulator prüfen. deploymentTarget 17.0 → Accessory-
// Familien ohne @available-Gating nutzbar.

import WidgetKit
import SwiftUI

private let appGroup = "group.de.salatibox.de"
private let storageKey = "salati.widget.prayerTimes"
private let prayerOrder = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]

// MARK: - Farb-Utilities

extension Color {
    init(hexRGB: UInt32, opacity: Double = 1.0) {
        let r = Double((hexRGB >> 16) & 0xff) / 255.0
        let g = Double((hexRGB >> 8) & 0xff) / 255.0
        let b = Double(hexRGB & 0xff) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}

// Spiegelt WIDGET_THEMES aus src/widgets/widgetTheme.ts (dark/light/transparent/
// black/white/purple/orange). Text bleibt auf jedem Grund lesbar.
struct WidgetTheme {
    let background: Color
    let text: Color
    let accent: Color
    let muted: Color

    static func resolve(_ key: String?) -> WidgetTheme {
        switch key {
        case "light":
            return WidgetTheme(background: Color(hexRGB: 0xf7f3ea), text: Color(hexRGB: 0x0b0b0d), accent: Color(hexRGB: 0x846200), muted: Color(hexRGB: 0x0b0b0d).opacity(0.65))
        case "transparent":
            return WidgetTheme(background: Color(hexRGB: 0x0b0b0d, opacity: 0.73), text: .white, accent: Color(hexRGB: 0xd4af37), muted: Color.white.opacity(0.7))
        case "black":
            return WidgetTheme(background: .black, text: .white, accent: Color(hexRGB: 0xd4af37), muted: Color.white.opacity(0.7))
        case "white":
            return WidgetTheme(background: .white, text: Color(hexRGB: 0x111111), accent: Color(hexRGB: 0x8a6d00), muted: Color(hexRGB: 0x111111).opacity(0.6))
        case "purple":
            return WidgetTheme(background: Color(hexRGB: 0x4c1d95), text: Color(hexRGB: 0xf5f3ff), accent: Color(hexRGB: 0xe9d5ff), muted: Color(hexRGB: 0xf5f3ff).opacity(0.75))
        case "orange":
            return WidgetTheme(background: Color(hexRGB: 0x9a3412), text: Color(hexRGB: 0xfff7ed), accent: Color(hexRGB: 0xfed7aa), muted: Color(hexRGB: 0xfff7ed).opacity(0.8))
        default: // dark
            return WidgetTheme(background: Color(hexRGB: 0x0b0b0d), text: Color(hexRGB: 0xf7f3ea), accent: Color(hexRGB: 0xd4af37), muted: Color(hexRGB: 0xf7f3ea).opacity(0.65))
        }
    }
}

// MARK: - Payload

// Spiegelt Timings aus src/features/prayer-times/api.ts.
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
        case "Sunrise": return Sunrise
        case "Dhuhr": return Dhuhr
        case "Asr": return Asr
        case "Maghrib": return Maghrib
        case "Isha": return Isha
        default: return "00:00"
        }
    }
}

// Spiegelt IosWidgetPayload aus src/features/prayer-times/ios-widget.ts.
// Neue Felder optional, damit ältere gespeicherte Payloads weiter decodieren.
private struct WidgetPayload: Codable {
    let locationLabel: String
    let today: Timings
    let tomorrow: Timings
    let timeFormat: String
    let qiblaBearing: Double?
    let qiblaDistanceKm: Double?
    let widgetTheme: String?
}

private func loadPayload() -> WidgetPayload? {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let json = defaults.string(forKey: storageKey),
          let data = json.data(using: .utf8),
          let payload = try? JSONDecoder().decode(WidgetPayload.self, from: data)
    else { return nil }
    return payload
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

private func cardinal(_ bearing: Double) -> String {
    let dirs = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"]
    let idx = Int((bearing.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) / 45.0 + 0.5) % 8
    return dirs[idx]
}

// MARK: - Nächstes-Gebet-Timeline

struct PrayerTime: Identifiable {
    let id: String   // Gebetsname ist eindeutig (Fajr…Isha)
    let date: Date
}

struct PrayerEntry: TimelineEntry {
    let date: Date
    let locationLabel: String
    let prayerName: String
    let prayerDate: Date
    let available: Bool
    let theme: String?
    let todayTimes: [PrayerTime]
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerEntry {
        PrayerEntry(date: Date(), locationLabel: "Salati", prayerName: "Fajr", prayerDate: Date(), available: true, theme: nil, todayTimes: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        completion(loadEntries().first ?? placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let entries = loadEntries()
        let refresh = entries.last?.prayerDate.addingTimeInterval(60) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: entries, policy: .after(refresh)))
    }

    private func loadEntries() -> [PrayerEntry] {
        guard let payload = loadPayload() else {
            return [PrayerEntry(date: Date(), locationLabel: "Salati", prayerName: "-", prayerDate: Date(), available: false, theme: nil, todayTimes: [])]
        }

        let now = Date()
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now

        var todayTimes: [PrayerTime] = []
        for name in prayerOrder {
            if let d = parseTime(payload.today.time(for: name), on: now) {
                todayTimes.append(PrayerTime(id: name, date: d))
            }
        }

        var candidates: [(name: String, date: Date)] = todayTimes.map { ($0.id, $0.date) }
        if let fajrTomorrow = parseTime(payload.tomorrow.time(for: "Fajr"), on: tomorrow) {
            candidates.append((name: "Fajr", date: fajrTomorrow))
        }

        let future = candidates.filter { $0.date > now }.sorted { $0.date < $1.date }
        guard !future.isEmpty else {
            return [PrayerEntry(date: now, locationLabel: payload.locationLabel, prayerName: "-", prayerDate: now, available: false, theme: payload.widgetTheme, todayTimes: todayTimes)]
        }

        var result: [PrayerEntry] = []
        var boundary = now
        for candidate in future {
            result.append(PrayerEntry(date: boundary, locationLabel: payload.locationLabel, prayerName: candidate.name, prayerDate: candidate.date, available: true, theme: payload.widgetTheme, todayTimes: todayTimes))
            boundary = candidate.date
        }
        return result
    }
}

// MARK: - Nächstes-Gebet-Ansicht

struct SalatiPrayerWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: PrayerEntry

    var body: some View {
        let theme = WidgetTheme.resolve(entry.theme)
        content(theme)
            .containerBackground(for: .widget) {
                if family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline {
                    Color.clear
                } else {
                    theme.background
                }
            }
    }

    @ViewBuilder
    private func content(_ theme: WidgetTheme) -> some View {
        switch family {
        case .accessoryInline:
            if entry.available {
                Text("\(entry.prayerName) \(entry.prayerDate, style: .time)")
            } else {
                Text("Salati")
            }
        case .accessoryCircular:
            VStack(spacing: 1) {
                Text(entry.available ? entry.prayerName : "Salati").font(.caption2).minimumScaleFactor(0.6)
                if entry.available { Text(entry.prayerDate, style: .time).font(.caption).bold() }
            }
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(entry.available ? entry.prayerName : "Salati").font(.headline)
                if entry.available {
                    Text(entry.prayerDate, style: .time).font(.caption)
                    Text(entry.prayerDate, style: .relative).font(.caption2)
                }
            }
        case .systemLarge:
            largeView(theme)
        default:
            defaultView(theme)
        }
    }

    // small + medium
    private func defaultView(_ theme: WidgetTheme) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.locationLabel).font(.caption2).foregroundColor(theme.muted).lineLimit(1)
            if entry.available {
                Text(entry.prayerName).font(.title2).fontWeight(.bold).foregroundColor(theme.text)
                Text(entry.prayerDate, style: .time).font(.headline).foregroundColor(theme.accent)
                Text(entry.prayerDate, style: .relative).font(.caption).foregroundColor(theme.muted)
            } else {
                Text("Salati").font(.headline).foregroundColor(theme.text)
                Text("App öffnen für Gebetszeiten").font(.caption).foregroundColor(theme.muted)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // large: alle Tageszeiten, nächstes hervorgehoben
    private func largeView(_ theme: WidgetTheme) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(entry.locationLabel).font(.caption).foregroundColor(theme.muted).lineLimit(1)
                Spacer()
                if entry.available {
                    Text(entry.prayerDate, style: .relative).font(.caption).foregroundColor(theme.accent)
                }
            }
            Divider().overlay(theme.muted.opacity(0.4))
            ForEach(entry.todayTimes) { item in
                HStack {
                    Text(item.id)
                        .font(.body)
                        .fontWeight(item.id == entry.prayerName ? .bold : .regular)
                        .foregroundColor(item.id == entry.prayerName ? theme.accent : theme.text)
                    Spacer()
                    Text(item.date, style: .time)
                        .font(.body)
                        .fontWeight(item.id == entry.prayerName ? .bold : .regular)
                        .foregroundColor(item.id == entry.prayerName ? theme.accent : theme.text)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct SalatiPrayerWidget: Widget {
    let kind: String = "SalatiPrayerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            SalatiPrayerWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Nächstes Gebet")
        .description("Zeigt das nächste Gebet mit Uhrzeit und Countdown.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryInline, .accessoryCircular, .accessoryRectangular])
    }
}

// MARK: - Countdown-Widget (kompakt)

struct SalatiCountdownWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: PrayerEntry

    var body: some View {
        let theme = WidgetTheme.resolve(entry.theme)
        Group {
            switch family {
            case .accessoryInline:
                Text(entry.available ? "\(entry.prayerName) \(entry.prayerDate, style: .relative)" : "Salati")
            case .accessoryCircular:
                VStack(spacing: 0) {
                    Text(entry.prayerName).font(.caption2).minimumScaleFactor(0.5)
                    if entry.available { Text(entry.prayerDate, style: .timer).font(.caption2).monospacedDigit().multilineTextAlignment(.center) }
                }
            default:
                VStack(alignment: .center, spacing: 4) {
                    Text(entry.available ? entry.prayerName : "Salati").font(.headline).foregroundColor(theme.text)
                    if entry.available {
                        Text(entry.prayerDate, style: .timer)
                            .font(.system(.title2, design: .rounded)).monospacedDigit().bold()
                            .foregroundColor(theme.accent).multilineTextAlignment(.center)
                        Text(entry.prayerDate, style: .time).font(.caption).foregroundColor(theme.muted)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .containerBackground(for: .widget) {
            (family == .accessoryCircular || family == .accessoryInline) ? Color.clear : theme.background
        }
    }
}

struct SalatiCountdownWidget: Widget {
    let kind: String = "SalatiCountdownWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            SalatiCountdownWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Countdown")
        .description("Kompakter Countdown bis zum nächsten Gebet.")
        .supportedFamilies([.systemSmall, .accessoryInline, .accessoryCircular])
    }
}

// MARK: - Qibla-Widget

struct QiblaEntry: TimelineEntry {
    let date: Date
    let bearing: Double
    let distanceKm: Double
    let locationLabel: String
    let available: Bool
    let theme: String?
}

struct QiblaProvider: TimelineProvider {
    func placeholder(in context: Context) -> QiblaEntry {
        QiblaEntry(date: Date(), bearing: 119, distanceKm: 4000, locationLabel: "Salati", available: true, theme: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (QiblaEntry) -> Void) {
        completion(entry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QiblaEntry>) -> Void) {
        completion(Timeline(entries: [entry()], policy: .after(Date().addingTimeInterval(6 * 3600))))
    }

    private func entry() -> QiblaEntry {
        guard let payload = loadPayload(), let bearing = payload.qiblaBearing, let dist = payload.qiblaDistanceKm else {
            return QiblaEntry(date: Date(), bearing: 0, distanceKm: 0, locationLabel: "Salati", available: false, theme: loadPayload()?.widgetTheme)
        }
        return QiblaEntry(date: Date(), bearing: bearing, distanceKm: dist, locationLabel: payload.locationLabel, available: true, theme: payload.widgetTheme)
    }
}

struct SalatiQiblaWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: QiblaEntry

    private var distanceText: String {
        entry.distanceKm >= 100 ? "\(Int(entry.distanceKm.rounded())) km" : String(format: "%.0f km", entry.distanceKm)
    }

    var body: some View {
        let theme = WidgetTheme.resolve(entry.theme)
        Group {
            switch family {
            case .accessoryInline:
                Text(entry.available ? "Qibla \(Int(entry.bearing.rounded()))° \(cardinal(entry.bearing))" : "Qibla")
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: "location.north.fill")
                        .rotationEffect(.degrees(entry.bearing))
                    VStack { Spacer(); Text("\(Int(entry.bearing.rounded()))°").font(.system(size: 10)).monospacedDigit() }
                }
            case .accessoryRectangular:
                HStack(spacing: 8) {
                    Image(systemName: "location.north.fill").rotationEffect(.degrees(entry.bearing))
                    VStack(alignment: .leading) {
                        Text("Qibla \(Int(entry.bearing.rounded()))° \(cardinal(entry.bearing))").font(.headline)
                        if entry.available { Text(distanceText).font(.caption2) }
                    }
                }
            default:
                VStack(spacing: 6) {
                    Text("Qibla").font(.caption).foregroundColor(theme.muted)
                    Image(systemName: "location.north.fill")
                        .font(.system(size: 34))
                        .foregroundColor(theme.accent)
                        .rotationEffect(.degrees(entry.bearing))
                    if entry.available {
                        Text("\(Int(entry.bearing.rounded()))° \(cardinal(entry.bearing))").font(.headline).foregroundColor(theme.text)
                        Text(distanceText).font(.caption).foregroundColor(theme.muted)
                    } else {
                        Text("App öffnen").font(.caption).foregroundColor(theme.muted)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .containerBackground(for: .widget) {
            (family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline) ? Color.clear : theme.background
        }
    }
}

struct SalatiQiblaWidget: Widget {
    let kind: String = "SalatiQiblaWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QiblaProvider()) { entry in
            SalatiQiblaWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Qibla-Richtung")
        .description("Richtung und Entfernung zur Kaaba.")
        .supportedFamilies([.systemSmall, .accessoryInline, .accessoryCircular, .accessoryRectangular])
    }
}

// MARK: - Bundle

@main
struct SalatiPrayerWidgetBundle: WidgetBundle {
    var body: some Widget {
        SalatiPrayerWidget()
        SalatiCountdownWidget()
        SalatiQiblaWidget()
        // Live Activity "nächstes Gebet" (Sperrbildschirm/Dynamic Island),
        // s. PrayerLiveActivity.swift. Nur ab iOS 16.1 verfügbar.
        if #available(iOS 16.1, *) {
            PrayerLiveActivity()
        }
    }
}
