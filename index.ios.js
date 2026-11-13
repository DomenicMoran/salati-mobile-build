// iOS-Entry: Hermes + Expo Winter brauchen AbortSignal/Headers vor expo-router.
// Android nutzt index.android.js; Web bleibt bei index.js. Metro
// getModulesRunBeforeMainModule ist laut Expo runtime.native „unstable or can
// be missing“ in Release — deshalb explizit wie in index.android.js.
import 'react-native/Libraries/Core/InitializeCore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('./src/lib/ensureAbortSignalGlobals');

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('expo-router/entry');
