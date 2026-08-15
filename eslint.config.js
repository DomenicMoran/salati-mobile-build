// https://docs.expo.dev/guides/using-eslint/
//
// Kein eslint/config-defineConfig()-Helper — der ist erst ab neueren ESLint-9-
// Minor-Versionen verfügbar (eslint-config-expo@57 selbst nutzt ihn intern
// und crasht mit älteren ESLint-Versionen, "Package subpath './config' is not
// defined by exports"). Ein reines Flat-Config-Array funktioniert stattdessen
// mit jeder ESLint-9-Version, hier auf ^9.30 gepinnt.
const expoConfig = require('eslint-config-expo/flat');

// Node-/Jest-Globals von Hand statt ueber das `globals`-Paket: das ist aus
// apps/mobile nicht aufloesbar (haengt nur transitiv im Root-Store).
const NODE_GLOBALS = {
  Buffer: 'readonly',
  process: 'readonly',
  console: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  module: 'writable',
  require: 'readonly',
  exports: 'writable',
  global: 'readonly',
  URL: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
};

module.exports = [
  ...expoConfig,
  {
    // scripts/ laeuft in Node, nicht in React Native — `npx expo lint` erfasst
    // den Ordner gar nicht, dadurch fielen dessen Findings bisher durchs Raster.
    files: ['scripts/**/*.{js,mjs,cjs}', '*.config.js', 'jest.setup.js'],
    languageOptions: {
      globals: { ...NODE_GLOBALS, jest: 'readonly' },
    },
  },
  {
    // Die beiden Web-Paritaetstests sind reines JavaScript (sie pruefen die
    // ES-Module unter public/rag gegen ihre nativen Gegenstuecke) und laufen
    // unter Jest. Ohne Jest-Globals meldet ESLint hier `describe is not
    // defined` — fuer TS-Tests deckt das bereits eslint-config-expo ab.
    files: ['src/**/*.web.test.js'],
    languageOptions: {
      globals: { describe: 'readonly', test: 'readonly', it: 'readonly', expect: 'readonly', jest: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' },
    },
  },
  {
    // dist*/ deckt dist/ und dist2/ (Web-Export-Output) ab; public/ enthaelt
    // vorgebautes RAG-Bundle, store-assets/ nur Bilder+generierte Skripte.
    // Ohne diese Eintraege meldet `npx eslint .` >13.000 Scheinfehler aus
    // Build-Output und verdeckt damit den echten (sauberen) Zustand von src/.
    ignores: ['dist*/**', '.expo/**', 'public/**', 'store-assets/**'],
  },
];
