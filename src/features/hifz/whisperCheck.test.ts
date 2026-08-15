import { trimSilence } from './whisperCheck.web';

describe('trimSilence', () => {
  const sr = 16000;

  it('schneidet führende und folgende Stille ab (mit 200ms Kontext)', () => {
    const pcm = new Float32Array(sr * 3); // 3s Stille
    pcm.fill(0.5, sr, sr * 2); // 1s Signal in der Mitte
    const out = trimSilence(pcm, 0.01, sr);
    // 1s Signal + je 200ms Kontext davor/danach
    expect(out.length).toBeGreaterThanOrEqual(sr);
    expect(out.length).toBeLessThanOrEqual(sr * 1.5);
    expect(Math.abs(out[Math.floor(out.length / 2)])).toBeGreaterThan(0.01);
  });

  it('lässt reine Stille unverändert (kein Leer-Array)', () => {
    const pcm = new Float32Array(sr);
    expect(trimSilence(pcm, 0.01, sr).length).toBe(sr);
  });

  it('lässt Audio ohne Stille praktisch unverändert', () => {
    const pcm = new Float32Array(sr);
    pcm.fill(0.4);
    expect(trimSilence(pcm, 0.01, sr).length).toBe(sr);
  });
});
