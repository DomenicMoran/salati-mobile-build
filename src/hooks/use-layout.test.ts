/**
 * Regressionsschutz für den Befund vom 30.07.2026: Auf salati.pro war das
 * gesamte Tablet-Layout wirkungslos. Ein Fenster von 1026 px bekam beim ersten
 * Laden `contentWidth: 800` und `tablet: false` — also das Telefon-Layout —
 * und schaltete erst nach einem Fenster-Resize um.
 *
 * Ursache war `useWindowDimensions()`: sein Wert liegt in `useState`, und beim
 * statischen Web-Export (`output: 'static'`) wird ohne Fenster vorgerendert;
 * die Hydration übernimmt den vorgerenderten Zustand, ohne ihn nachzuziehen.
 * Seitdem liest `useLayout` die Größe über `useSyncExternalStore` mit eigenem
 * Server-Schnappschuss.
 *
 * Der Hook selbst lässt sich ohne Renderer schlecht prüfen, deshalb steht hier
 * die reine Klassifizierung — plus die Zusicherung, dass der Hook nicht wieder
 * auf `useWindowDimensions` zurückfällt.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { classify, LayoutBreakpoints, padToColumns, splitSequential, WideContentWidth } from './use-layout';

describe('Fensterklassen', () => {
  it('ordnet die Referenzbreiten der erwarteten Klasse zu', () => {
    expect(classify(390)).toBe('compact'); // Telefon hoch
    expect(classify(599)).toBe('compact');
    expect(classify(600)).toBe('medium'); // 7-Zoll-Tablet hoch
    expect(classify(800)).toBe('medium'); // Pixel Tablet, 1600x2560 bei Dichte 320
    expect(classify(840)).toBe('expanded');
    expect(classify(1024)).toBe('expanded'); // iPad hoch
    expect(classify(1200)).toBe('large');
  });

  it('haelt die Schwellen an den Material-3-Fensterklassen', () => {
    expect(LayoutBreakpoints).toEqual({ medium: 600, expanded: 840, large: 1200 });
  });
});

describe('use-layout liest die Fenstergroesse hydrationsfest', () => {
  const quelle = readFileSync(path.join(__dirname, 'use-layout.ts'), 'utf8');

  it('nutzt useSyncExternalStore statt useWindowDimensions', () => {
    // useWindowDimensions haelt seinen Wert in useState — beim statischen
    // Export wird der nach der Hydration nie nachgezogen, und das Tablet-Layout
    // bleibt auf der Website wirkungslos.
    expect(quelle).toContain('useSyncExternalStore');
    // Nur Aufruf und Import sind verboten — im Kommentar darueber steht der
    // Name absichtlich, er erklaert den Befund.
    const ohneKommentare = quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(ohneKommentare).not.toMatch(/useWindowDimensions/);
  });

  it('liefert einen Server-Schnappschuss, der auf die schmale Klasse faellt', () => {
    // Ohne getServerSnapshot wirft React beim statischen Export; und der Wert
    // muss `compact` ergeben, damit das vorgerenderte HTML ohne JavaScript
    // sinnvoll aussieht.
    expect(quelle).toMatch(/fensterServerSchnappschuss[\s\S]*?return '0x0'/);
    expect(classify(0)).toBe('compact');
  });
});

describe('Rasterhilfen', () => {
  it('fuellt die letzte Rasterzeile auf, damit sie nicht ueber die Breite laeuft', () => {
    expect(padToColumns([1, 2, 3], 2)).toEqual([1, 2, 3, null]);
    expect(padToColumns([1, 2, 3, 4], 2)).toEqual([1, 2, 3, 4]);
    expect(padToColumns([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });

  it('teilt Bloecke reihenfolgetreu auf Spalten auf', () => {
    const bloecke = [{ n: 4 }, { n: 4 }, { n: 4 }, { n: 4 }];
    const [links, rechts] = splitSequential(bloecke, 2, (b) => b.n);
    expect(links.concat(rechts)).toEqual(bloecke); // Reihenfolge bleibt
    expect(links.length).toBeGreaterThan(0);
    expect(rechts.length).toBeGreaterThan(0);
  });

  it('laesst keine Spalte leer, auch wenn ein Block alles Gewicht traegt', () => {
    const bloecke = [{ n: 100 }, { n: 1 }];
    const spalten = splitSequential(bloecke, 2, (b) => b.n);
    expect(spalten.every((s) => s.length > 0)).toBe(true);
  });

  it('deckelt sehr breite Fenster statt weiter zu dehnen', () => {
    expect(WideContentWidth).toBeLessThan(1600);
  });
});
