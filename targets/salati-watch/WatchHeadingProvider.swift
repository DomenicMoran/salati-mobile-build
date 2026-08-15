// Kompass der Uhr (CoreLocation-Heading) fuer die Qibla-Ansicht.
//
// BEWUSST IN EINER EIGENEN DATEI: das ist der einzige Teil der Uhren-App, der
// eine API benutzt, die auf watchOS nicht in jedem SDK-Stand identisch
// verfuegbar war (Heading kam mit watchOS 5, Kompass-Hardware erst ab Apple
// Watch Series 5 / Ultra). Sollte der Ziel-Build an dieser Datei scheitern,
// genuegt es, sie zu loeschen und in WatchViews.swift den Zweig
// `headingProvider.heading` auf `nil` festzunageln — die Qibla-Ansicht faellt
// dann auf die reine Gradzahl aus der Nutzlast zurueck, alles andere bleibt
// unberuehrt. Details in docs/audit-2026-07-27/APPLE-WATCH-AUSBAU.md.
//
// KEINE HARDWARE OHNE KOMPASS ZWINGEN: headingAvailable() ist der Laufzeit-
// Schalter. Ist er false (aeltere Watch-Modelle), blendet die Ansicht den
// drehenden Pfeil aus und zeigt qibla.noMagnetometer — denselben Hinweistext,
// den die Telefon-App in diesem Fall zeigt.
//
// UNGETESTET: kein Geraet vorhanden, s. Kopfkommentar in WatchPrayerStore.swift.

// Combine explizit importiert: ObservableObject/@Published stammen von dort,
// nicht aus Foundation.
import Combine
import CoreLocation
import Foundation

final class WatchHeadingProvider: NSObject, ObservableObject, CLLocationManagerDelegate {
    /// Aktuelle Blickrichtung der Uhr in Grad (0 = Norden) oder nil, solange
    /// noch kein gueltiger Messwert vorliegt.
    @Published private(set) var heading: Double?
    /// Ob das Geraet ueberhaupt Heading liefern kann.
    @Published private(set) var available: Bool = false

    private let manager = CLLocationManager()
    private var isRunning = false

    override init() {
        super.init()
        manager.delegate = self
        // Weniger Updates als der Standard: auf einer Uhr reicht 2 Grad
        // Aufloesung fuer die Ausrichtung und spart Energie.
        manager.headingFilter = 2
        available = CLLocationManager.headingAvailable()
    }

    func start() {
        available = CLLocationManager.headingAvailable()
        guard available, !isRunning else { return }
        isRunning = true
        // trueHeading (geografisch statt magnetisch) setzt eine
        // Standortfreigabe voraus; ohne sie liefert CoreLocation nur
        // magneticHeading — das faengt didUpdateHeading unten ab.
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
        manager.startUpdatingHeading()
    }

    func stop() {
        guard isRunning else { return }
        isRunning = false
        manager.stopUpdatingHeading()
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        // Gleiche Regel wie src/features/qibla/useCompass.ts: trueHeading
        // bevorzugen, -1 bedeutet "unbekannt".
        let value = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        guard value >= 0 else { return }
        DispatchQueue.main.async { self.heading = value }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        DispatchQueue.main.async { self.heading = nil }
    }
}
