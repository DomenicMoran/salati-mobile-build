import {
  ReciteProgress,
  overlappingWindows,
  promptWindow,
  splitExpectedWords,
  windowedReveal,
} from './reciteProgress';

// Bewusst eindeutige Wörter (keine Wiederholungen), damit das Alignment im Test
// deterministisch pro Wort-Index greift.
const EXPECTED = 'الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين';
const WORDS = splitExpectedWords(EXPECTED);

// Text mit einem WIEDERHOLTEN Wort weit auseinander — Grundlage für den Kern-
// Bug 2026-07-22 („ein Wort aus Vers 1 wird beim Vers 7 als Treffer gewertet"):
// الله kommt an Index 2 UND an Index 8 vor.
const REPEAT = 'الف باء الله تاء ثاء جيم حاء خاء الله دال';
const REPEAT_WORDS = splitExpectedWords(REPEAT);

describe('promptWindow', () => {
  it('liefert am Anfang die ersten lookAhead-Wörter (kein negativer Start)', () => {
    expect(promptWindow(WORDS, 0, { lookBehind: 2, lookAhead: 3 })).toBe('الحمد لله رب');
  });

  it('wandert mit der Front mit und nimmt lookBehind-Kontext mit', () => {
    // Fenster [4-2, 4+3) = Index 2,3,4,5,6
    expect(promptWindow(WORDS, 4, { lookBehind: 2, lookAhead: 3 })).toBe(
      'رب العالمين الرحمن الرحيم مالك',
    );
  });

  it('klemmt am Ende (kein Überlauf über die Sure hinaus)', () => {
    expect(promptWindow(WORDS, WORDS.length, { lookBehind: 2, lookAhead: 5 })).toBe('يوم الدين');
  });
});

describe('windowedReveal — Positions-gekoppeltes Aufdecken', () => {
  const cfg = { lookBehind: 1, lookAhead: 3 };

  it('deckt Treffer mit GLOBALEM Index auf und rückt die Front nach dem letzten hit', () => {
    // Front 0, Fenster [0,3): الف باء الله
    const { reveals, frontier } = windowedReveal('الف باء الله', REPEAT_WORDS, 0, cfg);
    expect(reveals).toEqual([
      { index: 0, status: 'hit' },
      { index: 1, status: 'hit' },
      { index: 2, status: 'hit' },
    ]);
    expect(frontier).toBe(3);
  });

  it('KERN-FIX: ein Wort trifft NUR nahe der Front, nie ein gleichlautendes weit entferntes', () => {
    // Front 0, Fenster [0,3) enthält الله NUR an Index 2 — das zweite الله an
    // Index 8 liegt AUSSERHALB des Fensters und darf nicht aufgedeckt werden.
    const { reveals } = windowedReveal('الله', REPEAT_WORDS, 0, cfg);
    expect(reveals).toEqual([{ index: 2, status: 'hit' }]);
    expect(reveals.some((r) => r.index === 8)).toBe(false);
  });

  it('deckt das späte الله NUR auf, wenn die Front tatsächlich dort steht', () => {
    // Front 8, Fenster [7,11) → Index 7,8,9. Jetzt trifft الله Index 8, nicht 2.
    const { reveals } = windowedReveal('الله', REPEAT_WORDS, 8, cfg);
    expect(reveals).toEqual([{ index: 8, status: 'hit' }]);
  });

  it('near AN der Front rückt die Front mit (systematisches „fast" blockiert nicht mehr)', () => {
    const NEAR = splitExpectedWords('بسم الله خلق العالمين'); // Index 0..3
    // حلق statt خلق (ح↔خ, near). Front 2, Fenster [1,4) → Index 1,2,3. Der near
    // liegt GENAU an der Front → die Front zieht bis dahinter (Index 3), damit
    // ein durchweg „fast" erkannter Rezitierender nicht hängen bleibt.
    const { reveals, frontier } = windowedReveal('حلق', NEAR, 2, { lookBehind: 1, lookAhead: 2 });
    expect(reveals).toEqual([{ index: 2, status: 'near' }]);
    expect(frontier).toBe(3);
  });

  it('near-KETTE ab der Front rückt über alle fast-Treffer vor', () => {
    // Zwei aufeinanderfolgende „fast"-Wörter direkt an der Front → Front bis
    // hinter beide. حلق≈خلق, العلمين≈العالمين.
    const NEAR = splitExpectedWords('بسم الله خلق العالمين رب'); // Index 0..4
    const { reveals, frontier } = windowedReveal('حلق العلمين', NEAR, 2, { lookBehind: 1, lookAhead: 4 });
    expect(reveals.map((r) => r.status)).toEqual(['near', 'near']);
    expect(reveals.map((r) => r.index)).toEqual([2, 3]);
    expect(frontier).toBe(4);
  });

  it('ISOLIERTER near (nicht an der Front) rückt die Front NICHT vor', () => {
    // „الرحي" wird als „fast" einem der الرحـ-Wörter zugeordnet (hier Index 4),
    // die Front steht bei 0 und das Wort an der Front (الحمد) fehlt → die Front
    // bleibt bei 0 (kein verfrühtes Überspringen der ungesprochenen Wörter 1..3).
    const { reveals, frontier } = windowedReveal('الرحي', WORDS, 0);
    expect(reveals).toEqual([{ index: 4, status: 'near' }]);
    expect(frontier).toBe(0);
  });

  it('ist monoton — ein späteres Fenster ohne frühe Wörter senkt die Front nicht', () => {
    const { frontier } = windowedReveal('الف باء', REPEAT_WORDS, 5, cfg);
    expect(frontier).toBe(5);
  });

  it('ignoriert leere/nicht-arabische Teil-Transkripte', () => {
    expect(windowedReveal('', REPEAT_WORDS, 3, cfg)).toEqual({ reveals: [], frontier: 3 });
    expect(windowedReveal('...123', REPEAT_WORDS, 3, cfg)).toEqual({ reveals: [], frontier: 3 });
  });

  it('gibt bei leerem Fenster (lookBehind 0 am Ende) keine Treffer', () => {
    expect(
      windowedReveal('دال', REPEAT_WORDS, REPEAT_WORDS.length, { lookBehind: 0, lookAhead: 3 }),
    ).toEqual({ reveals: [], frontier: REPEAT_WORDS.length });
  });
});

