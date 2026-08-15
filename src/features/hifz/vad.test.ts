import {
  ABS_MIN_RMS,
  computeFrameEnergies,
  createEnergyVadGate,
  detectSpeechBounds,
  estimateNoiseFloor,
  frameRms,
  speechThreshold,
  trimSilenceAdaptive,
} from './vad';

const SR = 16000;

/** Baut ein Float32-Signal: Stille + Sprach-Region (konstante Amplitude) + Stille. */
function withSpeech(
  totalSec: number,
  speechFromSec: number,
  speechToSec: number,
  amp: number,
  noise = 0,
): Float32Array {
  const pcm = new Float32Array(Math.floor(totalSec * SR));
  for (let i = 0; i < pcm.length; i++) pcm[i] = noise ? (i % 2 ? noise : -noise) : 0;
  const from = Math.floor(speechFromSec * SR);
  const to = Math.floor(speechToSec * SR);
  // Alternierend ±amp → RMS == amp (deterministisch prüfbar).
  for (let i = from; i < to; i++) pcm[i] = i % 2 ? amp : -amp;
  return pcm;
}

/** Int16-Chunk konstanter Amplitude (RMS == amp/0x8000). */
function chunk16(amp: number, samples: number): Int16Array {
  const c = new Int16Array(samples);
  for (let i = 0; i < samples; i++) c[i] = i % 2 ? amp : -amp;
  return c;
}

describe('frameRms', () => {
  it('liefert 0 für leeren Abschnitt', () => {
    expect(frameRms(new Float32Array(0), 0, 10)).toBe(0);
    expect(frameRms(new Float32Array([0.5]), 2, 1)).toBe(0);
  });

  it('RMS konstanter Amplitude == Amplitude', () => {
    const pcm = new Float32Array([0.3, -0.3, 0.3, -0.3]);
    expect(frameRms(pcm, 0, 4)).toBeCloseTo(0.3, 6);
  });

  it('klemmt das Ende an die Puffer-Länge', () => {
    const pcm = new Float32Array([0.2, -0.2]);
    expect(frameRms(pcm, 0, 999)).toBeCloseTo(0.2, 6);
  });
});

describe('computeFrameEnergies', () => {
  it('zerlegt in Rahmen und liefert je Rahmen den RMS', () => {
    const pcm = new Float32Array([0.5, 0.5, 0, 0]);
    const e = computeFrameEnergies(pcm, 2);
    expect(Array.from(e)).toHaveLength(2);
    expect(e[0]).toBeCloseTo(0.5, 6);
    expect(e[1]).toBe(0);
  });

  it('robust gegen degenerierte Eingaben', () => {
    expect(computeFrameEnergies(new Float32Array(0), 480).length).toBe(0);
    expect(computeFrameEnergies(new Float32Array([1]), 0).length).toBe(0);
  });
});

describe('estimateNoiseFloor', () => {
  it('schätzt aus überwiegend leisen Rahmen die niedrige Untergrenze (Sprache stört nicht)', () => {
    // Viele leise Rahmen (~0.002), wenige laute Sprach-Rahmen (0.5).
    const e = new Float32Array([0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.5, 0.5, 0.5]);
    expect(estimateNoiseFloor(e)).toBeCloseTo(0.002, 6);
  });

  it('leere Eingabe → 0', () => {
    expect(estimateNoiseFloor(new Float32Array(0))).toBe(0);
  });
});

describe('speechThreshold', () => {
  it('nutzt die absolute Untergrenze bei ruhigem Hintergrund', () => {
    expect(speechThreshold(0.001)).toBe(ABS_MIN_RMS); // 0.001*2 < 0.01
  });

  it('hebt die Schwelle über lautes Rauschen', () => {
    expect(speechThreshold(0.05)).toBeCloseTo(0.1, 6); // 0.05*2
  });
});

