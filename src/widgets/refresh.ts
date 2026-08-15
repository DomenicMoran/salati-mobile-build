// Plattform-neutraler No-Op für refreshAllWidgets().
//
// react-native-android-widget ist Android-only und darf nicht ins Web-/iOS-
// Bundle gelangen (s. index.android.js / widget-task-handler.tsx). Diese
// Default-Datei greift auf Web/iOS; Metro löst auf Android stattdessen
// refresh.android.ts auf (Plattform-Endung), das die echten Widgets über
// requestWidgetUpdate neu zeichnet. Beide Dateien haben dieselbe Signatur,
// damit gemeinsame Aufrufer (z. B. src/app/settings.tsx) typkonform bleiben.
export async function refreshAllWidgets(): Promise<void> {
  // Kein Homescreen-Widget außerhalb von Android — nichts zu tun.
}
