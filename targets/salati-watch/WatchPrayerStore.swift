// Datenschicht der watchOS-App: empfaengt die Gebetszeiten vom iPhone
// (WatchConnectivity) und legt sie in der App-Group der UHR ab, aus der auch
// die Komplikation (targets/salati-watch-complication/) liest.
//
// WARUM WATCHCONNECTIVITY UND NICHT NUR DIE APP-GROUP:
// App-Groups teilen Daten nur zwischen Prozessen auf DEMSELBEN Geraet. Seit
// watchOS 2 laeuft die Uhren-App auf der Uhr (nicht mehr als Extension auf dem
// iPhone), d. h. "group.de.salatibox.de" existiert auf iPhone UND Uhr, aber als
// zwei voellig getrennte Container. Die iPhone-App schreibt ueber
// src/features/prayer-times/ios-widget.ts nur in den Container des iPhones —
// auf der Uhr blieb er bisher leer. Genau deshalb zeigte die Komplikation nie
// echte Daten. Der einzige unterstuetzte Weg iPhone -> Uhr ist WCSession;
// modules/salati-watch-sync (iPhone-Seite) schickt exakt dieselbe JSON-Nutzlast
// per updateApplicationContext, diese Datei schreibt sie in die App-Group der
// Uhr. Der Decoder der Komplikation bleibt dadurch unveraendert.
//
// WARUM DIE UHR NICHT SELBST RECHNET: die App berechnet die Zeiten offline mit
// adhan-js (src/features/prayer-times/calc.ts) inklusive Methode, Madhab,
// Hoehen-Regel und Nutzer-Offsets (offsets.ts). Diese Konfiguration in Swift
// nachzubauen hiesse, eine zweite Astronomie-Implementierung zu pflegen, die
// ohne Mac nicht einmal kompilierbar geprueft werden kann und garantiert von
// der Telefon-Seite abdriftet. Die uebertragene Tabelle ist per Definition
// identisch mit dem, was die App anzeigt.
//
// OFFLINE: Nach dem ersten Empfang liest die Uhr ausschliesslich aus ihrer
// eigenen App-Group — ohne iPhone in Reichweite, ohne Netz. Die Nutzlast
// enthaelt heute + morgen; ist sie aelter als der heutige Tag, wird sie
// weiterhin angezeigt, aber sichtbar als veraltet markiert (isStale).
//
// UNGETESTET: kein macOS/Xcode/iPhone/Apple Watch in dieser Umgebung, s.
// docs/audit-2026-07-27/APPLE-WATCH-AUSBAU.md.

// Combine explizit importiert: ObservableObject/@Published stammen von dort.
import Combine
import Foundation
import SwiftUI
import WatchConnectivity
import WidgetKit

/// MUSS identisch zu targets/salati-watch-complication/expo-target.config.js,
/// targets/salati-widget/expo-target.config.js und app.config.ts sein.
let salatiAppGroup = "group.de.salatibox.de"
/// MUSS identisch zu src/features/prayer-times/ios-widget.ts (STORAGE_KEY) sein.
let salatiPayloadKey = "salati.widget.prayerTimes"
/// Nur auf der Uhr: Zeitstempel der letzten Uebertragung (kein Pendant auf dem iPhone).
private let salatiSyncedAtKey = "salati.watch.syncedAt"

/// Schluessel im WCSession-ApplicationContext — Gegenstueck zu
/// modules/salati-watch-sync/ios/SalatiWatchSyncModule.swift.
private let contextPayloadKey = "payload"
private let contextSyncedAtKey = "syncedAt"

// MARK: - Nutzlast (spiegelt IosWidgetPayload aus src/features/prayer-times/ios-widget.ts)

struct WatchTimings: Codable {
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

/// Neue Felder bewusst optional, damit aeltere gespeicherte Nutzlasten weiter
/// decodieren (gleiche Regel wie in targets/salati-widget/SalatiPrayerWidget.swift).
struct WatchPayload: Codable {
    let locationLabel: String
    let today: WatchTimings
    let tomorrow: WatchTimings
    let timeFormat: String
    let qiblaBearing: Double?
    let qiblaDistanceKm: Double?
    let widgetTheme: String?
}

/// Ein Eintrag der Tagesliste. `labelKey` zeigt in die Tabelle in WatchStrings.swift.
struct PrayerSlot: Identifiable {
    let id: String
    let labelKey: String
    let date: Date
    /// Sunrise ist kein Pflichtgebet — wird gedimmt dargestellt und nie als "naechstes" gewaehlt.
    let isObligatory: Bool
}

// MARK: - Store

final class WatchPrayerStore: NSObject, ObservableObject, WCSessionDelegate {
    @Published private(set) var payload: WatchPayload?
    @Published private(set) var syncedAt: Date?

    private var didActivate = false

    /// Reihenfolge der Tagesliste (inkl. Sunrise, anders als prayerOrder in der Komplikation).
    private static let dayOrder: [(name: String, labelKey: String, obligatory: Bool)] = [
        ("Fajr", "fajr", true),
        ("Sunrise", "sunrise", false),
        ("Dhuhr", "dhuhr", true),
        ("Asr", "asr", true),
        ("Maghrib", "maghrib", true),
        ("Isha", "isha", true),
    ]

    override init() {
        super.init()
        loadFromAppGroup()
    }