describe('detectSpeechBounds', () => {
  it('findet die Sprach-Region in Stille (mit Kontext-Polster)', () => {
    // 3 s: Sprache 1..2 s bei Amplitude 0.5, ringsum Stille.
    const pcm = withSpeech(3, 1, 2, 0.5);
    const b = detectSpeechBounds(pcm, { sampleRate: SR });
    expect(b).not.toBeNull();
    // Start etwa bei 1 s minus 200 ms Polster, Ende etwa 2 s plus 200 ms.
    expect(b!.start).toBeGreaterThanOrEqual(Math.floor(0.75 * SR));
    expect(b!.start).toBeLessThanOrEqual(SR);
    expect(b!.end).toBeGreaterThanOrEqual(2 * SR);
    expect(b!.end).toBeLessThanOrEqual(Math.ceil(2.3 * SR));
  });

  it('adaptive Schwelle: leises Dauerrauschen zählt NICHT als Sprache', () => {
    // Durchgehendes leises Rauschen (0.02) + echte Sprache (0.5) in der Mitte.
    // Fester 0.01-Schwellwert würde das ganze Signal als „Sprache" sehen; die
    // adaptive Schwelle (Rausch-Floor 0.02 → Schwelle 0.04) trimmt das Rauschen.
    const pcm = withSpeech(3, 1, 2, 0.5, 0.02);
    const b = detectSpeechBounds(pcm, { sampleRate: SR });
    expect(b).not.toBeNull();
    expect(b!.start).toBeGreaterThanOrEqual(Math.floor(0.7 * SR));
    expect(b!.end).toBeLessThanOrEqual(Math.ceil(2.3 * SR));
  });

  it('leise, aber saubere Quelle in Stille wird weiter erkannt (keine Regression)', () => {
    // Amplitude 0.03 > ABS_MIN_RMS 0.01, ruhiger Hintergrund → muss erkannt werden.
    const pcm = withSpeech(2, 0.5, 1.2, 0.03);
    const b = detectSpeechBounds(pcm, { sampleRate: SR });
    expect(b).not.toBeNull();
  });

  it('Mindest-Sprachdauer: ein einzelner kurzer Klick zählt NICHT als Sprache', () => {
    // Nur 60 ms lauter Impuls (< MIN_SPEECH_MS 200 ms) in Stille.
    const pcm = withSpeech(2, 1.0, 1.06, 0.8);
    expect(detectSpeechBounds(pcm, { sampleRate: SR })).toBeNull();
  });

  it('reine Stille → null (Aufrufer behält Originalsignal)', () => {
    expect(detectSpeechBounds(new Float32Array(SR), { sampleRate: SR })).toBeNull();
  });

  it('behält innenliegende kurze Pause (trimmt nur führende/folgende Stille)', () => {
    // Sprache 0.5..1.0 s, Pause, Sprache 1.5..2.0 s in 3 s Gesamt.
    const pcm = new Float32Array(3 * SR);
    for (let i = Math.floor(0.5 * SR); i < Math.floor(1.0 * SR); i++) pcm[i] = i % 2 ? 0.5 : -0.5;
    for (let i = Math.floor(1.5 * SR); i < Math.floor(2.0 * SR); i++) pcm[i] = i % 2 ? 0.5 : -0.5;
    const b = detectSpeechBounds(pcm, { sampleRate: SR })!;
    // Region umspannt beide Sprach-Blöcke inkl. der Pause dazwischen.
    expect(b.start).toBeLessThanOrEqual(Math.floor(0.5 * SR));
    expect(b.end).toBeGreaterThanOrEqual(Math.floor(2.0 * SR));
  });
});

describe('trimSilenceAdaptive', () => {
  it('schneidet führende/folgende Stille ab', () => {
    const pcm = withSpeech(3, 1, 2, 0.5);
    const out = trimSilenceAdaptive(pcm, { sampleRate: SR });
    expect(out.length).toBeLessThan(pcm.length);
    // ~1 s Sprache + 2×200 ms Polster.
    expect(out.length).toBeGreaterThanOrEqual(SR);
    expect(out.length).toBeLessThanOrEqual(Math.ceil(1.5 * SR));
  });

  it('gibt bei reiner Stille das UNVERÄNDERTE Signal zurück (nie leer)', () => {
    const pcm = new Float32Array(SR);
    expect(trimSilenceAdaptive(pcm, { sampleRate: SR })).toBe(pcm);
    expect(trimSilenceAdaptive(pcm, { sampleRate: SR }).length).toBe(SR);
  });
});

describe('createEnergyVadGate', () => {
  const FRAME = Math.floor((SR * 30) / 1000); // 480 Samples = 30 ms

  it('bestätigt Sprache erst nach der Mindestdauer (Anti-Klick)', () => {
    const gate = createEnergyVadGate({ sampleRate: SR });
    // Ein einzelner 30-ms-Chunk (< 200 ms) → voiced, aber noch nicht bestätigt.
    const first = gate.push(chunk16(16000, FRAME));
    expect(first.voiced).toBe(true);
    expect(first.speechConfirmed).toBe(false);
    // Weitere laute Chunks bis > 200 ms → bestätigt.
    let confirmed = false;
    for (let i = 0; i < 8; i++) confirmed = gate.push(chunk16(16000, FRAME)).speechConfirmed;
    expect(confirmed).toBe(true);
  });

  it('unterbrechende Stille setzt den Sprach-Lauf zurück (Klick bleibt Klick)', () => {
    const gate = createEnergyVadGate({ sampleRate: SR });
    gate.push(chunk16(16000, FRAME)); // 1 lauter Chunk
    const afterSilence = gate.push(chunk16(0, FRAME)); // Stille dazwischen
    expect(afterSilence.voiced).toBe(false);
    expect(afterSilence.speechConfirmed).toBe(false);
  });

  it('leise, saubere Quelle in Stille gilt als voiced (keine Regression)', () => {
    const gate = createEnergyVadGate({ sampleRate: SR });
    // Amplitude ~0.03 (0x8000*0.03 ≈ 983) > ABS_MIN_RMS bei ruhigem Floor.
    const res = gate.push(chunk16(983, FRAME));
    expect(res.voiced).toBe(true);
  });

  it('lautes Dauerrauschen hebt die Schwelle → leises Signal zählt NICHT mehr als voiced', () => {
    const gate = createEnergyVadGate({ sampleRate: SR });
    // Viele leise (nicht-voiced, weil unter Schwelle) Chunks heben den Floor.
    // Rauschen 0.008 (< 0.01 Schwelle) → nicht voiced, aber Floor steigt Richtung 0.008.
    for (let i = 0; i < 40; i++) gate.push(chunk16(Math.round(0x8000 * 0.008), FRAME));
    expect(gate.noiseFloor()).toBeGreaterThan(0.004);
    // Ein Signal knapp über der alten festen Schwelle (0.011), aber unter
    // floor*2 (~0.016) darf jetzt NICHT mehr als voiced zählen.
    const res = gate.push(chunk16(Math.round(0x8000 * 0.011), FRAME));
    expect(res.voiced).toBe(false);
  });

  it('reine Stille ist nie voiced', () => {
    const gate = createEnergyVadGate({ sampleRate: SR });
    expect(gate.push(chunk16(0, FRAME)).voiced).toBe(false);
    expect(gate.push(new Int16Array(0)).voiced).toBe(false);
  });
});
