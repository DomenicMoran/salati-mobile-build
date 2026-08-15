import { DEFAULT_METHOD_ID } from '@/features/settings/methods';

import {
  WELTWEITE_METHODE,
  methodDiffersFromCountry,
  recommendMethod,
  recommendedMethod,
  zugeordneteLaender,
} from './method-country';

describe('Methoden-Vorschlag nach Land', () => {
  it('schlägt für die Länder ihre eigene Behörde vor', () => {
    const erwartet: Record<string, number> = {
      TR: 13, // Diyanet
      DE: 13, // DITIB/Diyanet-Kalender
      FR: 12, // UOIF
      PT: 22, // Comunidade Islâmica de Lisboa
      US: 2, // ISNA
      SA: 4, // Umm al-Qura
      EG: 5, // Egyptian General Authority
      PK: 1, // Karachi
      MA: 21, // Habous
      DZ: 19,
      TN: 18,
      ID: 20, // Kemenag
      MY: 17, // JAKIM
      SG: 11, // MUIS
      JO: 23,
      IR: 7, // Teheran
      AE: 16, // Dubai
      KW: 9,
      QA: 10,
      RU: 14,
      GB: 3, // Muslim World League
    };
    for (const [land, id] of Object.entries(erwartet)) {
      expect(recommendMethod(land)).toEqual({ methodId: id, basis: 'country' });
    }
  });

  it('ist unabhängig von Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(recommendMethod(' de ').methodId).toBe(13);
    expect(recommendMethod('tr').methodId).toBe(13);
  });

  it('nimmt für Länder ohne Zuordnung die Muslim World League', () => {
    // NG (Nigeria) hat im Katalog keine eigene Behörde — der weltweite
    // Standard ist die ehrlichere Antwort als die Voreinstellung.
    expect(recommendMethod('NG')).toEqual({ methodId: WELTWEITE_METHODE, basis: 'worldwide' });
  });

  it('fällt ohne Land auf die App-Voreinstellung zurück', () => {
    expect(recommendMethod(undefined)).toEqual({ methodId: DEFAULT_METHOD_ID, basis: 'default' });
    expect(recommendMethod('')).toEqual({ methodId: DEFAULT_METHOD_ID, basis: 'default' });
    expect(recommendMethod(null)).toEqual({ methodId: DEFAULT_METHOD_ID, basis: 'default' });
  });

  it('liefert zu jedem zugeordneten Land einen Katalog-Eintrag', () => {
    const ohne = zugeordneteLaender().filter((land) => !recommendedMethod(land));
    expect(ohne).toEqual([]);
  });

  it('meldet eine Abweichung nur, wenn das Land eine eigene Behörde hat', () => {
    expect(methodDiffersFromCountry(3, 'TR')).toBe(true);
    expect(methodDiffersFromCountry(13, 'TR')).toBe(false);
    // Nigeria ohne Zuordnung: kein Hinweis, sonst würde die App jedem Reisenden
    // ohne Grund eine Umstellung vorschlagen.
    expect(methodDiffersFromCountry(13, 'NG')).toBe(false);
    expect(methodDiffersFromCountry(13, undefined)).toBe(false);
  });
});
