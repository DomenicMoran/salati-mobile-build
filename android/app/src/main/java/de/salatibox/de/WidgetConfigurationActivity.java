package de.salatibox.de;

import android.os.Bundle;

import com.facebook.react.ReactActivityDelegate;
import com.reactnativeandroidwidget.RNWidgetConfigurationActivity;

import expo.modules.ReactActivityDelegateWrapper;

// PER-WIDGET Konfigurations-Activity. Android startet sie beim Platzieren bzw.
// beim Bearbeiten (langes Drücken → "Konfigurieren") eines Widgets, dessen
// Provider android:configure auf diese Activity zeigt (widgetprovider_*.xml).
// Die Basisklasse aus react-native-android-widget hostet den JS-Screen, der in
// index.android.js via registerWidgetConfigurationScreen registriert wird.
// Manuell gepflegt (kein expo prebuild) — analog zu den Widget-Providern unter
// de/salatibox/de/widget/.
//
// WICHTIG (Absturz-Fix): Wie MainActivity MUSS auch diese ReactActivity ihren
// ReactActivityDelegate in Expos ReactActivityDelegateWrapper hüllen. Die
// Basisklasse der Library liefert einen nackten DefaultReactActivityDelegate
// (korrekt für bare React Native, aber unvollständig für Expo). Ohne den
// Wrapper werden Expo-Module/-Lifecycle für diese Activity nicht initialisiert
// → die Konfigurations-Activity crasht beim Öffnen (New Architecture /
// bridgeless). Der Wrapper leitet getLaunchOptions() an das innere Delegate
// weiter, sodass die widgetInfo-Initial-Props (widgetId/widgetName) für den
// Config-Screen erhalten bleiben.
public class WidgetConfigurationActivity extends RNWidgetConfigurationActivity {
  // ROBUSTHEIT (Absturz-Vermeidung):
  // 1) setTheme(AppTheme): erzwingt die echte App-Theme, falls das Manifest je
  //    wieder auf die Splash-Theme zurückgesetzt wird (z. B. nach einem expo
  //    prebuild). Diese Config-Activity ruft KEIN SplashScreenManager.
  //    registerOnActivity() auf, die Splash->App-Transition würde also nie
  //    stattfinden.
  // 2) super.onCreate(null): React-Native-Empfehlung — ein non-null
  //    savedInstanceState lässt RN Fragmente wiederherstellen, was beim
  //    Activity-Recreate crashen kann. Die Basisklasse übergibt sonst das
  //    originale Bundle weiter.
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    setTheme(R.style.AppTheme);
    super.onCreate(null);
  }

  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new ReactActivityDelegateWrapper(
        this,
        BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
        super.createReactActivityDelegate());
  }
}
