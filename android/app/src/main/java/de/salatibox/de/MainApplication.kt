package de.salatibox.de

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

import de.salatibox.de.alarm.ExactAlarmPackage
import de.salatibox.de.wear.WearSyncPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          // WearSyncPackage (android/app/.../wear/) hat kein Expo-Config-Plugin
          // fuer Autolinking (siehe Kommentar in WearSyncModule.kt) - daher
          // hier von Hand registriert. WICHTIG: `npx expo prebuild -p android
          // --clean` ueberschreibt diese Datei und loescht diese Zeile + den
          // Import oben wieder - nach jedem Clean-Prebuild manuell erneut
          // eintragen, bis dafuer ein eigenes Config-Plugin existiert.
          add(WearSyncPackage())
          // ExactAlarmPackage (android/app/.../alarm/) - gleicher Grund/gleiches
          // Nachpflege-Risiko nach Clean-Prebuild wie WearSyncPackage oben.
          add(ExactAlarmPackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