describe('overlappingWindows — finale Voll-Auswertung', () => {
  it('liefert genau EIN Fenster, wenn die Aufnahme kürzer als das Fenster ist', () => {
    expect(overlappingWindows(1000, 4000, 2000)).toEqual([{ start: 0, end: 1000 }]);
  });

  it('deckt bei exakter Fensterlänge alles in einem Fenster ab', () => {
    expect(overlappingWindows(4000, 4000, 2000)).toEqual([{ start: 0, end: 4000 }]);
  });

  it('zerlegt eine lange Aufnahme in überlappende Fenster bis exakt ans Ende', () => {
    // 10000 Samples, Fenster 4000, hop 2000 → 0,2000,4000,6000; das Fenster bei
    // 6000 endet bei 10000 (== total) und beendet die Kette.
    expect(overlappingWindows(10000, 4000, 2000)).toEqual([
      { start: 0, end: 4000 },
      { start: 2000, end: 6000 },
      { start: 4000, end: 8000 },
      { start: 6000, end: 10000 },
    ]);
  });

  it('das letzte Fenster endet IMMER exakt bei totalSamples (nichts fällt hinten weg)', () => {
    const wins = overlappingWindows(9500, 4000, 2000);
    expect(wins[wins.length - 1].end).toBe(9500);
  });

  it('aufeinanderfolgende Fenster überlappen (keine Wort-Lücke an der Grenze)', () => {
    const wins = overlappingWindows(20000, 4000, 2000);
    for (let i = 1; i < wins.length; i++) {
      expect(wins[i].start).toBeLessThan(wins[i - 1].end);
    }
  });

  it('deckt lückenlos ab: jede Position liegt in mindestens einem Fenster', () => {
    const total = 15000;
    const wins = overlappingWindows(total, 4000, 2000);
    for (let pos = 0; pos < total; pos += 500) {
      expect(wins.some((w) => pos >= w.start && pos < w.end)).toBe(true);
    }
  });

  it('robust gegen Rand-Eingaben (leer / degenerierte Größen)', () => {
    expect(overlappingWindows(0, 4000, 2000)).toEqual([]);
    expect(overlappingWindows(1000, 0, 2000)).toEqual([]);
    // hop <= 0 wird auf 1 geklemmt → terminiert trotzdem (kein Endlos-Loop).
    expect(overlappingWindows(3000, 4000, 0)).toEqual([{ start: 0, end: 3000 }]);
  });
});

