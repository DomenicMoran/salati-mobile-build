import { calcZakatFitr } from './fitr';

describe('calcZakatFitr', () => {
  it('meldet amountMissing, wenn kein Betrag pro Person eingegeben wurde', () => {
    // Kein Betrag -> total wäre sonst 0 und würde fälschlich "keine Zakat
    // al-Fitr fällig" statt "nicht berechenbar" suggerieren (gleiches Muster
    // wie priceMissing in calc.ts, Audit 2026-07-20).
    const result = calcZakatFitr({ householdSize: 4, amountPerPerson: 0 });
    expect(result.amountMissing).toBe(true);
    expect(result.total).toBe(0);
  });

  it('multipliziert Haushaltsgröße mit dem Betrag pro Person', () => {
    const result = calcZakatFitr({ householdSize: 4, amountPerPerson: 10 });
    expect(result.amountMissing).toBe(false);
    expect(result.total).toBe(40);
  });

  it('behandelt 0 Personen als 0 Gesamtbetrag (kein amountMissing)', () => {
    const result = calcZakatFitr({ householdSize: 0, amountPerPerson: 10 });
    expect(result.amountMissing).toBe(false);
    expect(result.householdSize).toBe(0);
    expect(result.total).toBe(0);
  });

  it('lässt negative Haushaltsgröße nicht negativ werden', () => {
    const result = calcZakatFitr({ householdSize: -3, amountPerPerson: 10 });
    expect(result.householdSize).toBe(0);
    expect(result.total).toBe(0);
  });

  it('lässt negativen Betrag pro Person nicht negativ werden', () => {
    const result = calcZakatFitr({ householdSize: 4, amountPerPerson: -5 });
    expect(result.amountPerPerson).toBe(0);
    expect(result.amountMissing).toBe(true);
    expect(result.total).toBe(0);
  });

  it('rundet eine gebrochene Haushaltsgröße nach unten ab', () => {
    const result = calcZakatFitr({ householdSize: 4.9, amountPerPerson: 10 });
    expect(result.householdSize).toBe(4);
    expect(result.total).toBe(40);
  });

  it('fängt NaN/Infinity defensiv als 0 ab', () => {
    const result = calcZakatFitr({ householdSize: NaN, amountPerPerson: Infinity });
    expect(result.householdSize).toBe(0);
    expect(result.amountPerPerson).toBe(0);
    expect(result.amountMissing).toBe(true);
    expect(result.total).toBe(0);
  });
});
