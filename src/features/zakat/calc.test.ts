import {
  calcZakat,
  parseAmount,
  NISAB_GOLD_GRAMS,
  REFERENCE_GOLD_PRICE_PER_GRAM,
  ZAKAT_CURRENCIES,
  ZAKAT_RATE,
} from './calc';

describe('calcZakat', () => {
  it('meldet priceMissing, wenn kein Goldpreis eingegeben wurde (Audit 2026-07-20)', () => {
    // Kein Preis -> nisab wäre sonst 0 und "base >= 0" fälschlich immer wahr
    // ODER (mit der alten Logik) "nisab > 0" fälschlich immer falsch -> UI
    // zeigte irreführend "keine Zakat fällig" statt "nicht berechenbar".
    const result = calcZakat({
      cash: 1_000_000,
      goldValue: 0,
      silverValue: 0,
      businessAssets: 0,
      debts: 0,
      goldPricePerGram: 0,
    });
    expect(result.priceMissing).toBe(true);
    expect(result.aboveNisab).toBe(false);
    expect(result.due).toBe(0);
  });

  it('liegt knapp UNTER dem Nisab -> keine Zakat fällig', () => {
    const goldPricePerGram = 100;
    const nisab = NISAB_GOLD_GRAMS * goldPricePerGram; // 8500
    const result = calcZakat({
      cash: nisab - 1,
      goldValue: 0,
      silverValue: 0,
      businessAssets: 0,
      debts: 0,
      goldPricePerGram,
    });
    expect(result.priceMissing).toBe(false);
    expect(result.aboveNisab).toBe(false);
    expect(result.due).toBe(0);
  });

  it('liegt genau AUF dem Nisab -> Zakat fällig (>=, nicht >)', () => {
    const goldPricePerGram = 100;
    const nisab = NISAB_GOLD_GRAMS * goldPricePerGram;
    const result = calcZakat({
      cash: nisab,
      goldValue: 0,
      silverValue: 0,
      businessAssets: 0,
      debts: 0,
      goldPricePerGram,
    });
    expect(result.aboveNisab).toBe(true);
    expect(result.due).toBeCloseTo(nisab * ZAKAT_RATE);
  });

  it('liegt knapp ÜBER dem Nisab -> Zakat fällig, 2,5 % der Basis', () => {
    const goldPricePerGram = 100;
    const nisab = NISAB_GOLD_GRAMS * goldPricePerGram;
    const result = calcZakat({
      cash: nisab + 1,
      goldValue: 0,
      silverValue: 0,
      businessAssets: 0,
      debts: 0,
      goldPricePerGram,
    });
    expect(result.priceMissing).toBe(false);
    expect(result.aboveNisab).toBe(true);
    expect(result.due).toBeCloseTo((nisab + 1) * ZAKAT_RATE);
  });

  it('zieht Schulden von der Basis ab und lässt sie nicht negativ werden', () => {
    const result = calcZakat({
      cash: 500,
      goldValue: 0,
      silverValue: 0,
      businessAssets: 0,
      debts: 10_000,
      goldPricePerGram: 100,
    });
    expect(result.base).toBe(0);
    expect(result.aboveNisab).toBe(false);
  });

  it('summiert alle Vermögenswerte in die Basis', () => {
    const result = calcZakat({
      cash: 100,
      goldValue: 200,
      silverValue: 300,
      businessAssets: 400,
      debts: 50,
      goldPricePerGram: 100,
    });
    expect(result.base).toBe(950);
  });
});

describe('REFERENCE_GOLD_PRICE_PER_GRAM (Mehrwährungs-Erweiterung 2026-07-21)', () => {
  it('hat für jede ZAKAT_CURRENCIES-Währung einen positiven Referenzwert', () => {
    for (const currency of ZAKAT_CURRENCIES) {
      expect(REFERENCE_GOLD_PRICE_PER_GRAM[currency]).toBeGreaterThan(0);
    }
  });

  it('behält den bisherigen EUR-Referenzwert unverändert bei (keine Regression)', () => {
    expect(REFERENCE_GOLD_PRICE_PER_GRAM.EUR).toBe(115);
  });

  it('priceMissing/aboveNisab funktionieren identisch, unabhängig von der Währung des Preises', () => {
    // calcZakat ist bewusst währungsagnostisch - dieselbe Eingabe muss für
    // JEDE unterstützte Währung dasselbe Ergebnis liefern, solange goldValue/
    // goldPricePerGram konsistent in derselben Währung übergeben werden.
    for (const currency of ZAKAT_CURRENCIES) {
      const goldPricePerGram = REFERENCE_GOLD_PRICE_PER_GRAM[currency];
      const nisab = NISAB_GOLD_GRAMS * goldPricePerGram;
      const above = calcZakat({
        cash: nisab + 1,
        goldValue: 0,
        silverValue: 0,
        businessAssets: 0,
        debts: 0,
        goldPricePerGram,
      });
      expect(above.priceMissing).toBe(false);
      expect(above.aboveNisab).toBe(true);

      const missing = calcZakat({
        cash: nisab + 1,
        goldValue: 0,
        silverValue: 0,
        businessAssets: 0,
        debts: 0,
        goldPricePerGram: 0,
      });
      expect(missing.priceMissing).toBe(true);
      expect(missing.aboveNisab).toBe(false);
    }
  });
});

describe('parseAmount', () => {
  it('parst leeren String als 0', () => {
    expect(parseAmount('')).toBe(0);
  });

  it('parst deutsches Tausendertrennzeichen + Komma-Dezimalstelle', () => {
    expect(parseAmount('1.234,56')).toBeCloseTo(1234.56);
  });

  it('parst englisches Dezimalformat', () => {
    expect(parseAmount('1234.56')).toBeCloseTo(1234.56);
  });

  it('lässt negative/ungültige Eingaben auf 0 fallen', () => {
    expect(parseAmount('-50')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });
});
