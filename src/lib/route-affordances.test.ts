/**
 * Navigations-Affordanz-Regression (Audit 2026-07-27, U1 + U2).
 *
 * U1: Root-Stack und alle verschachtelten Layouts laufen mit
 * `headerShown:false`; der schwebende Zurück-Chip existiert nur im Web. Jede
 * Nicht-Tab-Route muss deshalb selbst eine sichtbare Zurück-/Schließen-
 * Affordanz mitbringen — sonst bleibt auf nativ nur der Edge-Swipe (und auf
 * Android gar nichts Sichtbares). Der Audit fand 31 solcher Routen.
 *
 * U2: Steht der Kopf INNERHALB der ScrollView, scrollt der Zurück-/Fertig-
 * Knopf nach wenigen Wischern aus dem Bild (belegt an `agb.tsx`). Der zweite
 * Test hält fest, dass `ScreenHeader` über dem Scroll-Container steht.
 *
 * Beide Tests sind bewusst statisch: sie prüfen die Struktur der Routen-
 * Dateien, nicht das Rendering — genau die Eigenschaft, die beim Anlegen einer
 * neuen Route stillschweigend verloren geht.
 */

// Die App hat bewusst kein @types/node (tsconfig `types: ["jest"]`, und die
// RN-Laufzeit hat kein Node-FS). Dieser Test läuft ausschließlich unter Jest
// und holt sich die zwei benötigten Node-Module deshalb typisiert über
// `jest.requireActual`, statt eine neue Abhängigkeit einzuführen.
interface DirEntry {
  name: string;
  isDirectory(): boolean;
}
interface FsLike {
  readdirSync(dir: string, options: { withFileTypes: true }): DirEntry[];
  readFileSync(file: string, encoding: 'utf8'): string;
}
interface PathLike {
  join(...parts: string[]): string;
}
declare const __dirname: string;

const fs = jest.requireActual<FsLike>('fs');
const path = jest.requireActual<PathLike>('path');

const APP_DIR = path.join(__dirname, '..', 'app');

/** Tab-Wurzeln: erreichbar über die Tab-Leiste, kein Zurück-Ziel. */
const TAB_ROOTS = [
  '(tabs)/index.tsx',
  '(tabs)/lernen.tsx',
  '(tabs)/more.tsx',
  '(tabs)/qibla.tsx',
  '(tabs)/quran/index.tsx',
];

/**
 * Begründete Ausnahmen — jede einzeln, nicht als Muster.
 *  - `+html.tsx`: Web-Dokument-Hülle von Expo Router, kein Screen.
 *  - `prayer.tsx`: reiner Re-Export des Gebetszeiten-Screens (4 Zeilen).
 *  - `onboarding.tsx`: Erstlauf-Ablauf mit eigenen Schritt-Knöpfen
 *    (Weiter/Zurück/Überspringen) statt einer Kopf-Affordanz.
 */
const EXEMPT = ['+html.tsx', 'prayer.tsx', 'onboarding.tsx'];

/**
 * Erlaubte Affordanzen. `ScreenHeader` ist der Regelfall; Vollbild-Lernformate
 * bringen ihren eigenen Schließen-Knopf über `LessonPlayer`/`QuizSession` mit;
 * Player-/Kamera-Screens setzen einen eigenen Knopf mit `a11y.back`-Label.
 */
const AFFORDANCE = [
  'ScreenHeader',
  'LessonPlayer',
  'QuizSession',
  "t('a11y.back')",
  "t('a11y.close')",
  "t('reels.back')",
];

function routeFiles(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...routeFiles(path.join(dir, entry.name), rel));
      continue;
    }
    if (!entry.name.endsWith('.tsx')) continue;
    if (entry.name.endsWith('.web.tsx')) continue; // Web hat den globalen Chip
    if (entry.name === '_layout.tsx') continue;
    out.push(rel);
  }
  return out;
}

const ROUTES = routeFiles(APP_DIR).sort();

describe('Navigations-Affordanzen der Routen (U1)', () => {
  it('findet die Routen überhaupt', () => {
    expect(ROUTES.length).toBeGreaterThan(50);
  });

  const needsBack = ROUTES.filter((r) => !TAB_ROOTS.includes(r) && !EXEMPT.includes(r));

  for (const route of needsBack) {
    it(`${route} hat eine sichtbare Zurück-/Schließen-Möglichkeit`, () => {
      const src = fs.readFileSync(path.join(APP_DIR, route), 'utf8');
      expect(AFFORDANCE.some((marker) => src.includes(marker))).toBe(true);
    });
  }
});

describe('Bottom-Sheets fangen den Screenreader-Fokus (U6)', () => {
  // Ohne `accessibilityViewIsModal` navigiert VoiceOver/TalkBack weiter durch
  // den Inhalt HINTER dem geöffneten Sheet. Der Audit fand 11 solche Sheets;
  // der Test deckt neben `app/` auch die Sheet-Komponenten mit ab.
  const SEARCH_DIRS = ['app', 'components', 'features'];

  function tsxFiles(dir: string, prefix: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) out.push(...tsxFiles(path.join(dir, entry.name), rel));
      else if (entry.name.endsWith('.tsx')) out.push(rel);
    }
    return out;
  }

  const withModal = SEARCH_DIRS.flatMap((d) => tsxFiles(path.join(__dirname, '..', d), d))
    .filter((rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').includes('<Modal'))
    .sort();

  it('findet die Sheets überhaupt', () => {
    expect(withModal.length).toBeGreaterThanOrEqual(11);
  });

  for (const rel of withModal) {
    it(`${rel} setzt accessibilityViewIsModal auf jedem Modal`, () => {
      const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
      const modals = (src.match(/<Modal[\s>]/g) ?? []).length;
      const flags = (src.match(/accessibilityViewIsModal/g) ?? []).length;
      expect(flags).toBeGreaterThanOrEqual(modals);
    });
  }
});

describe('ScreenHeader steht über der ScrollView (U2)', () => {
  for (const route of ROUTES) {
    const src = fs.readFileSync(path.join(APP_DIR, route), 'utf8');
    if (!src.includes('<ScreenHeader')) continue;

    it(`${route} rendert den Kopf nicht innerhalb eines Scroll-Containers`, () => {
      for (const match of src.matchAll(/<ScreenHeader/g)) {
        const before = src.slice(0, match.index);
        // Das vorangestellte Nicht-Wortzeichen schließt Typ-Argumente wie
        // `useRef<ScrollView>(null)` aus — die sind keine Elemente.
        const opened = (before.match(/(^|[^A-Za-z0-9_])<(ScrollView|KeyboardAwareScrollView|FlatList)[\s>]/g) ?? []).length;
        const closed = (before.match(/<\/(ScrollView|KeyboardAwareScrollView|FlatList)>/g) ?? []).length;
        expect(opened - closed).toBe(0);
      }
    });
  }
});
