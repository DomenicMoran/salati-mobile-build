// Web/iOS-Entry: unverändert expo-router. Android hat einen eigenen Entry
// (index.android.js), der zusätzlich den Widget-Task-Handler registriert —
// react-native-android-widget darf nicht ins Web-Bundle gelangen.
import 'expo-router/entry';
