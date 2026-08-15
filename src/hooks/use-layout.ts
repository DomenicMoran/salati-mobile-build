/**
 * Fensterklassen für Breitbild-Geräte (Tablet, aufgeklapptes Foldable, Web).
 *
 * Befund 2026-07-29 (`docs/STORE-BILDER-2026-07-29.md` §7.3): die App streckt
 * ihr Telefon-Layout auf Tabletbreite. Auf 1600×2560 (10 Zoll, 800 dp) endete
 * der Inhalt der Startseite bei rund 48 % der Höhe, „Lernen" bei 45 % — der
 * Rest war leerer Grund. Ursache war nicht fehlender Inhalt, sondern eine
 * einzige Regel: `maxWidth: MaxContentWidth` (800) zentriert eine
 * Telefon-Spalte und lässt daneben bzw. darunter alles frei.
 *
 * Dieses Modul legt die Schwellen EINMAL fest, damit nicht jeder Screen seine
 * eigene Zahl erfindet (vorher: `width >= 900` in prayer-times-screen.tsx,
 * sonst nichts). Die Schwellen folgen den Material-3-Fensterklassen, mit einer
 * Zusatzstufe für sehr breite Fenster:
 *
 *   compact   < 600 dp   Telefon hoch — eine Spalte, unverändert
 *   medium    600–839    7-Zoll-Tablet hoch, Telefon quer
 *   expanded  840–1199    10-Zoll-Tablet hoch (800 dp fällt NICHT hierunter)
 *   large     ≥ 1200      iPad-Klasse quer, Desktop-Web
 *
 * Wichtig für die Praxis: das 10-Zoll-Referenzgerät (Pixel Tablet, 1600×2560
 * bei Dichte 320) misst 800 dp und liegt damit in `medium`. Alle Regeln, die
 * auf Tablets greifen sollen, hängen deshalb an `tablet` (≥ 600 dp) und nicht
 * an `expanded`.
 *
 * Leistung: nur `useWindowDimensions()` — kein Context, kein Listener, kein
 * Re-Render über den ohnehin vorhandenen Dimensions-Abo hinaus.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { Dimensions } from 'react-native';

import { MaxContentWidth } from '@/constants/theme';

export const LayoutBreakpoints = {
  medium: 600,
  expanded: 840,
  large: 1200,
} as const;

export type WindowClass = 'compact' | 'medium' | 'expanded' | 'large';

/** Maximale Breite einer Fließtext-Spalte (Koran-Leser, Rechtstexte, Kurse).
 *  Bewusst enger als die Fensterbreite: 70–90 Zeichen je Zeile bleiben lesbar,
 *  eine 1200-dp-Zeile nicht. */
export const ReadingWidth = 760;

/** Maximale Breite eines mehrspaltigen Rasters. Über dieser Marke wird der
 *  Inhalt zentriert statt weiter gedehnt. */
export const WideContentWidth = 1180;

export type LayoutInfo = {
  width: number;
  height: number;
  windowClass: WindowClass;
  /** ≥ 600 dp — ab hier gelten die Breitbild-Regeln. */
  tablet: boolean;
  landscape: boolean;
  /** Spalten für gruppierte Listen-Sektionen (Einstellungen, „Mehr"). */
  sectionColumns: number;
  /** Spalten für Karten-/Kachelraster (Suren, Duas, Namen, Kurse). */
  gridColumns: number;
  /** Obergrenze der Inhaltsbreite dieses Screens. */
  contentWidth: number;
};

export function classify(width: number): WindowClass {
  if (width >= LayoutBreakpoints.large) return 'large';
  if (width >= LayoutBreakpoints.expanded) return 'expanded';
  if (width >= LayoutBreakpoints.medium) return 'medium';
  return 'compact';
}

/**
 * Fenstergröße als externer Speicher statt über `useWindowDimensions()`.
 *
 * Warum: `useWindowDimensions()` hält seinen Wert in `useState`. Beim
 * statischen Web-Export (`output: 'static'`) wird die Seite ohne Fenster
 * vorgerendert — die Hydration übernimmt den vorgerenderten Zustand und der
 * `useState`-Wert wird nie nachgezogen. Auf salati.pro hieß das: ein Fenster
 * von 1026 px bekam dauerhaft `contentWidth: 800` und `tablet: false`, also
 * das Telefon-Layout. Nachgemessen am 30.07.2026 — erst ein Fenster-Resize
 * löste ein Dimensions-Ereignis aus und schaltete das Layout um. Damit war das
 * gesamte Tablet-Layout auf der Website wirkungslos, obwohl es nativ
 * funktioniert.
 *
 * `useSyncExternalStore` mit eigenem Server-Schnappschuss ist genau dafür
 * gedacht: React rendert nach der Hydration mit dem echten Client-Wert neu.
 * Der Schnappschuss ist eine Zeichenkette, weil `Dimensions.get()` bei jedem
 * Aufruf ein neues Objekt liefert — React vergliche das per Identität und
 * geriete in eine Endlosschleife.
 *
 * Der Server-Wert ist bewusst `0x0` (→ `compact`): so bleibt das vorgerenderte
 * HTML das schmale Layout, das auch ohne JavaScript sinnvoll aussieht.
 */
