import {
  appendPoint,
  initialWriteState,
  isDrawableStroke,
  lastPoint,
  parseWriting,
  startStroke,
  WRITE_CANVAS,
  writeReducer,
  type WriteState,
} from './writing';

describe('Punkt-Sampling (startStroke/appendPoint)', () => {
  it('startet einen Strich mit gerundetem Punkt', () => {
    expect(startStroke(10.123, 20.987)).toBe('10.1,21');
  });

  it('klemmt Punkte in die Canvas-Fläche', () => {
    expect(startStroke(-15, 9999)).toBe(`0,${WRITE_CANVAS}`);
    expect(appendPoint('10,10', -5, WRITE_CANVAS + 50)).toBe(`10,10 0,${WRITE_CANVAS}`);
  });

  it('verwirft Punkte unterhalb des Mindestabstands', () => {
    const stroke = appendPoint('10,10', 11, 10); // Distanz 1 < 2
    expect(stroke).toBe('10,10');
  });

  it('übernimmt Punkte ab dem Mindestabstand', () => {
    expect(appendPoint('10,10', 12, 10)).toBe('10,10 12,10');
    expect(appendPoint('10,10 12,10', 12, 14.5)).toBe('10,10 12,10 12,14.5');
  });

  it('beginnt bei leerem Strich neu', () => {
    expect(appendPoint('', 5, 5)).toBe('5,5');
  });

  it('lastPoint liest den letzten Punkt, auch bei nur einem Punkt', () => {
    expect(lastPoint('10,10 20,30.5')).toEqual({ x: 20, y: 30.5 });
    expect(lastPoint('7,8')).toEqual({ x: 7, y: 8 });
    expect(lastPoint('kaputt')).toBeNull();
  });

  it('isDrawableStroke: ein bloßer Tipp (1 Punkt) zählt nicht', () => {
    expect(isDrawableStroke('10,10')).toBe(false);
    expect(isDrawableStroke('10,10 12,12')).toBe(true);
  });
});

describe('Phasen-Maschine (writeReducer)', () => {
  it('kompletter Ablauf: zeichnen → vergleichen → weiter', () => {
    let s: WriteState = initialWriteState;
    s = writeReducer(s, { type: 'strokeEnd', stroke: '10,10 20,20' });
    expect(s).toEqual({ phase: 'draw', strokes: ['10,10 20,20'] });
    s = writeReducer(s, { type: 'compare' });
    expect(s.phase).toBe('compare');
    s = writeReducer(s, { type: 'next' });
    expect(s).toEqual(initialWriteState);
  });

  it('verwirft bloße Tipps (Ein-Punkt-Striche)', () => {
    const s = writeReducer(initialWriteState, { type: 'strokeEnd', stroke: '10,10' });
    expect(s.strokes).toHaveLength(0);
  });

  it('Vergleichen ohne Zeichnung bleibt in der Zeichen-Phase', () => {
    const s = writeReducer(initialWriteState, { type: 'compare' });
    expect(s.phase).toBe('draw');
  });

  it('in der Vergleichs-Phase werden keine Striche mehr angenommen', () => {
    let s: WriteState = { phase: 'compare', strokes: ['10,10 20,20'] };
    s = writeReducer(s, { type: 'strokeEnd', stroke: '30,30 40,40' });
    expect(s.strokes).toEqual(['10,10 20,20']);
  });

  it('clear setzt Striche und Phase zurück', () => {
    const s = writeReducer({ phase: 'compare', strokes: ['1,1 2,2'] }, { type: 'clear' });
    expect(s).toEqual({ phase: 'draw', strokes: [] });
  });
});

describe('parseWriting', () => {
  it('leerer/kaputter Speicher ergibt leeres Objekt', () => {
    expect(parseWriting(null)).toEqual({});
    expect(parseWriting('kein json')).toEqual({});
    expect(parseWriting('"string"')).toEqual({});
  });

  it('gültiger Fortschritt wird übernommen', () => {
    expect(parseWriting('{"ba":3}')).toEqual({ ba: 3 });
  });

  it('Array statt Objekt ergibt leeres Objekt (typeof [] === "object" reicht nicht)', () => {
    expect(parseWriting('[]')).toEqual({});
    expect(parseWriting('null')).toEqual({});
  });
});
