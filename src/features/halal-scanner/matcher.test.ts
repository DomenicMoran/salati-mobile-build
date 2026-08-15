import { classifyIngredients, tokenize } from './matcher';

describe('tokenize', () => {
  it('splits on non-letter/number characters and lowercases', () => {
    expect(tokenize('Milch, Zucker (E471)')).toEqual(['milch', 'zucker', 'e471']);
  });

  it('keeps Unicode letters (German umlauts, Turkish, Arabic) as part of words', () => {
    expect(tokenize('Schweineschmalz')).toEqual(['schweineschmalz']);
    expect(tokenize('şarap sirkesi')).toEqual(['şarap', 'sirkesi']);
    expect(tokenize('جيلاتين خنزير')).toEqual(['جيلاتين', 'خنزير']);
  });

  it('splits E-numbers written with a space into two tokens', () => {
    expect(tokenize('E 471')).toEqual(['e', '471']);
  });
});

describe('classifyIngredients', () => {
  it('returns unknown when no ingredients text is available', () => {
    expect(classifyIngredients(null)).toEqual({ status: 'unknown', matches: [], halalCertified: false });
    expect(classifyIngredients(undefined)).toEqual({ status: 'unknown', matches: [], halalCertified: false });
    expect(classifyIngredients('   ')).toEqual({ status: 'unknown', matches: [], halalCertified: false });
  });

  it('returns halal for a purely plant-based ingredient list with no flagged keywords', () => {
    const result = classifyIngredients('Weizenmehl, Zucker, Sonnenblumenöl, Salz');
    expect(result.status).toBe('halal');
    expect(result.matches).toEqual([]);
  });

  it('does not false-positive on "porcini" mushrooms against the pork keyword', () => {
    const result = classifyIngredients('Porcini mushrooms, olive oil, salt');
    expect(result.status).toBe('halal');
    expect(result.matches).toEqual([]);
  });

  it('does not false-positive on "label" against the rennet keyword "lab"-like roots', () => {
    const result = classifyIngredients('Printed under private label, sugar, water');
    expect(result.status).toBe('halal');
  });

  it('flags pork explicitly mentioned as haram', () => {
    const result = classifyIngredients('Wheat flour, pork gelatin, salt');
    expect(result.status).toBe('haram');
    expect(result.matches.some((m) => m.categoryId === 'pork')).toBe(true);
  });

  it('flags German pork compound words (Schweineschmalz) as haram', () => {
    const result = classifyIngredients('Zucker, Schweineschmalz, Salz');
    expect(result.status).toBe('haram');
    expect(result.matches.some((m) => m.categoryId === 'pork')).toBe(true);
  });

  it('flags alcohol/wine mentions as haram', () => {
    const result = classifyIngredients('Zucker, Aroma, Wein, Wasser');
    expect(result.status).toBe('haram');
    expect(result.matches.some((m) => m.categoryId === 'alcohol')).toBe(true);
  });

  it('flags gelatin without stated origin as mashbooh', () => {
    const result = classifyIngredients('Zucker, Gelatine, Zitronensäure');
    expect(result.status).toBe('mashbooh');
    expect(result.matches.some((m) => m.categoryId === 'gelatinUnknownOrigin')).toBe(true);
  });

  it('flags carmine (E120) as mashbooh', () => {
    const result = classifyIngredients('Sugar, Carmine (E120), citric acid');
    expect(result.status).toBe('mashbooh');
    expect(result.matches.some((m) => m.categoryId === 'carmine')).toBe(true);
  });

  it('flags mono-/diglycerides (E471) written with a space as mashbooh', () => {
    const result = classifyIngredients('Wheat flour, emulsifier E 471, salt');
    expect(result.status).toBe('mashbooh');
    expect(result.matches.some((m) => m.categoryId === 'monoDiglycerides')).toBe(true);
  });

  it('lets an explicit haram match (pork) override a mashbooh match (gelatin)', () => {
    const result = classifyIngredients('Zucker, Schweinegelatine, Wasser');
    expect(result.status).toBe('haram');
  });

  it('treats an explicit halal-certification marker as halal even with a mashbooh keyword present', () => {
    const result = classifyIngredients('Sugar, gelatin (halal certified), water');
    expect(result.status).toBe('halal');
    expect(result.halalCertified).toBe(true);
  });

  it('does not let a halal-certification marker override an explicit haram match', () => {
    const result = classifyIngredients('Sugar, pork gelatin, halal certified emulsifier');
    expect(result.status).toBe('haram');
  });

  it('flags vanilla extract as mashbooh (alcohol solvent, debated)', () => {
    const result = classifyIngredients('Sugar, vanilla extract, flour');
    expect(result.status).toBe('mashbooh');
    expect(result.matches.some((m) => m.categoryId === 'vanillaExtractAlcohol')).toBe(true);
  });

  it('does not flag vinegar as alcohol (fully converted to acetic acid, majority view halal)', () => {
    const result = classifyIngredients('Water, wine vinegar, salt');
    expect(result.status).toBe('halal');
  });
});
