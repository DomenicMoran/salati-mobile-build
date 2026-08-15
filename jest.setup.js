// Offizieller AsyncStorage-Mock — nötig, weil Feature-Module (quran/learn
// progress) AsyncStorage auf Modulebene importieren und Jest kein Native-
// Module bereitstellt.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Reanimated 4 laedt beim Import react-native-worklets, das ohne JSI-Runtime
// sofort wirft ("Cannot read properties of undefined (reading 'loadUnpackers')")
// — jeder Screen-Render-Test scheitert daran schon am Import von
// components/ui/animated-list-item.tsx. Der MITGELIEFERTE Mock hilft nicht: er
// importiert intern dieselbe echte Bibliothek. Deshalb ein eigener Mock,
// s. jest.reanimated-mock.js.
jest.mock('react-native-reanimated', () => require('./jest.reanimated-mock'));
