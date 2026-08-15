// Android-Entry: expo-router + Registrierung des Homescreen-Widget-Handlers
// (react-native-android-widget). Muss VOR der App-Registrierung passieren,
// damit Widget-Updates auch headless (App geschlossen) funktionieren.
import 'expo-router/entry';
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';

import { WidgetConfigScreenRoot } from './src/widgets/WidgetConfigScreen';
import { widgetTaskHandler } from './src/widgets/widget-task-handler';

registerWidgetTaskHandler(widgetTaskHandler);
// PER-WIDGET Konfiguration: Android startet die native
// WidgetConfigurationActivity (AndroidManifest + android:configure in den
// widgetprovider_*.xml) beim Platzieren/Bearbeiten und rendert diesen Screen
// unter dem AppRegistry-Key 'RNWidgetConfigurationScreen'. Registriert wird der
// in eine ErrorBoundary gehüllte Root (WidgetConfigScreenRoot), damit ein
// Render-Fehler den Wiederherstellungs-Screen zeigt statt die App zu beenden.
registerWidgetConfigurationScreen(WidgetConfigScreenRoot);