describe('ReciteProgress', () => {
  const match = { lookBehind: 1, lookAhead: 3 };
  const prompt = { lookBehind: 2, lookAhead: 4 };

  it('startet mit dem Prompt am Sure-Anfang (weites Prompt-Fenster)', () => {
    const rp = new ReciteProgress(EXPECTED, match, prompt);
    expect(rp.position).toBe(0);
    expect(rp.prompt()).toBe('الحمد لله رب العالمين');
  });

  it('ingest deckt positions-gekoppelt auf und schiebt Position + Prompt vor', () => {
    const rp = new ReciteProgress(EXPECTED, match, prompt);
    const reveals = rp.ingest('الحمد لله رب');
    expect(reveals).toEqual([
      { index: 0, status: 'hit' },
      { index: 1, status: 'hit' },
      { index: 2, status: 'hit' },
    ]);
    expect(rp.position).toBe(3);
    // Prompt-Fenster [3-2, 3+4) = Index 1..6
    expect(rp.prompt()).toBe('لله رب العالمين الرحمن الرحيم مالك');
  });

  it('rückt über mehrere ingest-Aufrufe weiter vor, während erkannt wird', () => {
    const rp = new ReciteProgress(EXPECTED, match, prompt);
    rp.ingest('الحمد لله رب'); // Position 3
    rp.ingest('العالمين الرحمن'); // Index 3,4 → Position 5
    expect(rp.position).toBe(5);
  });

  it('springt NIE auf den Anfang zurück, wenn ein späteres Fenster frühe Wörter verliert', () => {
    const rp = new ReciteProgress(EXPECTED, match, prompt);
    rp.ingest('الحمد لله رب العالمين الرحمن الرحيم'); // weit vorgerückt
    const posBefore = rp.position;
    rp.ingest('الحمد لله'); // rollendes Fenster fällt an den Anfang zurück
    expect(rp.position).toBe(posBefore);
  });

  it('update() ist ein dünner Wrapper um ingest() und liefert die Position', () => {
    const rp = new ReciteProgress(EXPECTED, match, prompt);
    expect(rp.update('الحمد لله رب')).toBe(3);
  });

  it('FINAL-SWEEP: eine FRISCHE Front deckt beim Durchlauf von vorne die ganze Sure auf', () => {
    // Robustheits-Fix ganze Sure: nach dem Live-Lauf steht die Front irgendwo
    // mittendrin. Der Final-Sweep läuft von vorne durchs Audio — mit einer
    // FRISCHEN Front (bei 0). Sequenz überlappender Block-Transkripte (wie die
    // finalen Fenster) → am Ende ist jeder Vers aufgedeckt, inkl. der frühen.
    const fresh = new ReciteProgress(EXPECTED); // Default-Fenster (lookAhead 18)
    const revealed = new Set<number>();
    for (const block of [
      'الحمد لله رب العالمين',
      'العالمين الرحمن الرحيم مالك',
      'مالك يوم الدين',
    ]) {
      for (const r of fresh.ingest(block)) revealed.add(r.index);
    }
    // Alle 9 Wort-Indizes der Sure sind aufgedeckt.
    expect([...revealed].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('FINAL-SWEEP: eine weit voraus stehende (Live-)Front deckt frühe Verse NICHT mehr auf', () => {
    // Begründung, warum der Final-Sweep eine frische Front braucht: steht die
    // Front schon am Ende (Live-Lauf), findet ein Block mit FRÜHEM Audio seine
    // Wörter nicht mehr (Match-Fenster liegt fern der frühen Stelle).
    const stale = new ReciteProgress(EXPECTED);
    stale.update('الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين'); // Front ans Ende
    const reveals = stale.ingest('الحمد لله رب'); // frühes Audio erneut
    // Die tatsächlich gesprochenen frühen Wörter (Index 0,1,2) werden NICHT
    // aufgedeckt — das Match-Fenster der End-Front liegt fern (Index 5..8).
    expect(reveals.some((r) => r.index <= 2)).toBe(false);
  });

  it('deckt bei wiederholtem Wort nicht die falsche (spätere) Stelle auf', () => {
    // Simuliert die ganze „Sure" REPEAT: Front steht bei 0, es wird das erste
    // الله (Index 2) rezitiert — das zweite (Index 8) bleibt verdeckt.
    const rp = new ReciteProgress(REPEAT, match, prompt);
    const reveals = rp.ingest('الف باء الله تاء');
    const indices = reveals.filter((r) => r.status === 'hit').map((r) => r.index);
    expect(indices).toContain(2);
    expect(indices).not.toContain(8);
  });
});
