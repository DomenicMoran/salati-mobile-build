import { DHIKR_PRESETS, increment, parseTasbihState, resetCount, todayKey } from './counter';

const subhanallah = DHIKR_PRESETS[0]; // target 33

describe('tasbih counter', () => {
  it('zählt hoch und rollt am Ziel auf 0 über (Runde komplett)', () => {
    let state = parseTasbihState(null, '2026-07-12');
    for (let i = 0; i < 32; i++) state = increment(state, subhanallah);
    expect(state.counts.subhanallah).toBe(32);
    state = increment(state, subhanallah);
    expect(state.counts.subhanallah).toBe(0); // Runde voll → neue Runde
    expect(state.todayTotal).toBe(33);
  });

  it('reset setzt nur den Preset-Zähler zurück, nicht die Tagessumme', () => {
    let state = parseTasbihState(null, '2026-07-12');
    state = increment(state, subhanallah);
    state = increment(state, subhanallah);
    state = resetCount(state, subhanallah.id);
    expect(state.counts.subhanallah).toBe(0);
    expect(state.todayTotal).toBe(2);
  });

  it('neuer Tag setzt alles zurück', () => {
    const yesterday = JSON.stringify({ day: '2026-07-11', counts: { subhanallah: 20 }, todayTotal: 99 });
    expect(parseTasbihState(yesterday, '2026-07-12')).toEqual({
      day: '2026-07-12',
      counts: {},
      todayTotal: 0,
    });
  });

  it('gleicher Tag lädt gespeicherten Stand', () => {
    const saved = JSON.stringify({ day: '2026-07-12', counts: { istighfar: 42 }, todayTotal: 42 });
    expect(parseTasbihState(saved, '2026-07-12').counts.istighfar).toBe(42);
  });

  it('todayKey formatiert YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 6, 12))).toBe('2026-07-12');
  });

  it('kaputtes JSON fällt auf leeren Zustand zurück', () => {
    expect(parseTasbihState('{nope', '2026-07-12').todayTotal).toBe(0);
  });
});
