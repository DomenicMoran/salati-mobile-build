/**
 * Struktur-Test über ALLE Routen unter src/app.
 *
 * Hintergrund (Audit 2026-07-27/28): Der Root-Stack und alle 12 verschachtelten
 * Layouts setzen `headerShown: false`, und der schwebende Zurück-Chip
 * (`GlobalBackButton`) ist ausdrücklich Web-only (`Platform.OS !== 'web'` →
 * null). Auf nativ hat ein Screen deshalb GENAU DANN einen sichtbaren Ausgang,
 * wenn er selbst einen rendert — über `ScreenHeader`, einen eigenen
 * Zurück-Chevron (`a11y.back` / `backOr`) oder einen Schließen-Button.
 *
 * Der Audit fand 13 Frühzweige (Lade-, Fehler- und Nicht-gefunden-Zustände), in
 * denen genau das fehlte: ein Deep-Link auf eine unbekannte Kurs-/Guide-/
 * Themen-Id landete auf nativ bei einem einzelnen Wort „Fehler" ohne jede
 * Möglichkeit zurück. `app/reels/index.tsx` macht es vorbildlich richtig und
 * rendert seinen `BackButton` in JEDEM Zustand.
 *
 * Dieser Test hält die Regel maschinenprüfbar fest: Wenn eine Routen-Datei
 * überhaupt eine Zurück-Affordanz kennt, muss sie sie in JEDEM ihrer
 * Früh-Returns rendern. Ein statischer Test ist hier bewusst gewählt — er
 * deckt alle 95 Routen ab, während Render-Tests je Screen den gesamten
 * Router-/Query-/Settings-Kontext bräuchten.
 *
 * Der Test liegt bewusst NICHT unter `src/app/`: expo-router zieht dort per
 * `require.context` JEDE `.ts`/`.tsx`-Datei als Route in das Bundle (s.
 * node_modules/expo-router/_ctx.android.js — die Match-Regex nimmt nur
 * `+api`/`+html`/`+middleware` aus). Eine Testdatei dort wuerde also als Route
 * `/routen-ausgaenge.test` ausgeliefert und ihr `fs`-Import den Metro-Build
 * sprengen. Der letzte Testfall unten haelt genau diese Regel fest.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const APP_DIR = join(__dirname, '..', 'app');

/**
 * Marker, die einen sichtbaren Ausgang bedeuten:
 *  - `ScreenHeader`               gemeinsamer Kopf mit Chevron bzw. „Fertig"
 *  - `a11y.back` / `a11y.close`   eigener beschrifteter Zurück-/Schließen-Knopf
 *  - `backOr(` / `router.back`    Navigations-Aufruf eines eigenen Knopfs
 *  - `BackButton` / `backButton(` lokale Zurück-Komponenten (reels, tv-connect)
 *  - `LessonPlayer` / `QuizSession` bringen ihr eigenes ✕ mit
 */
const EXIT_MARKERS = [
  'ScreenHeader',
  'a11y.back',
  'a11y.close',
  'backOr(',
  'router.back',
  'BackButton',
  'backButton(',
  'LessonPlayer',
  'QuizSession',
];

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...routeFiles(full));
      continue;
    }
    if (!entry.endsWith('.tsx')) continue;
    if (entry.startsWith('_') || entry.startsWith('+')) continue; // Layouts/HTML-Shell
    out.push(full);
  }
  return out;
}

const ALL_ROUTES = routeFiles(APP_DIR);

/** Datei ohne Wagenruecklauf lesen: unter Windows liegen die Quellen mit CRLF
 *  vor, die Block-Erkennung unten arbeitet aber mit Zeilenumbruch-Ankern. */
function read(file: string): string {
  return readFileSync(file, 'utf8').replace(/\r/g, '');
}

/** Index nach der zu `src[start]` ('(') gehörenden schließenden Klammer. */
function endOfParens(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return i + 1;
  }
  return src.length;
}

/**
 * Körper der Default-Export-Komponente (die eigentliche Route). Hilfs-
 * Komponenten weiter unten in derselben Datei — z. B. `CameraPane` im
 * Halal-Scanner oder die Download-Knöpfe im Podcast-Screen — rendern
 * bewusst nur einen Ausschnitt und brauchen keinen eigenen Ausgang.
 */
