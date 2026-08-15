// iPhone-Seite der Apple-Watch-Synchronisation.
//
// WOZU: App-Groups teilen Daten nur zwischen Prozessen auf DEMSELBEN Geraet.
// Die iPhone-App schreibt die Gebetszeiten ueber
// src/features/prayer-times/ios-widget.ts in die App-Group
// "group.de.salatibox.de" — dort lesen das iOS-Widget und die Live Activity
// mit, aber NICHT die Apple Watch: die hat seit watchOS 2 ihren eigenen,
// voellig getrennten Container gleichen Namens. Der einzige unterstuetzte Weg
// iPhone -> Uhr ist WatchConnectivity. Dieses Modul schickt genau die Nutzlast,
// die ohnehin schon in der App-Group liegt, unveraendert per
// updateApplicationContext an die Uhr; targets/salati-watch/WatchPrayerStore.swift
// schreibt sie dort in die App-Group der Uhr, aus der auch die Komplikation
// (targets/salati-watch-complication/) liest.
//
// WARUM KEIN JS-AUFRUF NOETIG IST: die Quelle ist bewusst dieselbe App-Group-
// Zeichenkette, die die App schon schreibt — kein zweiter Datenpfad, keine
// zweite Aufrufstelle, die vergessen werden kann. Ausgeloest wird das Senden
// durch (a) den App-Start, (b) Vorder-/Hintergrundwechsel, (c) jede Aenderung
// an UserDefaults im Prozess (dort landet der ExtensionStorage-Schreibvorgang
// aus ios-widget.ts) und (d) Zustandswechsel der Uhr. Gesendet wird nur, wenn
// sich der Inhalt tatsaechlich geaendert hat.
//
// Die exportierten JS-Funktionen (siehe ../index.ts) sind reine Diagnose-/
// Nachhilfe-APIs und werden aktuell von keiner Stelle in src/ aufgerufen.
//
// UNVERIFIZIERT: kein macOS/Xcode/iPhone/Apple Watch in dieser Umgebung
// (s. AGENTS.md) — echte Verifikation erst per EAS-Build + TestFlight, siehe
// docs/audit-2026-07-27/APPLE-WATCH-AUSBAU.md.

import ExpoModulesCore
import UIKit
import WatchConnectivity

/// MUSS identisch zu app.config.ts (ios.entitlements) und
/// src/features/prayer-times/ios-widget.ts sein.
private let appGroup = "group.de.salatibox.de"
/// MUSS identisch zu src/features/prayer-times/ios-widget.ts (STORAGE_KEY) sein.
private let storageKey = "salati.widget.prayerTimes"

/// Schluessel im ApplicationContext — Gegenstueck zu
/// targets/salati-watch/WatchPrayerStore.swift.
private let contextPayloadKey = "payload"
private let contextSyncedAtKey = "syncedAt"

final class SalatiWatchSyncBridge: NSObject, WCSessionDelegate {
  static let shared = SalatiWatchSyncBridge()

  /// Zuletzt erfolgreich uebertragene Nutzlast — verhindert, dass jede
  /// beliebige UserDefaults-Aenderung eine Uebertragung ausloest.
  private var lastSentPayload: String?
  private var didRegisterObservers = false
  /// Buendelt Ausloeser: UserDefaults.didChangeNotification kann in kurzer
  /// Folge mehrfach feuern, uebertragen wird trotzdem hoechstens einmal.
  private var hasPendingSend = false

  var isSupported: Bool { WCSession.isSupported() }

  /// Idempotent; wird aus dem AppDelegate-Subscriber und aus OnCreate gerufen.
  func activate() {
    guard WCSession.isSupported() else { return }
    registerObservers()
    let session = WCSession.default
    if session.delegate !== self {
      session.delegate = self
    }
    if session.activationState != .activated {
      session.activate()
    }
  }

