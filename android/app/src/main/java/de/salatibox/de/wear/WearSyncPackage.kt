package de.salatibox.de.wear

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// Klassisches (Alt-Architektur-kompatibles) ReactPackage statt Expo-Modules-API
// oder TurboModule-Codegen - bewusst die einfachste Variante, damit dieses
// Scaffold ohne zusaetzliche Codegen-/Autolinking-Konfiguration lesbar bleibt.
// Unter der New Architecture (hier aktiv, siehe MainApplication.kt) laeuft
// dieses Modul ueber die Turbo-Modules-Interop-Schicht - UNGETESTET, ob das
// ohne weitere Anpassung (z. B. TurboReactPackage) tatsaechlich funktioniert.
class WearSyncPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(WearSyncModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
