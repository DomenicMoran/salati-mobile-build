// Zeitzone des Testlaufs pinnen. `calc.ts` formatiert Gebetszeiten mit
// `getHours()`, also in der Zone des Geraets — auf einem Telefon richtig, im
// Test eine Abhaengigkeit von der Maschine: `calc.test.ts` prueft die
// Reihenfolge fuer BERLIN, und auf einem Laeufer in UTC dreht sie sich um
// („Expected: < 163, Received: 1388", CI-Lauf 31509798910).
//
// Hier und NICHT in jest.setup.js: diese Datei liest der Elternprozess, bevor
// er die Arbeitsprozesse startet — die erben die Umgebung und legen ihre
// Zeitzone beim Start fest. In `setupFiles` kommt die Zuweisung zu spaet
// (Lauf 31511336496: dieselben drei Faelle fielen weiter um). apps/tv hat die
// Zeile seit dem Audit 2026-07-29; nur hier fehlte sie.
process.env.TZ = process.env.TZ || 'Europe/Berlin';

module.exports = {
  preset: 'jest-expo',
  passWithNoTests: true,
  setupFiles: ['./jest.setup.js'],
  // constants/theme.ts importiert global.css (NativeWind) — Jest hat keinen
  // CSS-Transformer, der Import wuerde jeden Test sprengen, der die Palette
  // laedt (z. B. constants/theme.test.ts). CSS traegt fuer Tests keinerlei
  // Information, daher auf ein leeres Modul mappen.
  // '@/assets/*' zeigt laut tsconfig auf ./assets (NICHT auf src/assets) — die
  // Voreinstellung von jest-expo kennt nur '@/*' → src/*, jeder Screen mit
  // Bild-Import (z. B. app/onboarding.tsx) scheitert sonst schon am require.
  // Reihenfolge zählt: die speziellere Regel muss vor '@/*' greifen.
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '\\.css$': '<rootDir>/jest.css-stub.js',
  },
  // Ohne collectCoverageFrom instrumentiert Jest nur Dateien, die ein Test
  // ohnehin laedt — die gemeldete Quote (63 %) ist dann eine Selbstauskunft
  // der getesteten Teilmenge. Explizit ueber ganz src/ gemessen sind es 21 %.
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.*'],
};
