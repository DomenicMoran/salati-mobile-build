// Expos Default (babel-preset-expo) reicht für Metro (native + Web-Export)
// vollständig aus — Metro versteht `import()` nativ fürs Chunk-Splitting
// (siehe features/study/courses.ts) und braucht dafür KEINE Babel-
// Transformation. Jest läuft dagegen unter CommonJS/Node und wirft ohne
// --experimental-vm-modules bei jedem echten `import()` einen Fehler
// ("A dynamic import callback was invoked without --experimental-vm-modules").
// babel-plugin-dynamic-import-node löst das NUR unter Jest auf, indem es
// `import()` dort zu `Promise.resolve(require())` transformiert.
//
// ACHTUNG, teuer erkaufte Lehre (LCP-Runde 2026-07-28): die Erkennung darf
// NICHT über JEST_WORKER_ID laufen. Metro 0.84 parallelisiert seine
// Transform-Schritte selbst mit `jest-worker`, und jest-worker setzt in JEDEM
// Kindprozess `JEST_WORKER_ID` (jest-worker/build/workers/ChildProcessWorker.js
// Zeile 133). Damit lief babel-plugin-dynamic-import-node auch im ganz normalen
// `expo export` mit — jedes `import()` wurde zu `Promise.resolve().then(require)`
// gefaltet, Metros collectDependencies sah keine einzige Async-Kante
// (gemessen: asyncDeps=0 bei 6.928 Kanten) und der Web-Export landete in EINER
// 25-MB-Datei statt in Chunks. Sichtbar wurde das nur lokal, weil Metro bei
// wenigen CPU-Kernen (CI/Vercel) in-band transformiert, also ohne Worker und
// damit ohne JEST_WORKER_ID — ein latenter Produktions-Bug, der beim nächsten
// größeren Build-Container jederzeit zugeschlagen hätte.
//
// NODE_ENV==='test' ist das saubere Signal: Jest setzt es beim Start selbst
// (jest-cli setzt process.env.NODE_ENV auf 'test', falls nicht gesetzt), Metro
// exportiert dagegen immer mit NODE_ENV='production' bzw. 'development'.
// Der Babel-Caller-Name taugt hier weiterhin nicht — jest-expo gibt sich
// absichtlich als `{ name: 'metro', bundler: 'metro' }` aus (siehe
// jest-expo/src/resolveBabelOptions.js).
module.exports = function (api) {
  const isJest = process.env.NODE_ENV === 'test';
  // Nicht api.cache(true): die Konfiguration hängt an NODE_ENV, und derselbe
  // Babel-Prozess darf sie nicht über einen Environment-Wechsel hinweg
  // festhalten. api.cache.using bindet den Cache-Schlüssel an genau diesen Wert.
  api.cache.using(() => process.env.NODE_ENV);
  return {
    presets: ['babel-preset-expo'],
    plugins: isJest ? ['babel-plugin-dynamic-import-node'] : [],
  };
};