function defaultExportBody(src: string): string | null {
  const m = /export default function \w+\([^)]*\)[^{]*\{/s.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end > 0 ? end : src.length);
}

/** Alle `if (…) { return ( … ) }`-Frühzweige der Route mit Zeilennummer. */
function earlyReturnBlocks(src: string): { line: number; block: string; cond: string }[] {
  const body = defaultExportBody(src);
  if (!body) return [];
  const offset = src.indexOf(body);
  const out: { line: number; block: string; cond: string }[] = [];
  const re = /\n {2,4}if \(([^\n]*)\)\s*\{?\s*\n?\s*return \(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const open = body.indexOf('return (', m.index) + 'return '.length;
    out.push({
      line: src.slice(0, offset + m.index).split('\n').length + 1,
      block: body.slice(open, endOfParens(body, open)),
      cond: m[1].trim(),
    });
  }
  return out;
}

function hasExit(text: string): boolean {
  return EXIT_MARKERS.some((k) => text.includes(k));
}

describe('Routen-Ausgänge', () => {
  it('findet die Routen-Dateien überhaupt', () => {
    expect(ALL_ROUTES.length).toBeGreaterThan(80);
  });

  it('kein Frühzweig einer Route mit Zurück-Affordanz rendert ihn weg', () => {
    const verstoesse: string[] = [];
    for (const file of ALL_ROUTES) {
      const src = read(file);
      // Screens ohne jede Zurück-Affordanz sind Tab-Screens bzw. Web-Stubs und
      // werden vom Tab-Balken/Web-Chip abgedeckt — s. eigener Test unten.
      if (!hasExit(src)) continue;
      for (const { line, block, cond } of earlyReturnBlocks(src)) {
        if (!hasExit(block)) {
          verstoesse.push(`${file.replace(APP_DIR, 'src/app')}:${line} — if (${cond})`);
        }
      }
    }
    expect(verstoesse).toEqual([]);
  });

  // Zweite Hälfte derselben Regel: Routen, die GAR KEINE Zurück-Affordanz
  // rendern, dürfen nur Tab-Screens oder Web-Varianten sein (dort übernimmt der
  // Tab-Balken bzw. der GlobalBackButton-Chip). Neue Stack-Routen ohne Ausgang
  // fallen damit sofort auf.
  it('nur Tab-Screens und Web-Varianten kommen ohne eigene Zurück-Affordanz aus', () => {
    const ohneAusgang = ALL_ROUTES.filter((f) => !hasExit(read(f))).map((f) =>
      f.replace(APP_DIR, '').replace(/\\/g, '/'),
    );
    const erlaubt = (p: string) =>
      p.startsWith('/(tabs)/') || // Tab-Balken ist der Ausgang
      p.endsWith('.web.tsx') || // Web: schwebender GlobalBackButton-Chip
      p === '/prayer.tsx'; // reiner Re-Export des Gebetszeiten-Tabs
    expect(ohneAusgang.filter((p) => !erlaubt(p))).toEqual([]);
  });
});

describe('Testdateien gehoeren nicht in den Router-Baum', () => {
  // expo-router registriert jede .ts/.tsx-Datei unter src/app als Route
  // (require.context, s. Kopfkommentar). Eine Testdatei dort landet im
  // ausgelieferten Bundle — mit `fs`-Import zerlegt sie sogar den Metro-Build.
  it('unter src/app liegt keine Testdatei', () => {
    const tests = routeFilesRaw(APP_DIR).filter((f) => /\.(test|spec)\.[tj]sx?$/.test(f));
    expect(tests).toEqual([]);
  });
});

describe('Layouts', () => {
  // Wenn ein Layout künftig `headerShown` einschaltet, wäre die Regel oben zu
  // streng — dann muss dieser Test bewusst angepasst werden. Er dokumentiert
  // also die Voraussetzung der Regel.
  it('alle Stack-Layouts setzen headerShown: false (Voraussetzung der Regel oben)', () => {
    const layouts = routeFilesRaw(APP_DIR).filter((f) => f.endsWith('_layout.tsx'));
    const mitStack = layouts.filter((f) => read(f).includes('<Stack'));
    expect(mitStack.length).toBeGreaterThan(10);
    for (const f of mitStack) {
      expect(read(f)).toContain('headerShown: false');
    }
  });
});

function routeFilesRaw(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFilesRaw(full));
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}