function abonniereFenster(onChange: () => void): () => void {
  const abo = Dimensions.addEventListener('change', onChange);
  return () => abo.remove();
}

function fensterSchnappschuss(): string {
  const { width, height } = Dimensions.get('window');
  return `${width}x${height}`;
}

function fensterServerSchnappschuss(): string {
  return '0x0';
}

export function useLayout(): LayoutInfo {
  const schnappschuss = useSyncExternalStore(abonniereFenster, fensterSchnappschuss, fensterServerSchnappschuss);
  const [width, height] = schnappschuss.split('x').map(Number);
  return useMemo(() => {
    const windowClass = classify(width);
    const tablet = windowClass !== 'compact';
    return {
      width,
      height,
      windowClass,
      tablet,
      landscape: width > height,
      // 7 Zoll hoch (600 dp) bleibt einspaltig: zwei Sektionsspalten wären dort
      // je 290 dp breit, und eine Einstellungszeile „Label … Wert" bricht
      // darunter um. Ab 720 dp trägt die Breite zwei Spalten.
      sectionColumns: width >= 720 ? 2 : 1,
      gridColumns: width >= 1000 ? 3 : tablet ? 2 : 1,
      contentWidth: tablet ? Math.min(width, WideContentWidth) : MaxContentWidth,
    };
  }, [width, height]);
}

/**
 * Füllt eine Liste auf ein Vielfaches der Spaltenzahl auf, damit die letzte
 * Zeile eines Rasters nicht über die ganze Breite läuft (FlatList verteilt
 * `flex: 1`-Zellen sonst auf die Restbreite). Die Füllwerte sind `null` und
 * werden von den Screens als unsichtbare Zelle gerendert.
 */
export function padToColumns<T>(data: readonly T[], columns: number): (T | null)[] {
  if (columns <= 1) return data as T[];
  const rest = data.length % columns;
  if (rest === 0) return data as T[];
  return [...data, ...(Array(columns - rest).fill(null) as null[])];
}

/**
 * Fertige FlatList-Requisiten für ein Raster, damit nicht jeder Screen
 * `numColumns`, den erzwungenen Neuaufbau-Key, den Spaltenabstand und die
 * Zellbreite einzeln erfindet.
 *
 * `listKey` ist Pflicht: React Native wirft „Changing numColumns on the fly is
 * not supported", wenn sich die Spaltenzahl ohne Key-Wechsel ändert — genau
 * das passiert beim Drehen eines Tablets.
 */
export function useGrid() {
  const { gridColumns, contentWidth, tablet } = useLayout();
  return useMemo(
    () => ({
      columns: gridColumns,
      tablet,
      contentWidth,
      numColumns: gridColumns,
      listKey: `spalten-${gridColumns}`,
      columnWrapperStyle: gridColumns > 1 ? ({ gap: 8 } as const) : undefined,
      /** Auf die Zelle legen, damit sich die Spalten die Breite teilen. */
      cellStyle: gridColumns > 1 ? ({ flex: 1, minWidth: 0 } as const) : undefined,
      pad: <T,>(data: readonly T[]) => padToColumns(data, gridColumns),
    }),
    [gridColumns, contentWidth, tablet],
  );
}

/**
 * Teilt eine Folge von Blöcken (Einstellungs-Gruppen, Sektionen des
 * „Mehr"-Tabs) REIHENFOLGETREU auf mehrere Spalten auf: die erste Spalte
 * bekommt so lange Blöcke, bis ihr Gewicht den Anteil erreicht, dann die
 * nächste. Bewusst kein Greedy-Ausgleich — der würde die Gruppen umsortieren,
 * und eine Einstellungsliste, deren Reihenfolge sich je Gerätebreite ändert,
 * ist schwerer wiederzufinden.
 */
export function splitSequential<T>(items: readonly T[], columns: number, weight: (item: T) => number): T[][] {
  if (columns <= 1) return [items as T[]];
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  const buckets: T[][] = Array.from({ length: columns }, () => []);
  let bucket = 0;
  let laufend = 0;
  for (const item of items) {
    // Zur nächsten Spalte, sobald die aktuelle ihren Anteil hat — aber nie so
    // früh, dass eine Spalte leer bliebe.
    const ziel = (total * (bucket + 1)) / columns;
    if (laufend >= ziel && bucket < columns - 1 && buckets[bucket].length > 0) bucket += 1;
    buckets[bucket].push(item);
    laufend += weight(item);
  }
  return buckets;
}