  private func registerObservers() {
    guard !didRegisterObservers else { return }
    didRegisterObservers = true
    let center = NotificationCenter.default
    // ExtensionStorage (@bacons/apple-targets) schreibt in die App-Group-
    // UserDefaults; das loest diese Benachrichtigung im selben Prozess aus.
    center.addObserver(self, selector: #selector(handleTrigger), name: UserDefaults.didChangeNotification, object: nil)
    center.addObserver(self, selector: #selector(handleTrigger), name: UIApplication.didBecomeActiveNotification, object: nil)
    center.addObserver(self, selector: #selector(handleTrigger), name: UIApplication.didEnterBackgroundNotification, object: nil)
  }

  @objc private func handleTrigger() {
    DispatchQueue.main.async { [weak self] in
      guard let self = self, !self.hasPendingSend else { return }
      self.hasPendingSend = true
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
        guard let self = self else { return }
        self.hasPendingSend = false
        _ = self.send(force: false)
      }
    }
  }

  /// Liest die aktuelle Nutzlast aus der App-Group des iPhones.
  private func currentPayload() -> String? {
    UserDefaults(suiteName: appGroup)?.string(forKey: storageKey)
  }

  /// Uebertraegt die Nutzlast an die Uhr. `force` ignoriert die
  /// Gleichheitspruefung (z. B. direkt nach Aktivierung).
  @discardableResult
  func send(force: Bool) -> Bool {
    guard WCSession.isSupported(), let json = currentPayload() else { return false }
    if !force && json == lastSentPayload { return false }

    let session = WCSession.default
    guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else {
      return false
    }

    do {
      try session.updateApplicationContext([
        contextPayloadKey: json,
        contextSyncedAtKey: Date().timeIntervalSince1970,
      ])
      lastSentPayload = json
      return true
    } catch {
      // Kein Nutzer-sichtbarer Fehler: die Uhr behaelt ihre zuletzt
      // gespeicherten Zeiten und versucht es beim naechsten Ausloeser erneut.
      return false
    }
  }

  func status() -> [String: Bool] {
    guard WCSession.isSupported() else {
      return ["supported": false, "paired": false, "watchAppInstalled": false, "activated": false, "reachable": false]
    }
    let session = WCSession.default
    return [
      "supported": true,
      "paired": session.isPaired,
      "watchAppInstalled": session.isWatchAppInstalled,
      "activated": session.activationState == .activated,
      "reachable": session.isReachable,
    ]
  }

  // MARK: - WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    guard activationState == .activated else { return }
    DispatchQueue.main.async { [weak self] in
      _ = self?.send(force: true)
    }
  }

  /// Auf iOS verpflichtend: nach einem Uhrenwechsel muss die Sitzung neu
  /// aktiviert werden.
  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    lastSentPayload = nil
    WCSession.default.activate()
  }

  /// Uhr gekoppelt / App auf der Uhr installiert -> sofort versorgen.
  func sessionWatchStateDidChange(_ session: WCSession) {
    DispatchQueue.main.async { [weak self] in
      _ = self?.send(force: true)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    guard session.isReachable else { return }
    DispatchQueue.main.async { [weak self] in
      _ = self?.send(force: false)
    }
  }

  /// Die Uhr fragt beim Start aktiv nach den Zeiten
  /// (WatchPrayerStore.requestFromPhone) — spart das Warten auf den naechsten
  /// Push.
  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    guard let json = currentPayload() else {
      replyHandler([:])
      return
    }
    replyHandler([
      contextPayloadKey: json,
      contextSyncedAtKey: Date().timeIntervalSince1970,
    ])
  }
}

/// Startet die Sitzung so frueh wie moeglich, ohne dass JS das Modul
/// importieren muss (registriert ueber ../expo-module.config.json).
public class SalatiWatchSyncAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    SalatiWatchSyncBridge.shared.activate()
    return true
  }
}

public class SalatiWatchSyncModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SalatiWatchSync")

    OnCreate {
      SalatiWatchSyncBridge.shared.activate()
    }

    Function("isSupported") { () -> Bool in
      SalatiWatchSyncBridge.shared.isSupported
    }

    Function("status") { () -> [String: Bool] in
      SalatiWatchSyncBridge.shared.status()
    }

    Function("sync") { () -> Bool in
      SalatiWatchSyncBridge.shared.send(force: true)
    }
  }
}