    // MARK: Aktivierung

    /// Idempotent — wird beim ersten Erscheinen der Oberflaeche aufgerufen.
    func activate() {
        guard !didActivate, WCSession.isSupported() else { return }
        didActivate = true
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    /// Bittet das iPhone aktiv um die aktuelle Tabelle (nur wenn es erreichbar
    /// ist). Ohne diesen Weg muesste die Uhr auf den naechsten
    /// updateApplicationContext-Push warten.
    func requestFromPhone() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(["request": salatiPayloadKey], replyHandler: { [weak self] reply in
            DispatchQueue.main.async { self?.apply(context: reply) }
        }, errorHandler: { _ in
            // Kein Fehlerfall fuer den Nutzer: die Uhr zeigt weiter die zuletzt
            // gespeicherten Zeiten (Offline-Pfad).
        })
    }

    // MARK: Persistenz

    private func loadFromAppGroup() {
        guard let defaults = UserDefaults(suiteName: salatiAppGroup) else { return }
        if let json = defaults.string(forKey: salatiPayloadKey),
           let data = json.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(WatchPayload.self, from: data) {
            payload = decoded
        }
        let timestamp = defaults.double(forKey: salatiSyncedAtKey)
        syncedAt = timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : nil
    }

    /// Schreibt eine empfangene Nutzlast in die App-Group der Uhr und laedt die
    /// Komplikations-Timelines neu.
    private func apply(context: [String: Any]) {
        guard let json = context[contextPayloadKey] as? String,
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(WatchPayload.self, from: data)
        else { return }

        let timestamp = context[contextSyncedAtKey] as? Double ?? Date().timeIntervalSince1970
        if let defaults = UserDefaults(suiteName: salatiAppGroup) {
            defaults.set(json, forKey: salatiPayloadKey)
            defaults.set(timestamp, forKey: salatiSyncedAtKey)
        }
        payload = decoded
        syncedAt = Date(timeIntervalSince1970: timestamp)
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: Abgeleitete Werte

    var locationLabel: String { payload?.locationLabel ?? "Salati" }
    var qiblaBearing: Double? { payload?.qiblaBearing }
    var qiblaDistanceKm: Double? { payload?.qiblaDistanceKm }
    var uses24hClock: Bool { payload?.timeFormat != "12h" }

    /// True, wenn die letzte Uebertragung nicht von heute ist — die Zeiten
    /// stimmen dann nur noch naeherungsweise.
    var isStale: Bool {
        guard let syncedAt = syncedAt else { return payload != nil }
        return !Calendar.current.isDateInToday(syncedAt)
    }

    func daySlots(now: Date) -> [PrayerSlot] {
        guard let payload = payload else { return [] }
        return Self.dayOrder.compactMap { entry in
            guard let date = Self.parseTime(payload.today.time(for: entry.name), on: now) else { return nil }
            return PrayerSlot(id: entry.name, labelKey: entry.labelKey, date: date, isObligatory: entry.obligatory)
        }
    }

    /// Naechstes Pflichtgebet — inkl. Fajr des Folgetags nach Isha. Gleiche
    /// Logik wie loadEntries() in targets/salati-watch-complication/.
    func nextSlot(now: Date) -> PrayerSlot? {
        guard let payload = payload else { return nil }
        var candidates = daySlots(now: now).filter { $0.isObligatory }
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now
        if let fajrTomorrow = Self.parseTime(payload.tomorrow.time(for: "Fajr"), on: tomorrow) {
            candidates.append(PrayerSlot(id: "Fajr+1", labelKey: "fajr", date: fajrTomorrow, isObligatory: true))
        }
        return candidates.filter { $0.date > now }.sorted { $0.date < $1.date }.first
    }

    /// Uhrzeit im vom Nutzer gewaehlten Format (settings.timeFormat, kommt in
    /// der Nutzlast mit). Ziffern/AM-PM folgen der Sprache der Uhr.
    func timeText(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = uses24hClock ? "HH:mm" : "h:mm a"
        return formatter.string(from: date)
    }

    /// "HH:mm" auf einen konkreten Tag gelegt — identisch zu parseTime() in
    /// targets/salati-widget/SalatiPrayerWidget.swift.
    private static func parseTime(_ hhmm: String, on day: Date) -> Date? {
        let parts = hhmm.split(separator: ":")
        guard parts.count >= 2, let hour = Int(parts[0]), let minute = Int(parts[1]) else { return nil }
        var components = Calendar.current.dateComponents([.year, .month, .day], from: day)
        components.hour = hour
        components.minute = minute
        components.second = 0
        return Calendar.current.date(from: components)
    }

    // MARK: - WCSessionDelegate
    //
    // Auf watchOS ist nur activationDidCompleteWith verpflichtend
    // (sessionDidBecomeInactive/sessionDidDeactivate sind iOS-only).

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        guard activationState == .activated else { return }
        // receivedApplicationContext ueberlebt Neustarts — deckt den Fall ab,
        // dass der Push kam, waehrend die App nicht lief.
        let context = session.receivedApplicationContext
        DispatchQueue.main.async {
            self.apply(context: context)
            self.requestFromPhone()
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async { self.apply(context: applicationContext) }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        DispatchQueue.main.async { self.apply(context: userInfo) }
    }
}
