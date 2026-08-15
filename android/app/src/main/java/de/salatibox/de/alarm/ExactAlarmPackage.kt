package de.salatibox.de.alarm

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// Klassisches ReactPackage, gleiches Muster wie WearSyncPackage.kt (siehe
// dortiger Kommentar zur New-Architecture-Turbo-Interop-Unsicherheit).
class ExactAlarmPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(ExactAlarmModule(reactContext), WidgetAlarmModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
