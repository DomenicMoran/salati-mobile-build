// Pure Logik fürs Schreibtraining (/learn/write): Punkt-Sampling der
// Zeichen-Striche und die Phasen-Maschine Zeichnen → Vergleichen → Weiter
// (Gedächtnis-Test: Vorlage erst beim Vergleichen sichtbar).

export const WRITE_CANVAS = 280;

/** Mindestabstand (px) zwischen zwei gesampelten Punkten eines Strichs. */
export const MIN_POINT_DIST = 2;

export type WritingProgress = Record<string, number>; // letterId -> Anzahl "getroffen"

export function parseWriting(raw: string | null): WritingProgress {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as WritingProgress) : {};
  } catch {
    return {};
  }
}

// In die Canvas-Fläche klemmen + auf 1 Nachkommastelle runden (kurze Strings).
function clampCoord(value: number, size: number): number {
  return Math.min(size, Math.max(0, Math.round(value * 10) / 10));
}

/** Beginnt einen Strich mit dem ersten Punkt (SVG-Polyline-Format "x,y"). */
export function startStroke(x: number, y: number, size = WRITE_CANVAS): string {
  return `${clampCoord(x, size)},${clampCoord(y, size)}`;
}

/**
 * Hängt einen Punkt an den Strich an. Punkte, die näher als minDist am
 * letzten Punkt liegen, werden verworfen (glättet und begrenzt die Größe).
 */
export function appendPoint(
  stroke: string,
  x: number,
  y: number,
  size = WRITE_CANVAS,
  minDist = MIN_POINT_DIST,
): string {
  if (!stroke) return startStroke(x, y, size);
  const cx = clampCoord(x, size);
  const cy = clampCoord(y, size);
  const last = lastPoint(stroke);
  if (last) {
    const dx = cx - last.x;
    const dy = cy - last.y;
    if (dx * dx + dy * dy < minDist * minDist) return stroke;
  }
  return `${stroke} ${cx},${cy}`;
}

/** Letzter Punkt eines Strichs (oder null bei leerem/kaputtem String). */
export function lastPoint(stroke: string): { x: number; y: number } | null {
  const idx = stroke.lastIndexOf(' ');
  const pair = idx === -1 ? stroke : stroke.slice(idx + 1);
  const [xs, ys] = pair.split(',');
  const x = Number(xs);
  const y = Number(ys);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/** Ein echter Strich braucht mindestens 2 Punkte — ein bloßer Tipp zählt nicht. */
export function isDrawableStroke(stroke: string): boolean {
  return stroke.includes(' ');
}

// --- Phasen-Maschine: 'draw' (Vorlage aus, zeichnen) → 'compare' (Vorlage
// halbtransparent über der Zeichnung) → 'next'/'clear' (Reset).

export type WritePhase = 'draw' | 'compare';

export interface WriteState {
  phase: WritePhase;
  strokes: string[];
}

export type WriteAction =
  | { type: 'strokeEnd'; stroke: string }
  | { type: 'compare' }
  | { type: 'clear' }
  | { type: 'next' };

export const initialWriteState: WriteState = { phase: 'draw', strokes: [] };

export function writeReducer(state: WriteState, action: WriteAction): WriteState {
  switch (action.type) {
    case 'strokeEnd':
      // Striche zählen nur in der Zeichen-Phase; bloße Tipps werden verworfen.
      if (state.phase !== 'draw' || !isDrawableStroke(action.stroke)) return state;
      return { ...state, strokes: [...state.strokes, action.stroke] };
    case 'compare':
      // Vergleichen erst, wenn tatsächlich etwas gezeichnet wurde.
      if (state.phase !== 'draw' || state.strokes.length === 0) return state;
      return { ...state, phase: 'compare' };
    case 'clear':
    case 'next':
      return { phase: 'draw', strokes: [] };
  }
}
