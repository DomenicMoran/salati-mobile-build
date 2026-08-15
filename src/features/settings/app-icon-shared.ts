// Reine Daten (Typ + Presets) fuer die Custom-App-Icon-Auswahl - KEINE
// nativen Imports. Bewusst getrennt von app-icon.ts, damit sowohl die native
// Implementierung (app-icon.ts) als auch der Web-Stub (app-icon.web.ts)
// dieselben Varianten/Typen teilen, ohne dass der Web-Build die nativen
// Module react-native-change-icon / expo-dynamic-app-icon laedt (deren
// Import wirft auf Web "Cannot find native module ...").

export type AppIconVariant = 'Default' | 'Emerald' | 'Salatibox';

export const APP_ICON_VARIANTS: { id: AppIconVariant; swatch: string }[] = [
  { id: 'Default', swatch: '#d4af37' },
  { id: 'Emerald', swatch: '#10a35c' },
  { id: 'Salatibox', swatch: '#f7f3ea' },
];
