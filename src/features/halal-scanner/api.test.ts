import { pickIngredientsText, type OpenFoodFactsProduct } from './api';

describe('pickIngredientsText', () => {
  it('prefers the preferred locale field when present', () => {
    const product: OpenFoodFactsProduct = {
      ingredients_text_de: 'Zucker, Mehl',
      ingredients_text_en: 'Sugar, flour',
    };
    expect(pickIngredientsText(product, 'de')).toEqual({ text: 'Zucker, Mehl', lang: 'de' });
  });

  it('falls back through the remaining app locales when the preferred one is missing', () => {
    const product: OpenFoodFactsProduct = {
      ingredients_text_fr: 'Sucre, farine',
    };
    expect(pickIngredientsText(product, 'de')).toEqual({ text: 'Sucre, farine', lang: 'fr' });
  });

  it('falls back to the generic ingredients_text field marked as unknown language', () => {
    const product: OpenFoodFactsProduct = {
      ingredients_text: 'Zucker, Mehl',
    };
    expect(pickIngredientsText(product, 'de')).toEqual({ text: 'Zucker, Mehl', lang: 'unknown' });
  });

  it('returns null when no ingredients field is present at all', () => {
    expect(pickIngredientsText({}, 'de')).toBeNull();
  });

  it('ignores blank/whitespace-only fields and keeps looking', () => {
    const product: OpenFoodFactsProduct = {
      ingredients_text_de: '   ',
      ingredients_text_en: 'Sugar, flour',
    };
    expect(pickIngredientsText(product, 'de')).toEqual({ text: 'Sugar, flour', lang: 'en' });
  });
});
