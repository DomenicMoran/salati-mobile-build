// Oberflaeche der watchOS-App: drei Seiten (naechstes Gebet, Tagesliste,
// Qibla). Daten kommen ausschliesslich aus WatchPrayerStore, Texte
// ausschliesslich aus WatchStrings (14 Sprachen).
//
// Farben bewusst als Literale statt ueber ein Asset-Catalog-Farbset: die
// Uhren-App hat kein eigenes Farbset (nur $accent aus expo-target.config.js
// fuer den System-Tint). Werte gespiegelt aus src/constants/theme.ts, wie es
// targets/salati-widget/SalatiPrayerWidget.swift ebenfalls macht.
//
// UNGETESTET: kein Geraet/Simulator vorhanden, s. Kopfkommentar in
// WatchPrayerStore.swift.

// Combine explizit importiert: Timer.publish liefert einen Combine-Publisher.
import Combine
import SwiftUI

enum Brand {
    /// Brand.gold (#d4af37)
    static let gold = Color(red: 212.0 / 255.0, green: 175.0 / 255.0, blue: 55.0 / 255.0)
    /// Brand.sand (#f7f3ea)
    static let sand = Color(red: 247.0 / 255.0, green: 243.0 / 255.0, blue: 234.0 / 255.0)
}

// MARK: - Wurzel

/// Startseite aus dem Startargument `--seite=<1|2|3>`.
///
/// Nur fuer die automatische Bildabnahme im Simulator: watchOS kennt keinen
/// Weg, per `simctl` zu wischen, und ohne das liesse sich immer nur Seite 1
/// belegen. Gleiches Mittel wie bei den TV-Ladenbildern (Startargument statt
/// Deep Link). Ohne das Argument bleibt es bei Seite 1, also beim normalen
/// Verhalten — das Argument setzt niemand ausser dem Pruefskript.
private func startSeiteAusArgumenten() -> Int {
    for argument in ProcessInfo.processInfo.arguments where argument.hasPrefix("--seite=") {
        let wert = Int(argument.dropFirst("--seite=".count)) ?? 1
        return min(max(wert, 1), 3)
    }
    return 1
}

struct WatchRootView: View {
    @EnvironmentObject private var store: WatchPrayerStore
    @State private var now = Date()
    @State private var seite = startSeiteAusArgumenten()

    /// Nur fuer die Auswahl "welches Gebet ist als naechstes dran" — die
    /// Restzeit selbst rendert SwiftUI ueber Text(_:style:.timer) sekundengenau.
    private let ticker = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        TabView(selection: $seite) {
            NextPrayerPage(now: now).tag(1)
            DayListPage(now: now).tag(2)
            QiblaPage().tag(3)
        }
        .tabViewStyle(.page)
        .onReceive(ticker) { now = $0 }
        .onAppear {
            store.activate()
            store.requestFromPhone()
        }
    }
}

// MARK: - Seite 1: naechstes Gebet

struct NextPrayerPage: View {
    @EnvironmentObject private var store: WatchPrayerStore
    let now: Date

    var body: some View {
        if let slot = store.nextSlot(now: now) {
            VStack(spacing: 2) {
                Text(store.locationLabel)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                Text(WatchStrings.t("nextPrayer"))
                    .font(.caption2)
                    .foregroundColor(Brand.gold)
                    .lineLimit(1)
                Text(WatchStrings.t(slot.labelKey))
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(Brand.sand)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                Text(store.timeText(slot.date))
                    .font(.headline)
                    .foregroundColor(Brand.gold)
                Text(slot.date, style: .timer)
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundColor(.secondary)
                StaleHint()
            }
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 4)
        } else {
            EmptyStatePage()
        }
    }
}

// MARK: - Seite 2: Tagesliste

struct DayListPage: View {
    @EnvironmentObject private var store: WatchPrayerStore
    let now: Date

    var body: some View {
        let slots = store.daySlots(now: now)
        if slots.isEmpty {
            EmptyStatePage()
        } else {
            let nextId = store.nextSlot(now: now)?.id
            List {
                ForEach(slots) { slot in
                    HStack {
                        Text(WatchStrings.t(slot.labelKey))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Spacer(minLength: 4)
                        Text(store.timeText(slot.date))
                            .monospacedDigit()
                    }
                    .font(.footnote)
                    .fontWeight(slot.id == nextId ? .bold : .regular)
                    .foregroundColor(color(for: slot, nextId: nextId))
                }
            }
        }
    }

    private func color(for slot: PrayerSlot, nextId: String?) -> Color {
        if slot.id == nextId { return Brand.gold }
        return slot.isObligatory ? Brand.sand : .secondary
    }
}

// MARK: - Seite 3: Qibla

struct QiblaPage: View {
    @EnvironmentObject private var store: WatchPrayerStore
    @StateObject private var headingProvider = WatchHeadingProvider()

    var body: some View {
        if let bearing = store.qiblaBearing {
            VStack(spacing: 4) {
                Image(systemName: "location.north.fill")
                    .font(.system(size: 32))
                    .foregroundColor(isAligned(bearing) ? .green : Brand.gold)
                    .rotationEffect(.degrees(arrowRotation(bearing)))
                    .animation(.easeOut(duration: 0.2), value: arrowRotation(bearing))
                Text("\(Int(bearing.rounded()))° · \(WatchStrings.cardinal(bearing))")
                    .font(.caption)
                    .foregroundColor(Brand.sand)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if let km = store.qiblaDistanceKm {
                    Text(WatchStrings.t("qiblaDistanceKm", "km", String(Int(km.rounded()))))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                hint(bearing)
            }
            .multilineTextAlignment(.center)
            .padding(.horizontal, 4)
            .onAppear { headingProvider.start() }
            .onDisappear { headingProvider.stop() }
        } else {
            EmptyStatePage()
        }
    }

    /// Ohne Kompass zeigt der Pfeil die reine Peilung ("Norden oben"), mit
    /// Kompass die Richtung relativ zur aktuellen Ausrichtung der Uhr.
    private func arrowRotation(_ bearing: Double) -> Double {
        guard let heading = headingProvider.heading else { return bearing }
        return bearing - heading
    }

    private func isAligned(_ bearing: Double) -> Bool {
        guard let heading = headingProvider.heading else { return false }
        let diff = abs((bearing - heading).truncatingRemainder(dividingBy: 360))
        return min(diff, 360 - diff) < 5
    }

    @ViewBuilder
    private func hint(_ bearing: Double) -> some View {
        if !headingProvider.available {
            Text(WatchStrings.t("qiblaNoMagnetometer"))
                .font(.system(size: 11))
                .foregroundColor(.secondary)
        } else if isAligned(bearing) {
            Text(WatchStrings.t("qiblaAligned"))
                .font(.system(size: 11))
                .foregroundColor(.green)
        } else {
            Text(WatchStrings.t("qiblaBearingInfo"))
                .font(.system(size: 11))
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Bausteine

/// Hinweis, wenn die letzte Uebertragung nicht von heute ist.
struct StaleHint: View {
    @EnvironmentObject private var store: WatchPrayerStore

    var body: some View {
        if store.isStale {
            Text(WatchStrings.t("offline"))
                .font(.system(size: 11))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .lineLimit(3)
        }
    }
}

/// Wird gezeigt, solange die Uhr noch nie Zeiten vom iPhone bekommen hat.
struct EmptyStatePage: View {
    var body: some View {
        VStack(spacing: 6) {
            Text("Salati")
                .font(.headline)
                .foregroundColor(Brand.gold)
            Text(WatchStrings.t("openOnPhone"))
                .font(.footnote)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 6)
    }
}
